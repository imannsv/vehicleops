-- Reference for a fresh install; use the versioned migrations for existing databases.
-- Initial schema with multiple-interior-photo support.
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
 sequence integer not null default 0 check(sequence>=0 and (slot='Innenraum' or sequence=0)),
 unique(handover_id,slot,sequence), unique(handover_id,path), foreign key(organization_id,handover_id) references public.handovers(organization_id,id)
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
 update public.vehicles set mileage=p_mileage,location=case when p_kind='pickup' then 'In Transport' else o.destination end where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,v.id,o.id,(case when p_kind='pickup' then 'Übernahme ' else 'Übergabe ' end)||o.reference||' · '||p_mileage::text||' km · '||trim(p_signer));
 return p_id;
end $$;
revoke all on function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb) from public;
grant execute on function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb) to authenticated;
create function public.finalize_handover(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.finalize_handover(p_id,p_order_id,p_kind,p_mileage,p_fuel,p_signer,p_signature,p_notes,p_photos,p_damages) $$;
revoke all on function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb) to authenticated;



-- Editing iteration
-- Editing is exposed through authorized RPCs; direct table updates remain revoked.
alter table public.vehicles add column revision integer not null default 1;
alter table public.drivers add column revision integer not null default 1;
alter table public.orders add column revision integer not null default 1;
alter table public.orders add column cancellation_reason text;
alter table public.orders add column cancelled_at timestamptz;
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check(status in ('assigned','in_transit','completed','cancelled'));
alter table public.orders add constraint order_cancellation_check check((status='cancelled') = (cancelled_at is not null and cancellation_reason is not null and length(trim(cancellation_reason))>0));
drop index public.one_open_order_per_vehicle;
create unique index one_open_order_per_vehicle on public.orders(organization_id,vehicle_id) where status in ('assigned','in_transit');
alter table public.vehicle_events alter column order_id drop not null;

create function private.bump_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision := old.revision + 1; return new; end $$;
revoke all on function private.bump_revision() from public;
create trigger vehicle_revision before update on public.vehicles for each row execute function private.bump_revision();
create trigger driver_revision before update on public.drivers for each row execute function private.bump_revision();
create trigger order_revision before update on public.orders for each row execute function private.bump_revision();

-- Backfill existing protocols before any editable master data can be changed.
alter table public.handovers add column snapshot jsonb;
update public.handovers h set snapshot=jsonb_build_object('organization_name',g.name,'vehicle',to_jsonb(v),'driver',to_jsonb(d),'order',to_jsonb(o))
 from public.orders o join public.vehicles v on v.id=o.vehicle_id and v.organization_id=o.organization_id
 join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id
 join public.organizations g on g.id=o.organization_id where h.order_id=o.id and h.organization_id=o.organization_id;
alter table public.handovers alter column snapshot set not null;
create function private.capture_protocol_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 select jsonb_build_object('organization_name',g.name,'vehicle',to_jsonb(v),'driver',to_jsonb(d),'order',to_jsonb(o)) into new.snapshot
 from public.orders o join public.vehicles v on v.id=o.vehicle_id and v.organization_id=o.organization_id
 join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id
 join public.organizations g on g.id=o.organization_id where o.id=new.order_id and o.organization_id=new.organization_id;
 return new;
end $$;
revoke all on function private.capture_protocol_snapshot() from public;
create trigger handover_snapshot before insert on public.handovers for each row execute function private.capture_protocol_snapshot();

-- Internal constraint trigger, not an exposed endpoint. Locks the driver while validating
-- so an assignment cannot race a simultaneous license-date edit.
create or replace function private.check_order() returns trigger language plpgsql security definer set search_path='' as $$
declare validity date;
begin
 select license_valid_until into validity from public.drivers where id=new.driver_id and organization_id=new.organization_id for share;
 if validity is null or validity < (new.scheduled_at at time zone 'Europe/Berlin')::date then raise exception 'Führerscheingültigkeit endet vor Auftrag'; end if;
 return new;
end $$;
revoke all on function private.check_order() from public;
drop trigger order_license_check on public.orders;
create trigger order_license_check before insert or update of driver_id,scheduled_at on public.orders for each row execute function private.check_order();

create function private.update_vehicle(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; next public.vehicles; floor integer;
begin
 select * into v from public.vehicles where id=p_id for update;
 if not found then raise exception 'Datensatz fehlt'; end if;
 if auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from v.revision then raise exception 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.'; end if;
 next := jsonb_populate_record(v,p_values);
 if next.id<>v.id or next.organization_id<>v.organization_id then raise exception 'Mandant oder ID kann nicht verändert werden'; end if;
 if length(trim(next.plate))=0 or length(trim(next.make))=0 or length(trim(next.model))=0 or length(trim(next.color))=0 or length(trim(next.location))=0 then raise exception 'Bitte alle Fahrzeugfelder ausfüllen'; end if;
 select coalesce(max(h.mileage),0) into floor from public.handovers h join public.orders o on o.id=h.order_id and o.organization_id=h.organization_id where o.vehicle_id=v.id and o.organization_id=v.organization_id;
 if next.mileage<floor then raise exception 'Kilometerstand muss mindestens % km betragen',floor; end if;
 if exists(select 1 from public.orders where vehicle_id=v.id and organization_id=v.organization_id and status='in_transit') and (next.mileage is distinct from v.mileage or next.location is distinct from v.location) then raise exception 'Während des Transports werden Kilometerstand und Standort durch das Protokoll aktualisiert.'; end if;
 update public.vehicles set plate=upper(trim(next.plate)),vin=upper(trim(next.vin)),make=trim(next.make),model=trim(next.model),color=trim(next.color),mileage=next.mileage,location=trim(next.location) where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,description) values(v.organization_id,v.id,'Fahrzeugdaten aktualisiert: '||v.plate||' → '||upper(trim(next.plate)));
