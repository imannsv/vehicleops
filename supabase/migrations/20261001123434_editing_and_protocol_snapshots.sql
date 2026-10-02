-- Editing is exposed through authorized RPCs; direct table updates remain revoked.
alter table public.vehicles add column revision integer not null default 1;
alter table public.drivers add column revision integer not null default 1;
alter table public.orders add column revision integer not null default 1;
alter table public.orders add column cancellation_reason text;
alter table public.orders add column cancelled_at timestamptz;
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check(status in ('assigned','in_transit','completed','cancelled'));
alter table public.orders add constraint order_cancellation_check check((status='cancelled') = (cancelled_at is not null and cancellation_reason is not null and length(trim(cancellation_reason))>0));
drop index public.one_open_order_per_vehicle;
create unique index one_open_order_per_vehicle on public.orders(organization_id,vehicle_id) where status in ('assigned','in_transit');
alter table public.vehicle_events alter column order_id drop not null;

create function private.bump_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision := old.revision + 1; return new; end $$;
revoke all on function private.bump_revision() from public;
create trigger vehicle_revision before update on public.vehicles for each row execute function private.bump_revision();
create trigger driver_revision before update on public.drivers for each row execute function private.bump_revision();
create trigger order_revision before update on public.orders for each row execute function private.bump_revision();

-- Backfill existing protocols before any editable master data can be changed.
alter table public.handovers add column snapshot jsonb;
update public.handovers h set snapshot=jsonb_build_object('organization_name',g.name,'vehicle',to_jsonb(v),'driver',to_jsonb(d),'order',to_jsonb(o))
 from public.orders o join public.vehicles v on v.id=o.vehicle_id and v.organization_id=o.organization_id
 join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id
 join public.organizations g on g.id=o.organization_id where h.order_id=o.id and h.organization_id=o.organization_id;
alter table public.handovers alter column snapshot set not null;
create function private.capture_protocol_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 select jsonb_build_object('organization_name',g.name,'vehicle',to_jsonb(v),'driver',to_jsonb(d),'order',to_jsonb(o)) into new.snapshot
 from public.orders o join public.vehicles v on v.id=o.vehicle_id and v.organization_id=o.organization_id
 join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id
 join public.organizations g on g.id=o.organization_id where o.id=new.order_id and o.organization_id=new.organization_id;
 return new;
end $$;
revoke all on function private.capture_protocol_snapshot() from public;
create trigger handover_snapshot before insert on public.handovers for each row execute function private.capture_protocol_snapshot();

-- Internal constraint trigger, not an exposed endpoint. Locks the driver while validating
-- so an assignment cannot race a simultaneous license-date edit.
create or replace function private.check_order() returns trigger language plpgsql security definer set search_path='' as $$
declare validity date;
begin
 select license_valid_until into validity from public.drivers where id=new.driver_id and organization_id=new.organization_id for share;
 if validity is null or validity < (new.scheduled_at at time zone 'Europe/Berlin')::date then raise exception 'Führerscheingültigkeit endet vor Auftrag'; end if;
 return new;
end $$;
revoke all on function private.check_order() from public;
drop trigger order_license_check on public.orders;
create trigger order_license_check before insert or update of driver_id,scheduled_at on public.orders for each row execute function private.check_order();

create function private.update_vehicle(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
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
 update public.vehicles set plate=upper(trim(next.plate)),vin=upper(trim(next.vin)),make=trim(next.make),model=trim(next.model),color=trim(next.color),mileage=next.mileage,location=trim(next.location) where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,description) values(v.organization_id,v.id,'Fahrzeugdaten aktualisiert: '||v.plate||' → '||upper(trim(next.plate)));
