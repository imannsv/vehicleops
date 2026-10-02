alter table public.vehicles add column cover_kind text check(cover_kind in ('protocol','asset'));
alter table public.vehicles add column cover_id uuid;
alter table public.vehicles add constraint vehicle_cover_pair check((cover_id is null)=(cover_kind is null));
create function private.set_vehicle_cover(p_vehicle uuid,p_revision integer,p_kind text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles;
begin
 select * into v from public.vehicles where id=p_vehicle for update;
 if not found or auth.uid() is null or coalesce(private.member_role(v.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung';end if;
 if v.revision is distinct from p_revision then raise exception 'Fahrzeug wurde inzwischen geändert';end if;
 if p_kind='asset' and not exists(select 1 from public.vehicle_assets where id=p_id and vehicle_id=v.id and organization_id=v.organization_id and kind='photo') then raise exception 'Fahrzeugfoto fehlt';
 elsif p_kind='protocol' and not exists(select 1 from public.handover_photos p join public.handovers h on h.id=p.handover_id and h.organization_id=p.organization_id where p.id=p_id and h.vehicle_id=v.id and h.organization_id=v.organization_id) then raise exception 'Protokollfoto fehlt';
 elsif p_kind is null and p_id is not null or p_kind is not null and p_id is null then raise exception 'Titelbild ungültig';end if;
 update public.vehicles set cover_kind=p_kind,cover_id=p_id where id=v.id;
end $$;
create function public.set_vehicle_cover(p_vehicle uuid,p_revision integer,p_kind text,p_id uuid) returns void language sql security invoker set search_path='' as $$select private.set_vehicle_cover(p_vehicle,p_revision,p_kind,p_id)$$;
revoke all on function private.set_vehicle_cover(uuid,integer,text,uuid),public.set_vehicle_cover(uuid,integer,text,uuid) from public,anon;
grant execute on function private.set_vehicle_cover(uuid,integer,text,uuid),public.set_vehicle_cover(uuid,integer,text,uuid) to authenticated;
create function private.clear_removed_cover() returns trigger language plpgsql security definer set search_path='' as $$begin update public.vehicles set cover_id=null,cover_kind=null where id=old.vehicle_id and cover_kind='asset' and cover_id=old.id;return old;end$$;
create trigger clear_removed_cover before delete on public.vehicle_assets for each row execute function private.clear_removed_cover();
revoke all on function private.clear_removed_cover() from public,anon,authenticated;
