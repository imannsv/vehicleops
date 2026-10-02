create table public.fleet_sites (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name)) between 1 and 120), address text not null default '' check(length(address)<=1000),
 revision integer not null default 1, unique(id,organization_id), unique(organization_id,name)
);
create index fleet_sites_org_idx on public.fleet_sites(organization_id);
create table public.parking_spaces (
 id uuid primary key, organization_id uuid not null, site_id uuid not null,
 label text not null check(length(trim(label)) between 1 and 80), revision integer not null default 1,
 unique(id,site_id,organization_id), unique(site_id,label),
 foreign key(site_id,organization_id) references public.fleet_sites(id,organization_id)
);
create index parking_spaces_site_idx on public.parking_spaces(site_id,organization_id);
create index parking_spaces_org_idx on public.parking_spaces(organization_id);
alter table public.vehicles add column site_id uuid;
alter table public.vehicles add column parking_space_id uuid;
alter table public.vehicles add constraint vehicle_site_fk foreign key(site_id,organization_id) references public.fleet_sites(id,organization_id);
alter table public.vehicles add constraint vehicle_space_fk foreign key(parking_space_id,site_id,organization_id) references public.parking_spaces(id,site_id,organization_id);
alter table public.vehicles add constraint vehicle_space_needs_site check(parking_space_id is null or site_id is not null);
create index vehicles_site_idx on public.vehicles(site_id,organization_id);
create index vehicles_space_fk_idx on public.vehicles(parking_space_id,site_id,organization_id);
create unique index vehicles_one_per_space on public.vehicles(parking_space_id) where parking_space_id is not null;
create table public.vehicle_movements (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null, organization_id uuid not null,
 from_location text not null, to_location text not null, from_site_id uuid, to_site_id uuid,
 from_space_id uuid, to_space_id uuid, reason text not null check(length(reason) between 1 and 1000),
 source text not null check(source in ('initial','manual','legacy','pickup','delivery')),
 actor_name text not null, created_at timestamptz not null default now(), handover_id uuid,
 foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id),
 foreign key(handover_id,organization_id) references public.handovers(id,organization_id)
);
-- Site/space IDs are historical references, while labels are immutable snapshots.
create index vehicle_movements_vehicle_idx on public.vehicle_movements(vehicle_id,organization_id);
create index vehicle_movements_handover_idx on public.vehicle_movements(handover_id,organization_id);
create index vehicle_movements_org_idx on public.vehicle_movements(organization_id);
alter table public.fleet_sites enable row level security;
alter table public.parking_spaces enable row level security;
alter table public.vehicle_movements enable row level security;
revoke all on public.fleet_sites,public.parking_spaces,public.vehicle_movements from public,anon,authenticated;
grant select on public.fleet_sites,public.parking_spaces,public.vehicle_movements to authenticated;
create policy site_read on public.fleet_sites for select to authenticated using(private.member_role(organization_id) is not null);
create policy space_read on public.parking_spaces for select to authenticated using(private.member_role(organization_id) is not null);
create policy movement_read on public.vehicle_movements for select to authenticated using(private.member_role(organization_id) is not null);

create function private.normalize_vehicle_position() returns trigger language plpgsql security definer set search_path='' as $$
declare site_name text;
begin
 if tg_op='UPDATE' and new.location is distinct from old.location and new.site_id is not distinct from old.site_id and new.parking_space_id is not distinct from old.parking_space_id and coalesce(current_setting('vehicleops.movement_source',true),'')<>'rename' then
  new.site_id:=null; new.parking_space_id:=null;
 end if;
 if new.site_id is not null then
  select name into site_name from public.fleet_sites where id=new.site_id and organization_id=new.organization_id;
  if not found then raise exception 'Standort gehört nicht zum Arbeitsbereich'; end if;
  new.location:=site_name;
 end if;
 return new;
end $$;
create trigger normalize_vehicle_position before insert or update of location,site_id,parking_space_id on public.vehicles for each row execute function private.normalize_vehicle_position();