end $$;
create function private.update_driver(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d public.drivers; next public.drivers;
begin
 select * into d from public.drivers where id=p_id for update;
 if not found then raise exception 'Datensatz fehlt'; end if;
 if auth.uid() is null or coalesce(private.member_role(d.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from d.revision then raise exception 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.'; end if;
 next := jsonb_populate_record(d,p_values);
 if next.id<>d.id or next.organization_id<>d.organization_id then raise exception 'Mandant oder ID kann nicht verändert werden'; end if;
 if length(trim(next.name))=0 or length(trim(next.email))=0 or length(trim(next.phone))=0 then raise exception 'Bitte alle Fahrerfelder ausfüllen'; end if;
 if next.user_id is not null and not exists(select 1 from public.memberships where organization_id=d.organization_id and user_id=next.user_id and role='driver') then raise exception 'Bitte ein Teammitglied mit Fahrerrolle auswählen'; end if;
 if exists(select 1 from public.orders where driver_id=d.id and organization_id=d.organization_id and status in ('assigned','in_transit') and (scheduled_at at time zone 'Europe/Berlin')::date>next.license_valid_until) then raise exception 'Die Führerscheingültigkeit muss alle offenen Aufträge abdecken.'; end if;
 update public.drivers set name=trim(next.name),email=trim(next.email),phone=trim(next.phone),license_valid_until=next.license_valid_until,user_id=next.user_id where id=d.id;
 insert into public.vehicle_events(organization_id,vehicle_id,description) select d.organization_id,o.vehicle_id,'Fahrerdaten aktualisiert: '||trim(next.name)||' · '||o.reference from public.orders o where o.organization_id=d.organization_id and o.driver_id=d.id and o.status in ('assigned','in_transit');
end $$;
create function private.update_order(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
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
create function private.cancel_order(p_id uuid,p_expected_revision integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'Auftrag fehlt'; end if;
 if auth.uid() is null or coalesce(private.member_role(o.organization_id),'') not in ('admin','dispatcher') then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from o.revision then raise exception 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.'; end if;
 if o.status<>'assigned' then raise exception 'Nur Aufträge vor der Übernahme können storniert werden.'; end if;
 if p_reason is null or length(trim(p_reason))=0 or length(p_reason)>1000 then raise exception 'Bitte einen Stornogrund angeben (maximal 1000 Zeichen).'; end if;
 update public.orders set status='cancelled',cancellation_reason=trim(p_reason),cancelled_at=now() where id=o.id;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,o.vehicle_id,o.id,'Auftrag '||o.reference||' storniert: '||trim(p_reason));
end $$;
revoke all on function private.update_vehicle(uuid,integer,jsonb),private.update_driver(uuid,integer,jsonb),private.update_order(uuid,integer,jsonb),private.cancel_order(uuid,integer,text) from public;
grant execute on function private.update_vehicle(uuid,integer,jsonb),private.update_driver(uuid,integer,jsonb),private.update_order(uuid,integer,jsonb),private.cancel_order(uuid,integer,text) to authenticated;
create function public.update_vehicle(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.update_vehicle(p_id,p_expected_revision,p_values) $$;
create function public.update_driver(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.update_driver(p_id,p_expected_revision,p_values) $$;
create function public.update_order(p_id uuid,p_expected_revision integer,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.update_order(p_id,p_expected_revision,p_values) $$;
create function public.cancel_order(p_id uuid,p_expected_revision integer,p_reason text) returns void language sql security invoker set search_path='' as $$ select private.cancel_order(p_id,p_expected_revision,p_reason) $$;
revoke all on function public.update_vehicle(uuid,integer,jsonb),public.update_driver(uuid,integer,jsonb),public.update_order(uuid,integer,jsonb),public.cancel_order(uuid,integer,text) from public,anon;
grant execute on function public.update_vehicle(uuid,integer,jsonb),public.update_driver(uuid,integer,jsonb),public.update_order(uuid,integer,jsonb),public.cancel_order(uuid,integer,text) to authenticated;

-- Cancelled orders no longer accept uploads.
create or replace function private.can_upload(p_org text,p_order text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.orders o join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id
 where o.organization_id::text=p_org and o.id::text=p_order and o.status in ('assigned','in_transit') and (private.member_role(o.organization_id) in ('admin','dispatcher') or (private.member_role(o.organization_id)='driver' and d.user_id=auth.uid())))
$$;

-- Reject stale protocol drafts after a vehicle swap, reassignment or schedule edit.
drop function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb);
drop function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb);
create function private.finalize_handover(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb,p_expected_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; v public.vehicles; r text; prefix text; photo jsonb; damage jsonb;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Auftrag fehlt'; end if;
 r := private.member_role(o.organization_id);
 if r is null or not (r in ('admin','dispatcher') or (r='driver' and exists(select 1 from public.drivers where id=o.driver_id and organization_id=o.organization_id and user_id=auth.uid()))) then raise exception 'Keine Berechtigung'; end if;
 if p_expected_revision is distinct from o.revision then raise exception 'Dieser Auftrag wurde inzwischen geändert. Bitte neu laden und den Entwurf erneut prüfen.'; end if;
 if p_kind is null or p_kind not in ('pickup','delivery') then raise exception 'Ungültige Protokollart'; end if;
 if (p_kind='pickup' and o.status<>'assigned') or (p_kind='delivery' and o.status<>'in_transit') then raise exception 'Auftragsstatus erlaubt diesen Abschluss nicht'; end if;
 select * into v from public.vehicles where id=o.vehicle_id and organization_id=o.organization_id for update;
 if p_mileage is null or p_mileage < v.mileage then raise exception 'Kilometerstand darf nicht sinken'; end if;
 if p_fuel is null or p_fuel not between 0 and 100 or p_signer is null or length(trim(p_signer))=0 then raise exception 'Zustand oder Unterzeichner fehlt'; end if;
 if jsonb_typeof(p_photos) is distinct from 'array' or jsonb_array_length(p_photos)<10 then raise exception 'Zehn Pflichtperspektiven erforderlich'; end if;
 if (select count(distinct item->>'slot') from jsonb_array_elements(p_photos) item where item->>'slot' in ('Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho'))<>10 then raise exception 'Fotoperspektiven unvollständig'; end if;
 if exists(select 1 from jsonb_array_elements(p_photos) item where item->>'slot' is null or item->>'slot' not in ('Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho')) then raise exception 'Ungültige Fotoperspektive'; end if;
 if exists(select 1 from jsonb_array_elements(p_photos) item where item->>'slot'<>'Innenraum' group by item->>'slot' having count(*)>1) then raise exception 'Nur Innenraum darf mehrere Fotos enthalten'; end if;
 if jsonb_typeof(p_damages) is distinct from 'array' then raise exception 'Ungültige Schäden'; end if;
 prefix := o.organization_id::text||'/'||o.id::text||'/'||p_id::text||'/';
 if p_signature is null or p_signature<>prefix||'signature.png' or not exists(select 1 from storage.objects where bucket_id='evidence' and name=p_signature and owner_id=auth.uid()::text and metadata->>'mimetype'='image/png') then raise exception 'Unterschrift fehlt'; end if;
 for photo in select * from jsonb_array_elements(p_photos) loop
  if photo->>'path' is null or left(photo->>'path',length(prefix))<>prefix or not exists(select 1 from storage.objects where bucket_id='evidence' and name=photo->>'path' and owner_id=auth.uid()::text and metadata->>'mimetype'='image/jpeg') then raise exception 'Fotodatei fehlt'; end if;
 end loop;
 if (select count(distinct item->>'path') from jsonb_array_elements(p_photos) item)<>jsonb_array_length(p_photos) then raise exception 'Separate Fotodateien erforderlich'; end if;
 insert into public.handovers(id,organization_id,order_id,kind,mileage,fuel,signer,signature,notes,created_by) values(p_id,o.organization_id,o.id,p_kind,p_mileage,p_fuel,trim(p_signer),p_signature,coalesce(p_notes,''),auth.uid());
 insert into public.handover_photos(organization_id,handover_id,slot,path,sequence) select o.organization_id,p_id,item->>'slot',item->>'path',coalesce((item->>'sequence')::integer,0) from jsonb_array_elements(p_photos) item;
 for damage in select * from jsonb_array_elements(p_damages) loop
  insert into public.damages(organization_id,vehicle_id,handover_id,area,description) values(o.organization_id,o.vehicle_id,p_id,trim(damage->>'area'),trim(damage->>'description'));
 end loop;
 update public.orders set status=case when p_kind='pickup' then 'in_transit' else 'completed' end where id=o.id;
 update public.vehicles set mileage=p_mileage,location=case when p_kind='pickup' then 'In Transport' else o.destination end where id=v.id;
 insert into public.vehicle_events(organization_id,vehicle_id,order_id,description) values(o.organization_id,v.id,o.id,(case when p_kind='pickup' then 'Übernahme ' else 'Übergabe ' end)||o.reference||' · '||p_mileage::text||' km · '||trim(p_signer));
 return p_id;
end $$;
revoke all on function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb,integer) from public;
grant execute on function private.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb,integer) to authenticated;
create function public.finalize_handover(p_id uuid,p_order_id uuid,p_kind text,p_mileage integer,p_fuel integer,p_signer text,p_signature text,p_notes text,p_photos jsonb,p_damages jsonb,p_expected_revision integer) returns uuid language sql security invoker set search_path='' as $$ select private.finalize_handover(p_id,p_order_id,p_kind,p_mileage,p_fuel,p_signer,p_signature,p_notes,p_photos,p_damages,p_expected_revision) $$;
revoke all on function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb,integer) from public,anon;
grant execute on function public.finalize_handover(uuid,uuid,text,integer,integer,text,text,text,jsonb,jsonb,integer) to authenticated;
