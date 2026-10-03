import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const config=JSON.parse(execFileSync('npx.cmd',['supabase','status','--output','json'],{encoding:'utf8',shell:true,stdio:['ignore','pipe','pipe']}));
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false}}),users=[],orgs=[],files=[];
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
async function account(){const email='route-'+crypto.randomUUID()+'@example.com',password=crypto.randomUUID()+'Aa1!';const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user);const c=createClient(config.API_URL,config.PUBLISHABLE_KEY,{auth:{persistSession:false}});ok(await c.auth.signInWithPassword({email,password}));return{c,user};}
try{
 const owner=await account(),driver=await account(),viewer=await account(),foreign=await account();
 const org=ok(await owner.c.rpc('create_organization',{p_name:'Routes '+owner.user.id,p_member_name:'Admin'}));orgs.push(org);
 const otherOrg=ok(await foreign.c.rpc('create_organization',{p_name:'Other routes',p_member_name:'Other'}));orgs.push(otherOrg);
 for(const[a,role]of[[driver,'driver'],[viewer,'viewer']])ok(await owner.c.rpc('add_member',{p_org:org,p_user:a.user.id,p_name:role,p_role:role}));
 const sites=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()],spaces=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
 for(let i=0;i<sites.length;i++)ok(await admin.from('fleet_sites').insert({id:sites[i],organization_id:i===2?otherOrg:org,name:i===0?'Pickup Yard':i===1?'Target Yard':'Foreign Yard',address:'Test street '+i}));
 for(let i=0;i<spaces.length;i++)ok(await admin.from('parking_spaces').insert({id:spaces[i],organization_id:org,site_id:i===0?sites[0]:sites[1],label:'Bay '+i}));
 const vehicles=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
 for(let i=0;i<vehicles.length;i++)ok(await owner.c.rpc('save_vehicle_record',{p_id:vehicles[i],p_org:org,p_revision:0,p_values:{plate:null,vin:'WVWZZZ3CZPE12345'+i,make:'VW',model:'Golf',color:'Blue',mileage:100,location:'Pickup Yard',inventory_kind:'owned',inventory_status:'sold'},p_holder:null,p_holder_revision:0}));
 const current=async id=>ok(await owner.c.from('vehicles').select('*').eq('id',id).single());
 ok(await owner.c.rpc('move_vehicle',{p_vehicle:vehicles[0],p_revision:(await current(vehicles[0])).revision,p_location:'',p_site:sites[0],p_space:spaces[0],p_reason:''}));
 const d=crypto.randomUUID();ok(await owner.c.from('drivers').insert({id:d,organization_id:org,user_id:driver.user.id,name:'Route Driver',email:driver.user.email,phone:'+49 12345',license_valid_until:'2035-01-01'}));
 const orders=[crypto.randomUUID(),crypto.randomUUID()];
 const makeOrder=(id,vehicle)=>({id,organization_id:org,vehicle_id:vehicle,driver_id:d,reference:'R-'+id,pickup:'Ignored label',destination:'Ignored label',pickup_site_id:sites[0],destination_site_id:sites[1],destination_space_id:spaces[1],pickup_address:'forged',destination_address:'forged',scheduled_at:new Date().toISOString(),contact:'Customer +49 12345',status:'assigned'});
 for(let i=0;i<2;i++)ok(await owner.c.from('orders').insert(makeOrder(orders[i],vehicles[i])));
 const readOrder=async id=>ok(await owner.c.from('orders').select('*').eq('id',id).single());
 const plan=await readOrder(orders[0]);assert.equal(plan.pickup,'Pickup Yard');assert.equal(plan.destination_address,'Test street 1');
 for(const actor of[driver,viewer,foreign])assert.ok((await actor.c.rpc('update_order',{p_id:plan.id,p_expected_revision:plan.revision,p_values:{destination_site_id:null,destination:'Forged'}})).error);
 assert.ok((await owner.c.rpc('update_order',{p_id:plan.id,p_expected_revision:plan.revision,p_values:{destination_site_id:sites[2],destination_space_id:null}})).error);
 assert.ok((await owner.c.rpc('update_order',{p_id:plan.id,p_expected_revision:plan.revision,p_values:{destination_site_id:sites[0]}})).error);
 ok(await owner.c.rpc('update_order',{p_id:plan.id,p_expected_revision:plan.revision,p_values:{transport_plate:'b red 07'}}));assert.equal((await readOrder(plan.id)).transport_plate,'B RED 07');
 // Snapshot planning addresses; later site edits must not rewrite the order.
 ok(await owner.c.rpc('save_fleet_site',{p_id:sites[1],p_org:org,p_revision:1,p_name:'Renamed Target',p_address:'New address'}));
 let o=await readOrder(plan.id);ok(await owner.c.rpc('update_order',{p_id:o.id,p_expected_revision:o.revision,p_values:{contact:'New contact'}}));assert.equal((await readOrder(o.id)).destination,'Target Yard');assert.equal((await readOrder(o.id)).destination_address,'Test street 1');
 const jpeg=await sharp({create:{width:40,height:30,channels:3,background:'#245de8'}}).jpeg().toBuffer(),png=await sharp({create:{width:40,height:30,channels:4,background:'#142c49'}}).png().toBuffer();
 async function evidence(orderId,kind){
  const vehicle=await current((await readOrder(orderId)).vehicle_id),order=await readOrder(orderId),id=crypto.randomUUID();
  ok(await driver.c.rpc('start_protocol',{p_id:id,p_vehicle:vehicle.id,p_order:orderId,p_kind:kind}));
  async function upload(label,bytes,mime){const path=org+'/'+id+'/'+label;ok(await driver.c.storage.from('protocol-media').upload(path,bytes,{contentType:mime}));files.push(path);return path;}
  const photos=[];for(const slot of['Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho'])photos.push({slot,path:await upload(photos.length+'.jpg',jpeg,'image/jpeg')});
  const parties={giver:{name:'Giver',role:'Employee',signature:await upload('giver.png',png,'image/png')},receiver:{name:'Receiver',role:'Driver',signature:await upload('receiver.png',png,'image/png')},exception_confirmed:false,exception_reason:''};
  return{id,payload:{purpose:'transport',company_revision:1,vehicle_revision:vehicle.revision,order_revision:order.revision,mileage:vehicle.mileage+1,fuel:60,notes:'',transport_plate:order.transport_plate,photos,parties,damages:[{area:'Door',description:'Scratch'}],keys:{confirmed:false,selected:[],revision:vehicle.keys_revision,notes:''},position_version:1,position:{confirmed:kind==='delivery',site_revision:kind==='delivery'?2:1,space_revision:1,location:'Renamed Target',site_id:kind==='delivery'?sites[1]:sites[0],space_id:kind==='delivery'?spaces[1]:null},stock_status:'sold',stock_confirmed:false}};
 }
 const pickups=[];for(const id of orders){const e=await evidence(id,'pickup');ok(await driver.c.rpc('finalize_protocol',{p_id:e.id,p_values:e.payload}));pickups.push(e.id);}
 assert.equal((await current(vehicles[0])).parking_space_id,null);assert.equal((await current(vehicles[0])).location,'In Transport');
 const pickup=ok(await owner.c.from('handovers').select('*').eq('id',pickups[0]).single());assert.equal(pickup.position.location,'Pickup Yard');assert.equal(pickup.snapshot.order.destination,'Target Yard');
 o=await readOrder(orders[0]);assert.ok((await owner.c.rpc('update_order',{p_id:o.id,p_expected_revision:o.revision,p_values:{pickup_site_id:null}})).error);
 const e1=await evidence(orders[0],'delivery'),e2=await evidence(orders[1],'delivery');
 assert.ok((await driver.c.rpc('finalize_protocol',{p_id:e1.id,p_values:{...e1.payload,position:{...e1.payload.position,space_revision:0}}})).error);
 assert.ok((await driver.c.rpc('finalize_protocol',{p_id:e1.id,p_values:{...e1.payload,position:{...e1.payload.position,site_revision:1}}})).error);
 assert.ok((await driver.c.rpc('finalize_protocol',{p_id:e1.id,p_values:{...e1.payload,position:{...e1.payload.position,confirmed:false}}})).error);
 assert.ok((await driver.c.rpc('finalize_protocol',{p_id:e1.id,p_values:{...e1.payload,position:{...e1.payload.position,site_id:sites[2],space_id:null}}})).error);
 assert.equal(ok(await owner.c.from('handovers').select('id').eq('id',e1.id)).length,0);
 const results=await Promise.all([e1,e2].map(e=>driver.c.rpc('finalize_protocol',{p_id:e.id,p_values:e.payload})));
 assert.equal(results.filter(r=>!r.error).length,1);assert.equal(results.filter(r=>r.error).length,1);assert.match(results.find(r=>r.error).error.message,/belegt/);
 const winner=results[0].error?e2:e1,loser=results[0].error?e1:e2,loserOrder=results[0].error?orders[0]:orders[1];
 assert.equal(ok(await owner.c.from('handovers').select('id').eq('id',loser.id)).length,0);assert.equal((await readOrder(loserOrder)).status,'in_transit');assert.equal(ok(await owner.c.from('damages').select('id').eq('handover_id',loser.id)).length,0);
 ok(await driver.c.rpc('finalize_protocol',{p_id:winner.id,p_values:winner.payload}));assert.equal(ok(await owner.c.from('vehicle_movements').select('id').eq('handover_id',winner.id)).length,1);
 loser.payload.position.space_id=spaces[2];ok(await driver.c.rpc('finalize_protocol',{p_id:loser.id,p_values:loser.payload}));
 for(const id of vehicles.slice(0,2)){const v=await current(id);assert.equal(v.inventory_status,'sold');assert.equal(v.site_id,sites[1]);assert.equal(v.location,'Renamed Target');}
 assert.equal(ok(await owner.c.from('handovers').select('position').eq('id',winner.id).single()).position.space_label,'Bay 1');
 // Legacy text-only planning remains compatible and drops its old site link.
 const legacy=makeOrder(crypto.randomUUID(),vehicles[2]);ok(await owner.c.from('orders').insert({...legacy,destination_space_id:null}));o=await readOrder(legacy.id);ok(await owner.c.rpc('update_order',{p_id:o.id,p_expected_revision:o.revision,p_values:{destination:'Customer Street 9'}}));o=await readOrder(o.id);assert.equal(o.destination_site_id,null);assert.equal(o.destination_address,'');
 console.log('PASS: route tenant/role checks, frozen addresses, transport-plate edit, pickup bay release, actual delivery confirmation, occupied/concurrent bay rollback, retry/idempotency, preserved sold status and legacy free addresses');
}finally{
 for(const org of orgs){for(const table of['stock_events','protocol_sessions','key_movements','vehicle_movements','handover_photos','damages','handovers','vehicle_keys','vehicle_assets','vehicle_holders','vehicle_events','orders','drivers','vehicles','parking_spaces','fleet_sites','memberships'])ok(await admin.from(table).delete().eq('organization_id',org));ok(await admin.from('organizations').delete().eq('id',org));}
 if(files.length)ok(await admin.storage.from('protocol-media').remove(files));for(const user of users)ok(await admin.auth.admin.deleteUser(user.id));
}
