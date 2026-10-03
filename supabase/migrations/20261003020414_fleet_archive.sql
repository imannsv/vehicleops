SET local check_function_bodies = off;

ALTER TABLE "public"."fleet_sites"
  ADD COLUMN "archived_at" timestamp WITH time zone;

ALTER TABLE "public"."parking_spaces"
  ADD COLUMN "archived_at" timestamp WITH time zone;

CREATE OR REPLACE FUNCTION private.add_parking_spaces (
  p_org    uuid,
  p_site   uuid,
  p_labels text[]
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare added integer;
begin
  if auth.uid() is null or coalesce(private.member_role(p_org), '') not in ('admin','dispatcher') then
    raise exception 'Keine Berechtigung';
  end if;
  perform 1 from public.organizations where id = p_org for update;
  if not exists(select 1 from public.fleet_sites where id = p_site and organization_id = p_org and archived_at is null) then
    raise exception 'Standort fehlt oder ist archiviert.';
  end if;
  if p_labels is null or cardinality(p_labels) > 200 or coalesce(array_ndims(p_labels), 1) <> 1 then
    raise exception 'Bitte höchstens 200 Stellplätze auf einmal anlegen.';
  end if;
  if exists(select 1 from unnest(p_labels) label where label is null or char_length(btrim(label, E' \t\r\n\f')) not between 1 and 80) then
    raise exception 'Jede Stellplatzbezeichnung benötigt 1 bis 80 Zeichen.';
  end if;
  insert into public.parking_spaces(id, organization_id, site_id, label)
    select gen_random_uuid(), p_org, p_site, label from
      (select distinct btrim(value, E' \t\r\n\f') label from unnest(p_labels) value) cleaned
    on conflict (site_id, label) do nothing;
  get diagnostics added = row_count;
  return added;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_active_fleet_reference()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare sites uuid[] := '{}';space uuid;parent uuid;active boolean;site uuid;
begin
 if TG_TABLE_NAME='vehicles' then
  if TG_OP='UPDATE' and new.site_id is not distinct from old.site_id and new.parking_space_id is not distinct from old.parking_space_id then return new;end if;
  sites:=array[new.site_id];space:=new.parking_space_id;
 elsif TG_TABLE_NAME='orders' then
  if new.status not in ('assigned','in_transit') then return new;end if;
  sites:=array[new.destination_site_id,case when new.status='assigned' then new.pickup_site_id else null end];space:=new.destination_space_id;
 else
  sites:=array[new.site_id];
 end if;
 for site in select distinct value from unnest(sites) value where value is not null order by value loop
  select archived_at is null into active from public.fleet_sites where id=site and organization_id=new.organization_id for share;
  if not found or not active then raise exception 'Standort fehlt oder ist archiviert. Bitte einen aktiven Standort wählen.';end if;
 end loop;
 if space is not null then
  select archived_at is null,site_id into active,parent from public.parking_spaces where id=space and organization_id=new.organization_id for share;
  if not found or not active then raise exception 'Stellplatz fehlt oder ist archiviert. Bitte einen aktiven Stellplatz wählen.';end if;
  if not coalesce(parent=any(sites),false) then raise exception 'Stellplatz gehört nicht zum Standort.';end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_fleet_archive()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
 if old.archived_at is not null and new.archived_at is not null then raise exception 'Dieser Bereich ist archiviert. Bitte zuerst wiederherstellen.';end if;
 if new.archived_at is not null and old.archived_at is null then
  if TG_TABLE_NAME='fleet_sites' then
   if exists(select 1 from public.vehicles where site_id=new.id and organization_id=new.organization_id) then raise exception 'Am Standort stehen noch Fahrzeuge. Bitte zuerst umsetzen.';end if;
   if exists(select 1 from public.orders where organization_id=new.organization_id and ((status='assigned' and pickup_site_id=new.id) or (status in ('assigned','in_transit') and destination_site_id=new.id))) then raise exception 'Offene Aufträge benötigen diesen Bereich noch. Bitte zuerst umplanen oder abschließen.';end if;
  else
   if exists(select 1 from public.vehicles where parking_space_id=new.id and organization_id=new.organization_id) then raise exception 'Der Stellplatz ist belegt. Bitte das Fahrzeug zuerst umsetzen.';end if;
   if exists(select 1 from public.orders where organization_id=new.organization_id and status in ('assigned','in_transit') and destination_space_id=new.id) then raise exception 'Offene Aufträge benötigen diesen Bereich noch. Bitte zuerst umplanen oder abschließen.';end if;
  end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.set_fleet_archived (
  p_org      uuid,
  p_kind     text,
  p_id       uuid,
  p_revision integer,
  p_archived boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare site public.fleet_sites;space public.parking_spaces;
begin
 if auth.uid() is null or coalesce(private.member_role(p_org),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung';end if;
 if p_kind not in ('site','space') or p_kind is null or p_archived is null then raise exception 'Ungültiger Archivvorgang';end if;
 perform 1 from public.organizations where id=p_org for update;
 if coalesce(private.member_role(p_org),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung';end if;
 if p_kind='site' then
  select * into site from public.fleet_sites where id=p_id and organization_id=p_org for update;
  if not found then raise exception 'Standort fehlt';end if;
  if (site.archived_at is not null)=p_archived then return;end if;
  if site.revision is distinct from p_revision then raise exception 'Standort oder Stellplatz wurde inzwischen geändert. Bitte aktualisieren und erneut prüfen.';end if;
  update public.fleet_sites set archived_at=case when p_archived then clock_timestamp() else null end,revision=revision+1 where id=p_id;
 else
  select * into space from public.parking_spaces where id=p_id and organization_id=p_org for update;
  if not found then raise exception 'Stellplatz fehlt';end if;
  if (space.archived_at is not null)=p_archived then return;end if;
  if space.revision is distinct from p_revision then raise exception 'Standort oder Stellplatz wurde inzwischen geändert. Bitte aktualisieren und erneut prüfen.';end if;
  if not exists(select 1 from public.fleet_sites where id=space.site_id and organization_id=p_org and archived_at is null) then raise exception 'Bitte zuerst den Standort wiederherstellen.';end if;
  update public.parking_spaces set archived_at=case when p_archived then clock_timestamp() else null end,revision=revision+1 where id=p_id;
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.set_fleet_archived (
  p_org      uuid,
  p_kind     text,
  p_id       uuid,
  p_revision integer,
  p_archived boolean
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select private.set_fleet_archived(p_org,p_kind,p_id,p_revision,p_archived)$function$;

REVOKE ALL ON FUNCTION "public"."set_fleet_archived"(uuid, text, uuid, integer, boolean) FROM PUBLIC, "anon";

CREATE TRIGGER guard_fleet_archive
  BEFORE UPDATE ON public.fleet_sites
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_fleet_archive();

CREATE TRIGGER guard_active_fleet_reference
  AFTER INSERT OR UPDATE OF pickup_site_id, destination_site_id, destination_space_id, status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_active_fleet_reference();

CREATE TRIGGER guard_active_fleet_reference
  AFTER INSERT OR UPDATE ON public.parking_spaces
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_active_fleet_reference();

CREATE TRIGGER guard_fleet_archive
  BEFORE UPDATE ON public.parking_spaces
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_fleet_archive();

CREATE TRIGGER guard_active_fleet_reference
  AFTER INSERT OR UPDATE OF site_id, parking_space_id ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_active_fleet_reference();

REVOKE ALL ON FUNCTION "private"."guard_active_fleet_reference"() FROM PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "private"."guard_fleet_archive"() FROM PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "private"."set_fleet_archived"(uuid, text, uuid, integer, boolean) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "private"."set_fleet_archived"(uuid, text, uuid, integer, boolean) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_fleet_archived"(uuid, text, uuid, integer, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_fleet_archived"(uuid, text, uuid, integer, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_fleet_archived"(uuid, text, uuid, integer, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_fleet_archived"(uuid, text, uuid, integer, boolean) TO "service_role";

NOTIFY pgrst, 'reload schema';
