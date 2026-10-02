// Writes only to the isolated local Supabase project and removes all fixtures.
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const config=JSON.parse(execFileSync('npx.cmd',['supabase','status','--output','json'],{encoding:'utf8',shell:true,stdio:['ignore','pipe','pipe']}));
if(!new URL(config.API_URL).hostname.match(/^(127\.0\.0\.1|localhost)$/))throw Error('Local project required');
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false}}),users=[],orgs=[];
const ok=result=>{if(result.error)throw Error(result.error.message);return result.data;};
async function account(){const email='mobile-import-'+crypto.randomUUID()+'@example.com',password=crypto.randomUUID()+'Aa1!',user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user);const c=createClient(config.API_URL,config.PUBLISHABLE_KEY,{auth:{persistSession:false}});ok(await c.auth.signInWithPassword({email,password}));return{c,user};}
try{
 const owner=await account(),dispatcher=await account(),viewer=await account(),driver=await account(),other=await account(),org=ok(await owner.c.rpc('create_organization',{p_name:'Import fixture',p_member_name:'Owner'}));orgs.push(org);orgs.push(ok(await other.c.rpc('create_organization',{p_name:'Other import fixture',p_member_name:'Other'})));
 for(const[a,role]of[[dispatcher,'dispatcher'],[viewer,'viewer'],[driver,'driver']])ok(await owner.c.rpc('add_member',{p_org:org,p_user:a.user.id,p_name:role,p_role:role}));
 const initial=crypto.randomUUID();ok(await owner.c.rpc('save_vehicle_record',{p_id:initial,p_org:org,p_revision:0,p_values:{vin:'WVWZZZ3CZPE123456',make:'Volkswagen',model:'Golf',color:'Silver',mileage:99999,location:'Existing position',inventory_kind:'owned',inventory_status:'sold'},p_holder:null,p_holder_revision:0}));
 const before=ok(await owner.c.from('vehicles').select('*').eq('id',initial).single()),createdId=crypto.randomUUID(),run=crypto.randomUUID();
 const entry=(vehicle,vin,remote='801')=>({action:'create',vehicle_id:vehicle,revision:0,remote_id:remote,values:{vin,make:'Audi',model:'A3',variant:'Sport',color:'Black',mileage:12000,build_year:2020,location:'Actual dealer',inventory_kind:'owned',inventory_status:'stock'},metadata:{first_registration_month:'202105',seller_stock_number:'EXT-90',image_count:3}});
 const payload={account_id:'55',environment:'production',entries:[entry(createdId,'WAUZZZ8V0PE444333'),{...entry(initial,before.vin,'802'),action:'link',revision:before.revision}]},args={p_id:run,p_org:org,p_values:payload};
 for(const a of[viewer,driver,other])assert.ok((await a.c.rpc('import_mobile_stock',args)).error);
 const anon=createClient(config.API_URL,config.PUBLISHABLE_KEY,{auth:{persistSession:false}});assert.ok((await anon.rpc('import_mobile_stock',args)).error);
 const race=await Promise.all([owner.c.rpc('import_mobile_stock',args),owner.c.rpc('import_mobile_stock',args)]);race.forEach(ok);assert.deepEqual(race[0].data,race[1].data);assert.equal(race[0].data.created,1);assert.equal(race[0].data.linked,1);
 assert.deepEqual(ok(await owner.c.from('vehicles').select('*').eq('id',initial).single()),before);
 const created=ok(await owner.c.from('vehicles').select('*').eq('id',createdId).single());assert.equal(created.first_registration,null);assert.equal(created.plate,null);assert.equal(created.build_year,2020);assert.notEqual(created.stock_number,before.stock_number);
 const listings=ok(await dispatcher.c.from('external_listings').select('*').eq('organization_id',org));assert.equal(listings.length,2);assert.equal(listings[0].metadata.first_registration_month,'202105');assert.equal(ok(await owner.c.from('platform_import_runs').select('*').eq('organization_id',org)).length,1);
 for(const a of[viewer,driver,other])assert.equal(ok(await a.c.from('external_listings').select('*').eq('organization_id',org)).length,0);
 assert.ok((await owner.c.from('external_listings').delete().eq('organization_id',org)).error||ok(await owner.c.from('external_listings').select('*').eq('organization_id',org)).length===2);
 assert.ok((await owner.c.rpc('import_mobile_stock',{...args,p_values:{...payload,account_id:'56'}})).error);
 const rejected=crypto.randomUUID(),first=crypto.randomUUID(),second=crypto.randomUUID(),invalid={account_id:'55',environment:'production',entries:[entry(first,'WAUZZZ8V0PE444334','803'),{...entry(second,'WAUZZZ8V0PE444335','804'),values:{...entry(second,'WAUZZZ8V0PE444335').values,mileage:-1}}]};
 assert.ok((await dispatcher.c.rpc('import_mobile_stock',{p_id:rejected,p_org:org,p_values:invalid})).error);assert.equal(ok(await owner.c.from('vehicles').select('id').in('id',[first,second])).length,0);assert.equal(ok(await owner.c.from('platform_import_runs').select('id').eq('id',rejected)).length,0);
 const stale={account_id:'55',environment:'production',entries:[{...entry(initial,before.vin,'805'),action:'link',revision:before.revision-1}]};assert.ok((await owner.c.rpc('import_mobile_stock',{p_id:crypto.randomUUID(),p_org:org,p_values:stale})).error);
 const foreign=crypto.randomUUID();ok(await other.c.rpc('save_vehicle_record',{p_id:foreign,p_org:orgs[1],p_revision:0,p_values:{vin:'WAUZZZ8V0PE444336',make:'Audi',model:'A3',color:'Black',mileage:1,location:'Other'},p_holder:null,p_holder_revision:0}));assert.ok((await owner.c.rpc('import_mobile_stock',{p_id:crypto.randomUUID(),p_org:org,p_values:{...stale,entries:[{...stale.entries[0],vehicle_id:foreign}]}})).error);
 const sandbox={account_id:'55',environment:'sandbox',entries:[{...entry(initial,before.vin,'802'),action:'link',revision:before.revision}]};ok(await dispatcher.c.rpc('import_mobile_stock',{p_id:crypto.randomUUID(),p_org:org,p_values:sandbox}));assert.equal(ok(await owner.c.from('external_listings').select('id').eq('remote_id','802')).length,2);
 const credentialMetadata={...sandbox,entries:[{...sandbox.entries[0],remote_id:'806',metadata:{...sandbox.entries[0].metadata,password:'must-not-store'}}]};assert.ok((await owner.c.rpc('import_mobile_stock',{p_id:crypto.randomUUID(),p_org:org,p_values:credentialMetadata})).error);
 console.log('PASS: local role/tenant isolation, create and explicit VIN link, unchanged existing vehicle, stable stock numbers, no invented registration day, two concurrent identical imports, changed request rejection, atomic rollback, stale revision, cross-tenant target, separate sandbox and sanitized metadata');
}finally{
 for(const org of orgs){for(const table of['external_listings','platform_import_runs','vehicle_movements','stock_events','vehicles','memberships'])ok(await admin.from(table).delete().eq('organization_id',org));ok(await admin.from('organizations').delete().eq('id',org));}for(const user of users)ok(await admin.auth.admin.deleteUser(user.id));
}