create function private.record_vehicle_movement() returns trigger language plpgsql security definer set search_path='' as $$
declare origin text; target text; actor text; source text; reason text; handover uuid;
begin
 source:=coalesce(nullif(current_setting('vehicleops.movement_source',true),''),'legacy');
 if source='rename' then return new; end if;
 if source not in ('pickup','delivery') and tg_op='UPDATE' and new.location is not distinct from old.location and new.site_id is not distinct from old.site_id and new.parking_space_id is not distinct from old.parking_space_id then return new; end if;
 target:=new.location;
 if new.parking_space_id is not null then target:=target||' · '||(select label from public.parking_spaces where id=new.parking_space_id); end if;
 if tg_op='INSERT' then origin:='';source:='initial';else
  origin:=old.location;
  if old.parking_space_id is not null then origin:=origin||' · '||(select label from public.parking_spaces where id=old.parking_space_id); end if;
 end if;
 select name into actor from public.memberships where organization_id=new.organization_id and user_id=auth.uid();
 reason:=coalesce(nullif(current_setting('vehicleops.movement_reason',true),''),case when tg_op='INSERT' then 'Fahrzeug neu erfasst' else 'Standortangabe geändert' end);
 handover:=nullif(current_setting('vehicleops.movement_handover',true),'')::uuid;
 insert into public.vehicle_movements(vehicle_id,organization_id,from_location,to_location,from_site_id,to_site_id,from_space_id,to_space_id,reason,source,actor_name,handover_id)
 values(new.id,new.organization_id,origin,target,case when tg_op='UPDATE' then old.site_id end,new.site_id,case when tg_op='UPDATE' then old.parking_space_id end,new.parking_space_id,reason,source,coalesce(actor,'System'),handover);
 return new;
end $$;
create trigger record_vehicle_movement after insert or update of location,site_id,parking_space_id on public.vehicles for each row execute function private.record_vehicle_movement();
revoke all on function private.normalize_vehicle_position(),private.record_vehicle_movement() from public,anon,authenticated;

