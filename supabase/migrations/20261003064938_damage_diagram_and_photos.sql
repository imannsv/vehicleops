SET local check_function_bodies = off;

DROP POLICY "protocol_media_cleanup" ON "storage"."objects";

CREATE TABLE "public"."damage_photos" (
  "id"              uuid    NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid    NOT NULL,
  "damage_id"       uuid    NOT NULL,
  "path"            text    NOT NULL,
  "bucket"          text    NOT NULL DEFAULT 'protocol-media'::text,
  "sequence"        integer NOT NULL,
  CONSTRAINT "damage_photos_bucket_check" CHECK ((bucket = 'protocol-media'::text)),
  CONSTRAINT "damage_photos_bucket_path_key" UNIQUE (bucket, path),
  CONSTRAINT "damage_photos_organization_id_damage_id_sequence_key" UNIQUE (organization_id, damage_id, SEQUENCE),
  CONSTRAINT "damage_photos_pkey" PRIMARY KEY (id),
  CONSTRAINT "damage_photos_sequence_check" CHECK (((sequence >= 0) AND (sequence <= 9)))
);

ALTER TABLE "public"."damage_photos"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."damage_photos" FROM PUBLIC, "anon";

ALTER TABLE "public"."damages"
  ADD COLUMN "marker" jsonb;

CREATE OR REPLACE FUNCTION private.finalize_protocol (
  p_id     uuid,
  p_values jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare s public.protocol_sessions;v public.vehicles;o public.orders;org public.organizations;old public.handovers;r text;fingerprint text;prefix text;photo jsonb;party jsonb;dam jsonb;keys jsonb;picked uuid[];key_data jsonb;expected integer;k public.vehicle_keys;actor text;violated_constraint text;site_revision integer;space_revision integer;target text;site uuid;space uuid;main_signature text;signer text;purpose text;body jsonb;damage_id uuid;damage_photo jsonb;damage_sequence integer;new_damage_snapshot jsonb;normalized_damages jsonb := '[]'::jsonb;
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
 -- Validate and persist damage details within the same finalization transaction.
 if jsonb_typeof(p_values->'damages') is distinct from 'array' or jsonb_array_length(p_values->'damages')>50 then raise exception 'Höchstens 50 gültige neue Schäden je Protokoll';end if;
 if (select count(distinct item->>'id') from jsonb_array_elements(p_values->'damages') item where item->>'id' is not null)<>(select count(*) from jsonb_array_elements(p_values->'damages') item where item->>'id' is not null) then raise exception 'Doppelte Schadenkennungen';end if;
 for dam in select * from jsonb_array_elements(p_values->'damages') loop
  if jsonb_typeof(dam) is distinct from 'object' or length(trim(coalesce(dam->>'area',''))) not between 1 and 120 or length(trim(coalesce(dam->>'description',''))) not between 1 and 2000 then raise exception 'Schaden benötigt Bereich und Beschreibung';end if;
  if not private.valid_damage_marker(dam->'marker') then raise exception 'Schadenmarkierung ungültig';end if;
  if dam ? 'photos' and (jsonb_typeof(dam->'photos') is distinct from 'array' or jsonb_array_length(dam->'photos')>10) then raise exception 'Höchstens zehn Detailfotos je Schaden';end if;
  damage_id:=coalesce(nullif(dam->>'id','')::uuid,gen_random_uuid());
  normalized_damages:=normalized_damages||jsonb_build_array(dam||jsonb_build_object('id',damage_id,'photos',coalesce(dam->'photos','[]'::jsonb)));
  damage_sequence:=0;
  for damage_photo in select * from jsonb_array_elements(coalesce(dam->'photos','[]'::jsonb)) loop
   if damage_photo->>'id' is null or damage_photo->>'path' is null or left(damage_photo->>'path',length(prefix))<>prefix or not exists(select 1 from storage.objects where bucket_id='protocol-media' and name=damage_photo->>'path' and owner_id=auth.uid()::text and metadata->>'mimetype'='image/jpeg') then raise exception 'Schadenfotodatei fehlt oder gehört nicht zum Protokoll';end if;
   if exists(select 1 from jsonb_array_elements(p_values->'photos') p where p->>'path'=damage_photo->>'path') then raise exception 'Schadenfotos bleiben vom Pflicht-Rundgang getrennt';end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(normalized_damages) d cross join lateral jsonb_array_elements(d->'photos') p group by p->>'id' having count(*)>1) then raise exception 'Separate Schadenfotokennungen erforderlich';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d->>'id','area',trim(d->>'area'),'description',trim(d->>'description'),'marker',d->'marker','photos',
 (select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','path',p->>'path','bucket','protocol-media')),'[]'::jsonb) from jsonb_array_elements(d->'photos') p))),'[]'::jsonb) into new_damage_snapshot from jsonb_array_elements(normalized_damages) d;
 signer:=case when coalesce(body->'receiver'->>'signature','')<>'' then body->'receiver'->>'name' else body->'giver'->>'name' end;
 insert into public.handovers(id,organization_id,vehicle_id,order_id,kind,mileage,fuel,signer,signature,signature_bucket,notes,created_by,version,purpose,parties,position,transport_plate,request_hash,snapshot,key_snapshot)
 values(p_id,s.organization_id,v.id,s.order_id,s.kind,(p_values->>'mileage')::integer,(p_values->>'fuel')::integer,signer,main_signature,'protocol-media',coalesce(p_values->>'notes',''),auth.uid(),2,purpose,body,jsonb_build_object('location',case when s.order_id is not null and s.kind='pickup' then o.pickup else target end,'confirmed',case when s.order_id is null or (s.kind='delivery' and (coalesce((p_values->>'position_version')::integer,0)=1 or o.destination_site_id is not null)) then true else false end,'site_id',case when s.order_id is not null and s.kind='pickup' then o.pickup_site_id else site end,'space_id',space,'space_label',(select label from public.parking_spaces where id=space and organization_id=v.organization_id),'stock_status',case when s.order_id is null and v.inventory_kind='owned' then nullif(p_values->>'stock_status','') else v.inventory_status end),nullif(upper(trim(p_values->>'transport_plate')),''),fingerprint,
 jsonb_build_object('organization_name',org.name,'new_damages',new_damage_snapshot,'known_damages',private.protocol_damage_snapshot(v.id),'organization',jsonb_build_object('id',org.id,'name',org.name,'profile',org.profile,'logo_path',org.logo_path),'vehicle',to_jsonb(v),'order',case when s.order_id is not null then to_jsonb(o) end,'driver',case when s.order_id is not null then (select to_jsonb(d) from public.drivers d where id=o.driver_id) end),
 jsonb_build_object('recorded',v.keys_recorded,'selected',key_data,'expected_count',expected,'notes',coalesce(keys->>'notes','')));
 insert into public.handover_photos(organization_id,handover_id,slot,path,sequence,bucket) select s.organization_id,p_id,item->>'slot',item->>'path',(row_number() over(partition by item->>'slot' order by ordinality)-1)::integer,'protocol-media' from jsonb_array_elements(p_values->'photos') with ordinality as elements(item,ordinality);
 for dam in select * from jsonb_array_elements(normalized_damages) loop
  damage_id:=(dam->>'id')::uuid;
  insert into public.damages(id,organization_id,vehicle_id,handover_id,area,description,marker) values(damage_id,s.organization_id,v.id,p_id,trim(dam->>'area'),trim(dam->>'description'),nullif(dam->'marker','null'::jsonb));
  damage_sequence:=0;
  for damage_photo in select * from jsonb_array_elements(dam->'photos') loop
   insert into public.damage_photos(id,organization_id,damage_id,path,sequence) values((damage_photo->>'id')::uuid,s.organization_id,damage_id,damage_photo->>'path',damage_sequence);
   damage_sequence:=damage_sequence+1;
  end loop;
 end loop;
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

CREATE OR REPLACE FUNCTION private.protocol_damage_snapshot (
  p_vehicle  uuid,
  p_protocol uuid DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'area',d.area,'description',d.description,'marker',d.marker,'photos',
 (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'path',p.path,'bucket',p.bucket) order by p.sequence),'[]'::jsonb) from public.damage_photos p where p.damage_id=d.id and p.organization_id=d.organization_id)) order by d.created_at,d.id),'[]'::jsonb)
 from public.damages d where d.vehicle_id=p_vehicle and (p_protocol is null or d.handover_id=p_protocol)
