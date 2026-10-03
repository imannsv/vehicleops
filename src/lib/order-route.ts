import {Data, Order, isActiveOrder} from './domain';
import {activeSites,activeSpaces} from './fleet-archive';

/** Planning references never reserve a bay or replace a confirmed actual position. */
export function normalizeOrderRoute(data:Data, order:Order, previous?:Order):Order {
 const next={...order,pickup_site_id:order.pickup_site_id??null,destination_site_id:order.destination_site_id??null,destination_space_id:order.destination_space_id??null};
 for(const leg of ['pickup','destination'] as const){
  const siteKey=leg==='pickup'?'pickup_site_id':'destination_site_id';
  const addressKey=leg==='pickup'?'pickup_address':'destination_address';
  // Older clients only send a changed text address. Drop its stale site reference.
  if(previous && next[siteKey]===(previous[siteKey]??null) && next[leg]!==previous[leg]){
   next[siteKey]=null;next[addressKey]='';if(leg==='destination')next.destination_space_id=null;
  }
  const site=next[siteKey]?data.sites?.find(s=>s.id===next[siteKey]&&s.organization_id===next.organization_id):null;
  if(next[siteKey]&&!site)throw Error('Standort gehört nicht zum Unternehmen.');
  if(site&&!activeSites(data).some(s=>s.id===site.id)&&!(leg==='pickup'&&previous?.status==='in_transit'&&next.pickup_site_id===previous.pickup_site_id))throw Error('Standort ist archiviert. Bitte einen aktiven Standort wählen.');
  const changed=!previous||next[siteKey]!== (previous[siteKey]??null);
  next[leg]=(site&&changed?site.name:next[leg]).trim();
  next[addressKey]=site?(changed?site.address:next[addressKey]??''):'';
  if(!next[leg]||next[leg].length>240)throw Error('Route fehlt oder ist zu lang.');
 }
 if(next.destination_space_id){
  if(!data.spaces?.some(s=>s.id===next.destination_space_id&&s.site_id===next.destination_site_id&&s.organization_id===next.organization_id))throw Error('Zielstellplatz gehört nicht zum Standort.');
  if(!activeSpaces(data,next.destination_site_id??undefined).some(s=>s.id===next.destination_space_id))throw Error('Zielstellplatz ist archiviert. Bitte einen aktiven Stellplatz wählen.');
  // Existing plans can stay visible if a bay becomes occupied; delivery rechecks it.
  if((!previous||next.destination_space_id!==previous.destination_space_id||next.vehicle_id!==previous.vehicle_id)&&data.vehicles.some(v=>v.id!==next.vehicle_id&&v.parking_space_id===next.destination_space_id))throw Error('Zielstellplatz ist bereits belegt.');
 }
 if(previous?.status==='in_transit'&&(next.pickup!==previous.pickup||next.pickup_site_id!==(previous.pickup_site_id??null)||next.pickup_address!==(previous.pickup_address??'')))throw Error('Nach der Übernahme bleibt der Abholort unverändert.');
 return next;
}

export function nextDriverOrders(data:Data,userId:string):Order[]{
 const drivers=new Set(data.drivers.filter(d=>d.user_id===userId).map(d=>d.id));
 return data.orders.filter(o=>drivers.has(o.driver_id)&&isActiveOrder(o)).sort((a,b)=>Number(b.status==='in_transit')-Number(a.status==='in_transit')||a.scheduled_at.localeCompare(b.scheduled_at)||a.id.localeCompare(b.id));
}
export function navigationUrl(order:Order):string {
 const leg=order.status==='in_transit'?'destination':'pickup';
 const address=leg==='pickup'?order.pickup_address:order.destination_address;
 return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(address?.trim()||order[leg]);
}
export function contactPhone(contact:string):string|null {
 const match=contact.match(/(?:\+|00)?\d[\d\s()./-]{4,}\d/);
 const phone=match?.[0].replace(/[^\d+]/g,'');return phone&&phone.replace(/\D/g,'').length>=5?phone:null;
}
