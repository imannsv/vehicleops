import { Data, FleetSite, ParkingSpace, Vehicle } from './domain';
import { supabase } from './supabase';
import { loadCloud, mutateDemo } from './repository';
import { moveInventory } from './inventory-domain';
import { normalizeParkingLabels } from './parking';

export async function addSpaces(data:Data,site:string,requested:string[],cloud:boolean):Promise<{data:Data;added:number}> {
 const labels=normalizeParkingLabels(requested);
 if(cloud){const r=await supabase!.rpc('add_parking_spaces',{p_org:data.organization.id,p_site:site,p_labels:labels});if(r.error)throw Error(r.error.message);return {data:(await loadCloud(data.organization.id))!,added:r.data};}
 let added=0;
 const next=await mutateDemo(latest=>{
  if(!latest.sites?.some(s=>s.id===site&&s.organization_id===data.organization.id))throw Error('Standort fehlt.');
  const existing=new Set(latest.spaces?.filter(s=>s.site_id===site).map(s=>s.label));
  const spaces=labels.filter(label=>!existing.has(label)).map(label=>({id:crypto.randomUUID(),organization_id:latest.organization.id,site_id:site,label,revision:1}));
  added=spaces.length;return {...latest,spaces:[...(latest.spaces??[]),...spaces]};
 });return {data:next,added};
}

export async function createSiteWithSpaces(data:Data,id:string,name:string,address:string,requested:string[],cloud:boolean):Promise<{data:Data;added:number}> {
 name=name.trim();address=address.trim();const labels=normalizeParkingLabels(requested);
 if(!name||name.length>120||address.length>1000)throw Error('Bitte Standortname und gültige Anschrift angeben.');
 if(cloud){const r=await supabase!.rpc('create_fleet_site_with_spaces',{p_id:id,p_org:data.organization.id,p_name:name,p_address:address,p_labels:labels});if(r.error)throw Error(r.error.message);return {data:(await loadCloud(data.organization.id))!,added:r.data};}
 let added=0;
 const next=await mutateDemo(latest=>{
  const old=latest.sites?.find(s=>s.id===id);
  if(old&&(old.name!==name||old.address!==address))throw Error('Standort wurde inzwischen geändert. Bitte neu laden.');
  if(latest.sites?.some(s=>s.id!==id&&s.name===name))throw Error('Standortname existiert bereits.');
  const existing=new Set(latest.spaces?.filter(s=>s.site_id===id).map(s=>s.label));
  const spaces=labels.filter(label=>!existing.has(label)).map(label=>({id:crypto.randomUUID(),organization_id:latest.organization.id,site_id:id,label,revision:1}));
  added=spaces.length;return {...latest,sites:old?latest.sites:[...(latest.sites??[]),{id,organization_id:latest.organization.id,name,address,revision:1}],spaces:[...(latest.spaces??[]),...spaces]};
 });return {data:next,added};
}

export async function saveSite(data:Data,id:string,revision:number,name:string,address:string,cloud:boolean):Promise<Data> {
 name=name.trim();address=address.trim();if(!name||name.length>120||address.length>1000)throw Error('Bitte Standortname und gültige Anschrift angeben.');
 if(cloud){const r=await supabase!.rpc('save_fleet_site',{p_id:id,p_org:data.organization.id,p_revision:revision,p_name:name,p_address:address});if(r.error)throw Error(r.error.message);return(await loadCloud(data.organization.id))!;}
 return mutateDemo(latest=>{const old=latest.sites?.find(s=>s.id===id);if((old?.revision??0)!==revision)throw Error('Standort wurde inzwischen geändert. Bitte neu laden.');if(latest.sites?.some(s=>s.id!==id&&s.name===name))throw Error('Standortname existiert bereits.');const site:FleetSite={id,organization_id:latest.organization.id,name,address,revision:revision+1};return {...latest,sites:[...(latest.sites??[]).filter(s=>s.id!==id),site],vehicles:latest.vehicles.map(v=>old&&old.name!==name&&v.site_id===id?{...v,location:name,revision:(v.revision??1)+1}:v)};});
}
export async function saveSpace(data:Data,id:string,site:string,revision:number,label:string,cloud:boolean):Promise<Data> {
 label=label.trim();if(!label||label.length>80)throw Error('Bitte eine Stellplatzbezeichnung angeben.');
 if(cloud){const r=await supabase!.rpc('save_parking_space',{p_id:id,p_org:data.organization.id,p_site:site,p_revision:revision,p_label:label});if(r.error)throw Error(r.error.message);return(await loadCloud(data.organization.id))!;}
 return mutateDemo(latest=>{if(!latest.sites?.some(s=>s.id===site))throw Error('Standort fehlt.');const old=latest.spaces?.find(s=>s.id===id);if((old?.revision??0)!==revision||(old&&old.site_id!==site))throw Error('Stellplatz wurde inzwischen geändert. Bitte neu laden.');if(latest.spaces?.some(s=>s.id!==id&&s.site_id===site&&s.label===label))throw Error('Stellplatzbezeichnung existiert bereits.');const space:ParkingSpace={id,organization_id:latest.organization.id,site_id:site,label,revision:revision+1};return {...latest,spaces:[...(latest.spaces??[]).filter(s=>s.id!==id),space]};});
}
export async function moveVehicle(data:Data,vehicle:Vehicle,site:string|null,space:string|null,location:string,reason:string,cloud:boolean):Promise<Data> {
 // UUID arguments are nullable in SQL; send explicit null rather than omitting RPC arguments.
 if(cloud){const r=await supabase!.rpc('move_vehicle',{p_vehicle:vehicle.id,p_revision:vehicle.revision??1,p_site:site as unknown as string,p_space:space as unknown as string,p_location:location,p_reason:reason});if(r.error)throw Error(r.error.message);return(await loadCloud(data.organization.id))!;}
 return mutateDemo(latest=>moveInventory(latest,vehicle,site,space,location,reason));
}
