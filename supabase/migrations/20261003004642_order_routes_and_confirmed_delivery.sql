SET local check_function_bodies = off;

ALTER TABLE "public"."orders"
  ADD COLUMN "pickup_site_id" uuid;

ALTER TABLE "public"."orders"
  ADD COLUMN "destination_site_id" uuid;

ALTER TABLE "public"."orders"
  ADD COLUMN "destination_space_id" uuid;

ALTER TABLE "public"."orders"
  ADD COLUMN "pickup_address" text NOT NULL DEFAULT ''::text;

ALTER TABLE "public"."orders"
  ADD COLUMN "destination_address" text NOT NULL DEFAULT ''::text;

CREATE OR REPLACE FUNCTION private.finalize_protocol (
  p_id     uuid,
  p_values jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare s public.protocol_sessions;v public.vehicles;o public.orders;org public.organizations;old public.handovers;r text;fingerprint text;prefix text;photo jsonb;party jsonb;dam jsonb;keys jsonb;picked uuid[];key_data jsonb;expected integer;k public.vehicle_keys;actor text;violated_constraint text;site_revision integer;space_revision integer;target text;site uuid;space uuid;main_signature text;signer text;purpose text;body jsonb;
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
 if s.order_id is null or (s.kind='delivery' and (coalesce((p_values->>'position_version')::integer,0)=1 or o.destination_site_id is not null)) then
  if coalesce((p_values->'position'->>'confirmed')::boolean,false)=false then raise exception 'Tatsächliche Position bestätigen';end if;
  site:=nullif(p_values->'position'->>'site_id','')::uuid;space:=nullif(p_values->'position'->>'space_id','')::uuid;
  if site is not null then select name,revision into target,site_revision from public.fleet_sites where id=site and organization_id=v.organization_id for share;if not found then raise exception 'Standort ungültig';end if;
   if coalesce((p_values->>'position_version')::integer,0)=1 and (p_values->'position'->>'site_revision')::integer is distinct from site_revision then raise exception 'Standortangaben geändert. Position erneut prüfen und bestätigen.';end if;
  else target:=trim(p_values->'position'->>'location');end if;
  if length(coalesce(target,'')) not between 1 and 240 then raise exception 'Position fehlt';end if;
  if space is not null and (site is null or not exists(select 1 from public.parking_spaces where id=space and site_id=site and organization_id=v.organization_id)) then raise exception 'Stellplatz ungültig';end if;
  if space is not null then
   select revision into space_revision from public.parking_spaces where id=space and site_id=site and organization_id=v.organization_id for share;
   if coalesce((p_values->>'position_version')::integer,0)=1 and (p_values->'position'->>'space_revision')::integer is distinct from space_revision then raise exception 'Stellplatzangaben geändert. Position erneut prüfen und bestätigen.';end if;
  end if;
  if space is not null and exists(select 1 from public.vehicles where parking_space_id=space and id<>v.id) then raise exception 'Stellplatz belegt. Bitte eine freie Position auswählen.';end if;
 else target:=case when s.kind='pickup' then 'In Transport' else o.destination end;
 end if;
 if s.order_id is null then
  if v.inventory_kind='owned' then
   if coalesce((p_values->>'stock_confirmed')::boolean,false)=false then raise exception 'Bestandsstatus bestätigen';end if;
  elsif nullif(p_values->>'stock_status','') is not null then raise exception 'Bestandsstatus nur für eigenen Bestand';end if;
 elsif nullif(p_values->>'stock_status','') is distinct from v.inventory_status then raise exception 'Transport ändert keinen Verkaufsstatus';
 end if;
 signer:=case when coalesce(body->'receiver'->>'signature','')<>'' then body->'receiver'->>'name' else body->'giver'->>'name' end;
 insert into public.handovers(id,organization_id,vehicle_id,order_id,kind,mileage,fuel,signer,signature,signature_bucket,notes,created_by,version,purpose,parties,position,transport_plate,request_hash,snapshot,key_snapshot)
 values(p_id,s.organization_id,v.id,s.order_id,s.kind,(p_values->>'mileage')::integer,(p_values->>'fuel')::integer,signer,main_signature,'protocol-media',coalesce(p_values->>'notes',''),auth.uid(),2,purpose,body,jsonb_build_object('location',case when s.order_id is not null and s.kind='pickup' then o.pickup else target end,'confirmed',case when s.order_id is null or (s.kind='delivery' and (coalesce((p_values->>'position_version')::integer,0)=1 or o.destination_site_id is not null)) then true else false end,'site_id',case when s.order_id is not null and s.kind='pickup' then o.pickup_site_id else site end,'space_id',space,'space_label',(select label from public.parking_spaces where id=space and organization_id=v.organization_id),'stock_status',case when s.order_id is null and v.inventory_kind='owned' then nullif(p_values->>'stock_status','') else v.inventory_status end),nullif(upper(trim(p_values->>'transport_plate')),''),fingerprint,
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
exception when unique_violation then
 get stacked diagnostics violated_constraint=CONSTRAINT_NAME;
 if violated_constraint='vehicles_one_per_space' then raise exception 'Stellplatz belegt. Bitte eine freie Position auswählen.';end if;
 raise;
end $function$;

CREATE OR REPLACE FUNCTION private.normalize_order_route()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare planned public.fleet_sites;
begin
 -- Text-only legacy edits explicitly become free addresses; never retain a stale link.
 if TG_OP='UPDATE' then
  if new.pickup_site_id is not distinct from old.pickup_site_id and new.pickup is distinct from old.pickup then new.pickup_site_id:=null;new.pickup_address:='';end if;
  if new.destination_site_id is not distinct from old.destination_site_id and new.destination is distinct from old.destination then new.destination_site_id:=null;new.destination_space_id:=null;new.destination_address:='';end if;
 end if;
 if new.pickup_site_id is not null then
  select * into planned from public.fleet_sites where id=new.pickup_site_id and organization_id=new.organization_id;
  if not found then raise exception 'Abholstandort gehört nicht zum Unternehmen';end if;
  if TG_OP='INSERT' or new.pickup_site_id is distinct from old.pickup_site_id then new.pickup:=planned.name;new.pickup_address:=planned.address;
  else new.pickup_address:=old.pickup_address;end if;
 else new.pickup_address:='';end if;
 if new.destination_site_id is not null then
  select * into planned from public.fleet_sites where id=new.destination_site_id and organization_id=new.organization_id;
  if not found then raise exception 'Zielstandort gehört nicht zum Unternehmen';end if;
  if TG_OP='INSERT' or new.destination_site_id is distinct from old.destination_site_id then new.destination:=planned.name;new.destination_address:=planned.address;
  else new.destination_address:=old.destination_address;end if;
 else new.destination_address:='';end if;
 if new.destination_space_id is not null then
  if new.destination_site_id is null or not exists(select 1 from public.parking_spaces where id=new.destination_space_id and site_id=new.destination_site_id and organization_id=new.organization_id) then raise exception 'Zielstellplatz gehört nicht zum Standort';end if;
  if (TG_OP='INSERT' or new.destination_space_id is distinct from old.destination_space_id or new.vehicle_id is distinct from old.vehicle_id) and exists(select 1 from public.vehicles where parking_space_id=new.destination_space_id and id<>new.vehicle_id) then raise exception 'Zielstellplatz ist bereits belegt';end if;
 end if;
 if TG_OP='UPDATE' and old.status='in_transit' and (new.pickup is distinct from old.pickup or new.pickup_site_id is distinct from old.pickup_site_id or new.pickup_address is distinct from old.pickup_address) then raise exception 'Nach der Übernahme bleibt der Abholort unverändert';end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.update_order (
  p_id                uuid,
  p_expected_revision integer,
  p_values            jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
 update public.orders set vehicle_id=next.vehicle_id,driver_id=next.driver_id,pickup=trim(next.pickup),destination=trim(next.destination),scheduled_at=next.scheduled_at,contact=coalesce(next.contact,''),transport_plate=nullif(upper(trim(next.transport_plate)),''),pickup_site_id=next.pickup_site_id,destination_site_id=next.destination_site_id,destination_space_id=next.destination_space_id,pickup_address=next.pickup_address,destination_address=next.destination_address where id=o.id;
 select name into driver_name from public.drivers where id=next.driver_id and organization_id=o.organization_id;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,next.vehicle_id,o.id,'Auftrag '||o.reference||' aktualisiert · Fahrer: '||driver_name||' · Termin: '||to_char(next.scheduled_at at time zone 'Europe/Berlin','DD.MM.YYYY HH24:MI'));
 if next.vehicle_id<>o.vehicle_id then insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,o.vehicle_id,o.id,'Fahrzeug aus Auftrag '||o.reference||' entfernt.'); end if;
end $function$;

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "order_destination_site_fk" FOREIGN KEY (destination_site_id, organization_id) REFERENCES public.fleet_sites(id, organization_id);

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "order_destination_space_fk" FOREIGN KEY (destination_space_id, destination_site_id, organization_id)
    REFERENCES public.parking_spaces(id, site_id, organization_id);

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "order_pickup_site_fk" FOREIGN KEY (pickup_site_id, organization_id) REFERENCES public.fleet_sites(id, organization_id);

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "order_space_needs_site" CHECK (((destination_space_id IS NULL) OR (destination_site_id IS NOT NULL)));

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_destination_address_check" CHECK ((length(destination_address) <= 1000));

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_pickup_address_check" CHECK ((length(pickup_address) <= 1000));

CREATE INDEX orders_destination_site_idx ON public.orders USING btree (destination_site_id, organization_id);

CREATE INDEX orders_destination_space_idx ON public.orders USING btree (destination_space_id, destination_site_id, organization_id);

CREATE INDEX orders_pickup_site_idx ON public.orders USING btree (pickup_site_id, organization_id);

CREATE TRIGGER normalize_order_route
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.normalize_order_route();

REVOKE ALL ON FUNCTION "private"."normalize_order_route"() FROM PUBLIC;


REVOKE ALL ON FUNCTION private.normalize_order_route() FROM anon, authenticated;
