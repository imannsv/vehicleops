alter table public.handovers add column vehicle_id uuid;
update public.handovers h set vehicle_id=o.vehicle_id from public.orders o where o.id=h.order_id;
alter table public.handovers alter column vehicle_id set not null;
alter table public.handovers add foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id);
create index handovers_vehicle_idx on public.handovers(vehicle_id,organization_id);
alter table public.handovers alter column order_id drop not null;
alter table public.handovers add column version integer not null default 1 check(version in (1,2));
alter table public.handovers add column purpose text not null default 'transport' check(purpose in ('transport','purchase','sale','rental','return','other'));
alter table public.handovers add column parties jsonb;
alter table public.handovers add column position jsonb;
alter table public.handovers add column transport_plate text;
alter table public.handovers add column signature_bucket text not null default 'evidence';
alter table public.handovers add column request_hash text;
alter table public.handover_photos add column bucket text not null default 'evidence';
create or replace function private.capture_protocol_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.version=1 then
  select jsonb_build_object('organization_name',g.name,'vehicle',to_jsonb(v),'driver',to_jsonb(d),'order',to_jsonb(o)) ,v.id into new.snapshot,new.vehicle_id
  from public.orders o join public.vehicles v on v.id=o.vehicle_id and v.organization_id=o.organization_id join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id join public.organizations g on g.id=o.organization_id where o.id=new.order_id and o.organization_id=new.organization_id;
 end if;
 return new;
end $$;

create table public.protocol_sessions (
 id uuid primary key,organization_id uuid not null,vehicle_id uuid not null,order_id uuid,kind text not null check(kind in ('pickup','delivery')),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),vehicle_revision integer not null,order_revision integer,closed boolean not null default false,
 foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id),foreign key(order_id,organization_id) references public.orders(id,organization_id)
);
create index protocol_sessions_vehicle_idx on public.protocol_sessions(vehicle_id,organization_id);
create index protocol_sessions_order_idx on public.protocol_sessions(order_id,organization_id);
create index protocol_sessions_creator_idx on public.protocol_sessions(created_by);
create index protocol_sessions_org_idx on public.protocol_sessions(organization_id);
alter table public.protocol_sessions enable row level security;
revoke all on public.protocol_sessions from public,anon,authenticated;
grant select on public.protocol_sessions to authenticated;
create policy protocol_session_read on public.protocol_sessions for select to authenticated using(created_by=(select auth.uid()) and private.member_role(organization_id) is not null);

