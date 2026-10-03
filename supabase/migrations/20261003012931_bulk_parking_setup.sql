SET local check_function_bodies = off;

-- Additive batch endpoints. Existing single-site/space APIs and stored positions remain unchanged.

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
  if not exists(select 1 from public.fleet_sites where id = p_site and organization_id = p_org) then
    raise exception 'Standort fehlt oder gehört nicht zum Arbeitsbereich.';
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

CREATE OR REPLACE FUNCTION private.create_fleet_site_with_spaces (
  p_id      uuid,
  p_org     uuid,
  p_name    text,
  p_address text,
  p_labels  text[]
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare site public.fleet_sites;
begin
  if auth.uid() is null or coalesce(private.member_role(p_org), '') not in ('admin','dispatcher') then
    raise exception 'Keine Berechtigung';
  end if;
  if p_id is null or p_name is null or char_length(trim(p_name)) not between 1 and 120 or char_length(trim(coalesce(p_address,''))) > 1000 then
    raise exception 'Bitte Standortname und gültige Anschrift angeben.';
  end if;
  perform 1 from public.organizations where id = p_org for update;
  select * into site from public.fleet_sites where id = p_id and organization_id = p_org for update;
  if found then
    if site.name is distinct from trim(p_name) or site.address is distinct from trim(coalesce(p_address,'')) then
      raise exception 'Standort wurde inzwischen geändert. Bitte neu laden.';
    end if;
  else
    insert into public.fleet_sites(id, organization_id, name, address)
      values(p_id, p_org, trim(p_name), trim(coalesce(p_address,'')));
  end if;
  return private.add_parking_spaces(p_org, p_id, p_labels);
exception when unique_violation then
  raise exception 'Standortname oder Kennung existiert bereits.';
end $function$;

CREATE OR REPLACE FUNCTION public.add_parking_spaces (
  p_org    uuid,
  p_site   uuid,
  p_labels text[]
)
  RETURNS integer
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select private.add_parking_spaces(p_org, p_site, p_labels)
$function$;

REVOKE ALL ON FUNCTION "public"."add_parking_spaces"(uuid, uuid, text[]) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.create_fleet_site_with_spaces (
  p_id      uuid,
  p_org     uuid,
  p_name    text,
  p_address text,
  p_labels  text[]
)
  RETURNS integer
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select private.create_fleet_site_with_spaces(p_id, p_org, p_name, p_address, p_labels)
$function$;

REVOKE ALL ON FUNCTION "public"."create_fleet_site_with_spaces"(uuid, uuid, text, text, text[]) FROM PUBLIC, "anon";

REVOKE ALL ON FUNCTION "private"."add_parking_spaces"(uuid, uuid, text[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."add_parking_spaces"(uuid, uuid, text[]) TO "authenticated";

REVOKE ALL ON FUNCTION "private"."create_fleet_site_with_spaces"(uuid, uuid, text, text, text[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."create_fleet_site_with_spaces"(uuid, uuid, text, text, text[]) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."add_parking_spaces"(uuid, uuid, text[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."add_parking_spaces"(uuid, uuid, text[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."add_parking_spaces"(uuid, uuid, text[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."add_parking_spaces"(uuid, uuid, text[]) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_fleet_site_with_spaces"(uuid, uuid, text, text, text[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_fleet_site_with_spaces"(uuid, uuid, text, text, text[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_fleet_site_with_spaces"(uuid, uuid, text, text, text[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_fleet_site_with_spaces"(uuid, uuid, text, text, text[]) TO "service_role";

-- Explicitly exclude anon even when a target has different default function privileges.
REVOKE ALL ON FUNCTION private.add_parking_spaces(uuid,uuid,text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.create_fleet_site_with_spaces(uuid,uuid,text,text,text[]) FROM PUBLIC, anon;
NOTIFY pgrst, 'reload schema';
