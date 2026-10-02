-- Cover the complete composite vehicle foreign key used by holder authorization.
create index vehicle_holders_vehicle_idx on public.vehicle_holders(vehicle_id,organization_id);