create function private.save_fleet_site(p_id uuid,p_org uuid,p_revision integer,p_name text,p_address text) returns void language plpgsql security definer set search_path='' as $$
declare site public.fleet_sites;
begin
 if auth.uid() is null or coalesce(private.member_role(p_org),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 perform 1 from public.organizations where id=p_org for update;
 if p_revision=0 then insert into public.fleet_sites(id,organization_id,name,address) values(p_id,p_org,trim(p_name),trim(coalesce(p_address,'')));
 else
  select * into site from public.fleet_sites where id=p_id and organization_id=p_org for update;
  if not found or site.revision is distinct from p_revision then raise exception 'Standort wurde inzwischen geändert. Bitte neu laden.'; end if;
  update public.fleet_sites set name=trim(p_name),address=trim(coalesce(p_address,'')),revision=revision+1 where id=p_id;
  if site.name is distinct from trim(p_name) then
   perform set_config('vehicleops.movement_source','rename',true);
   update public.vehicles set location=trim(p_name) where site_id=p_id and organization_id=p_org;
  end if;
 end if;
end $$;
create function public.save_fleet_site(p_id uuid,p_org uuid,p_revision integer,p_name text,p_address text) returns void language sql security invoker set search_path='' as $$ select private.save_fleet_site(p_id,p_org,p_revision,p_name,p_address) $$;

create function private.save_parking_space(p_id uuid,p_org uuid,p_site uuid,p_revision integer,p_label text) returns void language plpgsql security definer set search_path='' as $$
declare space public.parking_spaces;
begin
 if auth.uid() is null or coalesce(private.member_role(p_org),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 perform 1 from public.organizations where id=p_org for update;
 if not exists(select 1 from public.fleet_sites where id=p_site and organization_id=p_org) then raise exception 'Standort fehlt'; end if;
 if p_revision=0 then insert into public.parking_spaces(id,organization_id,site_id,label) values(p_id,p_org,p_site,trim(p_label));
 else
  select * into space from public.parking_spaces where id=p_id and organization_id=p_org for update;
  if not found or space.revision is distinct from p_revision or space.site_id<>p_site then raise exception 'Stellplatz wurde inzwischen geändert. Bitte neu laden.'; end if;
  update public.parking_spaces set label=trim(p_label),revision=revision+1 where id=p_id;
 end if;
end $$;
create function public.save_parking_space(p_id uuid,p_org uuid,p_site uuid,p_revision integer,p_label text) returns void language sql security invoker set search_path='' as $$ select private.save_parking_space(p_id,p_org,p_site,p_revision,p_label) $$;

create function private.move_vehicle(p_vehicle uuid,p_revision integer,p_site uuid,p_space uuid,p_location text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; target text;
begin
 select * into v from public.vehicles where id=p_vehicle for update;
 if not found or auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if v.revision is distinct from p_revision then raise exception 'Fahrzeug wurde inzwischen geändert. Bitte neu laden.'; end if;
 if exists(select 1 from public.orders where vehicle_id=v.id and organization_id=v.organization_id and status='in_transit') then raise exception 'Fahrzeug ist in Transport. Standort wird durch das Protokoll fortgeschrieben.'; end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Bitte einen Anlass für die Bewegung angeben'; end if;
 if p_site is null then
  if p_space is not null then raise exception 'Stellplatz benötigt einen Standort'; end if;
  target:=trim(p_location);
  if length(coalesce(target,'')) not between 1 and 240 then raise exception 'Bitte eine Standortangabe eingeben'; end if;
 else
  select name into target from public.fleet_sites where id=p_site and organization_id=v.organization_id;
  if not found then raise exception 'Standort gehört nicht zum Arbeitsbereich'; end if;
  if p_space is not null and not exists(select 1 from public.parking_spaces where id=p_space and site_id=p_site and organization_id=v.organization_id) then raise exception 'Stellplatz gehört nicht zum Standort'; end if;
 end if;
 if v.site_id is not distinct from p_site and v.parking_space_id is not distinct from p_space and v.location=target then raise exception 'Fahrzeug steht bereits an diesem Standort'; end if;
 perform set_config('vehicleops.movement_source','manual',true);
 perform set_config('vehicleops.movement_reason',trim(p_reason),true);
 update public.vehicles set site_id=p_site,parking_space_id=p_space,location=target where id=v.id;
 exception when unique_violation then raise exception 'Dieser Stellplatz ist bereits belegt';
end $$;
create function public.move_vehicle(p_vehicle uuid,p_revision integer,p_site uuid,p_space uuid,p_location text,p_reason text) returns void language sql security invoker set search_path='' as $$ select private.move_vehicle(p_vehicle,p_revision,p_site,p_space,p_location,p_reason) $$;
do $$declare f record;begin
 for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in ('save_fleet_site','save_parking_space','move_vehicle') loop
  execute format('revoke all on function %I.%I(%s) from public,anon',f.nspname,f.proname,f.args);
  execute format('grant execute on function %I.%I(%s) to authenticated',f.nspname,f.proname,f.args);
 end loop;
end $$;

-- Both legacy and current protocol endpoints release the occupied bay atomically.
create or replace function private.finalize_handover(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb,p_expected_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; v public.vehicles; r text; prefix text; photo jsonb; damage jsonb;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Auftrag fehlt'; end if;
 r := private.member_role(o.organization_id);
 if r is null or not (r in ('admin','dispatcher') or (r='driver' and exists(select 1 from public.drivers where id=o.driver_id and organization_id=o.organization_id and user_id=auth.uid()))) then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from o.revision then raise exception 'Dieser Auftrag wurde inzwischen geändert. Bitte neu laden und den Entwurf erneut prüfen.'; end if;
 if p_kind is null or p_kind not in ('pickup','delivery') then raise exception 'Ungültige Protokollart'; end if;
 if (p_kind='pickup' and o.status<>'assigned') or (p_kind='delivery' and o.status<>'in_transit') then raise exception 'Auftragsstatus erlaubt diesen Abschluss nicht'; end if;
 select * into v from public.vehicles where id=o.vehicle_id and organization_id=o.organization_id for update;
 if p_mileage is null or p_mileage < v.mileage then raise exception 'Kilometerstand darf nicht sinken'; end if;
 if p_fuel is null or p_fuel not between 0 and 100 or p_signer is null or length(trim(p_signer))=0 then raise exception 'Zustand oder Unterzeichner fehlt'; end if;
 if jsonb_typeof(p_photos) is distinct from 'array' or jsonb_array_length(p_photos)<10 then raise exception 'Zehn Pflichtperspektiven erforderlich'; end if;
 if (select count(distinct item->>'slot') from jsonb_array_elements(p_photos) item where item->>'slot' in ('Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho'))<>10 then raise exception 'Fotoperspektiven unvollständig'; end if;
 if exists(select 1 from jsonb_array_elements(p_photos) item where item->>'slot' is null or item->>'slot' not in ('Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho')) then raise exception 'Ungültige Fotoperspektive'; end if;
 if exists(select 1 from jsonb_array_elements(p_photos) item where item->>'slot'<>'Innenraum' group by item->>'slot' having count(*)>1) then raise exception 'Nur Innenraum darf mehrere Fotos enthalten'; end if;
 if jsonb_typeof(p_damages) is distinct from 'array' then raise exception 'Ungültige Schäden'; end if;
 prefix := o.organization_id::text||'/'||o.id::text||'/'||p_id::text||'/';
 if p_signature is null or p_signature<>prefix||'signature.png' or not exists(select 1 from storage.objects where bucket_id='evidence' and name=p_signature and owner_id=auth.uid()::text and metadata->>'mimetype'='image/png') then raise exception 'Unterschrift fehlt'; end if;
 for photo in select * from jsonb_array_elements(p_photos) loop
  if photo->>'path' is null or left(photo->>'path',length(prefix))<>prefix or not exists(select 1 from storage.objects where bucket_id='evidence' and name=photo->>'path' and owner_id=auth.uid()::text and metadata->>'mimetype'='image/jpeg') then raise exception 'Fotodatei fehlt'; end if;
 end loop;
 if (select count(distinct item->>'path') from jsonb_array_elements(p_photos) item)<>jsonb_array_length(p_photos) then raise exception 'Separate Fotodateien erforderlich'; end if;
 insert into public.handovers(id,organization_id,order_id,kind,mileage,fuel,signer,signature,notes,created_by) values(p_id,o.organization_id,o.id,p_kind,p_mileage,p_fuel,trim(p_signer),p_signature,coalesce(p_notes,''),auth.uid());
 insert into public.handover_photos(organization_id,handover_id,slot,path,sequence) select o.organization_id,p_id,item->>'slot',item->>'path',coalesce((item->>'sequence')::integer,0) from jsonb_array_elements(p_photos) item;
 for damage in select * from jsonb_array_elements(p_damages) loop
  insert into public.damages(organization_id,vehicle_id,handover_id,area,description) values(o.organization_id,o.vehicle_id,p_id,trim(damage->>'area'),trim(damage->>'description'));
 end loop;
 update public.orders set status=case when p_kind='pickup' then 'in_transit' else 'completed' end where id=o.id;
 perform set_config('vehicleops.movement_source',p_kind,true);
 perform set_config('vehicleops.movement_reason',left((case when p_kind='pickup' then 'Fahrzeugübernahme · ' else 'Fahrzeugübergabe · ' end)||o.reference,1000),true);
 perform set_config('vehicleops.movement_handover',p_id::text,true);
 update public.vehicles set site_id=null,parking_space_id=null,mileage=p_mileage,location=case when p_kind='pickup' then 'In Transport' else o.destination end where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,v.id,o.id,(case when p_kind='pickup' then 'Übernahme ' else 'Übergabe ' end)||o.reference||' · '||p_mileage::text||' km · '||trim(p_signer));
 return p_id;
end $$;
