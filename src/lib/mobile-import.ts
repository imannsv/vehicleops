import {Data,Vehicle,canManage} from './domain';
import {ImportPayload,mobileId} from './mobile-import-domain';
import {loadCloud,mutateDemo} from './repository';
import {recordMovement} from './inventory-domain';
import {supabase} from './supabase';
import type {Json} from './database.types';
export class ImportRejected extends Error {}

export function applyDemoMobileImport(data:Data,id:string,payload:ImportPayload,hash:string,userId:string):Data {
 if(!canManage(data.members.find(member=>member.user_id===userId)?.role??'viewer'))throw Error('Keine Berechtigung.');
 const old=data.import_runs?.find(run=>run.id===id);if(old){if(old.request_hash!==hash)throw Error('Import-ID wurde bereits mit anderen Angaben verwendet.');return data;}
 if(!mobileId(payload.account_id)||!['production','sandbox'].includes(payload.environment)||!payload.entries.length||payload.entries.length>100)throw Error('Importangaben ungültig.');
 let next={...data,vehicles:[...data.vehicles],external_listings:[...(data.external_listings??[])]},created=0,linked=0;
 let counter=Math.max(data.organization.vehicle_counter??0,...data.vehicles.map(v=>Number(v.stock_number?.replace('FZ-',''))||0));
 for(const entry of payload.entries){
  if(!mobileId(entry.remote_id)||next.external_listings.some(link=>link.account_id===payload.account_id&&link.environment===payload.environment&&link.remote_id===entry.remote_id))throw Error('Inserat wurde inzwischen zugeordnet. Bitte Vorschau neu laden.');
  const values=entry.values,vin=String(values.vin??'');if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw Error('Gültige VIN erforderlich.');
  if(entry.action==='link'){
   const vehicle=next.vehicles.find(v=>v.id===entry.vehicle_id&&v.organization_id===data.organization.id);
   if(!vehicle||vehicle.vin!==vin||(vehicle.revision??1)!==entry.revision)throw Error('Fahrzeug wurde inzwischen geändert. Bitte Vorschau neu prüfen.');linked++;
  }else if(entry.action==='create'){
   if(entry.revision!==0||next.vehicles.some(v=>v.vin===vin||v.id===entry.vehicle_id))throw Error('VIN existiert inzwischen. Bitte vorhandenes Fahrzeug ausdrücklich zuordnen.');
   if(['make','model','color','location'].some(key=>typeof values[key]!=='string'||!String(values[key]).trim()||String(values[key]).length>(key==='location'?240:120))||typeof values.mileage!=='number'||!Number.isSafeInteger(values.mileage)||values.mileage<0||values.mileage>2147483647)throw Error('Pflichtangaben für neue Fahrzeuge fehlen.');
   if(!['unassigned','owned','customer'].includes(String(values.inventory_kind)))throw Error('Bestandszuordnung ungültig.');
   const vehicle:Vehicle={id:entry.vehicle_id,organization_id:data.organization.id,plate:null,vin,make:String(values.make),model:String(values.model),color:String(values.color),mileage:values.mileage,location:String(values.location),variant:String(values.variant??''),build_year:values.build_year as number|null,first_registration:null,inventory_kind:values.inventory_kind as Vehicle['inventory_kind'],inventory_status:values.inventory_kind==='owned'?'stock':null,revision:1,stock_number:'FZ-'+String(++counter).padStart(6,'0')};
   next={...recordMovement({...next,vehicles:[...next.vehicles,vehicle]},undefined,vehicle,'initial','mobile.de-Bestandsimport'),external_listings:next.external_listings};created++;
  }else throw Error('Importaktion ungültig.');
  next.external_listings.push({id:crypto.randomUUID(),organization_id:data.organization.id,vehicle_id:entry.vehicle_id,platform:'mobile_de',environment:payload.environment,account_id:payload.account_id,remote_id:entry.remote_id,metadata:{...entry.metadata},created_at:new Date().toISOString()});
 }
 return {...next,organization:{...next.organization,vehicle_counter:counter},import_runs:[...(data.import_runs??[]),{id,organization_id:data.organization.id,account_id:payload.account_id,environment:payload.environment,created_count:created,linked_count:linked,created_at:new Date().toISOString(),request_hash:hash}]};
}
export async function importMobileStock(data:Data,id:string,payload:ImportPayload,cloud:boolean,userId:string):Promise<Data> {
 if(cloud){const result=await supabase!.rpc('import_mobile_stock',{p_id:id,p_org:data.organization.id,p_values:payload as unknown as Json});if(result.error){if(/^[A-Z0-9]{5}$/.test(result.error.code))throw new ImportRejected(result.error.message);throw Error(result.error.message);}return(await loadCloud(data.organization.id))!;}
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)))),byte=>byte.toString(16).padStart(2,'0')).join('');
 try{return await mutateDemo(latest=>applyDemoMobileImport(latest,id,payload,hash,userId));}catch(error){throw new ImportRejected(error instanceof Error?error.message:'Import abgewiesen.');}
}
