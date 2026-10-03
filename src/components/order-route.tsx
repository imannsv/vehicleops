'use client';
import {useState} from 'react';
import {activeSpaces} from '@/lib/fleet-archive';
import {Data,Order} from '@/lib/domain';
import {contactPhone,navigationUrl,nextDriverOrders} from '@/lib/order-route';
import {vehicleIdentity,vehicleTitle} from '@/lib/company';

export function OrderRouteFields({data,order,vehicleId,inTransit}:{data:Data;order:Order|null;vehicleId:string;inTransit:boolean}){
 const [pickup,setPickup]=useState(order?.pickup_site_id??''),[destination,setDestination]=useState(order?.destination_site_id??''),[space,setSpace]=useState(order?.destination_space_id??'');
 return <>{(['pickup','destination'] as const).map(leg=>{
  const id=leg==='pickup'?pickup:destination,site=data.sites?.find(s=>s.id===id),locked=leg==='pickup'&&inTransit;
  const unchanged=id===(leg==='pickup'?order?.pickup_site_id:order?.destination_site_id);
  const text=site?(unchanged?order?.[leg]??site.name:site.name):undefined;
  const address=site?(unchanged?(leg==='pickup'?order?.pickup_address:order?.destination_address)??site.address:site.address):'';
  return <div className="route-fields" key={leg}><label>{leg==='pickup'?'Abholstandort':'Zielstandort'}<select aria-label={leg==='pickup'?'Abholstandort':'Zielstandort'} value={id} disabled={locked} onChange={e=>{if(leg==='pickup')setPickup(e.target.value);else{setDestination(e.target.value);setSpace('');}}}><option value="">Freie Adresse / Kundenort</option>{data.sites?.filter(s=>!s.archived_at||s.id===id).map(s=><option value={s.id} key={s.id} disabled={!!s.archived_at&&!locked}>{s.name}{s.archived_at?' · archiviert':''}</option>)}</select></label>
   <input type="hidden" name={leg+'_site_id'} value={id}/><input type="hidden" name={leg+'_address'} value={address}/>
   <label>{leg==='pickup'?'Abholort':'Zielort'}<input key={id} name={leg} maxLength={240} required readOnly={!!site||locked} defaultValue={text??order?.[leg]??''} placeholder="Straße, Hausnummer, PLZ und Ort"/></label>{site&&<p className="muted small">{address||'Für diesen Standort ist noch keine Adresse hinterlegt.'}</p>}
  </div>;
 })}<label className="span-2">Zielstellplatz (optional)<select aria-label="Zielstellplatz (optional)" name="destination_space_id" value={space} disabled={!destination} onChange={e=>setSpace(e.target.value)}><option value="">Ohne festen Stellplatz</option>{activeSpaces(data,destination).map(s=>{const occupant=data.vehicles.find(v=>v.id!==vehicleId&&v.parking_space_id===s.id);return <option value={s.id} key={s.id} disabled={!!occupant}>{s.label}{occupant?' · belegt':''}</option>;})}</select></label><p className="muted small span-2">Ein Zielstellplatz wird vorgemerkt, nicht reserviert. Die tatsächliche Position wird bei der Übergabe bestätigt.</p></>;
}

export function OrderRouteSummary({data,order}:{data:Data;order:Order}){
 const phone=contactPhone(order.contact),occupied=order.destination_space_id&&data.vehicles.some(v=>v.id!==order.vehicle_id&&v.parking_space_id===order.destination_space_id);
 return <div className="order-route-summary"><dl><dt>Abholung</dt><dd>{order.pickup}{order.pickup_address&&<small>{order.pickup_address}</small>}</dd><dt>Ziel</dt><dd>{order.destination}{order.destination_address&&<small>{order.destination_address}</small>}{order.destination_space_id&&<small>Geplant: {data.spaces?.find(s=>s.id===order.destination_space_id)?.label??'Stellplatz'}{occupied?' · inzwischen belegt':''}</small>}</dd></dl>{occupied&&order.status!=='completed'&&<p className="notice">Der geplante Stellplatz ist belegt. Bei der Übergabe einen freien Stellplatz oder eine andere Position bestätigen.</p>}{(order.status==='assigned'||order.status==='in_transit')&&<div className="detail-actions"><a className="secondary" href={navigationUrl(order)} target="_blank" rel="noopener noreferrer">{order.status==='assigned'?'Zur Abholung navigieren':'Zum Ziel navigieren'}</a>{phone&&<a className="secondary" href={'tel:'+phone}>Ansprechpartner anrufen</a>}</div>}</div>;
}

export function DriverWork({data,userId,onOpen,onStart}:{data:Data;userId:string;onOpen:(id:string)=>void;onStart:(order:Order)=>void}){
 const orders=nextDriverOrders(data,userId),next=orders[0],v=data.vehicles.find(v=>v.id===next?.vehicle_id);
 return <section className="panel driver-work"><h2>{next?.status==='in_transit'?'Aktuelle Fahrt':'Nächste Abholung'}</h2>{next&&v?<><p className="eyebrow">{next.reference} · {new Date(next.scheduled_at).toLocaleString('de-DE')}</p><h3>{vehicleTitle(v)}</h3><p className="muted">{vehicleIdentity(v)}</p><p>{next.contact||'Kein Ansprechpartner hinterlegt'}</p><OrderRouteSummary data={data} order={next}/><div className="detail-actions mt"><button className="primary" onClick={()=>onStart(next)}>{next.status==='assigned'?'Übernahme starten':'Übergabe starten'}</button><button className="secondary" onClick={()=>onOpen(next.id)}>Auftrag ansehen</button></div>{orders.length>1&&<p className="muted small mt">{orders.length-1} weitere offene Aufträge</p>}</>:<p className="muted">Dir sind aktuell keine offenen Aufträge zugewiesen.</p>}</section>;
}
