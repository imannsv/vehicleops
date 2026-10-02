alter table public.organizations add column revision integer not null default 1;
alter table public.organizations add column business_type text not null default 'combined' check(business_type in ('dealer','transfer','combined'));
alter table public.organizations add column profile jsonb not null default '{}' check(jsonb_typeof(profile)='object');
alter table public.organizations add column logo_path text;
alter table public.organizations add column vehicle_counter bigint not null default 0;
alter table public.vehicles alter column plate drop not null;
alter table public.vehicles drop constraint vehicles_plate_check;
alter table public.vehicles add constraint vehicles_plate_check check(plate is null or length(trim(plate))>0);
alter table public.vehicles add column stock_number text;
alter table public.vehicles add column generation text not null default '' check(length(generation)<=120);
alter table public.vehicles add column inventory_kind text not null default 'unassigned' check(inventory_kind in ('unassigned','owned','customer'));
alter table public.vehicles add column inventory_status text check(inventory_status in ('stock','reserved','sold','rented'));
alter table public.vehicles add constraint inventory_owned_status check(inventory_kind='owned' or inventory_status is null);
with numbered as (select id,row_number() over(partition by organization_id order by id) n from public.vehicles)
update public.vehicles v set stock_number='FZ-'||lpad(n.n::text,greatest(6,length(n.n::text)),'0') from numbered n where v.id=n.id;
update public.organizations o set vehicle_counter=(select count(*) from public.vehicles where organization_id=o.id);
alter table public.vehicles alter column stock_number set not null;
alter table public.vehicles add unique(organization_id,stock_number);
alter table public.orders add column transport_plate text;

create table public.stock_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,vehicle_id uuid not null,
 previous_kind text, next_kind text not null,previous_status text,next_status text,
 reason text not null check(length(trim(reason)) between 1 and 1000), actor_name text not null,
 created_at timestamptz not null default now(),handover_id uuid,
 foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id),
 foreign key(handover_id,organization_id) references public.handovers(id,organization_id)
);
create index stock_events_vehicle_idx on public.stock_events(vehicle_id,organization_id);
create index stock_events_org_idx on public.stock_events(organization_id);
create index stock_events_handover_idx on public.stock_events(handover_id,organization_id);
alter table public.stock_events enable row level security;
revoke all on public.stock_events from public,anon,authenticated;
grant select on public.stock_events to authenticated;
create policy stock_events_read on public.stock_events for select to authenticated using(private.member_role(organization_id) is not null);

create function private.assign_vehicle_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
 new.plate:=nullif(upper(trim(new.plate)),'');
 if tg_op='INSERT' then
  update public.organizations set vehicle_counter=vehicle_counter+1 where id=new.organization_id returning vehicle_counter into n;
  if n is null then raise exception 'Organisation fehlt'; end if;
  new.stock_number:='FZ-'||lpad(n::text,greatest(6,length(n::text)),'0');
 elsif new.stock_number is distinct from old.stock_number then raise exception 'Bestandsnummer ist unveränderlich'; end if;
 return new;
end $$;
create trigger assign_vehicle_identity before insert or update on public.vehicles for each row execute function private.assign_vehicle_identity();
revoke all on function private.assign_vehicle_identity() from public,anon,authenticated;

create function private.record_stock_change() returns trigger language plpgsql security definer set search_path='' as $$
declare reason text;actor text;
begin
 if new.inventory_kind is not distinct from old.inventory_kind and new.inventory_status is not distinct from old.inventory_status then return new;end if;
 reason:=nullif(trim(current_setting('vehicleops.stock_reason',true)),'');
 if reason is null or length(reason)>1000 then raise exception 'Bestandsänderung benötigt einen Anlass';end if;
 select name into actor from public.memberships where user_id=auth.uid() and organization_id=new.organization_id;
 insert into public.stock_events(organization_id,vehicle_id,previous_kind,next_kind,previous_status,next_status,reason,actor_name,handover_id)
 values(new.organization_id,new.id,old.inventory_kind,new.inventory_kind,old.inventory_status,new.inventory_status,reason,coalesce(actor,'System'),nullif(current_setting('vehicleops.movement_handover',true),'')::uuid);
 return new;
