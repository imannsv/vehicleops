import { Data, Draft, KeySnapshot, Vehicle, VehicleAsset, VehicleHolder, VehicleKey } from './domain';
import { supabase } from './supabase';
import { loadCloud, mutateDemo } from './repository';
import { applyEntityUpdate, conflictMessage } from './management';
import type { Json } from './database.types';
import { recordMovement } from './inventory-domain';

export const keyStateLabels = { available: 'Vorhanden', issued: 'Ausgegeben', lost: 'Verloren', retired: 'Ausgemustert' };
export const keyActionLabels: Record<string,string> = { create: 'Erfasst', edit: 'Bearbeitet', issue: 'Ausgabe', return: 'Rückgabe', lost: 'Verlust', retire: 'Ausmusterung', pickup: 'Übernahme', delivery: 'Übergabe' };
export function validateVehicleDates(vehicle: Vehicle) {
 if (vehicle.build_year != null && (!Number.isInteger(vehicle.build_year) || vehicle.build_year < 1886 || vehicle.build_year > new Date().getFullYear()+1)) throw new Error('Baujahr ist ungültig.');
 if (vehicle.first_registration) {const date=new Date(vehicle.first_registration);if(!/^\d{4}-\d{2}-\d{2}$/.test(vehicle.first_registration)||Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==vehicle.first_registration||vehicle.first_registration>new Date().toISOString().slice(0,10))throw new Error('Erstzulassung ist ungültig.');}
}
export async function saveVehicleRecord(data:Data,vehicle:Vehicle,holder:VehicleHolder,revision:number,cloud:boolean,stockReason=''):Promise<Data> {
 validateVehicleDates(vehicle);
 if (holder.name.length>120 || holder.address.length>1000 || holder.contact.length>240) throw new Error('Halterangaben sind zu lang.');
 if(cloud) {
  const result=await supabase!.rpc('save_vehicle_record',{p_id:vehicle.id,p_org:data.organization.id,p_revision:revision,p_values:{...vehicle,stock_reason:stockReason} as unknown as Json,p_holder:holder as unknown as Json,p_holder_revision:holder.revision});
  if(result.error)throw new Error(result.error.message);
  return (await loadCloud(data.organization.id))!;
 }
 return mutateDemo(latest=>{
  const existing=latest.holders?.find(h=>h.vehicle_id===vehicle.id);
  if((existing?.revision??0)!==holder.revision)throw new Error('Halterdaten wurden inzwischen geändert. Bitte neu laden.');
  let next=latest;
  if(revision){next=applyEntityUpdate(latest,'vehicles',vehicle,revision);const old=latest.vehicles.find(v=>v.id===vehicle.id)!;if((old.inventory_kind??'unassigned')!==(vehicle.inventory_kind??'unassigned')||(old.inventory_status??null)!==(vehicle.inventory_status??null)){if(!stockReason.trim())throw Error('Bestandsänderung benötigt einen Anlass');next={...next,stock_events:[...(next.stock_events??[]),{id:crypto.randomUUID(),organization_id:latest.organization.id,vehicle_id:vehicle.id,previous_kind:old.inventory_kind??'unassigned',next_kind:vehicle.inventory_kind??'unassigned',previous_status:old.inventory_status??null,next_status:vehicle.inventory_status??null,reason:stockReason,actor_name:latest.members[0]?.name??'Administrator',created_at:new Date().toISOString()}]};}}
  else {if(latest.vehicles.some(v=>v.id===vehicle.id||v.vin===vehicle.vin||(!!vehicle.plate&&v.plate===vehicle.plate)))throw new Error('Kennzeichen oder VIN existiert bereits.');next={...latest,vehicles:[...latest.vehicles,{...vehicle,stock_number:'FZ-'+String(Math.max(0,...latest.vehicles.map(v=>Number(v.stock_number?.slice(3))||0))+1).padStart(6,'0'),revision:1,keys_revision:1,keys_recorded:false}]};}
  if(!revision)next=recordMovement(next,undefined,vehicle,'initial','Fahrzeug neu erfasst');
  return {...next,holders:[...(latest.holders??[]).filter(h=>h.vehicle_id!==vehicle.id),{...holder,revision:holder.revision+1}]};
 });
}
export function keyValidation(data:Data,vehicle:Vehicle,draft:Draft):string[] {
 const input=draft.keys, keys=(data.keys??[]).filter(k=>k.vehicle_id===vehicle.id&&['available','issued'].includes(k.state));
 if(!input) return vehicle.keys_recorded?['Bitte Schlüsselbestand bestätigen.']:[];
 if(input.revision!==(vehicle.keys_revision??1))return ['Schlüsselbestand wurde inzwischen geändert. Bitte neu laden.'];
 if(new Set(input.selected).size!==input.selected.length || input.selected.some(id=>!keys.some(k=>k.id===id)))return ['Schlüsselauswahl ungültig.'];
 if(vehicle.keys_recorded&&!input.confirmed)return ['Bitte Schlüsselbestand bestätigen.'];
 if(vehicle.keys_recorded&&input.selected.length!==keys.length&&!input.notes.trim())return ['Abweichende Schlüsselanzahl benötigt eine Begründung.'];
 if(input.notes.length>1000)return ['Schlüsselhinweis zu lang.'];
 return [];
}
export function keySnapshot(data:Data,vehicle:Vehicle,draft:Draft):KeySnapshot {
 const keys=(data.keys??[]).filter(k=>k.vehicle_id===vehicle.id&&['available','issued'].includes(k.state));
 return {recorded:vehicle.keys_recorded??false,selected:keys.filter(k=>draft.keys?.selected.includes(k.id)).map(k=>({id:k.id,label:k.label,identifier:k.identifier})),expected_count:keys.length,notes:draft.keys?.notes??''};
}
export async function changeKey(data:Data,vehicle:Vehicle,id:string,action:string,values:Record<string,string>,cloud:boolean):Promise<Data> {
 if(cloud){const result=await supabase!.rpc('change_vehicle_key',{p_vehicle:vehicle.id,p_key:id,p_expected_revision:vehicle.keys_revision??1,p_action:action,p_values:values});if(result.error)throw new Error(result.error.message);return(await loadCloud(data.organization.id))!;}
 return mutateDemo(latest=>{
  const v=latest.vehicles.find(v=>v.id===vehicle.id);if(!v||(v.keys_revision??1)!==(vehicle.keys_revision??1))throw new Error(conflictMessage);
  const keys=latest.keys??[], old=keys.find(k=>k.id===id&&k.vehicle_id===v.id);let next:VehicleKey|undefined;
  if(action==='record_empty'){if(keys.some(k=>k.vehicle_id===v.id&&k.state!=='retired'))throw new Error('Es sind bereits Schlüssel erfasst.');}
  else if(action==='create') {if(keys.some(k=>k.id===id))throw new Error('Schlüssel existiert bereits.');next={id,vehicle_id:v.id,organization_id:v.organization_id,label:values.label?.trim(),identifier:values.identifier??'',location:values.location??'',state:'available',custodian:''};}
  else {if(!old)throw new Error('Schlüssel fehlt.');next={...old};if(action==='edit')Object.assign(next,{label:values.label?.trim(),identifier:values.identifier??'',location:values.location??''});
   else if(action==='issue'){if(old.state!=='available'||!values.person?.trim()||!values.location?.trim())throw new Error('Ausgabe benötigt verfügbaren Schlüssel, Person und Aufbewahrungsort.');Object.assign(next,{state:'issued',custodian:values.person,location:values.location});}
   else if(action==='return'){if(!['issued','lost'].includes(old.state)||!values.person?.trim()||!values.location?.trim())throw new Error('Rückgabe benötigt Person und Aufbewahrungsort.');Object.assign(next,{state:'available',custodian:'',location:values.location});}
   else if(['lost','retire'].includes(action)){if(old.state==='retired'||!values.person?.trim())throw new Error('Vorgang benötigt einen aktiven Schlüssel und eine Person.');next.state=action==='lost'?'lost':'retired';}
   else throw new Error('Ungültiger Schlüsselvorgang.');
  }
  if(next&&(!next.label||next.label.length>120||next.identifier.length>120||next.location.length>240||next.custodian.length>120))throw new Error('Schlüsselangaben sind ungültig.');
  const actor=latest.members[0]?.name??'Administrator';
  return {...latest,vehicles:latest.vehicles.map(row=>row.id===v.id?{...row,keys_recorded:true,keys_revision:(row.keys_revision??1)+1,revision:(row.revision??1)+1}:row),keys:next?[...keys.filter(k=>k.id!==id),next]:keys,key_movements:next?[...(latest.key_movements??[]),{id:crypto.randomUUID(),vehicle_id:v.id,organization_id:v.organization_id,key_id:id,key_label:next.label,action,person:values.person??actor,location:next.location,actor_name:actor,created_at:new Date().toISOString()}]:latest.key_movements};
 });
}
export function validateAsset(file:File,kind:VehicleAsset['kind']) {
 if(!file.size||file.size>10*1024*1024)throw new Error('Dateien dürfen höchstens 10 MB groß sein.');
 if(!['image/jpeg','image/png','image/webp',...(kind==='photo'?[]:['application/pdf'])].includes(file.type))throw new Error('Erlaubt sind JPEG, PNG, WebP und für Dokumente PDF.');
}
const fileData=(file:File)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Datei konnte nicht gelesen werden.'));reader.readAsDataURL(file);});
export async function uploadAsset(data:Data,vehicle:Vehicle,file:File,kind:VehicleAsset['kind'],cloud:boolean,progress:(value:number)=>void):Promise<Data> {
 validateAsset(file,kind);const id=crypto.randomUUID(),path=data.organization.id+'/'+vehicle.id+'/'+id+'/file',name=file.name.slice(0,200);
 if(cloud){
  const session=(await supabase!.auth.getSession()).data.session;if(!session)throw new Error('Bitte erneut anmelden.');
  await new Promise<void>((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',process.env.NEXT_PUBLIC_SUPABASE_URL+'/storage/v1/object/vehicle-files/'+path);xhr.setRequestHeader('Authorization','Bearer '+session.access_token);xhr.setRequestHeader('apikey',process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);xhr.setRequestHeader('Content-Type',file.type);xhr.timeout=120000;xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.round(e.loaded/e.total*95));};xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('Upload fehlgeschlagen. Bitte erneut versuchen.'));xhr.onerror=xhr.ontimeout=()=>reject(new Error('Upload unterbrochen. Bitte erneut versuchen.'));xhr.send(file);});
  const registered=await supabase!.rpc('register_vehicle_asset',{p_id:id,p_vehicle:vehicle.id,p_kind:kind,p_name:name,p_path:path});
  if(registered.error){await supabase!.storage.from('vehicle-files').remove([path]);throw new Error(registered.error.message);}progress(100);return(await loadCloud(data.organization.id))!;
 }
 const url=await fileData(file);progress(100);return mutateDemo(latest=>({...latest,assets:[...(latest.assets??[]),{id,vehicle_id:vehicle.id,organization_id:vehicle.organization_id,kind,name,path,mime:file.type,size:file.size,created_at:new Date().toISOString(),url}]}));
}
export async function assetUrl(asset:VehicleAsset,cloud:boolean) {if(!cloud)return asset.url!;const result=await supabase!.storage.from('vehicle-files').createSignedUrl(asset.path,300);if(result.error)throw new Error(result.error.message);return result.data.signedUrl;}
export async function removeAsset(data:Data,asset:VehicleAsset,cloud:boolean):Promise<Data>{if(cloud){const result=await supabase!.rpc('remove_vehicle_asset',{p_id:asset.id});if(result.error)throw new Error(result.error.message);const removed=await supabase!.storage.from('vehicle-files').remove([result.data]);if(removed.error)throw new Error('Eintrag entfernt; Dateibereinigung fehlgeschlagen. '+removed.error.message);return(await loadCloud(data.organization.id))!;}return mutateDemo(latest=>({...latest,assets:(latest.assets??[]).filter(a=>a.id!==asset.id),vehicles:latest.vehicles.map(v=>v.cover_kind==='asset'&&v.cover_id===asset.id?{...v,cover_kind:null,cover_id:null,revision:(v.revision??1)+1}:v)}));}
