import {createClient} from '@supabase/supabase-js';
import {fetchSellerAds} from '@/lib/mobile-client';
import {parseMobileAds} from '@/lib/mobile-import-domain';

export async function POST(request:Request){
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,authorization=request.headers.get('Authorization')??'';
  if(!url||!key||!authorization.startsWith('Bearer '))return reply({error:'Bitte anmelden.'},401);
  const client=createClient(url,key,{auth:{persistSession:false},global:{headers:{Authorization:authorization}}}),auth=await client.auth.getUser(authorization.slice(7));
  if(!auth.data.user)return reply({error:'Bitte anmelden.'},401);
  const raw=await request.text();if(raw.length>5000)return reply({error:'Anfrage ist zu groß.'},400);
  let body;try{body=JSON.parse(raw);}catch{return reply({error:'Anfrage ist ungültig.'},400);}
  if(!body||typeof body!=='object')return reply({error:'Anfrage ist ungültig.'},400);
  const member=await client.from('memberships').select('role').eq('user_id',auth.data.user.id).eq('organization_id',body.organization_id??'').maybeSingle();
  if(!member.data||!['admin','dispatcher'].includes(member.data.role))return reply({error:'Keine Berechtigung.'},403);
  if(typeof body.username!=='string'||typeof body.password!=='string'||typeof body.account_id!=='string')return reply({error:'Händler-ID und Seller-API-Zugangsdaten prüfen.'},400);
  const source=await fetchSellerAds(body.account_id,body.environment,body.username,body.password);
  return reply({rows:parseMobileAds(source,body.account_id)});
 }catch(error){return reply({error:error instanceof Error&&!['AbortError','TimeoutError','TypeError'].includes(error.name)?error.message:'Bestandsabruf fehlgeschlagen oder Zeitüberschreitung. Bitte erneut versuchen.'},502);}
}
