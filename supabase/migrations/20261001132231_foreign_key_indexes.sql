create index damages_handover_idx on public.damages(organization_id,handover_id);
create index drivers_member_idx on public.drivers(organization_id,user_id);
create index photos_handover_idx on public.handover_photos(organization_id,handover_id);
create index handovers_creator_idx on public.handovers(created_by);
create index handovers_order_idx on public.handovers(organization_id,order_id);
create index events_order_idx on public.vehicle_events(organization_id,order_id);
