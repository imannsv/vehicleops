import { Data, Vehicle, VehicleMovement, isActiveOrder } from './domain';
import { activeSites, activeSpaces } from './fleet-archive';

export function positionLabel(data:Data,vehicle:Vehicle) {
 const site=data.sites?.find(s=>s.id===vehicle.site_id),space=data.spaces?.find(s=>s.id===vehicle.parking_space_id);
 return (site?.name??vehicle.location)+(space?' · '+space.label:'');
}
export function inventoryState(data:Data,vehicle:Vehicle):'available'|'reserved'|'in_transit' {
 const order=data.orders.find(o=>o.vehicle_id===vehicle.id&&isActiveOrder(o));
 return order?.status==='in_transit'?'in_transit':order?'reserved':'available';
}
export const inventoryLabels={available:'Ohne Transportauftrag',reserved:'Auftrag zugewiesen',in_transit:'In Transport'};
export function matchesVehicleSearch(data:Data,vehicle:Vehicle,search:string) {
 const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const fields=[vehicle.plate,vehicle.stock_number,vehicle.vin,vehicle.make,vehicle.model,vehicle.generation,vehicle.variant,vehicle.color,positionLabel(data,vehicle)].map(value=>normalize(value??''));
 return search.trim().split(/\s+/).map(normalize).filter(Boolean).every(term=>fields.some(value=>value.includes(term)));
}
export interface InventoryFilters {search:string;site:string;space:string;availability:string;transport:string}
export function filterInventory(data:Data,filter:InventoryFilters) {
 return data.vehicles.filter(v=>{
  const state=inventoryState(data,v);
  return matchesVehicleSearch(data,v,filter.search)&&(!filter.site||(filter.site==='unassigned'?!v.site_id:v.site_id===filter.site))&&(!filter.space||(filter.space==='none'?!v.parking_space_id:v.parking_space_id===filter.space))&&(!filter.availability||(filter.availability==='available'?state==='available':state!=='available'))&&(!filter.transport||(filter.transport==='in_transit'?state==='in_transit':state!=='in_transit'));
 });
}
export function recordMovement(data:Data,previous:Vehicle|undefined,next:Vehicle,source:VehicleMovement['source'],reason:string,handover?:string):Data {
 if(previous&&source!=='pickup'&&source!=='delivery'&&previous.location===next.location&&previous.site_id===next.site_id&&previous.parking_space_id===next.parking_space_id)return data;
 const movement:VehicleMovement={id:crypto.randomUUID(),organization_id:data.organization.id,vehicle_id:next.id,from_location:previous?positionLabel(data,previous):'',to_location:positionLabel(data,next),from_site_id:previous?.site_id??null,to_site_id:next.site_id??null,from_space_id:previous?.parking_space_id??null,to_space_id:next.parking_space_id??null,source,reason,actor_name:data.members[0]?.name??'Administrator',created_at:new Date().toISOString(),handover_id:handover??null};
 return {...data,movements:[...(data.movements??[]),movement]};
}
export function moveInventory(data:Data,vehicle:Vehicle,site:string|null,space:string|null,location:string,reason:string):Data {
 const v=data.vehicles.find(v=>v.id===vehicle.id&&v.organization_id===data.organization.id);
 if(!v||(v.revision??1)!==(vehicle.revision??1))throw Error('Fahrzeug wurde inzwischen geändert. Bitte neu laden.');
 if(inventoryState(data,v)==='in_transit')throw Error('Fahrzeug ist in Transport. Standort wird durch das Protokoll fortgeschrieben.');
 if(reason.trim().length>1000)throw Error('Der Anlass darf höchstens 1.000 Zeichen enthalten.');
 const target=site?data.sites?.find(s=>s.id===site&&s.organization_id===data.organization.id):null;
 if(site&&!target)throw Error('Standort gehört nicht zum Arbeitsbereich.');
 if(site&&!activeSites(data).some(s=>s.id===site))throw Error('Standort ist archiviert. Bitte einen aktiven Standort wählen.');
 if(space&&(!site||!data.spaces?.some(s=>s.id===space&&s.site_id===site&&s.organization_id===data.organization.id)))throw Error('Stellplatz gehört nicht zum Standort.');
 if(space&&!activeSpaces(data,site??undefined).some(s=>s.id===space))throw Error('Stellplatz ist archiviert. Bitte einen aktiven Stellplatz wählen.');
 if(space&&data.vehicles.some(other=>other.id!==v.id&&other.parking_space_id===space))throw Error('Dieser Stellplatz ist bereits belegt.');
 const text=target?.name??location.trim();if(!text||text.length>240)throw Error('Bitte eine Standortangabe eingeben.');
 if((v.site_id??null)===site&&(v.parking_space_id??null)===space&&v.location===text)throw Error('Fahrzeug steht bereits an diesem Standort.');
 const next={...v,site_id:site,parking_space_id:space,location:text,revision:(v.revision??1)+1};
 return recordMovement({...data,vehicles:data.vehicles.map(row=>row.id===v.id?next:row)},v,next,'manual',reason.trim()||'Fahrzeug umgesetzt');
}
