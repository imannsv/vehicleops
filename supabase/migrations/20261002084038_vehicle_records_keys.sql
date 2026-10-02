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