end $$;
create function private.update_driver(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d public.drivers; next public.drivers;
begin
 select * into d from public.drivers where id=p_id for update;
 if not found then raise exception 'Datensatz fehlt'; end if;
 if auth.uid() is null or coalesce(private.member_role(d.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from d.revision then raise exception 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.'; end if;
 next := jsonb_populate_record(d,p_values);
 if next.id<>d.id or next.organization_id<>d.organization_id then raise exception 'Mandant oder ID kann nicht verändert werden'; end if;
 if length(trim(next.name))=0 or length(trim(next.email))=0 or length(trim(next.phone))=0 then raise exception 'Bitte alle Fahrerfelder ausfüllen'; end if;
 if next.user_id is not null and not exists(select 1 from public.memberships where organization_id=d.organization_id and user_id=next.user_id and role='driver') then raise exception 'Bitte ein Teammitglied mit Fahrerrolle auswählen'; end if;
 if exists(select 1 from public.orders where driver_id=d.id and organization_id=d.organization_id and status in ('assigned','in_transit') and (scheduled_at at time zone 'Europe/Berlin')::date>next.license_valid_until) then raise exception 'Die Führerscheingültigkeit muss alle offenen Aufträge abdecken.'; end if;
 update public.drivers set name=trim(next.name),email=trim(next.email),phone=trim(next.phone),license_valid_until=next.license_valid_until,user_id=next.user_id where id=d.id;
 insert into public.vehicle_events(organization_id,vehicle_id,description) select d.organization_id,o.vehicle_id,'Fahrerdaten aktualisiert: '||trim(next.name)||' · '||o.reference from public.orders o where o.organization_id=d.organization_id and o.driver_id=d.id and o.status in ('assigned','in_transit');
end $$;
create function private.update_order(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; next public.orders; driver_name text;
begin
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'Datensatz fehlt'; end if;
 if auth.uid() is null or coalesce(private.member_role(o.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from o.revision then raise exception 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.'; end if;
 if o.status not in ('assigned','in_transit') then raise exception 'Abgeschlossene und stornierte Aufträge können nicht bearbeitet werden.'; end if;
 next := jsonb_populate_record(o,p_values);
 if next.id<>o.id or next.organization_id<>o.organization_id or next.status<>o.status or next.reference<>o.reference then raise exception 'Status, Mandant und Referenz können hier nicht verändert werden'; end if;
 if o.status='in_transit' and (next.vehicle_id is distinct from o.vehicle_id or next.pickup is distinct from o.pickup) then raise exception 'Nach der Übernahme bleiben Fahrzeug und Abholort unverändert.'; end if;
 update public.orders set vehicle_id=next.vehicle_id,driver_id=next.driver_id,pickup=trim(next.pickup),destination=trim(next.destination),scheduled_at=next.scheduled_at,contact=coalesce(next.contact,'') where id=o.id;
 select name into driver_name from public.drivers where id=next.driver_id and organization_id=o.organization_id;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,next.vehicle_id,o.id,'Auftrag '||o.reference||' aktualisiert · Fahrer: '||driver_name||' · Termin: '||to_char(next.scheduled_at at time zone 'Europe/Berlin','DD.MM.YYYY HH24:MI'));
 if next.vehicle_id<>o.vehicle_id then insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,o.vehicle_id,o.id,'Fahrzeug aus Auftrag '||o.reference||' entfernt.'); end if;
end $$;
create function private.cancel_order(p_id uuid,p_expected_revision integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'Auftrag fehlt'; end if;
 if auth.uid() is null or coalesce(private.member_role(o.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from o.revision then raise exception 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.'; end if;
 if o.status<>'assigned' then raise exception 'Nur Aufträge vor der Übernahme können storniert werden.'; end if;
 if p_reason is null or length(trim(p_reason))=0 or length(p_reason)>1000 then raise exception 'Bitte einen Stornogrund angeben (maximal 1000 Zeichen).'; end if;
 update public.orders set status='cancelled',cancellation_reason=trim(p_reason),cancelled_at=now() where id=o.id;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,o.vehicle_id,o.id,'Auftrag '||o.reference||' storniert: '||trim(p_reason));
end $$;
revoke all on function private.update_vehicle(uuid,integer,jsonb),private.update_driver(uuid,integer,jsonb),private.update_order(uuid,integer,jsonb),private.cancel_order(uuid,integer,text) from public;
grant execute on function private.update_vehicle(uuid,integer,jsonb),private.update_driver(uuid,integer,jsonb),private.update_order(uuid,integer,jsonb),private.cancel_order(uuid,integer,text) to authenticated;
create function public.update_vehicle(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.update_vehicle(p_id,p_expected_revision,p_values) $$;
create function public.update_driver(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.update_driver(p_id,p_expected_revision,p_values) $$;
create function public.update_order(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.update_order(p_id,p_expected_revision,p_values) $$;
create function public.cancel_order(p_id uuid,p_expected_revision integer,p_reason text) returns void language sql security invoker set search_path='' as $$ select private.cancel_order(p_id,p_expected_revision,p_reason) $$;
revoke all on function public.update_vehicle(uuid,integer,jsonb),public.update_driver(uuid,integer,jsonb),public.update_order(uuid,integer,jsonb),public.cancel_order(uuid,integer,text) from public,anon;
grant execute on function public.update_vehicle(uuid,integer,jsonb),public.update_driver(uuid,integer,jsonb),public.update_order(uuid,integer,jsonb),public.cancel_order(uuid,integer,text) to authenticated;

-- Cancelled orders no longer accept uploads.
create or replace function private.can_upload(p_org text,p_order text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.orders o join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id
 where o.organization_id::text=p_org and o.id::text=p_order and o.status in ('assigned','in_transit') and (private.member_role(o.organization_id) in ('admin','dispatcher') or (private.member_role(o.organization_id)='driver' and d.user_id=auth.uid())))
$$;

-- Reject stale protocol drafts after a vehicle swap, reassignment or schedule edit.
drop function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb);
drop function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb);
create function private.finalize_handover(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb,p_expected_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
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
 update public.vehicles set mileage=p_mileage,location=case when p_kind='pickup' then 'In Transport' else o.destination end where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,v.id,o.id,(case when p_kind='pickup' then 'Übernahme ' else 'Übergabe ' end)||o.reference||' · '||p_mileage::text||' km · '||trim(p_signer));
 return p_id;
end $$;
revoke all on function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb,integer) from public;
grant execute on function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb,integer) to authenticated;
create function public.finalize_handover(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb,p_expected_revision integer) returns uuid language sql security invoker set search_path='' as $$ select private.finalize_handover(p_id,p_order_id,p_kind,p_mileage,p_fuel,p_signer,p_signature,p_notes,p_photos,p_damages,p_expected_revision) $$;
revoke all on function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb,integer) from public,anon;
grant execute on function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb,integer) to authenticated;

create extension if not exists pgcrypto with schema extensions;
create table public.team_invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 email text not null check(email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 name text not null check(length(trim(name)) between 1 and 120), role text not null check(role in ('admin','dispatcher','driver','viewer')),
 token_hash text not null unique, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days', accepted_at timestamptz, revoked_at timestamptz
);
create index team_invitation_org_idx on public.team_invitations(organization_id);
create index team_invitation_creator_idx on public.team_invitations(created_by);
alter table public.team_invitations enable row level security;
create policy invitation_admin_read on public.team_invitations for select to authenticated using(private.member_role(organization_id)='admin');
revoke all on public.team_invitations from public,anon,authenticated;
grant select(id,organization_id,email,name,role,created_at,expires_at,accepted_at,revoked_at) on public.team_invitations to authenticated;

create function private.create_team_invitation(p_org uuid,p_email text,p_name text,p_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; invitation public.team_invitations;
begin
 perform 1 from public.organizations where id=p_org for update;
 if auth.uid() is null or private.member_role(p_org) is distinct from 'admin' then raise exception 'Administrator erforderlich'; end if;
 if exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.organization_id=p_org and lower(u.email)=lower(trim(p_email))) then raise exception 'Diese Person ist bereits im Team'; end if;
 update public.team_invitations set revoked_at=now() where organization_id=p_org and email=lower(trim(p_email)) and accepted_at is null and revoked_at is null;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.team_invitations(organization_id,email,name,role,token_hash,created_by) values(p_org,lower(trim(p_email)),trim(p_name),p_role,encode(extensions.digest(token,'sha256'),'hex'),auth.uid()) returning * into invitation;
 return jsonb_build_object('token',token,'id',invitation.id,'expires_at',invitation.expires_at);
end $$;

create function private.preview_team_invitation(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Einladung ist ungültig oder abgelaufen'; end if;
 select jsonb_build_object('organization_name',o.name,'email',i.email,'name',i.name,'role',i.role,'expires_at',i.expires_at) into result
 from public.team_invitations i join public.organizations o on o.id=i.organization_id
 where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and i.revoked_at is null and i.accepted_at is null and i.expires_at>now();
 if result is null then raise exception 'Einladung ist ungültig oder abgelaufen'; end if;
 return result;
end $$;

create function private.accept_team_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.team_invitations; org uuid; user_email text; confirmed timestamptz;
begin
 if auth.uid() is null then raise exception 'Bitte anmelden'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Einladung ist ungültig oder abgelaufen'; end if;
 select organization_id into org from public.team_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 perform 1 from public.organizations where id=org for update;
 select * into i from public.team_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now() then raise exception 'Einladung ist ungültig oder abgelaufen'; end if;
 select lower(email),email_confirmed_at into user_email,confirmed from auth.users where id=auth.uid();
 if user_email is distinct from i.email or confirmed is null then raise exception 'Bitte mit der bestätigten eingeladenen E-Mail-Adresse anmelden'; end if;
 if not exists(select 1 from public.memberships where organization_id=i.organization_id and user_id=auth.uid()) then
  insert into public.memberships(organization_id,user_id,name,role) values(i.organization_id,auth.uid(),i.name,i.role);
 end if;
 update public.team_invitations set accepted_at=now() where id=i.id;
 return i.organization_id;
end $$;

create function private.revoke_team_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.team_invitations where id=p_id;
 perform 1 from public.organizations where id=org for update;
 if auth.uid() is null or private.member_role(org) is distinct from 'admin' then raise exception 'Administrator erforderlich'; end if;
 update public.team_invitations set revoked_at=now() where id=p_id and accepted_at is null and revoked_at is null;
 if not found then raise exception 'Einladung ist nicht mehr offen'; end if;
end $$;

create function private.manage_team_member(p_id uuid,p_expected_role text,p_role text,p_remove boolean) returns void language plpgsql security definer set search_path='' as $$
declare org uuid; m public.memberships;
begin
 select organization_id into org from public.memberships where id=p_id;
 perform 1 from public.organizations where id=org for update;
 if auth.uid() is null or private.member_role(org) is distinct from 'admin' then raise exception 'Administrator erforderlich'; end if;
 select * into m from public.memberships where id=p_id for update;
 if not found then raise exception 'Teammitglied fehlt'; end if;
 if m.role is distinct from p_expected_role then raise exception 'Rolle wurde inzwischen geändert. Bitte neu laden.'; end if;
 if p_remove is null or (not p_remove and (p_role is null or p_role not in ('admin','dispatcher','driver','viewer'))) then raise exception 'Ungültige Rolle'; end if;
 if m.role='admin' and (p_remove or p_role<>'admin') and (select count(*) from public.memberships where organization_id=org and role='admin')<=1 then raise exception 'Mindestens ein Administrator muss erhalten bleiben'; end if;
 -- Lock driver records before checking assignments; assignment validation shares these locks.
 perform 1 from public.drivers where organization_id=org and user_id=m.user_id for update;
 if (p_remove or p_role<>'driver') and exists(select 1 from public.orders o join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id where d.organization_id=org and d.user_id=m.user_id and o.status in ('assigned','in_transit')) then raise exception 'Bitte zuerst die offenen Aufträge dieses Fahrers neu zuweisen'; end if;
 if p_remove or p_role<>'driver' then update public.drivers set user_id=null where organization_id=org and user_id=m.user_id; end if;
 if p_remove then delete from public.memberships where id=p_id; else update public.memberships set role=p_role where id=p_id; end if;
end $$;

revoke all on function private.create_team_invitation(uuid,text,text,text),private.preview_team_invitation(text),private.accept_team_invitation(text),private.revoke_team_invitation(uuid),private.manage_team_member(uuid,text,text,boolean) from public;
grant usage on schema private to anon;
grant execute on function private.preview_team_invitation(text) to anon,authenticated;
grant execute on function private.create_team_invitation(uuid,text,text,text),private.accept_team_invitation(text),private.revoke_team_invitation(uuid),private.manage_team_member(uuid,text,text,boolean) to authenticated;
create function public.create_team_invitation(p_org uuid,p_email text,p_name text,p_role text) returns jsonb language sql security invoker set search_path='' as $$ select private.create_team_invitation(p_org,p_email,p_name,p_role) $$;
create function public.preview_team_invitation(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select private.preview_team_invitation(p_token) $$;
create function public.accept_team_invitation(p_token text) returns uuid language sql security invoker set search_path='' as $$ select private.accept_team_invitation(p_token) $$;
create function public.revoke_team_invitation(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.revoke_team_invitation(p_id) $$;
create function public.manage_team_member(p_id uuid,p_expected_role text,p_role text,p_remove boolean) returns void language sql security invoker set search_path='' as $$ select private.manage_team_member(p_id,p_expected_role,p_role,p_remove) $$;
revoke all on function public.create_team_invitation(uuid,text,text,text),public.preview_team_invitation(text),public.accept_team_invitation(text),public.revoke_team_invitation(uuid),public.manage_team_member(uuid,text,text,boolean) from public,anon;
grant execute on function public.preview_team_invitation(text) to anon,authenticated;
grant execute on function public.create_team_invitation(uuid,text,text,text),public.accept_team_invitation(text),public.revoke_team_invitation(uuid),public.manage_team_member(uuid,text,text,boolean) to authenticated;

create index damages_handover_idx on public.damages(organization_id,handover_id);
create index drivers_member_idx on public.drivers(organization_id,user_id);
create index photos_handover_idx on public.handover_photos(organization_id,handover_id);
create index handovers_creator_idx on public.handovers(created_by);
create index handovers_order_idx on public.handovers(organization_id,order_id);
create index events_order_idx on public.vehicle_events(organization_id,order_id);

-- Existing vehicle and historical protocol data remain intact. New protocols capture these columns automatically.
alter table public.vehicles add column variant text not null default '' check(length(variant)<=120);
alter table public.vehicles add column equipment_notes text not null default '' check(length(equipment_notes)<=2000);
alter table public.vehicles add column equipment text[] not null default '{}'::text[];
alter table public.vehicles add constraint vehicle_equipment_check check (
 cardinality(equipment)<=136 and array_position(equipment,null) is null and equipment <@ array['ABS','AIR_SUSPENSION','ALARM_SYSTEM','ALLOY_WHEELS','ALL_SEASON_TIRES','AMBIENT_LIGHTING','ANDROID_AUTO','ARM_REST','AUTOMATIC_RAIN_SENSOR','AUXILIARY_HEATING','BIODIESEL_SUITABLE','BLIND_SPOT_MONITOR','BLUETOOTH','CARGO_BARRIER','CARPLAY','CD_MULTICHANGER','CD_PLAYER','CENTRAL_LOCKING','COLLISION_AVOIDANCE','DIGITAL_COCKPIT','DIMMING_INTERIOR_MIRROR','DISABLED_ACCESSIBLE','DISTANCE_WARNING_SYSTEM','DYNAMIC_CHASSIS_CONTROL','E10_ENABLED','ELECTRIC_ADJUSTABLE_SEATS','ELECTRIC_BACKSEAT_ADJUSTMENT','ELECTRIC_EXTERIOR_MIRRORS','ELECTRIC_HEATED_REAR_SEATS','ELECTRIC_HEATED_SEATS','ELECTRIC_TAILGATE','ELECTRIC_WINDOWS','EMERGENCY_CALL_SYSTEM','ENVIRONMENTAL_BONUS','ESP','EXPORT','FATIGUE_WARNING_SYSTEM','FOLDING_EXTERIOR_MIRRORS','FOLDING_ROOF','FOLD_FLAT_PASSENGER_SEAT','FRONT_FOG_LIGHTS','FULL_SERVICE_HISTORY','GLARE_FREE_HIGH_BEAM','HANDS_FREE_PHONE_SYSTEM','HEADLIGHT_WASHER_SYSTEM','HEAD_UP_DISPLAY','HEATED_STEERING_WHEEL','HEATED_WINDSHIELD','HEAT_PUMP','HIGH_BEAM_ASSIST','HILL_START_ASSIST','HU_AU_NEU','HYBRID_PLUGIN','IMMOBILIZER','INTEGRATED_MUSIC_STREAMING','ISOFIX','KEYLESS_ENTRY','LANE_DEPARTURE_WARNING','LEATHER_STEERING_WHEEL','LIGHT_SENSOR','LUMBAR_SUPPORT','MASSAGE_SEATS','MATTE_COLOR','MEMORY_SEATS','METALLIC','MULTIFUNCTIONAL_WHEEL','NAVIGATION_PREPARATION','NAVIGATION_SYSTEM','NEW_SERVICE','NIGHT_VISION_ASSIST','NONSMOKER_VEHICLE','ON_BOARD_COMPUTER','PADDLE_SHIFTERS','PANORAMIC_GLASS_ROOF','PARTICULATE_FILTER_DIESEL','PASSENGER_SEAT_ISOFIX_POINT','PERFORMANCE_HANDLING_SYSTEM','POWER_ASSISTED_STEERING','RANGE_EXTENDER','REAR_TRAFFIC_ALERT','RIGHT_HAND_DRIVE','ROOF_RAILS','SKI_BAG','SMOKERS_PACKAGE','SOUND_SYSTEM','SPEED_LIMITER','SPORT_PACKAGE','SPORT_SEATS','START_STOP_SYSTEM','STEEL_WHEELS','SUMMER_TIRES','SUNROOF','TAXI','TINTED_WINDOWS','TIRE_PRESSURE_MONITORING','TOUCHSCREEN','TRACTION_CONTROL_SYSTEM','TRAFFIC_SIGN_RECOGNITION','TRAILER_ASSIST','TV','USB','VEGETABLEOILFUEL_SUITABLE','VENTILATED_SEATS','VIRTUAL_SIDE_MIRROR','VOICE_CONTROL','WARRANTY','WIFI_HOTSPOT','WINTER_PACKAGE','WINTER_TIRES','WIRELESS_CHARGING','CLIMATE_MANUAL','CLIMATE_AUTO','CLIMATE_2_ZONE','CLIMATE_3_ZONE','CLIMATE_4_ZONE','CRUISE_CONTROL','ADAPTIVE_CRUISE_CONTROL','PARKING_FRONT','PARKING_REAR','REAR_CAMERA','CAMERA_360','PARKING_SELF_STEERING','LED_HEADLIGHTS','XENON_HEADLIGHTS','BI_XENON_HEADLIGHTS','LASER_HEADLIGHTS','LED_DAYTIME_LIGHTS','ADAPTIVE_CORNERING_LIGHTS','LEATHER_INTERIOR','PART_LEATHER_INTERIOR','ALCANTARA_INTERIOR','FABRIC_INTERIOR','TRAILER_HITCH_FIXED','TRAILER_HITCH_REMOVABLE','TRAILER_HITCH_SWIVEL','ALL_WHEEL_DRIVE']::text[]
);
create function private.validate_vehicle_equipment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if cardinality(new.equipment)<>(select count(distinct entry) from unnest(new.equipment) entry) then raise exception 'Ausstattung enthält doppelte Einträge'; end if;
 return new;
end $$;
revoke all on function private.validate_vehicle_equipment() from public;
create trigger validate_vehicle_equipment before insert or update of equipment on public.vehicles for each row execute function private.validate_vehicle_equipment();
create or replace function private.update_vehicle(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; next public.vehicles; floor integer;
begin
 select * into v from public.vehicles where id=p_id for update;
 if not found then raise exception 'Datensatz fehlt'; end if;
 if auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from v.revision then raise exception 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.'; end if;
 next := jsonb_populate_record(v,p_values);
 if next.id<>v.id or next.organization_id<>v.organization_id then raise exception 'Mandant oder ID kann nicht verändert werden'; end if;
 if length(trim(next.plate))=0 or length(trim(next.make))=0 or length(trim(next.model))=0 or length(trim(next.color))=0 or length(trim(next.location))=0 then raise exception 'Bitte alle Fahrzeugfelder ausfüllen'; end if;
 select coalesce(max(h.mileage),0) into floor from public.handovers h join public.orders o on o.id=h.order_id and o.organization_id=h.organization_id where o.vehicle_id=v.id and o.organization_id=v.organization_id;
 if next.mileage<floor then raise exception 'Kilometerstand muss mindestens % km betragen',floor; end if;
 if exists(select 1 from public.orders where vehicle_id=v.id and organization_id=v.organization_id and status='in_transit') and (next.mileage is distinct from v.mileage or next.location is distinct from v.location) then raise exception 'Während des Transports werden Kilometerstand und Standort durch das Protokoll aktualisiert.'; end if;
 update public.vehicles set plate=upper(trim(next.plate)),vin=upper(trim(next.vin)),make=trim(next.make),model=trim(next.model),color=trim(next.color),mileage=next.mileage,location=trim(next.location),variant=trim(next.variant),equipment=next.equipment,equipment_notes=trim(next.equipment_notes) where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,description) values(v.organization_id,v.id,'Fahrzeugdaten aktualisiert: '||v.plate||' → '||upper(trim(next.plate)));
end $$;
alter table public.vehicles add column build_year integer check(build_year between 1886 and 2200);
alter table public.vehicles add column first_registration date;
alter table public.vehicles add column keys_recorded boolean not null default false;
alter table public.vehicles add column keys_revision integer not null default 1;
alter table public.handovers add column key_snapshot jsonb;

create table public.vehicle_holders (
 vehicle_id uuid primary key, organization_id uuid not null, name text not null default '' check(length(name)<=120),
 address text not null default '' check(length(address)<=1000), contact text not null default '' check(length(contact)<=240),
 revision integer not null default 1,
 foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade
);
create index vehicle_holders_org_idx on public.vehicle_holders(organization_id);
create table public.vehicle_assets (
 id uuid primary key, vehicle_id uuid not null, organization_id uuid not null,
 kind text not null check(kind in ('photo','registration','document')),
 name text not null check(length(name) between 1 and 200), path text not null unique, mime text not null,
 size integer not null check(size between 1 and 10485760), created_at timestamptz not null default now(),
 foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade
);
create index vehicle_assets_vehicle_idx on public.vehicle_assets(vehicle_id,organization_id);
create index vehicle_assets_org_idx on public.vehicle_assets(organization_id);
create table public.vehicle_keys (
 id uuid primary key, vehicle_id uuid not null, organization_id uuid not null,
 label text not null check(length(trim(label)) between 1 and 120), identifier text not null default '' check(length(identifier)<=120),
 location text not null default '' check(length(location)<=240), custodian text not null default '' check(length(custodian)<=120),
 state text not null default 'available' check(state in ('available','issued','lost','retired')),
 unique(id,organization_id),
 foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade
);
create index vehicle_keys_vehicle_idx on public.vehicle_keys(vehicle_id,organization_id);
create index vehicle_keys_org_idx on public.vehicle_keys(organization_id);
create table public.key_movements (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null, organization_id uuid not null,
 key_id uuid not null, key_label text not null, action text not null, person text not null default '', location text not null default '',
 actor_name text not null, created_at timestamptz not null default now(), handover_id uuid,
 foreign key(key_id,organization_id) references public.vehicle_keys(id,organization_id),
 foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id),
 foreign key(handover_id,organization_id) references public.handovers(id,organization_id)
);
create index key_movements_vehicle_idx on public.key_movements(vehicle_id,organization_id);
create index key_movements_key_idx on public.key_movements(key_id,organization_id);
create index key_movements_handover_idx on public.key_movements(handover_id,organization_id);
create index key_movements_org_idx on public.key_movements(organization_id);
alter table public.vehicle_holders enable row level security;
alter table public.vehicle_assets enable row level security;
alter table public.vehicle_keys enable row level security;
alter table public.key_movements enable row level security;

create function private.vehicle_document_access(p_vehicle uuid,p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.member_role(p_org) in ('admin','dispatcher') or
 (private.member_role(p_org)='driver' and exists(select 1 from public.orders o join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id
 where o.vehicle_id=p_vehicle and o.organization_id=p_org and o.status in ('assigned','in_transit') and d.user_id=auth.uid())))
$$;
revoke all on function private.vehicle_document_access(uuid,uuid) from public;
grant execute on function private.vehicle_document_access(uuid,uuid) to authenticated;
create policy holder_read on public.vehicle_holders for select to authenticated using(private.vehicle_document_access(vehicle_id,organization_id));
create policy asset_read on public.vehicle_assets for select to authenticated using((kind='photo' and private.member_role(organization_id) is not null) or private.vehicle_document_access(vehicle_id,organization_id));
create policy key_read on public.vehicle_keys for select to authenticated using(private.member_role(organization_id) is not null);
create policy movement_read on public.key_movements for select to authenticated using(private.vehicle_document_access(vehicle_id,organization_id));
revoke all on public.vehicle_holders,public.vehicle_assets,public.vehicle_keys,public.key_movements from public,anon,authenticated;
grant select on public.vehicle_holders,public.vehicle_assets,public.vehicle_keys,public.key_movements to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('vehicle-files','vehicle-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create function private.vehicle_file_manage(p_org text,p_vehicle text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.vehicles v where v.id::text=p_vehicle and v.organization_id::text=p_org and private.member_role(v.organization_id) in ('admin','dispatcher'))
$$;
revoke all on function private.vehicle_file_manage(text,text) from public;
grant execute on function private.vehicle_file_manage(text,text) to authenticated;
create policy vehicle_file_insert on storage.objects for insert to authenticated with check(bucket_id='vehicle-files' and private.vehicle_file_manage((storage.foldername(name))[1],(storage.foldername(name))[2]));
create policy vehicle_file_read on storage.objects for select to authenticated using(bucket_id='vehicle-files' and (
 private.vehicle_file_manage((storage.foldername(name))[1],(storage.foldername(name))[2]) or exists(select 1 from public.vehicle_assets a where a.path=storage.objects.name)));
create policy vehicle_file_delete on storage.objects for delete to authenticated using(bucket_id='vehicle-files' and private.vehicle_file_manage((storage.foldername(name))[1],(storage.foldername(name))[2]));

create function private.save_vehicle_holder(p_vehicle uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; r integer;
begin
 select * into v from public.vehicles where id=p_vehicle for update;
 if not found or auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 select revision into r from public.vehicle_holders where vehicle_id=v.id;
 if coalesce(r,0) is distinct from p_expected_revision then raise exception 'Halterdaten wurden inzwischen geändert. Bitte neu laden.'; end if;
 insert into public.vehicle_holders(vehicle_id,organization_id,name,address,contact,revision)
 values(v.id,v.organization_id,trim(coalesce(p_values->>'name','')),trim(coalesce(p_values->>'address','')),trim(coalesce(p_values->>'contact','')),coalesce(r,0)+1)
 on conflict(vehicle_id) do update set name=excluded.name,address=excluded.address,contact=excluded.contact,revision=excluded.revision;
end $$;
create function public.save_vehicle_holder(p_vehicle uuid,p_expected_revision integer,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.save_vehicle_holder(p_vehicle,p_expected_revision,p_values) $$;

create function private.register_vehicle_asset(p_id uuid,p_vehicle uuid,p_kind text,p_name text,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; obj storage.objects;
begin
 select * into v from public.vehicles where id=p_vehicle for update;
 if not found or auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if left(p_path,length(v.organization_id::text||'/'||v.id::text||'/'||p_id::text||'/'))<>v.organization_id::text||'/'||v.id::text||'/'||p_id::text||'/' then raise exception 'Ungültiger Dateipfad'; end if;
 select * into obj from storage.objects where bucket_id='vehicle-files' and name=p_path and owner_id=auth.uid()::text;
 if not found then raise exception 'Upload fehlt'; end if;
 if obj.metadata->>'mimetype' not in ('image/jpeg','image/png','image/webp','application/pdf') or (p_kind='photo' and obj.metadata->>'mimetype'='application/pdf') then raise exception 'Ungültiges Dateiformat'; end if;
 insert into public.vehicle_assets(id,vehicle_id,organization_id,kind,name,path,mime,size)
 values(p_id,v.id,v.organization_id,p_kind,p_name,p_path,obj.metadata->>'mimetype',(obj.metadata->>'size')::integer);
end $$;
create function public.register_vehicle_asset(p_id uuid,p_vehicle uuid,p_kind text,p_name text,p_path text) returns void language sql security invoker set search_path='' as $$ select private.register_vehicle_asset(p_id,p_vehicle,p_kind,p_name,p_path) $$;
create function private.remove_vehicle_asset(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare a public.vehicle_assets;
begin
 select * into a from public.vehicle_assets where id=p_id for update;
 if not found or auth.uid() is null or coalesce(private.member_role(a.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 delete from public.vehicle_assets where id=p_id;
 return a.path;
end $$;
create function public.remove_vehicle_asset(p_id uuid) returns text language sql security invoker set search_path='' as $$ select private.remove_vehicle_asset(p_id) $$;

create function private.change_vehicle_key(p_vehicle uuid,p_key uuid,p_expected_revision integer,p_action text,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; k public.vehicle_keys; actor text;
begin
 select * into v from public.vehicles where id=p_vehicle for update;
 if not found or auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if v.keys_revision is distinct from p_expected_revision then raise exception 'Schlüsselbestand wurde inzwischen geändert. Bitte neu laden.'; end if;
 select name into actor from public.memberships where organization_id=v.organization_id and user_id=auth.uid();
 if p_action='record_empty' then
  if exists(select 1 from public.vehicle_keys where vehicle_id=v.id and state<>'retired') then raise exception 'Es sind bereits Schlüssel erfasst'; end if;
 elsif p_action='create' then
  insert into public.vehicle_keys(id,vehicle_id,organization_id,label,identifier,location) values(p_key,v.id,v.organization_id,trim(p_values->>'label'),trim(coalesce(p_values->>'identifier','')),trim(coalesce(p_values->>'location',''))) returning * into k;
 else
  select * into k from public.vehicle_keys where id=p_key and vehicle_id=v.id and organization_id=v.organization_id for update;
  if not found then raise exception 'Schlüssel fehlt'; end if;
  if p_action='edit' then
   update public.vehicle_keys set label=trim(p_values->>'label'),identifier=trim(coalesce(p_values->>'identifier','')),location=trim(coalesce(p_values->>'location','')) where id=k.id returning * into k;
  elsif p_action='issue' then
   if k.state<>'available' or length(trim(coalesce(p_values->>'person','')))=0 or length(trim(coalesce(p_values->>'location','')))=0 then raise exception 'Ausgabe benötigt verfügbaren Schlüssel, Person und Aufbewahrungsort'; end if;
   update public.vehicle_keys set state='issued',custodian=trim(p_values->>'person'),location=trim(p_values->>'location') where id=k.id returning * into k;
  elsif p_action='return' then
   if k.state not in ('issued','lost') or length(trim(coalesce(p_values->>'person','')))=0 or length(trim(coalesce(p_values->>'location','')))=0 then raise exception 'Rückgabe benötigt Person und Aufbewahrungsort'; end if;
   update public.vehicle_keys set state='available',custodian='',location=trim(p_values->>'location') where id=k.id returning * into k;
  elsif p_action in ('lost','retire') then
   if k.state='retired' or length(trim(coalesce(p_values->>'person','')))=0 then raise exception 'Vorgang benötigt einen aktiven Schlüssel und eine Person'; end if;
   update public.vehicle_keys set state=case when p_action='lost' then 'lost' else 'retired' end where id=k.id returning * into k;
  else raise exception 'Ungültiger Schlüsselvorgang';
  end if;
 end if;
 if p_action<>'record_empty' then
  insert into public.key_movements(vehicle_id,organization_id,key_id,key_label,action,person,location,actor_name) values(v.id,v.organization_id,k.id,k.label,p_action,left(coalesce(p_values->>'person',actor),120),k.location,actor);
 end if;
 update public.vehicles set keys_recorded=true,keys_revision=keys_revision+1 where id=v.id;
end $$;
create function public.change_vehicle_key(p_vehicle uuid,p_key uuid,p_expected_revision integer,p_action text,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.change_vehicle_key(p_vehicle,p_key,p_expected_revision,p_action,p_values) $$;

-- A new endpoint leaves historical callers compatible. All new UI completions use this endpoint.
create function private.finalize_handover_v2(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb,p_expected_revision integer,p_keys jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; v public.vehicles; r text; k public.vehicle_keys; picked uuid[]; expected integer; key_data jsonb; result uuid; actor text;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Auftrag fehlt'; end if;
 r:=private.member_role(o.organization_id);
 if coalesce(r,'') not in ('admin','dispatcher') and not (coalesce(r,'')='driver' and exists(select 1 from public.drivers where id=o.driver_id and organization_id=o.organization_id and user_id=auth.uid())) then raise exception 'Keine Berechtigung'; end if;
 select * into v from public.vehicles where id=o.vehicle_id and organization_id=o.organization_id for update;
 if p_keys is null or jsonb_typeof(p_keys) is distinct from 'object' or (p_keys->>'revision')::integer is distinct from v.keys_revision or jsonb_typeof(p_keys->'selected') is distinct from 'array' then raise exception 'Schlüsselbestand wurde inzwischen geändert. Bitte neu laden.'; end if;
 picked:=array(select jsonb_array_elements_text(p_keys->'selected')::uuid);
 if cardinality(picked)<>(select count(distinct id) from unnest(picked) id) then raise exception 'Doppelte Schlüsselauswahl'; end if;
 select count(*) into expected from public.vehicle_keys where vehicle_id=v.id and state in ('available','issued');
 if exists(select 1 from unnest(picked) picked_key where not exists(select 1 from public.vehicle_keys vk where vk.id=picked_key and vk.vehicle_id=v.id and vk.organization_id=v.organization_id and vk.state in ('available','issued'))) then raise exception 'Schlüsselauswahl ungültig'; end if;
 if v.keys_recorded and coalesce((p_keys->>'confirmed')::boolean,false)=false then raise exception 'Bitte Schlüsselbestand bestätigen'; end if;
 if v.keys_recorded and cardinality(picked)<>expected and length(trim(coalesce(p_keys->>'notes','')))=0 then raise exception 'Abweichende Schlüsselanzahl benötigt eine Begründung'; end if;
 if length(coalesce(p_keys->>'notes',''))>1000 then raise exception 'Schlüsselhinweis zu lang'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'identifier',identifier) order by label),'[]') into key_data from public.vehicle_keys where id=any(picked);
 result:=private.finalize_handover(p_id,p_order_id,p_kind,p_mileage,p_fuel,p_signer,p_signature,p_notes,p_photos,p_damages,p_expected_revision);
 update public.handovers set key_snapshot=jsonb_build_object('recorded',v.keys_recorded,'selected',key_data,'expected_count',expected,'notes',coalesce(p_keys->>'notes','')) where id=result;
 select name into actor from public.memberships where organization_id=o.organization_id and user_id=auth.uid();
 for k in select * from public.vehicle_keys where id=any(picked) for update loop
  update public.vehicle_keys set state=case when p_kind='pickup' then 'issued' else 'available' end,
   custodian=case when p_kind='pickup' then (select name from public.drivers where id=o.driver_id) else '' end,
   location=case when p_kind='pickup' then 'Beim Fahrer: '||(select name from public.drivers where id=o.driver_id) else o.destination end where id=k.id;
  insert into public.key_movements(vehicle_id,organization_id,key_id,key_label,action,person,location,actor_name,handover_id)
   values(v.id,v.organization_id,k.id,k.label,p_kind,left(p_signer,120),case when p_kind='pickup' then 'Beim Fahrer' else o.destination end,coalesce(actor,''),result);
 end loop;
 update public.vehicles set keys_revision=keys_revision+1 where id=v.id;
 return result;
end $$;
create function public.finalize_handover_v2(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb,p_expected_revision integer,p_keys jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.finalize_handover_v2(p_id,p_order_id,p_kind,p_mileage,p_fuel,p_signer,p_signature,p_notes,p_photos,p_damages,p_expected_revision,p_keys) $$;

do $$
declare f record;
begin
 for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.proname in ('save_vehicle_holder','register_vehicle_asset','remove_vehicle_asset','change_vehicle_key','finalize_handover_v2') loop
  execute format('revoke all on function %I.%I(%s) from public,anon',f.nspname,f.proname,f.args);
  execute format('grant execute on function %I.%I(%s) to authenticated',f.nspname,f.proname,f.args);
 end loop;
end $$;

create or replace function private.update_vehicle(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; next public.vehicles; floor integer;
begin
 select * into v from public.vehicles where id=p_id for update;
 if not found then raise exception 'Datensatz fehlt'; end if;
 if auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from v.revision then raise exception 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.'; end if;
 next := jsonb_populate_record(v,p_values);
 if next.id<>v.id or next.organization_id<>v.organization_id then raise exception 'Mandant oder ID kann nicht verändert werden'; end if;
 if length(trim(next.plate))=0 or length(trim(next.make))=0 or length(trim(next.model))=0 or length(trim(next.color))=0 or length(trim(next.location))=0 then raise exception 'Bitte alle Fahrzeugfelder ausfüllen'; end if;
 select coalesce(max(h.mileage),0) into floor from public.handovers h join public.orders o on o.id=h.order_id and o.organization_id=h.organization_id where o.vehicle_id=v.id and o.organization_id=v.organization_id;
 if next.mileage<floor then raise exception 'Kilometerstand muss mindestens % km betragen',floor; end if;
 if exists(select 1 from public.orders where vehicle_id=v.id and organization_id=v.organization_id and status='in_transit') and (next.mileage is distinct from v.mileage or next.location is distinct from v.location) then raise exception 'Während des Transports werden Kilometerstand und Standort durch das Protokoll aktualisiert.'; end if;
 update public.vehicles set plate=upper(trim(next.plate)),vin=upper(trim(next.vin)),make=trim(next.make),model=trim(next.model),color=trim(next.color),mileage=next.mileage,location=trim(next.location),variant=trim(next.variant),equipment=next.equipment,equipment_notes=trim(next.equipment_notes),build_year=next.build_year,first_registration=next.first_registration where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,description) values(v.organization_id,v.id,'Fahrzeugdaten aktualisiert: '||v.plate||' → '||upper(trim(next.plate)));
end $$;

create function private.validate_vehicle_dates() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.build_year>extract(year from current_date)+1 or new.first_registration>current_date then raise exception 'Baujahr oder Erstzulassung ist ungültig'; end if;
 return new;
end $$;
revoke all on function private.validate_vehicle_dates() from public;
create trigger validate_vehicle_dates before insert or update of build_year,first_registration on public.vehicles for each row execute function private.validate_vehicle_dates();
create function private.save_vehicle_record(p_id uuid,p_org uuid,p_revision integer,p_values jsonb,p_holder jsonb,p_holder_revision integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(private.member_role(p_org),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_revision=0 then
  insert into public.vehicles(id,organization_id,plate,vin,make,model,color,mileage,location,variant,equipment,equipment_notes,build_year,first_registration)
  values(p_id,p_org,upper(trim(p_values->>'plate')),upper(trim(p_values->>'vin')),trim(p_values->>'make'),trim(p_values->>'model'),trim(p_values->>'color'),(p_values->>'mileage')::integer,trim(p_values->>'location'),coalesce(p_values->>'variant',''),array(select jsonb_array_elements_text(coalesce(p_values->'equipment','[]'))),coalesce(p_values->>'equipment_notes',''),(p_values->>'build_year')::integer,(p_values->>'first_registration')::date);
 else
  if not exists(select 1 from public.vehicles where id=p_id and organization_id=p_org) then raise exception 'Fahrzeug fehlt'; end if;
  perform private.update_vehicle(p_id,p_revision,p_values);
 end if;
 if p_holder is not null then perform private.save_vehicle_holder(p_id,p_holder_revision,p_holder); end if;
end $$;
create function public.save_vehicle_record(p_id uuid,p_org uuid,p_revision integer,p_values jsonb,p_holder jsonb,p_holder_revision integer) returns void language sql security invoker set search_path='' as $$ select private.save_vehicle_record(p_id,p_org,p_revision,p_values,p_holder,p_holder_revision) $$;
revoke all on function private.save_vehicle_record(uuid,uuid,integer,jsonb,jsonb,integer),public.save_vehicle_record(uuid,uuid,integer,jsonb,jsonb,integer) from public,anon;
grant execute on function private.save_vehicle_record(uuid,uuid,integer,jsonb,jsonb,integer),public.save_vehicle_record(uuid,uuid,integer,jsonb,jsonb,integer) to authenticated;
-- Cover the complete composite vehicle foreign key used by holder authorization.
create index vehicle_holders_vehicle_idx on public.vehicle_holders(vehicle_id,organization_id);

-- Migration 20261002094207: fleet_inventory
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
