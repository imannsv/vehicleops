// All fixtures and real uploads are restricted to the isolated local stack.
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const config=JSON.parse(execFileSync(process.platform==='win32'?'npx.cmd':'npx',['supabase','status','--output','json'],{encoding:'utf8',shell:process.platform==='win32',stdio:['ignore','pipe','pipe']}));
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false}}),users=[],orgs=[],files=[];
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
async function account(){const email='fleet-archive-'+crypto.randomUUID()+'@example.com',password=crypto.randomUUID()+'Aa1!';const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user);const c=createClient(config.API_URL,config.PUBLISHABLE_KEY,{auth:{persistSession:false}});ok(await c.auth.signInWithPassword({email,password}));return{c,user};}
try{
 const owner=await account(),dispatch=await account(),driver=await account(),viewer=await account(),foreign=await account();
 const org=ok(await owner.c.rpc('create_organization',{p_name:'Archive '+owner.user.id,p_member_name:'Owner'}));orgs.push(org);
 const other=ok(await foreign.c.rpc('create_organization',{p_name:'Foreign archive',p_member_name:'Other'}));orgs.push(other);
 for(const[a,role]of[[dispatch,'dispatcher'],[driver,'driver'],[viewer,'viewer']])ok(await owner.c.rpc('add_member',{p_org:org,p_user:a.user.id,p_name:role,p_role:role}));
 const sites=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
 for(let i=0;i<3;i++)ok(await owner.c.rpc('create_fleet_site_with_spaces',{p_id:sites[i],p_org:org,p_name:'Hof '+i,p_address:'Teststraße '+i,p_labels:['A-01','A-02']}));
 const allSpaces=ok(await owner.c.from('parking_spaces').select('*').eq('organization_id',org)),bay=allSpaces.find(s=>s.site_id===sites[0]&&s.label==='A-01');
 const site=id=>owner.c.from('fleet_sites').select('*').eq('id',id).single().then(ok),space=id=>owner.c.from('parking_spaces').select('*').eq('id',id).single().then(ok);
 const change=(c,kind,id,revision,archived)=>c.rpc('set_fleet_archived',{p_org:org,p_kind:kind,p_id:id,p_revision:revision,p_archived:archived});
 for(const actor of[driver,viewer,foreign])assert.ok((await change(actor.c,'space',bay.id,1,true)).error);
 const anon=createClient(config.API_URL,config.PUBLISHABLE_KEY,{auth:{persistSession:false}});assert.ok((await change(anon,'space',bay.id,1,true)).error);
 ok(await change(dispatch.c,'space',bay.id,1,true));const archivedBay=await space(bay.id);assert.ok(archivedBay.archived_at);assert.equal(archivedBay.revision,2);
 ok(await change(dispatch.c,'space',bay.id,1,true));assert.deepEqual(await space(bay.id),archivedBay);
 assert.ok((await change(owner.c,'space',bay.id,1,false)).error);
 assert.ok((await owner.c.rpc('save_parking_space',{p_id:bay.id,p_org:org,p_site:sites[0],p_revision:2,p_label:'Renamed archived'})).error);
 assert.equal(ok(await owner.c.rpc('add_parking_spaces',{p_org:org,p_site:sites[0],p_labels:['A-01','A-03']})),1);assert.deepEqual(await space(bay.id),archivedBay);
 ok(await change(owner.c,'site',sites[0],1,true));assert.ok((await change(owner.c,'space',bay.id,2,false)).error);
 for(const result of [await owner.c.rpc('add_parking_spaces',{p_org:org,p_site:sites[0],p_labels:[]}),await owner.c.rpc('save_fleet_site',{p_id:sites[0],p_org:org,p_revision:2,p_name:'Renamed',p_address:''}),await owner.c.rpc('save_parking_space',{p_id:crypto.randomUUID(),p_org:org,p_site:sites[0],p_revision:0,p_label:'New'})])assert.ok(result.error);
 const vehicles=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
 for(let i=0;i<3;i++)ok(await owner.c.from('vehicles').insert({id:vehicles[i],organization_id:org,plate:null,vin:'WVWZZZ3CZPE77777'+i,make:'VW',model:'Golf',color:'Blue',mileage:10,location:'Free location'}));
 const current=id=>owner.c.from('vehicles').select('*').eq('id',id).single().then(ok);
 const move=async(c,id,target,bayId)=>c.rpc('move_vehicle',{p_vehicle:id,p_revision:(await current(id)).revision,p_site:target,p_space:bayId,p_location:target?'':'Free location',p_reason:''});
 assert.ok((await move(owner.c,vehicles[0],sites[0],null)).error);assert.equal((await current(vehicles[0])).site_id,null);
 const driverId=crypto.randomUUID();ok(await owner.c.from('drivers').insert({id:driverId,organization_id:org,user_id:driver.user.id,name:'Driver',email:driver.user.email,phone:'12345',license_valid_until:'2035-01-01'}));
 const orderId=crypto.randomUUID(),orderRow={id:orderId,organization_id:org,vehicle_id:vehicles[1],driver_id:driverId,reference:'Archive trip',pickup:'Hof 0',destination:'Hof 1',pickup_site_id:sites[0],destination_site_id:sites[1],scheduled_at:new Date().toISOString(),contact:'',status:'assigned'};
 assert.ok((await owner.c.from('orders').insert(orderRow)).error);assert.equal(ok(await owner.c.from('orders').select('id').eq('id',orderId)).length,0);
 ok(await change(owner.c,'site',sites[0],2,false));assert.ok((await space(bay.id)).archived_at);ok(await change(owner.c,'space',bay.id,2,false));
 ok(await move(owner.c,vehicles[0],sites[0],bay.id));assert.ok((await change(owner.c,'space',bay.id,3,true)).error);assert.ok((await change(owner.c,'site',sites[0],3,true)).error);
 const frozenMove=ok(await owner.c.from('vehicle_movements').select('*').eq('vehicle_id',vehicles[0]).eq('to_site_id',sites[0]).single());ok(await move(owner.c,vehicles[0],null,null));
 ok(await owner.c.from('orders').insert({...orderRow,destination_space_id:allSpaces.find(s=>s.site_id===sites[1]&&s.label==='A-01').id}));
 assert.ok((await change(owner.c,'site',sites[0],3,true)).error);assert.ok((await change(owner.c,'site',sites[1],1,true)).error);
 const targetBay=allSpaces.find(s=>s.site_id===sites[1]&&s.label==='A-01');assert.ok((await change(owner.c,'space',targetBay.id,1,true)).error);
 const jpeg=await sharp({create:{width:40,height:30,channels:3,background:'#245de8'}}).jpeg().toBuffer(),png=await sharp({create:{width:40,height:30,channels:4,background:'#142c49'}}).png().toBuffer();
 async function protocol(kind,order=null){
  const vehicle=await current(vehicles[1]),trip=order?ok(await owner.c.from('orders').select('*').eq('id',order).single()):null,id=crypto.randomUUID();
  ok(await owner.c.rpc('start_protocol',{p_id:id,p_vehicle:vehicle.id,p_order:order,p_kind:kind}));
  async function upload(label,bytes,mime){const path=org+'/'+id+'/'+label;ok(await owner.c.storage.from('protocol-media').upload(path,bytes,{contentType:mime}));files.push(path);return path;}
  const photos=[];for(const slot of['Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho'])photos.push({slot,path:await upload(photos.length+'.jpg',jpeg,'image/jpeg')});
  const parties={giver:{name:'Giver',role:'Employee',signature:await upload('giver.png',png,'image/png')},receiver:{name:'Receiver',role:'Driver',signature:await upload('receiver.png',png,'image/png')},exception_confirmed:false,exception_reason:''};
  return{id,payload:{purpose:order?'transport':'other',company_revision:1,vehicle_revision:vehicle.revision,order_revision:trip?.revision??null,mileage:vehicle.mileage+1,fuel:50,notes:'',transport_plate:'',photos,parties,damages:[{area:'Door',description:'Scratch'}],keys:{confirmed:false,selected:[],revision:vehicle.keys_revision,notes:''},position_version:1,position:{confirmed:kind==='delivery'||!order,location:'Free location',site_id:null,space_id:null,site_revision:null,space_revision:null},stock_status:null,stock_confirmed:false}};
 }
 const pickup=await protocol('pickup',orderId);ok(await owner.c.rpc('finalize_protocol',{p_id:pickup.id,p_values:pickup.payload}));
 const frozenProtocol=ok(await owner.c.from('handovers').select('*').eq('id',pickup.id).single());
 ok(await change(owner.c,'site',sites[0],3,true));assert.equal(ok(await driver.c.from('fleet_sites').select('*').eq('id',sites[0]).single()).archived_at!==null,true);
 const trip=ok(await owner.c.from('orders').select('*').eq('id',orderId).single());ok(await owner.c.rpc('update_order',{p_id:orderId,p_expected_revision:trip.revision,p_values:{contact:'Updated during transport'}}));
 ok(await change(owner.c,'site',sites[0],4,false));ok(await owner.c.rpc('save_fleet_site',{p_id:sites[0],p_org:org,p_revision:5,p_name:'New yard name',p_address:'New street'}));
 assert.deepEqual(ok(await owner.c.from('handovers').select('*').eq('id',pickup.id).single()),frozenProtocol);assert.deepEqual(ok(await owner.c.from('vehicle_movements').select('*').eq('id',frozenMove.id).single()),frozenMove);
 const delivery=await protocol('delivery',orderId);ok(await owner.c.rpc('finalize_protocol',{p_id:delivery.id,p_values:delivery.payload}));ok(await change(owner.c,'site',sites[1],1,true));ok(await owner.c.rpc('finalize_protocol',{p_id:delivery.id,p_values:delivery.payload}));
 // A standalone draft targeting an unused bay cannot complete after that bay is archived, even without the new revision checks.
 const stale=await protocol('delivery'),staleTarget=allSpaces.find(s=>s.site_id===sites[2]&&s.label==='A-01');ok(await change(owner.c,'space',staleTarget.id,1,true));
 const rejected=await owner.c.rpc('finalize_protocol',{p_id:stale.id,p_values:{...stale.payload,position_version:0,position:{confirmed:true,site_id:sites[2],space_id:staleTarget.id,location:'Hof 2'}}});assert.ok(rejected.error);
 assert.equal(ok(await owner.c.from('handovers').select('id').eq('id',stale.id)).length,0);assert.equal(ok(await owner.c.from('damages').select('id').eq('handover_id',stale.id)).length,0);assert.equal((await current(vehicles[1])).site_id,null);
 // Archival and a newly committed position/order cannot both win.
 const race=await Promise.all([change(owner.c,'site',sites[2],1,true),move(dispatch.c,vehicles[2],sites[2],null)]);assert.equal(race.filter(r=>!r.error).length,1);
 const lastSite=await site(sites[2]),lastVehicle=await current(vehicles[2]);assert.ok(!lastSite.archived_at||lastVehicle.site_id!==sites[2]);
 if(lastSite.archived_at)ok(await change(owner.c,'site',sites[2],lastSite.revision,false));else ok(await move(owner.c,vehicles[2],null,null));
 const raceOrder=crypto.randomUUID(),before=await site(sites[2]);const plannedRace=await Promise.all([change(owner.c,'site',sites[2],before.revision,true),dispatch.c.from('orders').insert({...orderRow,id:raceOrder,vehicle_id:vehicles[2],reference:'Race trip',pickup_site_id:sites[2],destination_site_id:null,destination:'Customer'})]);assert.equal(plannedRace.filter(r=>!r.error).length,1);
 assert.ok(!(await site(sites[2])).archived_at||!ok(await owner.c.from('orders').select('id').eq('id',raceOrder)).length);
 assert.equal(ok(await foreign.c.from('fleet_sites').select('id').eq('organization_id',org)).length,0);
 console.log('PASS: archive/restore roles, revisions/retries, occupancy and pending route protection, historical pickup/readability, stable protocol/movement copies, legacy write guards, stale-protocol rollback and concurrent archival versus position/order');
}finally{
 for(const org of orgs){for(const table of['stock_events','protocol_sessions','key_movements','vehicle_movements','handover_photos','damages','handovers','vehicle_keys','vehicle_assets','vehicle_holders','vehicle_events','orders','drivers','vehicles','parking_spaces','fleet_sites','memberships'])ok(await admin.from(table).delete().eq('organization_id',org));ok(await admin.from('organizations').delete().eq('id',org));}
 if(files.length)ok(await admin.storage.from('protocol-media').remove(files));for(const user of users)ok(await admin.auth.admin.deleteUser(user.id));
}
