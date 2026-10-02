// Exercises the real local Supabase Auth, REST, Storage and transactional RPC.
// Creates a uniquely named test tenant, and removes only its fixtures in finally.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const status = JSON.parse(execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['supabase','status','--output','json'], { encoding:'utf8', shell:process.platform === 'win32', stdio:['ignore','pipe','pipe'] }));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const client = createClient(status.API_URL, status.PUBLISHABLE_KEY, { auth:{persistSession:false} });
function ok(result) { if (result.error) throw new Error(result.error.message); return result.data; }
let user, org; const paths = [];
try {
 const email = `vehicleops-${crypto.randomUUID()}@example.com`, password = crypto.randomUUID()+'aA1!';
 user = ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 ok(await client.auth.signInWithPassword({email,password}));
 org = ok(await client.rpc('create_organization',{p_name:'Integration '+user.id,p_member_name:'Integration Admin'}));
 const vehicleId=crypto.randomUUID(),driverId=crypto.randomUUID(),orderId=crypto.randomUUID();
 ok(await client.from('vehicles').insert({id:vehicleId,organization_id:org,plate:'TEST '+user.id.slice(0,8),vin:'WVWZZZ3CZPE123456',make:'VW',model:'Golf',color:'Blue',mileage:100,location:'Berlin',variant:'Variant',equipment:['CARPLAY','ELECTRIC_HEATED_SEATS'],equipment_notes:'Sonderumbau'}));
 assert.ok((await client.rpc('update_vehicle',{p_id:vehicleId,p_expected_revision:1,p_values:{equipment:['UNKNOWN']}})).error,'Unknown equipment rejected');
 assert.ok((await client.rpc('update_vehicle',{p_id:vehicleId,p_expected_revision:1,p_values:{equipment:['ABS','ABS']}})).error,'Duplicate equipment rejected');
 assert.ok((await client.rpc('update_vehicle',{p_id:vehicleId,p_expected_revision:1,p_values:{equipment_notes:'x'.repeat(2001)}})).error,'Oversized equipment notes rejected');
 ok(await client.from('drivers').insert({id:driverId,organization_id:org,name:'Test Driver',email,phone:'123',license_valid_until:'2030-12-31'}));
 ok(await client.from('orders').insert({id:orderId,organization_id:org,reference:'TEST-1',vehicle_id:vehicleId,driver_id:driverId,pickup:'Berlin',destination:'Hamburg',scheduled_at:'2027-01-01T10:00:00Z'}));
 const jpeg=await sharp({create:{width:32,height:32,channels:3,background:'#7799bb'}}).jpeg().toBuffer();
 const png=await sharp({create:{width:32,height:32,channels:4,background:'#192b42'}}).png().toBuffer();
 const slots=['Vorne','Hinten','Links','Rechts','Vorne links','Vorne rechts','Hinten links','Hinten rechts','Innenraum','Tacho'];
 for (const kind of ['pickup','delivery']) {
  const id=crypto.randomUUID(),prefix=`${org}/${orderId}/${id}/`,photos=[];
  for (const [index,slot] of slots.entries()) { const path=prefix+index+'.jpg'; ok(await client.storage.from('evidence').upload(path,jpeg,{contentType:'image/jpeg'})); paths.push(path); photos.push({slot,path}); }
  for (let sequence = 1; sequence <= 2; sequence++) { const path=prefix+`interior-${sequence}.jpg`; ok(await client.storage.from('evidence').upload(path,jpeg,{contentType:'image/jpeg'})); paths.push(path); photos.push({slot:'Innenraum',sequence,path}); }
  const signature=prefix+'signature.png'; ok(await client.storage.from('evidence').upload(signature,png,{contentType:'image/png'})); paths.push(signature);
  const args={p_id:id,p_order_id:orderId,p_kind:kind,p_mileage:kind==='pickup'?100:200,p_fuel:75,p_signer:'Test Driver',p_signature:signature,p_notes:'Integration',p_photos:photos,p_damages:[],p_expected_revision:ok(await client.from('orders').select('revision').eq('id',orderId).single()).revision};
  const missing=await client.rpc('finalize_handover',{...args,p_photos:photos.slice(1)}); assert.ok(missing.error,'Incomplete photos must be rejected');
  ok(await client.rpc('finalize_handover',args));
  const snapshot=ok(await client.from('handovers').select('snapshot').eq('id',id).single()).snapshot;
  if (kind==='pickup') {
   assert.deepEqual(snapshot.vehicle.equipment,['CARPLAY','ELECTRIC_HEATED_SEATS']);assert.equal(snapshot.vehicle.variant,'Variant');assert.equal(snapshot.vehicle.equipment_notes,'Sonderumbau');
   ok(await client.rpc('update_vehicle',{p_id:vehicleId,p_expected_revision:2,p_values:{plate:'CHANGED '+user.id.slice(0,8),variant:'GTI',equipment:['ABS'],equipment_notes:'Dachbox'}}));
   const updated=ok(await client.from('vehicles').select('variant,equipment,equipment_notes').eq('id',vehicleId).single());assert.deepEqual(updated,{variant:'GTI',equipment:['ABS'],equipment_notes:'Dachbox'});
   ok(await client.rpc('update_driver',{p_id:driverId,p_expected_revision:1,p_values:{name:'Changed Driver'}}));
   assert.deepEqual(ok(await client.from('handovers').select('snapshot').eq('id',id).single()).snapshot,snapshot,'Protocol metadata must be immutable');
   assert.ok((await client.rpc('update_vehicle',{p_id:vehicleId,p_expected_revision:2,p_values:{color:'Red'}})).error,'Stale revision rejected');
   assert.ok((await client.rpc('update_vehicle',{p_id:vehicleId,p_expected_revision:3,p_values:{mileage:150}})).error,'In-transit mileage edit rejected');
   assert.ok((await client.rpc('update_driver',{p_id:driverId,p_expected_revision:2,p_values:{license_valid_until:'2020-01-01'}})).error,'License edit cannot invalidate open order');
   assert.ok((await client.rpc('update_order',{p_id:orderId,p_expected_revision:2,p_values:{pickup:'Other'}})).error,'Pickup edit after handover rejected');
   assert.ok((await client.rpc('cancel_order',{p_id:orderId,p_expected_revision:2,p_reason:'Reason'})).error,'In-transit cancellation rejected');
   ok(await client.rpc('update_order',{p_id:orderId,p_expected_revision:2,p_values:{destination:'Bremen',scheduled_at:'2027-02-01T10:00:00Z'}}));
  }
  const duplicate=await client.rpc('finalize_handover',args); assert.ok(duplicate.error,'Duplicate finalization must be rejected');
  const persisted=ok(await client.from('handover_photos').select('slot,sequence').eq('handover_id',id).order('sequence')); assert.deepEqual(persisted.filter(photo=>photo.slot==='Innenraum').map(photo=>photo.sequence),[0,1,2]);
  const signed=ok(await client.storage.from('evidence').createSignedUrl(photos[0].path,60)); const response=await fetch(signed.signedUrl); assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'image/jpeg');
  const removed=ok(await client.storage.from('evidence').remove([photos[0].path])); assert.equal(removed.length,0,'Finalized evidence must be protected');
 }
 assert.equal(ok(await client.from('orders').select('status').eq('id',orderId).single()).status,'completed');
 assert.equal(ok(await client.from('vehicles').select('mileage').eq('id',vehicleId).single()).mileage,200);
 assert.equal(ok(await client.from('vehicle_events').select('*').eq('organization_id',org)).length,5);
 assert.ok((await client.rpc('update_order',{p_id:orderId,p_expected_revision:4,p_values:{destination:'Berlin'}})).error,'Completed order edit denied');
 assert.ok((await client.rpc('update_vehicle',{p_id:vehicleId,p_expected_revision:4,p_values:{mileage:199}})).error,'Historic mileage floor enforced');
 const cancelledId=crypto.randomUUID();
 ok(await client.from('orders').insert({id:cancelledId,organization_id:org,reference:'TEST-CANCEL',vehicle_id:vehicleId,driver_id:driverId,pickup:'Bremen',destination:'Berlin',scheduled_at:'2027-03-01T10:00:00Z'}));
 assert.ok((await client.rpc('cancel_order',{p_id:cancelledId,p_expected_revision:1,p_reason:''})).error,'Cancellation requires reason');
 ok(await client.rpc('cancel_order',{p_id:cancelledId,p_expected_revision:1,p_reason:'Customer cancelled'}));
 assert.equal(ok(await client.from('orders').select('status').eq('id',cancelledId).single()).status,'cancelled');
 ok(await client.from('orders').insert({organization_id:org,reference:'TEST-REBOOK',vehicle_id:vehicleId,driver_id:driverId,pickup:'Bremen',destination:'Berlin',scheduled_at:'2027-03-02T10:00:00Z'}));
 assert.ok((await client.storage.from('evidence').upload(org+'/'+cancelledId+'/'+crypto.randomUUID()+'/0.jpg',jpeg,{contentType:'image/jpeg'})).error,'Cancelled order rejects uploads');
 const anonymous=createClient(status.API_URL,status.PUBLISHABLE_KEY,{auth:{persistSession:false}}); assert.ok((await anonymous.from('vehicles').select('*')).error,'Anonymous access must be rejected');
 console.log('PASS: local Supabase login, organization, CRUD, 26 uploads, multiple interior photos, both protocol RPCs, immutable evidence, signed downloads, history and anonymous denial');
} finally {
 if (org) { for (const table of ['vehicle_movements','handover_photos','damages','vehicle_events','handovers','orders','drivers','vehicles','memberships']) ok(await admin.from(table).delete().eq('organization_id',org)); if(paths.length) ok(await admin.storage.from('evidence').remove(paths)); ok(await admin.from('organizations').delete().eq('id',org)); }
 if(user) ok(await admin.auth.admin.deleteUser(user.id));
}