end $$;
create trigger record_stock_change after update of inventory_kind,inventory_status on public.vehicles for each row execute function private.record_stock_change();
revoke all on function private.record_stock_change() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('company-logos','company-logos',false,10485760,array['image/png']);
create policy company_logo_insert on storage.objects for insert to authenticated with check(bucket_id='company-logos' and exists(select 1 from public.organizations o where o.id::text=(storage.foldername(storage.objects.name))[1] and private.member_role(o.id)='admin'));
create policy company_logo_read on storage.objects for select to authenticated using(bucket_id='company-logos' and exists(select 1 from public.organizations o where o.id::text=(storage.foldername(storage.objects.name))[1]));
-- Logos are versioned evidence. No update/delete policy permits replacing a referenced logo.
create function private.save_company(p_org uuid,p_revision integer,p_name text,p_type text,p_profile jsonb,p_logo text) returns void language plpgsql security definer set search_path='' as $$
declare o public.organizations; entry record;
begin
 if auth.uid() is null or coalesce(private.member_role(p_org),'')<>'admin' then raise exception 'Keine Berechtigung';end if;
 select * into o from public.organizations where id=p_org for update;
 if o.revision is distinct from p_revision then raise exception 'Unternehmen wurde inzwischen geändert. Bitte neu laden.';end if;
 if jsonb_typeof(p_profile) is distinct from 'object' then raise exception 'Firmenangaben ungültig';end if;
 for entry in select * from jsonb_each(p_profile) loop
  if entry.key not in ('legal_form','management','street','postal_code','city','country','email','phone','website','tax_number','vat_id','register_court','register_number') or jsonb_typeof(entry.value)<>'string' or length(entry.value#>>'{}')>300 then raise exception 'Firmenangaben ungültig';end if;
 end loop;
 if coalesce(p_profile->>'website','')<>'' and p_profile->>'website' !~ '^https?://' then raise exception 'Webseite benötigt http oder https';end if;
 if p_logo is not null and (left(p_logo,length(p_org::text)+1)<>p_org::text||'/' or not exists(select 1 from storage.objects where bucket_id='company-logos' and name=p_logo and metadata->>'mimetype'='image/png')) then raise exception 'Logo fehlt';end if;
 update public.organizations set name=trim(p_name),business_type=p_type,profile=p_profile,logo_path=p_logo,revision=revision+1 where id=p_org;
end $$;
create function public.save_company(p_org uuid,p_revision integer,p_name text,p_type text,p_profile jsonb,p_logo text) returns void language sql security invoker set search_path='' as $$select private.save_company(p_org,p_revision,p_name,p_type,p_profile,p_logo)$$;
revoke all on function private.save_company(uuid,integer,text,text,jsonb,text),public.save_company(uuid,integer,text,text,jsonb,text) from public,anon;
grant execute on function private.save_company(uuid,integer,text,text,jsonb,text),public.save_company(uuid,integer,text,text,jsonb,text) to authenticated;

create or replace function private.update_vehicle(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; next public.vehicles; floor integer;
begin
 select * into v from public.vehicles where id=p_id for update;
 if not found then raise exception 'Datensatz fehlt'; end if;
 if auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from v.revision then raise exception 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.'; end if;
 perform set_config('vehicleops.stock_reason',coalesce(p_values->>'stock_reason',''),true);
 next := jsonb_populate_record(v,p_values);
 if next.id<>v.id or next.organization_id<>v.organization_id then raise exception 'Mandant oder ID kann nicht verändert werden'; end if;
 if length(trim(next.make))=0 or length(trim(next.model))=0 or length(trim(next.color))=0 or length(trim(next.location))=0 then raise exception 'Bitte alle Fahrzeugfelder ausfüllen'; end if;
 select coalesce(max(h.mileage),0) into floor from public.handovers h join public.orders o on o.id=h.order_id and o.organization_id=h.organization_id where o.vehicle_id=v.id and o.organization_id=v.organization_id;
 if next.mileage<floor then raise exception 'Kilometerstand muss mindestens % km betragen',floor; end if;
 if exists(select 1 from public.orders where vehicle_id=v.id and organization_id=v.organization_id and status='in_transit') and (next.mileage is distinct from v.mileage or next.location is distinct from v.location) then raise exception 'Während des Transports werden Kilometerstand und Standort durch das Protokoll aktualisiert.'; end if;
 update public.vehicles set plate=upper(trim(next.plate)),vin=upper(trim(next.vin)),make=trim(next.make),model=trim(next.model),color=trim(next.color),mileage=next.mileage,location=trim(next.location),variant=trim(next.variant),equipment=next.equipment,equipment_notes=trim(next.equipment_notes),build_year=next.build_year,first_registration=next.first_registration,generation=trim(next.generation),inventory_kind=next.inventory_kind,inventory_status=next.inventory_status where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,description) values(v.organization_id,v.id,'Fahrzeugdaten aktualisiert: '||v.stock_number);
end $$;


create or replace function private.save_vehicle_record(p_id uuid,p_org uuid,p_revision integer,p_values jsonb,p_holder jsonb,p_holder_revision integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(private.member_role(p_org),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_revision=0 then
  insert into public.vehicles(id,organization_id,plate,vin,make,model,color,mileage,location,variant,equipment,equipment_notes,build_year,first_registration,generation,inventory_kind,inventory_status)
  values(p_id,p_org,upper(trim(p_values->>'plate')),upper(trim(p_values->>'vin')),trim(p_values->>'make'),trim(p_values->>'model'),trim(p_values->>'color'),(p_values->>'mileage')::integer,trim(p_values->>'location'),coalesce(p_values->>'variant',''),array(select jsonb_array_elements_text(coalesce(p_values->'equipment','[]'))),coalesce(p_values->>'equipment_notes',''),(p_values->>'build_year')::integer,(p_values->>'first_registration')::date,coalesce(p_values->>'generation',''),coalesce(p_values->>'inventory_kind','unassigned'),p_values->>'inventory_status');
 else
  if not exists(select 1 from public.vehicles where id=p_id and organization_id=p_org) then raise exception 'Fahrzeug fehlt'; end if;
  perform private.update_vehicle(p_id,p_revision,p_values);
 end if;
 if p_holder is not null then perform private.save_vehicle_holder(p_id,p_holder_revision,p_holder); end if;
end $$;

create or replace function private.update_order(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
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
