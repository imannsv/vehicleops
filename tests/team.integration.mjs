import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const s=JSON.parse(execFileSync(process.platform==='win32'?'npx.cmd':'npx',['supabase','status','--output','json'],{encoding:'utf8',shell:process.platform==='win32',stdio:['ignore','pipe','pipe']}));
const admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const client=()=>createClient(s.API_URL,s.PUBLISHABLE_KEY,{auth:{persistSession:false}});
const ok=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
const users=[];let org;
async function account(confirmed=true){const email=crypto.randomUUID()+'@example.com',password=crypto.randomUUID()+'aA1!';const u=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(u);const c=client();ok(await c.auth.signInWithPassword({email,password}));if(!confirmed)execFileSync('docker',['exec','supabase_db_vehicleops','psql','-U','postgres','-d','postgres','-c',`update auth.users set email_confirmed_at=null where id='${u.id}'`],{stdio:'pipe'});return{u,c,email};}
try{
 const owner=await account(),driver=await account(),other=await account(),unconfirmed=await account(false);
 org=ok(await owner.c.rpc('create_organization',{p_name:'Team integration',p_member_name:'Owner'}));
 const member=ok(await owner.c.from('memberships').select('*').eq('organization_id',org).single());
 assert.ok((await owner.c.rpc('manage_team_member',{p_id:member.id,p_expected_role:'admin',p_role:'viewer',p_remove:false})).error,'Last admin protected');
 const invite=ok(await owner.c.rpc('create_team_invitation',{p_org:org,p_email:driver.email,p_name:'Driver',p_role:'driver'}));
 assert.equal(ok(await client().rpc('preview_team_invitation',{p_token:invite.token})).email,driver.email);
 assert.ok((await owner.c.from('team_invitations').select('token_hash')).error,'Token hashes are private');
 assert.ok((await other.c.rpc('accept_team_invitation',{p_token:invite.token})).error,'Wrong email rejected');
 assert.equal(ok(await driver.c.rpc('accept_team_invitation',{p_token:invite.token})),org);
 assert.ok((await driver.c.rpc('accept_team_invitation',{p_token:invite.token})).error,'Token is single use');
 assert.equal(ok(await driver.c.from('team_invitations').select('id')).length,0,'Drivers cannot list invitations');
 assert.ok((await driver.c.rpc('create_team_invitation',{p_org:org,p_email:other.email,p_name:'Other',p_role:'admin'})).error,'Driver cannot grant access');
 const vehicle=crypto.randomUUID(),driverId=crypto.randomUUID(),order=crypto.randomUUID();
 ok(await owner.c.from('vehicles').insert({id:vehicle,organization_id:org,plate:'TEAM',vin:'WVWZZZ3CZPE777777',make:'VW',model:'Golf',color:'Blue',mileage:100,location:'Berlin'}));
 ok(await owner.c.from('drivers').insert({id:driverId,organization_id:org,name:'Driver',email:driver.email,phone:'123',license_valid_until:'2030-12-31',user_id:driver.u.id}));
 ok(await owner.c.from('orders').insert({id:order,organization_id:org,reference:'TEAM',vehicle_id:vehicle,driver_id:driverId,pickup:'Berlin',destination:'Hamburg',scheduled_at:'2027-01-01T10:00:00Z'}));
 const dm=ok(await owner.c.from('memberships').select('*').eq('user_id',driver.u.id).single());
 assert.ok((await owner.c.rpc('manage_team_member',{p_id:dm.id,p_expected_role:'driver',p_role:'viewer',p_remove:true})).error,'Active driver protected');
 ok(await owner.c.rpc('cancel_order',{p_id:order,p_expected_revision:1,p_reason:'Test completed'}));
 ok(await owner.c.rpc('manage_team_member',{p_id:dm.id,p_expected_role:'driver',p_role:'viewer',p_remove:false}));
 assert.equal(ok(await owner.c.from('drivers').select('user_id').eq('id',driverId).single()).user_id,null,'Role removal unlinks driver');
 assert.ok((await owner.c.rpc('manage_team_member',{p_id:dm.id,p_expected_role:'driver',p_role:'admin',p_remove:false})).error,'Stale role change rejected');
 ok(await owner.c.rpc('manage_team_member',{p_id:dm.id,p_expected_role:'viewer',p_role:'viewer',p_remove:true}));
 assert.equal(ok(await driver.c.from('vehicles').select('id')).length,0,'Existing JWT loses tenant access immediately');
 const revoked=ok(await owner.c.rpc('create_team_invitation',{p_org:org,p_email:other.email,p_name:'Other',p_role:'viewer'}));
 ok(await owner.c.rpc('revoke_team_invitation',{p_id:revoked.id}));
 assert.ok((await other.c.rpc('accept_team_invitation',{p_token:revoked.token})).error,'Revoked link rejected');
 const expired=ok(await owner.c.rpc('create_team_invitation',{p_org:org,p_email:other.email,p_name:'Other',p_role:'viewer'}));
 ok(await admin.from('team_invitations').update({expires_at:'2020-01-01'}).eq('id',expired.id));
 assert.ok((await client().rpc('preview_team_invitation',{p_token:expired.token})).error,'Expired link rejected');
 const uc=ok(await owner.c.rpc('create_team_invitation',{p_org:org,p_email:unconfirmed.email,p_name:'Unconfirmed',p_role:'viewer'}));
 assert.ok((await unconfirmed.c.rpc('accept_team_invitation',{p_token:uc.token})).error,'Unconfirmed email rejected');
 console.log('PASS: invite preview, verified identity, single use, revoked/expired links, admin authorization, last-admin guard, active-driver guard, stale role conflicts and access revocation');
}finally{
 if(org){for(const table of ['team_invitations','vehicle_events','orders','drivers','vehicles','memberships'])ok(await admin.from(table).delete().eq('organization_id',org));ok(await admin.from('organizations').delete().eq('id',org));}
 for(const u of users)ok(await admin.auth.admin.deleteUser(u.id));
}

