-- Source schema. Generated migration contains this same SQL.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 120), created_at timestamptz not null default now()
);
create table public.memberships (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id),
 name text not null check (length(trim(name)) > 0), role text not null check (role in ('admin','dispatcher','driver','viewer')), unique(organization_id,user_id)
);
create index memberships_user_idx on public.memberships(user_id);
create table public.vehicles (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), plate text not null check (length(trim(plate)) > 0),
 vin text not null check (vin ~ '^[A-HJ-NPR-Z0-9]{17}$'), make text not null, model text not null, color text not null, mileage integer not null check (mileage >= 0), location text not null,
 unique(organization_id,id), unique(organization_id,vin), unique(organization_id,plate)
);
create table public.drivers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null check(length(trim(name))>0), email text not null, phone text not null,
 license_valid_until date not null, user_id uuid, unique(organization_id,id), foreign key(organization_id,user_id) references public.memberships(organization_id,user_id)
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), reference text not null, vehicle_id uuid not null, driver_id uuid not null,
 pickup text not null check(length(trim(pickup))>0), destination text not null check(length(trim(destination))>0), scheduled_at timestamptz not null, contact text not null default '',
 status text not null default 'assigned' check(status in ('assigned','in_transit','completed')), unique(organization_id,id), unique(organization_id,reference),
 foreign key(organization_id,vehicle_id) references public.vehicles(organization_id,id), foreign key(organization_id,driver_id) references public.drivers(organization_id,id)
);
create unique index one_open_order_per_vehicle on public.orders(organization_id,vehicle_id) where status <> 'completed';
create index orders_driver_idx on public.orders(organization_id,driver_id);
create table public.handovers (
 id uuid primary key, organization_id uuid not null references public.organizations(id), order_id uuid not null, kind text not null check(kind in ('pickup','delivery')),
 mileage integer not null check(mileage>=0), fuel integer not null check(fuel between 0 and 100), signer text not null check(length(trim(signer))>0), signature text not null, notes text not null default '',
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(organization_id,id), unique(order_id,kind),
 foreign key(organization_id,order_id) references public.orders(organization_id,id)
);
create table public.handover_photos (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), handover_id uuid not null,
 slot text not null check(slot in ('Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho')), path text not null,
 unique(handover_id,slot), foreign key(organization_id,handover_id) references public.handovers(organization_id,id)
);
create table public.damages (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), vehicle_id uuid not null, handover_id uuid not null,
 area text not null check(length(trim(area))>0), description text not null check(length(trim(description))>0), created_at timestamptz not null default now(),
 foreign key(organization_id,vehicle_id) references public.vehicles(organization_id,id), foreign key(organization_id,handover_id) references public.handovers(organization_id,id)
);
create table public.vehicle_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), vehicle_id uuid not null, order_id uuid not null,
 description text not null, created_at timestamptz not null default now(), foreign key(organization_id,vehicle_id) references public.vehicles(organization_id,id), foreign key(organization_id,order_id) references public.orders(organization_id,id)
);
create index photos_org_idx on public.handover_photos(organization_id);
create index damages_vehicle_idx on public.damages(organization_id,vehicle_id);
create index events_vehicle_idx on public.vehicle_events(organization_id,vehicle_id);

-- Definer lookup is isolated to avoid recursive membership RLS; identity is always auth.uid().
create function private.member_role(p_org uuid) returns text language sql stable security definer set search_path = '' as $$
 select role from public.memberships where organization_id=p_org and user_id=(select auth.uid()) and auth.uid() is not null
