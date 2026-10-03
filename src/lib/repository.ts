import { openDB } from 'idb';
import { supabase } from './supabase';
import { seed } from './seed';
import { Data, Draft, Handover, Kind, Order, Vehicle, Driver, ProtocolSnapshot, protocolSnapshot, validateHandover } from './domain';
import { EntityTable, applyCancellation, applyEntityUpdate, conflictMessage, scheduledDay, upgradeDemo } from './management';
import { validateVehicleExtras } from './vehicle-catalog';
import { keyValidation, keySnapshot } from './vehicle-records';
import {normalizeOrderRoute} from './order-route';
import { recordMovement } from './inventory-domain';
const db = () => openDB('vehicleops-demo-v1', 1, { upgrade(database) { database.createObjectStore('data'); database.createObjectStore('drafts'); } });
export async function loadDemo(): Promise<Data> { const database = await db(); const transaction = database.transaction('data', 'readwrite'); const existing = await transaction.store.get('state'); const data = upgradeDemo(existing ?? seed()); await transaction.store.put(data, 'state'); await transaction.done; return data; }
export async function mutateDemo(transform: (data: Data) => Data): Promise<Data> {
 const transaction = (await db()).transaction('data', 'readwrite');
 try { const next = transform(upgradeDemo(await transaction.store.get('state'))); await transaction.store.put(next, 'state'); await transaction.done; return next; }
 catch (error) { try { transaction.abort(); } catch {} await transaction.done.catch(() => {}); throw error; }
}
export async function insertDemo(table: EntityTable, row: Vehicle | Driver | Order): Promise<Data> {
 const transaction = (await db()).transaction('data', 'readwrite');
 try {
  const latest = upgradeDemo(await transaction.store.get('state'));
  if (row.organization_id !== latest.organization.id || latest[table].some(entity => entity.id === row.id)) throw new Error('Datensatz existiert bereits oder gehört zu einem anderen Arbeitsbereich.');
  if (table === 'vehicles') {
   const v = row as Vehicle;
   validateVehicleExtras(v);
   if (latest.vehicles.some(other => other.vin === v.vin || (!!v.plate && other.plate === v.plate))) throw new Error('Kennzeichen oder VIN existiert bereits.');
   latest.vehicles.push({ ...v, revision: 1 });
  } else if (table === 'drivers') latest.drivers.push({ ...row as Driver, revision: 1 });
  else {
   const order = normalizeOrderRoute(latest,row as Order);
   if (latest.orders.some(other => other.reference === order.reference || other.vehicle_id === order.vehicle_id && ['assigned', 'in_transit'].includes(other.status))) throw new Error('Dieses Fahrzeug hat bereits einen offenen Auftrag.');
   const driver = latest.drivers.find(d => d.id === order.driver_id);
   if (!driver || driver.license_valid_until < scheduledDay(order.scheduled_at)) throw new Error('Die Führerscheingültigkeit endet vor dem Auftrag.');
   if (!latest.vehicles.some(v => v.id === order.vehicle_id)) throw new Error('Fahrzeug fehlt.');
   latest.orders.push({ ...order, revision: 1 });
  }
  await transaction.store.put(latest, 'state'); await transaction.done; return latest;
 } catch (error) { transaction.abort(); await transaction.done.catch(() => {}); throw error; }
}
export async function saveDraft(key: string, draft: Draft) { await (await db()).put('drafts', draft, key); }
export async function readDraft(key: string): Promise<Draft | undefined> { return (await db()).get('drafts', key); }
export async function clearDraft(key: string) { await (await db()).delete('drafts', key); }
function checked<T>(result: { data: T; error: { message: string } | null }): T { if (result.error) throw new Error(result.error.message); return result.data; }
export async function loadCloud(orgId?: string): Promise<Data | null> {
 if (!supabase) throw new Error('Supabase ist nicht konfiguriert.');
 const auth = await supabase.auth.getUser();
 if (auth.error) throw new Error(auth.error.message);
 const user = auth.data.user;
 if (!user) throw new Error('Bitte anmelden.');
 const own = checked(await supabase.from('memberships').select('*').eq('user_id', user.id));
 const id = orgId ?? own?.[0]?.organization_id;
 if (!id) return null;
 const organization = checked(await supabase.from('organizations').select('*').eq('id', id).single());
 const rows = await Promise.all([
  supabase.from('memberships').select('*').eq('organization_id', id),
  supabase.from('vehicles').select('*').eq('organization_id', id),
  supabase.from('drivers').select('*').eq('organization_id', id),
  supabase.from('orders').select('*').eq('organization_id', id),
  supabase.from('handovers').select('*').eq('organization_id', id),
  supabase.from('damages').select('*').eq('organization_id', id),
  supabase.from('vehicle_events').select('*').eq('organization_id', id),
 ]);
 for (const result of rows) if (result.error) throw new Error(result.error.message);
 const rawHandovers = checked(rows[4]) ?? [];
 const photos = checked(await supabase.from('handover_photos').select('*').eq('organization_id', id).order('sequence')) ?? [];
 const handovers=rawHandovers.map(h=>({...h,snapshot:h.snapshot as unknown as ProtocolSnapshot,photos:photos.filter(p=>p.handover_id===h.id).map(p=>({id:p.id,slot:p.slot,path:p.path,bucket:p.bucket,url:''}))}));
 const invitations = checked(await supabase.from('team_invitations').select('id,organization_id,email,name,role,created_at,expires_at,accepted_at,revoked_at').eq('organization_id', id)) ?? [];
 const extras=await Promise.all(['vehicle_holders','vehicle_assets','vehicle_keys','key_movements','fleet_sites','parking_spaces','vehicle_movements','stock_events','external_listings','platform_import_runs'].map(table=>supabase!.from(table as 'vehicle_keys').select('*').eq('organization_id',id)));
 for(const result of extras)if(result.error)throw new Error(result.error.message);
 return { organization, members: rows[0].data, vehicles: rows[1].data, drivers: rows[2].data, orders: rows[3].data, handovers, damages: rows[5].data, events: rows[6].data, invitations,holders:extras[0].data,assets:extras[1].data,keys:extras[2].data,key_movements:extras[3].data,sites:extras[4].data,spaces:extras[5].data,movements:extras[6].data,stock_events:extras[7].data,external_listings:extras[8].data,import_runs:extras[9].data } as unknown as Data;
}
export async function insertCloud(table: 'vehicles' | 'drivers' | 'orders', row: Vehicle | Driver | Order) { if (!supabase) throw new Error('Supabase fehlt.'); if (table === 'vehicles') checked(await supabase.from(table).insert({...row as Vehicle,stock_number:(row as Vehicle).stock_number??''})); else if (table === 'drivers') checked(await supabase.from(table).insert(row as Driver)); else checked(await supabase.from(table).insert(row as Order)); }
export async function updateEntity(data: Data, table: EntityTable, row: Vehicle | Driver | Order, expectedRevision: number, cloud: boolean): Promise<Data | null> {
 if (cloud) {
  if (!supabase) throw new Error('Supabase fehlt.');
  const rpc = table === 'vehicles' ? 'update_vehicle' : table === 'drivers' ? 'update_driver' : 'update_order';
  checked(await supabase.rpc(rpc, { p_id: row.id, p_expected_revision: expectedRevision, p_values: { ...row } }));
  return loadCloud(data.organization.id);
 }
 const transaction = (await db()).transaction('data', 'readwrite');
 try { const latest = upgradeDemo(await transaction.store.get('state')); const next = applyEntityUpdate(latest, table, row, expectedRevision); await transaction.store.put(next, 'state'); await transaction.done; return next; }
 catch (error) { transaction.abort(); await transaction.done.catch(() => {}); throw error; }
}
export async function cancelOrder(data: Data, order: Order, reason: string, expectedRevision: number, cloud: boolean): Promise<Data | null> {
 if (cloud) {
  if (!supabase) throw new Error('Supabase fehlt.');
  checked(await supabase.rpc('cancel_order', { p_id: order.id, p_expected_revision: expectedRevision, p_reason: reason.trim() }));
  return loadCloud(data.organization.id);
 }
 const transaction = (await db()).transaction('data', 'readwrite');
 try { const latest = upgradeDemo(await transaction.store.get('state')); const next = applyCancellation(latest, order.id, reason, expectedRevision); await transaction.store.put(next, 'state'); await transaction.done; return next; }
 catch (error) { transaction.abort(); await transaction.done.catch(() => {}); throw error; }
}
export async function finalize(data: Data, order: Order, kind: Kind, draft: Draft, cloud: boolean): Promise<Data | null> {
 const vehicle = data.vehicles.find(v => v.id === order.vehicle_id)!;
 const errors = [...validateHandover(draft, order, vehicle, data.handovers, kind),...keyValidation(data,vehicle,draft)];
 if (errors.length) throw new Error(errors.join('\n'));
 const id = crypto.randomUUID(), now = new Date().toISOString();
 if (cloud) {
  if (!supabase) throw new Error('Supabase fehlt.');
  const uploaded: string[] = [];
  const upload = async (url: string, name: string) => { const blob = await (await fetch(url)).blob(); const path = `${data.organization.id}/${order.id}/${id}/${name}`; checked(await supabase!.storage.from('evidence').upload(path, blob, { contentType: blob.type, upsert: false })); uploaded.push(path); return path; };
  try {
   const photos = [];
   const counts = new Map<string, number>();
   for (let i = 0; i < draft.photos.length; i++) {
    const photo = draft.photos[i], sequence = counts.get(photo.slot) ?? 0;
    counts.set(photo.slot, sequence + 1);
    photos.push({ slot: photo.slot, sequence, path: await upload(photo.url, `${i}.jpg`) });
   }
   const signature = await upload(draft.signature, 'signature.png');
   checked(await supabase.rpc('finalize_handover_v2', { p_id: id, p_order_id: order.id, p_kind: kind, p_mileage: draft.mileage, p_fuel: draft.fuel, p_signer: draft.signer.trim(), p_signature: signature, p_notes: draft.notes, p_photos: photos, p_damages: draft.damages, p_expected_revision: order.revision ?? 1,p_keys:{...(draft.keys??{confirmed:false,selected:[],notes:''}),revision:draft.keys?.revision??vehicle.keys_revision??1} }));
  } catch (error) { if (uploaded.length) await supabase.storage.from('evidence').remove(uploaded); throw error; }
  return loadCloud(data.organization.id);
 }
 const transaction = (await db()).transaction('data', 'readwrite');
 try {
  const latest = upgradeDemo(await transaction.store.get('state'));
  const currentOrder = latest.orders.find(o => o.id === order.id);
  if (!currentOrder || currentOrder.revision !== (order.revision ?? 1)) throw new Error(conflictMessage);
  const currentVehicle = latest.vehicles.find(v => v.id === currentOrder.vehicle_id)!;
  const currentErrors = [...validateHandover(draft, currentOrder, currentVehicle, latest.handovers, kind),...keyValidation(latest,currentVehicle,draft)];
  if (currentErrors.length) throw new Error(currentErrors.join('\n'));
  const handover: Handover = { id, organization_id: latest.organization.id, order_id: order.id, kind, mileage: draft.mileage, fuel: draft.fuel, signer: draft.signer.trim(), signature: draft.signature, notes: draft.notes, photos: draft.photos, created_at: now, snapshot: protocolSnapshot(latest, currentOrder),key_snapshot:keySnapshot(latest,currentVehicle,draft) };
  const next: Data = { ...latest, orders: latest.orders.map(o => o.id === order.id ? { ...o, revision: (o.revision ?? 1) + 1, status: kind === 'pickup' ? 'in_transit' : 'completed' } : o), vehicles: latest.vehicles.map(v => v.id === currentVehicle.id ? { ...v, revision: (v.revision ?? 1) + 1, mileage: draft.mileage, site_id:null,parking_space_id:null,location: kind === 'pickup' ? 'In Transport' : currentOrder.destination } : v), handovers: [...latest.handovers, handover], damages: [...latest.damages, ...draft.damages.map(d => ({ ...d, id: crypto.randomUUID(), organization_id: latest.organization.id, vehicle_id: currentVehicle.id, handover_id: id, created_at: now }))], events: [...latest.events, { id: crypto.randomUUID(), organization_id: latest.organization.id, vehicle_id: currentVehicle.id, order_id: order.id, description: `${kind === 'pickup' ? 'Übernahme' : 'Übergabe'} ${order.reference} · ${draft.mileage.toLocaleString('de-DE')} km · ${draft.signer}`, created_at: now }] };
  next.keys=(latest.keys??[]).map(k=>draft.keys?.selected.includes(k.id)?{...k,state:kind==='pickup'?'issued':'available',custodian:kind==='pickup'?latest.drivers.find(d=>d.id===currentOrder.driver_id)!.name:'',location:kind==='pickup'?'Beim Fahrer':currentOrder.destination}:k);
  next.key_movements=[...(latest.key_movements??[]),...(handover.key_snapshot?.selected??[]).map(k=>({id:crypto.randomUUID(),key_id:k.id,key_label:k.label,vehicle_id:currentVehicle.id,organization_id:latest.organization.id,action:kind,person:draft.signer,location:kind==='pickup'?'Beim Fahrer':currentOrder.destination,created_at:now,handover_id:id,actor_name:latest.members[0]?.name??'Administrator'}))];
  next.vehicles=next.vehicles.map(v=>v.id===currentVehicle.id?{...v,keys_revision:(currentVehicle.keys_revision??1)+1}:v);
  const moved=recordMovement(next,currentVehicle,next.vehicles.find(v=>v.id===currentVehicle.id)!,kind,`${kind==='pickup'?'Fahrzeugübernahme':'Fahrzeugübergabe'} · ${currentOrder.reference}`,id);
  await transaction.store.put(moved, 'state'); await transaction.done; return moved;
 } catch (error) { transaction.abort(); await transaction.done.catch(() => {}); throw error; }
}
