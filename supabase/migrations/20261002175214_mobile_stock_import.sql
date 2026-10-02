SET local check_function_bodies = off;

CREATE TABLE "public"."external_listings" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid                     NOT NULL,
  "vehicle_id"      uuid                     NOT NULL,
  "platform"        text                     NOT NULL DEFAULT 'mobile_de'::text,
  "environment"     text                     NOT NULL,
  "account_id"      text                     NOT NULL,
  "remote_id"       text                     NOT NULL,
  "metadata"        jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "source_run"      uuid                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "external_listings_account_id_check" CHECK ((account_id ~ '^[1-9][0-9]{0,29}$'::text)),
  CONSTRAINT "external_listings_environment_check" CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
  CONSTRAINT "external_listings_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "external_listings_organization_id_platform_environment_acco_key" UNIQUE (organization_id, platform, environment, account_id, remote_id),
  CONSTRAINT "external_listings_pkey" PRIMARY KEY (id),
  CONSTRAINT "external_listings_platform_check" CHECK ((platform = 'mobile_de'::text)),
  CONSTRAINT "external_listings_remote_id_check" CHECK ((remote_id ~ '^[1-9][0-9]{0,29}$'::text))
);

ALTER TABLE "public"."external_listings"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."external_listings" FROM "anon";

CREATE TABLE "public"."platform_import_runs" (
  "id"              uuid                     NOT NULL,
  "organization_id" uuid                     NOT NULL,
  "platform"        text                     NOT NULL DEFAULT 'mobile_de'::text,
  "environment"     text                     NOT NULL,
  "account_id"      text                     NOT NULL,
  "request_hash"    text                     NOT NULL,
  "created_count"   integer                  NOT NULL DEFAULT 0,
  "linked_count"    integer                  NOT NULL DEFAULT 0,
  "created_by"      uuid                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "platform_import_runs_account_id_check" CHECK ((account_id ~ '^[1-9][0-9]{0,29}$'::text)),
  CONSTRAINT "platform_import_runs_environment_check" CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
  CONSTRAINT "platform_import_runs_id_organization_id_key" UNIQUE (id, organization_id),
  CONSTRAINT "platform_import_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "platform_import_runs_platform_check" CHECK ((platform = 'mobile_de'::text))
);

ALTER TABLE "public"."platform_import_runs"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."platform_import_runs" FROM "anon";