$$;
revoke all on function private.member_role(uuid) from public;
grant execute on function private.member_role(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.orders enable row level security;
alter table public.handovers enable row level security;
alter table public.handover_photos enable row level security;
alter table public.damages enable row level security;
alter table public.vehicle_events enable row level security;
create policy organization_read on public.organizations for select to authenticated using(private.member_role(id) is not null);
create policy membership_read on public.memberships for select to authenticated using(private.member_role(organization_id) is not null);
create policy vehicle_read on public.vehicles for select to authenticated using(private.member_role(organization_id) is not null);
create policy vehicle_insert on public.vehicles for insert to authenticated with check(private.member_role(organization_id) in ('admin','dispatcher'));
create policy driver_read on public.drivers for select to authenticated using(private.member_role(organization_id) is not null);
create policy driver_insert on public.drivers for insert to authenticated with check(private.member_role(organization_id) in ('admin','dispatcher'));
create policy order_read on public.orders for select to authenticated using(private.member_role(organization_id) is not null);
create policy order_insert on public.orders for insert to authenticated with check(private.member_role(organization_id) in ('admin','dispatcher') and status='assigned');
create policy handover_read on public.handovers for select to authenticated using(private.member_role(organization_id) is not null);
create policy photo_read on public.handover_photos for select to authenticated using(private.member_role(organization_id) is not null);
create policy damage_read on public.damages for select to authenticated using(private.member_role(organization_id) is not null);
create policy event_read on public.vehicle_events for select to authenticated using(private.member_role(organization_id) is not null);
revoke all on public.organizations,public.memberships,public.vehicles,public.drivers,public.orders,public.handovers,public.handover_photos,public.damages,public.vehicle_events from anon,authenticated;
grant select on public.organizations,public.memberships,public.vehicles,public.drivers,public.orders,public.handovers,public.handover_photos,public.damages,public.vehicle_events to authenticated;
grant insert on public.vehicles,public.drivers,public.orders to authenticated;

create function private.check_order() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.drivers where id=new.driver_id and organization_id=new.organization_id and license_valid_until >= (new.scheduled_at at time zone 'Europe/Berlin')::date) then raise exception 'Führerscheingültigkeit endet vor Auftrag'; end if;
 return new;
end $$;
create trigger order_license_check before insert on public.orders for each row execute function private.check_order();
revoke all on function private.check_order() from public;

