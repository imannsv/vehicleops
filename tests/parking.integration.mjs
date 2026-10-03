// This test creates and removes fixtures only in the isolated local Supabase stack.
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const status=JSON.parse(execFileSync(process.platform==='win32'?'npx.cmd':'npx',['supabase','status','--output','json'],{encoding:'utf8',shell:process.platform==='win32',stdio:['ignore','pipe','pipe']}));
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false}}),users=[],orgs=[];
const ok=result=>{if(result.error)throw Error(result.error.message);return result.data;};
async function account(){const email='parking-'+crypto.randomUUID()+'@example.com',password=crypto.randomUUID()+'Aa1!';const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user);const client=createClient(status.API_URL,status.PUBLISHABLE_KEY,{auth:{persistSession:false}});ok(await client.auth.signInWithPassword({email,password}));return {client,user};}
try {
 const owner=await account(),dispatcher=await account(),viewer=await account(),driver=await account(),other=await account();
 const org=ok(await owner.client.rpc('create_organization',{p_name:'Parking '+owner.user.id,p_member_name:'Owner'}));orgs.push(org);
 const foreignOrg=ok(await other.client.rpc('create_organization',{p_name:'Other '+other.user.id,p_member_name:'Other'}));orgs.push(foreignOrg);
 for(const [account,role] of [[dispatcher,'dispatcher'],[viewer,'viewer'],[driver,'driver']])ok(await owner.client.rpc('add_member',{p_org:org,p_user:account.user.id,p_name:role,p_role:role}));
 const site=crypto.randomUUID(),labels=Array.from({length:20},(_,i)=>'A-'+String(i+1).padStart(2,'0'));
 const create={p_id:site,p_org:org,p_name:'Hof',p_address:'Teststraße 1',p_labels:labels};
 const spaces=async()=>ok(await owner.client.from('parking_spaces').select('*').eq('site_id',site).order('label'));
 const initial=await Promise.all([owner.client.rpc('create_fleet_site_with_spaces',create),dispatcher.client.rpc('create_fleet_site_with_spaces',create)]);
 assert.ok(initial.every(result=>!result.error));assert.equal(initial.reduce((sum,result)=>sum+result.data,0),20);
 const frozen=await spaces();assert.equal(frozen.length,20);
 assert.equal(ok(await owner.client.rpc('create_fleet_site_with_spaces',create)),0);assert.deepEqual(await spaces(),frozen);
 const batch={p_org:org,p_site:site,p_labels:[' A-01 ','A-01','Werkstatt','Werkstatt']};
 assert.equal(ok(await dispatcher.client.rpc('add_parking_spaces',batch)),1);assert.equal((await spaces()).length,21);
 assert.equal(ok(await owner.client.rpc('add_parking_spaces',batch)),0);
 for(const account of [viewer,driver,other]){
  assert.ok((await account.client.rpc('add_parking_spaces',{...batch,p_labels:['Unauthorized']})).error);
  assert.ok((await account.client.rpc('create_fleet_site_with_spaces',{...create,p_id:crypto.randomUUID(),p_name:'Unauthorized'})).error);
 }
 const anon=createClient(status.API_URL,status.PUBLISHABLE_KEY,{auth:{persistSession:false}});
 assert.ok((await anon.rpc('add_parking_spaces',batch)).error);assert.ok((await anon.rpc('create_fleet_site_with_spaces',create)).error);
 assert.equal(ok(await other.client.from('parking_spaces').select('*').eq('organization_id',org)).length,0);
 assert.equal(ok(await viewer.client.from('parking_spaces').select('*').eq('site_id',site)).length,21);
 assert.ok((await other.client.rpc('add_parking_spaces',{...batch,p_org:foreignOrg})).error);
 assert.ok((await owner.client.rpc('add_parking_spaces',{...batch,p_site:crypto.randomUUID()})).error);
 assert.ok((await viewer.client.from('parking_spaces').insert({id:crypto.randomUUID(),organization_id:org,site_id:site,label:'Direct'})).error);
 for(const invalid of [['Valid but rolled back',''],['Valid but rolled back',null],['Valid but rolled back','x'.repeat(81)],Array.from({length:201},(_,i)=>String(i)),null]){
  const id=crypto.randomUUID();assert.ok((await owner.client.rpc('create_fleet_site_with_spaces',{...create,p_id:id,p_name:'Invalid '+id,p_labels:invalid})).error);
  assert.equal(ok(await owner.client.from('fleet_sites').select('id').eq('id',id)).length,0);
  assert.ok((await owner.client.rpc('add_parking_spaces',{...batch,p_labels:invalid})).error);
 }
 assert.ok(!(await spaces()).some(space=>space.label==='Valid but rolled back'));
 const overlap=await Promise.all([owner.client.rpc('add_parking_spaces',{...batch,p_labels:Array.from({length:20},(_,i)=>'B-'+(i+1))}),dispatcher.client.rpc('add_parking_spaces',{...batch,p_labels:Array.from({length:20},(_,i)=>'B-'+(i+16))})]);
 assert.ok(overlap.every(result=>!result.error));assert.equal(overlap.reduce((sum,result)=>sum+result.data,0),35);assert.equal((await spaces()).length,56);
 assert.deepEqual((await spaces()).filter(space=>space.label.startsWith('A-')),frozen);
 ok(await owner.client.rpc('save_fleet_site',{p_id:site,p_org:org,p_revision:1,p_name:'Renamed',p_address:'Teststraße 1'}));
 assert.ok((await owner.client.rpc('create_fleet_site_with_spaces',{...create,p_labels:['Stale']})).error);assert.ok(!(await spaces()).some(space=>space.label==='Stale'));
 const empty=crypto.randomUUID();assert.equal(ok(await dispatcher.client.rpc('create_fleet_site_with_spaces',{...create,p_id:empty,p_name:'Without bays',p_labels:[]})),0);
 const race=await Promise.all([owner.client.rpc('create_fleet_site_with_spaces',{...create,p_id:crypto.randomUUID(),p_name:'Same name',p_labels:['C-01']}),dispatcher.client.rpc('create_fleet_site_with_spaces',{...create,p_id:crypto.randomUUID(),p_name:'Same name',p_labels:['D-01']})]);
 assert.equal(race.filter(result=>!result.error).length,1);assert.equal(ok(await owner.client.from('fleet_sites').select('id').eq('name','Same name')).length,1);
 console.log('PASS: atomic site/bay setup, retry and concurrent idempotency, overlap/deduplication, bounded validation and rollback, tenant/role isolation, preserved existing bays and stale site protection');
} finally {
 for(const org of orgs){for(const table of ['parking_spaces','fleet_sites','memberships'])ok(await admin.from(table).delete().eq('organization_id',org));ok(await admin.from('organizations').delete().eq('id',org));}
 for(const user of users)ok(await admin.auth.admin.deleteUser(user.id));
}