create function private.can_use_protocol(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.protocol_sessions s where s.id=p_id and s.created_by=auth.uid() and (
private.member_role(s.organization_id) in ('admin','dispatcher') or (private.member_role(s.organization_id)='driver' and exists(select 1 from public.orders o join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id where o.id=s.order_id and o.organization_id=s.organization_id and o.vehicle_id=s.vehicle_id and d.user_id=auth.uid() and o.status in ('assigned','in_transit')))))
$$;
revoke all on function private.can_use_protocol(uuid) from public,anon;
grant execute on function private.can_use_protocol(uuid) to authenticated;
create function private.start_protocol(p_id uuid,p_vehicle uuid,p_order uuid,p_kind text) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.vehicles;o public.orders;r text;s public.protocol_sessions;
begin
 select * into v from public.vehicles where id=p_vehicle;
 if not found or auth.uid() is null then raise exception 'Fahrzeug fehlt oder Anmeldung erforderlich';end if;
 r:=private.member_role(v.organization_id);
 if p_order is not null then
  select * into o from public.orders where id=p_order and organization_id=v.organization_id and vehicle_id=v.id;
  if not found or not ((p_kind='pickup' and o.status='assigned') or (p_kind='delivery' and o.status='in_transit')) then raise exception 'Auftragsstatus erlaubt diesen Vorgang nicht';end if;
  if not (coalesce(r,'') in ('admin','dispatcher') or (r='driver' and exists(select 1 from public.drivers where id=o.driver_id and user_id=auth.uid()))) then raise exception 'Keine Berechtigung';end if;
 else
  if coalesce(r,'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung';end if;
  if exists(select 1 from public.orders where vehicle_id=v.id and status='in_transit') then raise exception 'Fahrzeug ist in Transport';end if;
 end if;
 select * into s from public.protocol_sessions where id=p_id;
 if found then
  if s.created_by<>auth.uid() or s.vehicle_id<>v.id or s.order_id is distinct from p_order or s.kind<>p_kind then raise exception 'Protokoll-ID bereits verwendet';end if;
 else
  insert into public.protocol_sessions(id,organization_id,vehicle_id,order_id,kind,created_by,vehicle_revision,order_revision) values(p_id,v.organization_id,v.id,p_order,p_kind,auth.uid(),v.revision,o.revision);
 end if;
 return p_id;
end $$;
create function public.start_protocol(p_id uuid,p_vehicle uuid,p_order uuid,p_kind text) returns uuid language sql security invoker set search_path='' as $$select private.start_protocol(p_id,p_vehicle,p_order,p_kind)$$;
revoke all on function private.start_protocol(uuid,uuid,uuid,text),public.start_protocol(uuid,uuid,uuid,text) from public,anon;
grant execute on function private.start_protocol(uuid,uuid,uuid,text),public.start_protocol(uuid,uuid,uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('protocol-media','protocol-media',false,5242880,array['image/jpeg','image/png']);
create policy protocol_media_insert on storage.objects for insert to authenticated with check(bucket_id='protocol-media' and exists(select 1 from public.protocol_sessions s where s.id::text=(storage.foldername(storage.objects.name))[2] and s.organization_id::text=(storage.foldername(storage.objects.name))[1] and not s.closed and private.can_use_protocol(s.id)));
create policy protocol_media_read on storage.objects for select to authenticated using(bucket_id='protocol-media' and exists(select 1 from public.organizations o where o.id::text=(storage.foldername(storage.objects.name))[1]));
create policy protocol_media_cleanup on storage.objects for delete to authenticated using(bucket_id='protocol-media' and owner_id=auth.uid()::text and not exists(select 1 from public.handover_photos p where p.bucket=bucket_id and p.path=name) and not exists(select 1 from public.handovers h where h.signature_bucket=bucket_id and (h.signature=name or h.parties->'giver'->>'signature'=name or h.parties->'receiver'->>'signature'=name)));

create function private.finalize_protocol(p_id uuid,p_values jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.protocol_sessions;v public.vehicles;o public.orders;org public.organizations;old public.handovers;r text;fingerprint text;prefix text;photo jsonb;party jsonb;dam jsonb;keys jsonb;picked uuid[];key_data jsonb;expected integer;k public.vehicle_keys;actor text;target text;site uuid;space uuid;main_signature text;signer text;purpose text;body jsonb;
begin
 select * into s from public.protocol_sessions where id=p_id for update;
 if not found or auth.uid() is null or s.created_by<>auth.uid() then raise exception 'Protokoll fehlt oder keine Berechtigung';end if;
 r:=private.member_role(s.organization_id);
 if coalesce(r,'') not in ('admin','dispatcher') and not (r='driver' and exists(select 1 from public.orders a join public.drivers d on d.id=a.driver_id where a.id=s.order_id and a.organization_id=s.organization_id and d.user_id=auth.uid())) then raise exception 'Keine Berechtigung';end if;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Protokoll ungültig';end if;
 fingerprint:=encode(extensions.digest(p_values::text,'sha256'),'hex');
 select * into old from public.handovers where id=p_id;
 if found then if old.request_hash=fingerprint then return p_id;else raise exception 'Protokoll-ID mit anderem Inhalt bereits abgeschlossen';end if;end if;
 if s.order_id is not null then
  select * into o from public.orders where id=s.order_id for update;
  if o.vehicle_id<>s.vehicle_id or o.revision<>s.order_revision or (p_values->>'order_revision')::integer is distinct from o.revision or not ((s.kind='pickup' and o.status='assigned') or (s.kind='delivery' and o.status='in_transit')) then raise exception 'Auftrag wurde inzwischen geändert. Bitte Entwurf neu prüfen.';end if;
 end if;
 select * into v from public.vehicles where id=s.vehicle_id for update;
 if v.revision<>s.vehicle_revision or (p_values->>'vehicle_revision')::integer is distinct from v.revision then raise exception 'Fahrzeug wurde inzwischen geändert. Bitte Entwurf neu prüfen.';end if;
 if s.order_id is null and exists(select 1 from public.orders where vehicle_id=v.id and status='in_transit') then raise exception 'Fahrzeug ist in Transport';end if;
 select * into org from public.organizations where id=s.organization_id for share;
 if (p_values->>'company_revision')::integer is distinct from org.revision then raise exception 'Unternehmensprofil wurde geändert. Bitte neu prüfen.';end if;
 purpose:=case when s.order_id is not null then 'transport' else p_values->>'purpose' end;
 if purpose is null or purpose not in ('transport','purchase','sale','rental','return','other') or (s.order_id is null and purpose='transport') then raise exception 'Anlass fehlt';end if;
 if (p_values->>'mileage')::integer<v.mileage or (p_values->>'mileage') is null or (p_values->>'fuel')::integer not between 0 and 100 or p_values->>'fuel' is null then raise exception 'Kilometer oder Tank-/Ladestand ungültig';end if;
 prefix:=s.organization_id::text||'/'||p_id::text||'/';
 body:=p_values->'parties';
 if jsonb_typeof(body) is distinct from 'object' then raise exception 'Beteiligte fehlen';end if;
 for party in select value from jsonb_each(body) where key in ('giver','receiver') loop
  if length(trim(coalesce(party->>'name',''))) not between 1 and 120 or length(trim(coalesce(party->>'role',''))) not between 1 and 120 then raise exception 'Beide Beteiligten benötigen Name und Funktion';end if;
  if coalesce(party->>'signature','')<>'' and (left(party->>'signature',length(prefix))<>prefix or not exists(select 1 from storage.objects where bucket_id='protocol-media' and name=party->>'signature' and owner_id=auth.uid()::text and metadata->>'mimetype'='image/png')) then raise exception 'Unterschriftdatei fehlt';end if;
 end loop;
 if not (body ? 'giver' and body ? 'receiver') then raise exception 'Beide Beteiligten fehlen';end if;
 main_signature:=coalesce(nullif(body->'receiver'->>'signature',''),nullif(body->'giver'->>'signature',''));
 if main_signature is null then raise exception 'Mindestens eine Unterschrift erforderlich';end if;
 if coalesce(body->'giver'->>'signature','')='' or coalesce(body->'receiver'->>'signature','')='' then
  if coalesce((body->>'exception_confirmed')::boolean,false)=false or length(trim(coalesce(body->>'exception_reason',''))) not between 1 and 1000 then raise exception 'Fehlende Unterschrift benötigt bestätigte Ausnahme und Begründung';end if;
 elsif body->'giver'->>'signature'=body->'receiver'->>'signature' then raise exception 'Unterschriften benötigen getrennte Dateien';end if;
 if length(coalesce(p_values->>'transport_plate',''))>40 then raise exception 'Transportkennzeichen zu lang';end if;
 if length(coalesce(p_values->>'notes',''))>4000 then raise exception 'Hinweise zu lang';end if;
 if jsonb_typeof(p_values->'photos') is distinct from 'array' or (select count(distinct item->>'slot') from jsonb_array_elements(p_values->'photos') item where item->>'slot' in ('Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho'))<>10 then raise exception 'Zehn Pflichtperspektiven erforderlich';end if;
 if exists(select 1 from jsonb_array_elements(p_values->'photos') item where item->>'slot' is null or item->>'slot' not in ('Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho')) or exists(select 1 from jsonb_array_elements(p_values->'photos') item where item->>'slot'<>'Innenraum' group by item->>'slot' having count(*)>1) then raise exception 'Ungültige Fotoperspektiven';end if;
 if (select count(distinct item->>'path') from jsonb_array_elements(p_values->'photos') item)<>jsonb_array_length(p_values->'photos') then raise exception 'Separate Fotodateien erforderlich';end if;
 for photo in select * from jsonb_array_elements(p_values->'photos') loop
  if photo->>'path' is null or left(photo->>'path',length(prefix))<>prefix or not exists(select 1 from storage.objects where bucket_id='protocol-media' and name=photo->>'path' and owner_id=auth.uid()::text and metadata->>'mimetype'='image/jpeg') then raise exception 'Fotodatei fehlt';end if;
 end loop;
 keys:=p_values->'keys';
 if jsonb_typeof(keys) is distinct from 'object' or (keys->>'revision')::integer is distinct from v.keys_revision or jsonb_typeof(keys->'selected') is distinct from 'array' then raise exception 'Schlüsselbestand wurde geändert';end if;
 picked:=array(select jsonb_array_elements_text(keys->'selected')::uuid);
 if cardinality(picked)<>(select count(distinct value) from unnest(picked) value) or exists(select 1 from unnest(picked) value where not exists(select 1 from public.vehicle_keys where id=value and vehicle_id=v.id and state in ('available','issued'))) then raise exception 'Schlüsselauswahl ungültig';end if;
 select count(*) into expected from public.vehicle_keys where vehicle_id=v.id and state in ('available','issued');
 if v.keys_recorded and (coalesce((keys->>'confirmed')::boolean,false)=false or (expected<>cardinality(picked) and length(trim(coalesce(keys->>'notes','')))=0)) then raise exception 'Schlüsselbestand bestätigen und Abweichung begründen';end if;
 if length(coalesce(keys->>'notes',''))>1000 then raise exception 'Schlüsselhinweis zu lang';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'identifier',identifier) order by label),'[]') into key_data from public.vehicle_keys where id=any(picked);
 if s.order_id is null then
  if coalesce((p_values->'position'->>'confirmed')::boolean,false)=false then raise exception 'Tatsächliche Position bestätigen';end if;
  site:=nullif(p_values->'position'->>'site_id','')::uuid;space:=nullif(p_values->'position'->>'space_id','')::uuid;
  if site is not null then select name into target from public.fleet_sites where id=site and organization_id=v.organization_id;if not found then raise exception 'Standort ungültig';end if;
  else target:=trim(p_values->'position'->>'location');end if;
  if length(coalesce(target,'')) not between 1 and 240 then raise exception 'Position fehlt';end if;
  if space is not null and (site is null or not exists(select 1 from public.parking_spaces where id=space and site_id=site and organization_id=v.organization_id)) then raise exception 'Stellplatz ungültig';end if;
  if v.inventory_kind='owned' then
   if coalesce((p_values->>'stock_confirmed')::boolean,false)=false then raise exception 'Bestandsstatus bestätigen';end if;
  elsif nullif(p_values->>'stock_status','') is not null then raise exception 'Bestandsstatus nur für eigenen Bestand';end if;
 else
  target:=case when s.kind='pickup' then 'In Transport' else o.destination end;
  if nullif(p_values->>'stock_status','') is distinct from v.inventory_status then raise exception 'Transport ändert keinen Verkaufsstatus';end if;
 end if;
 signer:=case when coalesce(body->'receiver'->>'signature','')<>'' then body->'receiver'->>'name' else body->'giver'->>'name' end;
 insert into public.handovers(id,organization_id,vehicle_id,order_id,kind,mileage,fuel,signer,signature,signature_bucket,notes,created_by,version,purpose,parties,position,transport_plate,request_hash,snapshot,key_snapshot)
 values(p_id,s.organization_id,v.id,s.order_id,s.kind,(p_values->>'mileage')::integer,(p_values->>'fuel')::integer,signer,main_signature,'protocol-media',coalesce(p_values->>'notes',''),auth.uid(),2,purpose,body,jsonb_build_object('location',target,'site_id',site,'space_id',space,'space_label',(select label from public.parking_spaces where id=space and organization_id=v.organization_id),'stock_status',case when s.order_id is null and v.inventory_kind='owned' then nullif(p_values->>'stock_status','') else v.inventory_status end),nullif(upper(trim(p_values->>'transport_plate')),''),fingerprint,
 jsonb_build_object('organization_name',org.name,'known_damages',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'area',d.area,'description',d.description)),'[]'::jsonb) from public.damages d where d.vehicle_id=v.id and d.organization_id=v.organization_id),'organization',jsonb_build_object('id',org.id,'name',org.name,'profile',org.profile,'logo_path',org.logo_path),'vehicle',to_jsonb(v),'order',case when s.order_id is not null then to_jsonb(o) end,'driver',case when s.order_id is not null then (select to_jsonb(d) from public.drivers d where id=o.driver_id) end),
 jsonb_build_object('recorded',v.keys_recorded,'selected',key_data,'expected_count',expected,'notes',coalesce(keys->>'notes','')));
 insert into public.handover_photos(organization_id,handover_id,slot,path,sequence,bucket) select s.organization_id,p_id,item->>'slot',item->>'path',(row_number() over(partition by item->>'slot' order by ordinality)-1)::integer,'protocol-media' from jsonb_array_elements(p_values->'photos') with ordinality as elements(item,ordinality);
 if jsonb_typeof(p_values->'damages') is distinct from 'array' then raise exception 'Schäden ungültig';end if;
 for dam in select * from jsonb_array_elements(p_values->'damages') loop insert into public.damages(organization_id,vehicle_id,handover_id,area,description) values(s.organization_id,v.id,p_id,trim(dam->>'area'),trim(dam->>'description'));end loop;
 perform set_config('vehicleops.movement_source',case when s.order_id is null then 'manual' else s.kind end,true);
 perform set_config('vehicleops.movement_reason',case when s.order_id is null then 'Eigenständiges Protokoll: '||purpose else 'Transportprotokoll: '||o.reference end,true);
 perform set_config('vehicleops.movement_handover',p_id::text,true);
 perform set_config('vehicleops.stock_reason','Protokoll: '||purpose,true);
 update public.vehicles set mileage=(p_values->>'mileage')::integer,location=target,site_id=site,parking_space_id=space,
 inventory_status=case when s.order_id is null and v.inventory_kind='owned' then nullif(p_values->>'stock_status','') else v.inventory_status end,keys_revision=keys_revision+1 where id=v.id;
 if s.order_id is not null then update public.orders set status=case when s.kind='pickup' then 'in_transit' else 'completed' end where id=o.id;end if;
 select name into actor from public.memberships where organization_id=s.organization_id and user_id=auth.uid();
 for k in select * from public.vehicle_keys where id=any(picked) for update loop
  update public.vehicle_keys set state=case when (s.order_id is null and s.kind='pickup') or (s.order_id is not null and s.kind='delivery') then 'available' else 'issued' end,location=target,custodian=case when (s.order_id is null and s.kind='pickup') or (s.order_id is not null and s.kind='delivery') then '' else body->'receiver'->>'name' end where id=k.id;
  insert into public.key_movements(organization_id,vehicle_id,key_id,key_label,action,person,location,actor_name,handover_id) values(s.organization_id,v.id,k.id,k.label,s.kind,body->'receiver'->>'name',target,actor,p_id);
 end loop;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(s.organization_id,v.id,s.order_id,case when s.kind='pickup' then 'Fahrzeugübernahme' else 'Fahrzeugübergabe' end||case when s.order_id is not null then ' '||o.reference else ' · '||purpose end);
 update public.protocol_sessions set closed=true where id=p_id;
 return p_id;
