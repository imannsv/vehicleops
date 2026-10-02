import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
export async function POST(request:Request){
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,authorization=request.headers.get('Authorization')??'';
  if(!url||!key||!authorization.startsWith('Bearer '))return reply({error:'Bitte anmelden.'},401);
  const client=createClient(url,key,{auth:{persistSession:false},global:{headers:{Authorization:authorization}}}),user=await client.auth.getUser(authorization.slice(7));
  if(!user.data.user)return reply({error:'Bitte anmelden.'},401);
  const form=await request.formData(),org=String(form.get('organization_id')??''),file=form.get('logo');
  const member=await client.from('memberships').select('role').eq('user_id',user.data.user.id).eq('organization_id',org).maybeSingle();
  if(member.data?.role!=='admin')return reply({error:'Nur Administratoren können das Logo ändern.'},403);
  if(!(file instanceof File)||!file.size||file.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))return reply({error:'Bitte JPEG, PNG oder WebP bis 10 MB auswählen.'},400);
  const input=sharp(await file.arrayBuffer(),{limitInputPixels:40000000}),metadata=await input.metadata();
  if(!metadata.format||!['png','jpeg','webp'].includes(metadata.format))return reply({error:'Bildformat ist nicht zulässig.'},400);
  const normalized=await input.rotate().resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).png().toBuffer(),path=org+'/'+crypto.randomUUID()+'.png';
  const uploaded=await client.storage.from('company-logos').upload(path,normalized,{contentType:'image/png',upsert:false});if(uploaded.error)throw Error(uploaded.error.message);
  return reply({path});
 }catch{return reply({error:'Logo konnte nicht verarbeitet werden. Bitte ein gültiges Bild auswählen und erneut versuchen.'},400);}
}
