-- Optional notes for manual moves; keep authorization, revisions and history intact.
create or replace function private.move_vehicle(p_vehicle uuid,p_revision integer,p_site uuid,p_space uuid,p_location text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; target text;
begin
 select * into v from public.vehicles where id=p_vehicle for update;
 if not found or auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if v.revision is distinct from p_revision then raise exception 'Fahrzeug wurde inzwischen geändert. Bitte neu laden.'; end if;
 if exists(select 1 from public.orders where vehicle_id=v.id and organization_id=v.organization_id and status='in_transit') then raise exception 'Fahrzeug ist in Transport. Standort wird durch das Protokoll fortgeschrieben.'; end if;
 if length(trim(coalesce(p_reason,'')))>1000 then raise exception 'Der Anlass darf höchstens 1.000 Zeichen enthalten'; end if;
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
 perform set_config('vehicleops.movement_reason',coalesce(nullif(trim(p_reason),''),'Fahrzeug umgesetzt'),true);
 update public.vehicles set site_id=p_site,parking_space_id=p_space,location=target where id=v.id;
 exception when unique_violation then raise exception 'Dieser Stellplatz ist bereits belegt';
end $$;