$function$;

CREATE OR REPLACE FUNCTION private.valid_damage_marker (
  p_marker jsonb
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
 select case when p_marker is null or p_marker='null'::jsonb then true
 when jsonb_typeof(p_marker)='object' and jsonb_typeof(p_marker->'x')='number' and jsonb_typeof(p_marker->'y')='number' then
 (p_marker->>'x')::numeric between 0 and 100 and (p_marker->>'y')::numeric between 0 and 100
 else false end
$function$;

ALTER TABLE "public"."damage_photos"
  ADD CONSTRAINT "damage_photos_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE "public"."damages"
  ADD CONSTRAINT "damages_organization_id_id_key" UNIQUE (organization_id, id);

ALTER TABLE "public"."damage_photos"
  ADD CONSTRAINT "damage_photos_damage_fkey" FOREIGN KEY (organization_id, damage_id) REFERENCES public.damages(organization_id, id) ON DELETE CASCADE;

CREATE POLICY "damage_photos_read" ON "public"."damage_photos"
  FOR SELECT
  TO "authenticated"
  USING ((private.member_role(organization_id) IS NOT NULL));

CREATE POLICY "protocol_media_cleanup" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'protocol-media'::text) AND (owner_id = (auth.uid())::text) AND (NOT (EXISTS ( SELECT 1
   FROM public.handover_photos p
  WHERE ((p.bucket = objects.bucket_id) AND (p.path = objects.name))))) AND (NOT (EXISTS ( SELECT 1
   FROM public.damage_photos p
  WHERE ((p.bucket = objects.bucket_id) AND (p.path = objects.name))))) AND (NOT (EXISTS ( SELECT 1
   FROM public.handovers h
  WHERE
    ((h.signature_bucket = objects.bucket_id) AND ((h.signature = objects.name) OR (((h.parties -> 'giver'::text) ->> 'signature'::text) = objects.name) OR (((h.parties ->
    'receiver'::text) ->> 'signature'::text) = objects.name))))))));

REVOKE ALL ON FUNCTION "private"."protocol_damage_snapshot"(uuid, uuid) FROM PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "private"."valid_damage_marker"(jsonb) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "private"."valid_damage_marker"(jsonb) TO "authenticated";

REVOKE ALL ON TABLE "public"."damage_photos" FROM "authenticated";

GRANT SELECT ON TABLE "public"."damage_photos" TO "authenticated";

REVOKE ALL ON TABLE "public"."damage_photos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."damage_photos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."damage_photos" TO "service_role";

ALTER TABLE "public"."damages"
  ADD CONSTRAINT "damages_marker_check" CHECK (private.valid_damage_marker(marker));

NOTIFY pgrst, 'reload schema';