end $$;
create function public.finalize_protocol(p_id uuid,p_values jsonb) returns uuid language sql security invoker set search_path='' as $$select private.finalize_protocol(p_id,p_values)$$;
revoke all on function private.finalize_protocol(uuid,jsonb),public.finalize_protocol(uuid,jsonb) from public,anon;
grant execute on function private.finalize_protocol(uuid,jsonb),public.finalize_protocol(uuid,jsonb) to authenticated;

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
 select coalesce(max(h.mileage),0) into floor from public.handovers h where h.vehicle_id=v.id and h.organization_id=v.organization_id;
 if next.mileage<floor then raise exception 'Kilometerstand muss mindestens % km betragen',floor; end if;
 if exists(select 1 from public.orders where vehicle_id=v.id and organization_id=v.organization_id and status='in_transit') and (next.mileage is distinct from v.mileage or next.location is distinct from v.location) then raise exception 'Während des Transports werden Kilometerstand und Standort durch das Protokoll aktualisiert.'; end if;
 update public.vehicles set plate=upper(trim(next.plate)),vin=upper(trim(next.vin)),make=trim(next.make),model=trim(next.model),color=trim(next.color),mileage=next.mileage,location=trim(next.location),variant=trim(next.variant),equipment=next.equipment,equipment_notes=trim(next.equipment_notes),build_year=next.build_year,first_registration=next.first_registration,generation=trim(next.generation),inventory_kind=next.inventory_kind,inventory_status=next.inventory_status where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,description) values(v.organization_id,v.id,'Fahrzeugdaten aktualisiert: '||v.stock_number);
end $$;