CREATE OR REPLACE FUNCTION private.import_mobile_stock (
  p_id     uuid,
  p_org    uuid,
  p_values jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare fingerprint text;r public.platform_import_runs;entry jsonb;values_row jsonb;metadata_row jsonb;v public.vehicles;account text;env text;ad text;action text;target uuid;created integer:=0;linked integer:=0;field text;
begin
 if auth.uid() is null or coalesce(private.member_role(p_org),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung';end if;
 if p_id is null or jsonb_typeof(p_values) is distinct from 'object' or pg_column_size(p_values)>250000 then raise exception 'Importanfrage ungültig oder zu groß';end if;
 fingerprint:=encode(extensions.digest(p_values::text,'sha256'),'hex');
 perform 1 from public.organizations where id=p_org for update;
 if not found then raise exception 'Organisation fehlt';end if;
 select * into r from public.platform_import_runs where id=p_id;
 if found then
  if r.organization_id<>p_org or r.request_hash<>fingerprint then raise exception 'Import-ID wurde bereits mit anderen Angaben verwendet';end if;
  return jsonb_build_object('id',r.id,'created',r.created_count,'linked',r.linked_count);
 end if;
 for field in select jsonb_object_keys(p_values) loop if field not in ('account_id','environment','entries') then raise exception 'Importangaben ungültig';end if;end loop;
 account:=p_values->>'account_id';env:=p_values->>'environment';
 if account is null or account !~ '^[1-9][0-9]{0,29}$' or coalesce(env,'') not in ('production','sandbox') or jsonb_typeof(p_values->'entries') is distinct from 'array' then raise exception 'Händler-ID, Umgebung oder Einträge ungültig';end if;
 if jsonb_array_length(p_values->'entries') not between 1 and 100 then raise exception 'Bitte 1 bis 100 Einträge auswählen';end if;
 insert into public.platform_import_runs(id,organization_id,environment,account_id,request_hash,created_by) values(p_id,p_org,env,account,fingerprint,auth.uid());
 for entry in select * from jsonb_array_elements(p_values->'entries') loop
  if jsonb_typeof(entry) is distinct from 'object' then raise exception 'Importeintrag ungültig';end if;
  action:=entry->>'action';ad:=entry->>'remote_id';values_row:=entry->'values';metadata_row:=entry->'metadata';target:=(entry->>'vehicle_id')::uuid;
  if coalesce(action,'') not in ('create','link') or ad is null or ad !~ '^[1-9][0-9]{0,29}$' or target is null or jsonb_typeof(values_row) is distinct from 'object' or jsonb_typeof(metadata_row) is distinct from 'object' then raise exception 'Importeintrag ungültig';end if;
  if exists(select 1 from public.external_listings where organization_id=p_org and platform='mobile_de' and environment=env and account_id=account and remote_id=ad) then raise exception 'Inserat wurde inzwischen zugeordnet. Bitte Vorschau neu laden.';end if;
  if coalesce(values_row->>'vin','') !~ '^[A-HJ-NPR-Z0-9]{17}$' then raise exception 'Gültige VIN erforderlich';end if;
  for field in select jsonb_object_keys(metadata_row) loop if field not in ('first_registration_month','seller_stock_number','image_count') then raise exception 'Inseratmetadaten ungültig';end if;end loop;
  if jsonb_typeof(metadata_row->'first_registration_month') is distinct from 'string' or (metadata_row->>'first_registration_month'<>'' and (metadata_row->>'first_registration_month' !~ '^[0-9]{4}(0[1-9]|1[0-2])$' or metadata_row->>'first_registration_month'<'190001' or metadata_row->>'first_registration_month'>to_char(current_date,'YYYYMM'))) or jsonb_typeof(metadata_row->'seller_stock_number') is distinct from 'string' or length(metadata_row->>'seller_stock_number')>40 or jsonb_typeof(metadata_row->'image_count') is distinct from 'number' or coalesce(metadata_row->>'image_count','') !~ '^[0-9]{1,3}$' then raise exception 'Inseratmetadaten ungültig';end if;
  if action='link' then
   select * into v from public.vehicles where id=target and organization_id=p_org for update;
   if not found then raise exception 'Fahrzeug gehört nicht zum Arbeitsbereich';end if;
   if v.vin is distinct from values_row->>'vin' or v.revision is distinct from (entry->>'revision')::integer then raise exception 'Fahrzeug wurde inzwischen geändert. Bitte Vorschau neu prüfen.';end if;
   linked:=linked+1;
  else
   if (entry->>'revision')::integer is distinct from 0 or exists(select 1 from public.vehicles where organization_id=p_org and vin=values_row->>'vin') then raise exception 'VIN existiert inzwischen. Bitte vorhandenes Fahrzeug ausdrücklich zuordnen.';end if;
   for field in select unnest(array['make','model','color','location']) loop
    if jsonb_typeof(values_row->field) is distinct from 'string' or length(trim(values_row->>field)) not between 1 and (case when field='location' then 240 else 120 end) then raise exception 'Hersteller, Modell, Farbe und tatsächliche Position erforderlich';end if;
   end loop;
   if jsonb_typeof(values_row->'mileage') is distinct from 'number' or coalesce(values_row->>'mileage','') !~ '^[0-9]{1,10}$' or (values_row->>'mileage')::bigint>2147483647 then raise exception 'Gültiger Kilometerstand erforderlich';end if;
   if coalesce(values_row->>'inventory_kind','') not in ('unassigned','owned','customer') or (values_row->>'inventory_kind'='owned' and values_row->>'inventory_status' is distinct from 'stock') or (values_row->>'inventory_kind'<>'owned' and values_row->>'inventory_status' is not null) then raise exception 'Bestandszuordnung ungültig';end if;
   if values_row->>'build_year' is not null and (coalesce(values_row->>'build_year','') !~ '^[0-9]{4}$' or (values_row->>'build_year')::integer not between 1900 and extract(year from current_date)::integer+1) then raise exception 'Baujahr ungültig';end if;
   if jsonb_typeof(values_row->'variant') is distinct from 'string' or length(values_row->>'variant')>120 then raise exception 'Ausführung ungültig';end if;
   perform private.save_vehicle_record(target,p_org,0,jsonb_build_object('plate',null,'vin',values_row->>'vin','make',values_row->>'make','model',values_row->>'model','color',values_row->>'color','mileage',(values_row->>'mileage')::integer,'location',values_row->>'location','variant',values_row->>'variant','build_year',values_row->'build_year','inventory_kind',values_row->>'inventory_kind','inventory_status',values_row->>'inventory_status'),null,0);
   created:=created+1;
  end if;
  insert into public.external_listings(organization_id,vehicle_id,environment,account_id,remote_id,metadata,source_run) values(p_org,target,env,account,ad,metadata_row,p_id);
 end loop;
 update public.platform_import_runs set created_count=created,linked_count=linked where id=p_id;
 return jsonb_build_object('id',p_id,'created',created,'linked',linked);
end $function$;

CREATE OR REPLACE FUNCTION public.import_mobile_stock (
  p_id     uuid,
  p_org    uuid,
  p_values jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select private.import_mobile_stock(p_id,p_org,p_values)$function$;

REVOKE ALL ON FUNCTION "public"."import_mobile_stock"(uuid, uuid, jsonb) FROM PUBLIC, "anon";

ALTER TABLE "public"."external_listings"
  ADD CONSTRAINT "external_listings_vehicle_id_organization_id_fkey" FOREIGN KEY (vehicle_id, organization_id) REFERENCES public.vehicles(id, organization_id);

ALTER TABLE "public"."platform_import_runs"
  ADD CONSTRAINT "platform_import_runs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE "public"."external_listings"
  ADD CONSTRAINT "external_listings_source_run_organization_id_fkey" FOREIGN KEY (source_run, organization_id) REFERENCES public.platform_import_runs(id, organization_id);

ALTER TABLE "public"."platform_import_runs"
  ADD CONSTRAINT "platform_import_runs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

CREATE INDEX external_listings_run_idx ON public.external_listings USING btree (source_run, organization_id);

CREATE INDEX external_listings_vehicle_idx ON public.external_listings USING btree (vehicle_id, organization_id);

CREATE INDEX platform_import_runs_creator_idx ON public.platform_import_runs USING btree (created_by);

CREATE INDEX platform_import_runs_org_idx ON public.platform_import_runs USING btree (organization_id, created_at DESC);

CREATE POLICY "external_listing_read" ON "public"."external_listings"
  FOR SELECT
  TO "authenticated"
  USING ((private.member_role(organization_id) = ANY (ARRAY['admin'::text, 'dispatcher'::text])));

CREATE POLICY "platform_import_read" ON "public"."platform_import_runs"
  FOR SELECT
  TO "authenticated"
  USING ((private.member_role(organization_id) = ANY (ARRAY['admin'::text, 'dispatcher'::text])));

REVOKE ALL ON FUNCTION "private"."import_mobile_stock"(uuid, uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."import_mobile_stock"(uuid, uuid, jsonb) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."import_mobile_stock"(uuid, uuid, jsonb) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."import_mobile_stock"(uuid, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."import_mobile_stock"(uuid, uuid, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."import_mobile_stock"(uuid, uuid, jsonb) TO "service_role";

REVOKE ALL ON TABLE "public"."external_listings" FROM "authenticated";

GRANT SELECT ON TABLE "public"."external_listings" TO "authenticated";

REVOKE ALL ON TABLE "public"."external_listings" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."external_listings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."external_listings" TO "service_role";

REVOKE ALL ON TABLE "public"."platform_import_runs" FROM "authenticated";

GRANT SELECT ON TABLE "public"."platform_import_runs" TO "authenticated";

REVOKE ALL ON TABLE "public"."platform_import_runs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."platform_import_runs" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."platform_import_runs" TO "service_role";

