import {createClient} from '@supabase/supabase-js';
import {findMake} from '@/lib/vehicle-catalog';
export async function POST(request:Request){
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 try{
  const body=await request.json(),make=findMake(body.make??''),model=make?.models.find(m=>m.name===body.model||m.key===body.model);
  if(!make||!model||typeof body.first_registration!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.first_registration)||Number.isNaN(Date.parse(body.first_registration))||new Date(body.first_registration).toISOString().slice(0,10)!==body.first_registration||body.first_registration>new Date().toISOString().slice(0,10))return reply({error:'Hersteller, Modell und gültige Erstzulassung benötigt.'},400);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(url&&key){const authorization=request.headers.get('Authorization')??'';if(!authorization.startsWith('Bearer '))return reply({error:'Bitte anmelden.'},401);const client=createClient(url,key,{auth:{persistSession:false},global:{headers:{Authorization:authorization}}});const user=await client.auth.getUser(authorization.slice(7));if(!user.data.user)return reply({error:'Bitte anmelden.'},401);const member=await client.from('memberships').select('role').eq('user_id',user.data.user.id).eq('organization_id',body.organization_id??'').maybeSingle();if(!member.data||!['admin','dispatcher'].includes(member.data.role))return reply({error:'Keine Berechtigung.'},403);}
  const endpoint=`https://services.mobile.de/refdata/sites/GERMANY/classes/Car/makes/${encodeURIComponent(make.key)}/models/${encodeURIComponent(model.key)}/modelranges?firstregistration=${body.first_registration.slice(0,7).replace('-','')}`;
  const response=await fetch(endpoint,{headers:{Accept:'application/json','Accept-Language':'de'},signal:AbortSignal.timeout(12000),cache:'no-store'});if(!response.ok)throw Error('provider');const result=await response.json();const codes=[...new Set<string>((result.reference?.item??[]).map((entry:Record<string,string>)=>String(entry['@key']??'').trim()).filter((v:string)=>v.length>0&&v.length<=120))];return reply({codes,source:endpoint,retrieved_at:new Date().toISOString()});
 }catch{return reply({error:'Baureihenabfrage derzeit nicht verfügbar. Manuelle Eingabe bleibt möglich.'},503);}
}