create function private.create_organization(p_name text,p_member_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
 insert into public.organizations(name) values(trim(p_name)) returning id into org;
 insert into public.memberships(organization_id,user_id,name,role) values(org,auth.uid(),trim(p_member_name),'admin');
 return org;
end $$;
revoke all on function private.create_organization(text,text) from public;
grant execute on function private.create_organization(text,text) to authenticated;
create function public.create_organization(p_name text,p_member_name text) returns uuid language sql security invoker set search_path='' as $$ select private.create_organization(p_name,p_member_name) $$;
revoke all on function public.create_organization(text,text) from public,anon;
grant execute on function public.create_organization(text,text) to authenticated;

create function private.add_member(p_org uuid,p_user uuid,p_name text,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or private.member_role(p_org) is distinct from 'admin' then raise exception 'Administrator erforderlich'; end if;
 insert into public.memberships(organization_id,user_id,name,role) values(p_org,p_user,p_name,p_role);
end $$;
revoke all on function private.add_member(uuid,uuid,text,text) from public;
grant execute on function private.add_member(uuid,uuid,text,text) to authenticated;
create function public.add_member(p_org uuid,p_user uuid,p_name text,p_role text) returns void language sql security invoker set search_path='' as $$ select private.add_member(p_org,p_user,p_name,p_role) $$;
revoke all on function public.add_member(uuid,uuid,text,text) from public,anon;
grant execute on function public.add_member(uuid,uuid,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evidence','evidence',false,5242880,array['image/jpeg','image/png']);
create function private.can_upload(p_org text,p_order text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.orders o join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id
 where o.organization_id::text=p_org and o.id::text=p_order and o.status<>'completed' and (private.member_role(o.organization_id) in ('admin','dispatcher') or (private.member_role(o.organization_id)='driver' and d.user_id=auth.uid())))
$$;
revoke all on function private.can_upload(text,text) from public;
grant execute on function private.can_upload(text,text) to authenticated;
create policy evidence_insert on storage.objects for insert to authenticated with check(bucket_id='evidence' and private.can_upload((storage.foldername(name))[1],(storage.foldername(name))[2]));
create policy evidence_read on storage.objects for select to authenticated using(bucket_id='evidence' and exists(select 1 from public.organizations o where o.id::text=(storage.foldername(storage.objects.name))[1]));
-- Only unreferenced uploads may be cleaned up; finalized evidence cannot be overwritten or deleted.
create policy evidence_cleanup on storage.objects for delete to authenticated using(bucket_id='evidence' and owner_id=auth.uid()::text and not exists(select 1 from public.handover_photos p where p.path=name) and not exists(select 1 from public.handovers h where h.signature=name));

create function private.finalize_handover(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; v public.vehicles; r text; prefix text; photo jsonb; damage jsonb;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Auftrag fehlt'; end if;
 r := private.member_role(o.organization_id);
 if r is null or not (r in ('admin','dispatcher') or (r='driver' and exists(select 1 from public.drivers where id=o.driver_id and organization_id=o.organization_id and user_id=auth.uid()))) then raise exception 'Keine Berechtigung'; end if;
 if p_kind is null or p_kind not in ('pickup','delivery') then raise exception 'Ungültige Protokollart'; end if;
 if (p_kind='pickup' and o.status<>'assigned') or (p_kind='delivery' and o.status<>'in_transit') then raise exception 'Auftragsstatus erlaubt diesen Abschluss nicht'; end if;
 select * into v from public.vehicles where id=o.vehicle_id and organization_id=o.organization_id for update;
 if p_mileage is null or p_mileage < v.mileage then raise exception 'Kilometerstand darf nicht sinken'; end if;
 if p_fuel is null or p_fuel not between 0 and 100 or p_signer is null or length(trim(p_signer))=0 then raise exception 'Zustand oder Unterzeichner fehlt'; end if;
 if jsonb_typeof(p_photos) is distinct from 'array' or jsonb_array_length(p_photos)<>10 then raise exception 'Zehn Pflichtfotos erforderlich'; end if;
 if (select count(distinct item->>'slot') from jsonb_array_elements(p_photos) item where item->>'slot' in ('Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho'))<>10 then raise exception 'Fotoperspektiven unvollständig'; end if;
 if jsonb_typeof(p_damages) is distinct from 'array' then raise exception 'Ungültige Schäden'; end if;
 prefix := o.organization_id::text||'/'||o.id::text||'/'||p_id::text||'/';
 if p_signature is null or p_signature<>prefix||'signature.png' or not exists(select 1 from storage.objects where bucket_id='evidence' and name=p_signature and owner_id=auth.uid()::text and metadata->>'mimetype'='image/png') then raise exception 'Unterschrift fehlt'; end if;
 for photo in select * from jsonb_array_elements(p_photos) loop
  if photo->>'path' is null or left(photo->>'path',length(prefix))<>prefix or not exists(select 1 from storage.objects where bucket_id='evidence' and name=photo->>'path' and owner_id=auth.uid()::text and metadata->>'mimetype'='image/jpeg') then raise exception 'Fotodatei fehlt'; end if;
 end loop;
 if (select count(distinct item->>'path') from jsonb_array_elements(p_photos) item)<>10 then raise exception 'Zehn separate Fotodateien erforderlich'; end if;
 insert into public.handovers(id,organization_id,order_id,kind,mileage,fuel,signer,signature,notes,created_by) values(p_id,o.organization_id,o.id,p_kind,p_mileage,p_fuel,trim(p_signer),p_signature,coalesce(p_notes,''),auth.uid());
 insert into public.handover_photos(organization_id,handover_id,slot,path) select o.organization_id,p_id,item->>'slot',item->>'path' from jsonb_array_elements(p_photos) item;
 for damage in select * from jsonb_array_elements(p_damages) loop
  insert into public.damages(organization_id,vehicle_id,handover_id,area,description) values(o.organization_id,o.vehicle_id,p_id,trim(damage->>'area'),trim(damage->>'description'));
 end loop;
 update public.orders set status=case when p_kind='pickup' then 'in_transit' else 'completed' end where id=o.id;
 update public.vehicles set mileage=p_mileage,location=case when p_kind='pickup' then 'In Transport' else o.destination end where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,v.id,o.id,(case when p_kind='pickup' then 'Übernahme ' else 'Übergabe ' end)||o.reference||' · '||p_mileage::text||' km · '||trim(p_signer));
 return p_id;
end $$;
revoke all on function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb) from public;
grant execute on function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb) to authenticated;
create function public.finalize_handover(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.finalize_handover(p_id,p_order_id,p_kind,p_mileage,p_fuel,p_signer,p_signature,p_notes,p_photos,p_damages) $$;
revoke all on function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb) to authenticated;

