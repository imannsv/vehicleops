-- Run with psql -v ON_ERROR_STOP=1 against a migrated LOCAL Supabase database.
-- Every fixture is rolled back.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','admin@test.invalid'),
 ('10000000-0000-4000-8000-000000000002','other@test.invalid'),
 ('10000000-0000-4000-8000-000000000003','driver@test.invalid'),
 ('10000000-0000-4000-8000-000000000004','viewer@test.invalid');
insert into public.organizations(id,name) values ('20000000-0000-4000-8000-000000000001','Tenant A'),('20000000-0000-4000-8000-000000000002','Tenant B');
insert into public.memberships(organization_id,user_id,name,role) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Admin','admin'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Other','admin'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Driver','driver'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','Viewer','viewer');
insert into public.vehicles(id,organization_id,plate,vin,make,model,color,mileage,location) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','A 1','WVWZZZ3CZPE111111','VW','Golf','Blue',100,'Berlin'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','B 1','WVWZZZ3CZPE222222','VW','Golf','Blue',100,'Berlin');
insert into public.drivers(id,organization_id,name,email,phone,license_valid_until,user_id) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Driver','driver@test.invalid','123','2030-01-01','10000000-0000-4000-8000-000000000003'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Other','other@test.invalid','123','2030-01-01',null);
insert into public.orders(id,organization_id,reference,vehicle_id,driver_id,pickup,destination,scheduled_at) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','TEST-1','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Berlin','Hamburg','2027-01-01');

-- Files are metadata fixtures; storage byte and upload behavior is separately integration tested.
insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'evidence','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001/'||i||'.jpg','10000000-0000-4000-8000-000000000003','{"mimetype":"image/jpeg"}'::jsonb from generate_series(1,10) i;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('evidence','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001/signature.png','10000000-0000-4000-8000-000000000003','{"mimetype":"image/png"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if (select count(*) from public.vehicles) <> 1 then raise exception 'FAIL: tenant isolation'; end if;
 if exists(select 1 from public.organizations where name='Tenant B') then raise exception 'FAIL: foreign organization visible'; end if;
 begin
  insert into public.vehicles(organization_id,plate,vin,make,model,color,mileage,location) values('20000000-0000-4000-8000-000000000001','A 2','WVWZZZ3CZPE333333','VW','Golf','Blue',100,'Berlin');
  raise exception 'FAIL: driver created vehicle';
 exception when insufficient_privilege then null; end;
 begin
  perform public.finalize_handover('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','delivery',100,75,'Driver','bad','', '[]','[]',1);
  raise exception 'FAIL: delivery before pickup';
 exception when raise_exception then if sqlerrm not like 'Auftragsstatus%' then raise; end if; end;
 begin
  perform public.finalize_handover('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','pickup',99,75,'Driver','bad','','[]','[]',1);
  raise exception 'FAIL: mileage decreased';
 exception when raise_exception then if sqlerrm not like 'Kilometerstand%' then raise; end if; end;
 begin
  perform public.finalize_handover('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','pickup',100,75,'Driver','bad','','[]','[]',1);
  raise exception 'FAIL: missing photos allowed';
 exception when raise_exception then if sqlerrm not like 'Zehn Pflicht%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
do $$ begin
 begin
  perform public.finalize_handover('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','pickup',100,75,'Viewer','bad','','[]','[]',1);
  raise exception 'FAIL: viewer finalized';
 exception when raise_exception then if sqlerrm <> 'Keine Berechtigung' then raise; end if; end;
 begin
  perform public.add_member('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Intruder','admin');
  raise exception 'FAIL: viewer elevated role';
 exception when raise_exception then if sqlerrm <> 'Administrator erforderlich' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select public.finalize_handover('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','pickup',100,75,'Driver','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001/signature.png','',
 (select jsonb_agg(jsonb_build_object('slot',slot,'path','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001/'||ord||'.jpg')) from unnest(array['Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho']) with ordinality as t(slot,ord)), '[{"area":"Felge","description":"Kratzer"}]',1);
do $$ begin
 if (select status from public.orders where reference='TEST-1') <> 'in_transit' then raise exception 'FAIL: status not advanced'; end if;
 if (select count(*) from public.handover_photos)<>10 or (select count(*) from public.damages)<>1 or (select count(*) from public.vehicle_events)<>1 then raise exception 'FAIL: evidence/history not recorded'; end if;
 begin
  update public.handovers set mileage=0;
  raise exception 'FAIL: finalized protocol mutable';
 exception when insufficient_privilege then null; end;
 begin
  update public.orders set status='completed';
  raise exception 'FAIL: direct status bypass';
 exception when insufficient_privilege then null; end;
 if (select count(*) from storage.objects where bucket_id='evidence')<>11 then raise exception 'FAIL: evidence access'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
 begin
  perform public.update_vehicle('30000000-0000-4000-8000-000000000001',2,'{"color":"Red"}');
  raise exception 'FAIL: viewer edited vehicle';
 exception when raise_exception then if sqlerrm <> 'Keine Berechtigung' then raise; end if; end;
 begin
  perform public.update_driver('40000000-0000-4000-8000-000000000001',1,'{"name":"Changed"}');
  raise exception 'FAIL: viewer edited driver';
 exception when raise_exception then if sqlerrm <> 'Keine Berechtigung' then raise; end if; end;
 begin
  perform public.update_order('50000000-0000-4000-8000-000000000001',2,'{"destination":"Bremen"}');
  raise exception 'FAIL: viewer edited order';
 exception when raise_exception then if sqlerrm <> 'Keine Berechtigung' then raise; end if; end;
 begin
  perform public.cancel_order('50000000-0000-4000-8000-000000000001',2,'Reason');
  raise exception 'FAIL: viewer cancelled order';
 exception when raise_exception then if sqlerrm <> 'Keine Berechtigung' then raise; end if; end;
end $$;
reset role;
select 'PASS: tenant isolation, roles, photos, mileage, lifecycle, immutability, history' as result;
rollback;

