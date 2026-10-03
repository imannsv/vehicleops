import { DamageDraft, DamageMarker, Handover, Data, RecordedDamage } from './domain';
import { supabase } from './supabase';

export const damageZones = [
  { area:'Vorne links', x:29, y:15 }, { area:'Vorne', x:50, y:10 }, { area:'Vorne rechts', x:71, y:15 },
  { area:'Links', x:23, y:50 }, { area:'Dach', x:50, y:50 }, { area:'Rechts', x:77, y:50 },
  { area:'Hinten links', x:29, y:85 }, { area:'Hinten', x:50, y:90 }, { area:'Hinten rechts', x:71, y:85 },
];
export function validDamageMarker(marker:unknown):marker is DamageMarker {
  if(!marker||typeof marker!=='object')return false;
  const {x,y}=marker as DamageMarker;
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=100&&y>=0&&y<=100;
}
export function damageArea(marker:DamageMarker) {
  const side=marker.x<38?'links':marker.x>62?'rechts':'';
  return marker.y<32?['Vorne',side].filter(Boolean).join(' '):marker.y>68?['Hinten',side].filter(Boolean).join(' '):side?side==='links'?'Links':'Rechts':'Dach';
}
export function damageErrors(damages:DamageDraft[]) {
  const errors:string[]=[];
  if(damages.length>50)errors.push('Höchstens 50 neue Schäden je Protokoll.');
  const ids=damages.flatMap(d=>d.id?[d.id]:[]);
  if(new Set(ids).size!==ids.length)errors.push('Schadenkennungen müssen eindeutig sein.');
  const photoIds=damages.flatMap(d=>d.photos?.map(p=>p.id)??[]);
  if(new Set(photoIds).size!==photoIds.length)errors.push('Schadenfotos benötigen getrennte Kennungen.');
  for(const d of damages) {
    if(!d.area.trim()||!d.description.trim()||d.area.length>120||d.description.length>2000)errors.push('Schaden benötigt Bereich (bis 120 Zeichen) und Beschreibung (bis 2.000 Zeichen).');
    if(d.marker!=null&&!validDamageMarker(d.marker))errors.push('Schadenmarkierung ist ungültig.');
    if((d.photos?.length??0)>10)errors.push('Höchstens zehn Detailfotos je Schaden.');
    if(d.photos?.some(p=>!p.id||!p.url.startsWith('data:image/jpeg;base64,'))||new Set(d.photos?.map(p=>p.id)).size!==(d.photos?.length??0))errors.push('Schadenfotos sind ungültig.');
  }
  return [...new Set(errors)];
}
export function protocolDamages(data:Data,h:Handover):RecordedDamage[] {
  return h.snapshot?.new_damages??data.damages.filter(d=>d.handover_id===h.id);
}
export function freezeDamages(damages:RecordedDamage[]):RecordedDamage[] {
  return structuredClone(damages.map(({id,area,description,marker,photos})=>({id,area,description,marker:marker??null,photos:photos??[]})));
}
export async function resolveDamagePhotos(damages:RecordedDamage[],cloud:boolean):Promise<RecordedDamage[]> {
  if(!cloud)return damages;
  return Promise.all(damages.map(async d=>({...d,photos:await Promise.all((d.photos??[]).map(async p=>{
    const r=await supabase!.storage.from(p.bucket??'protocol-media').createSignedUrl(p.path??'',300);
    if(r.error)throw Error(r.error.message);return {...p,url:r.data.signedUrl};
  }))})));
}
export async function compressDamagePhoto(file:File):Promise<string> {
  if(!file.size||file.size>10*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Bitte JPEG, PNG oder WebP bis 10 MB auswählen.');
  const bitmap=await createImageBitmap(file),ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.85);
}
