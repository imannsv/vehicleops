import { openDB } from 'idb';
import { supabase } from './supabase';
import { seed } from './seed';
import { Data, Draft, Handover, Kind, Order, Vehicle, Driver, validateHandover } from './domain';
const db = () => openDB('vehicleops-demo-v1', 1, { upgrade(database) { database.createObjectStore('data'); database.createObjectStore('drafts'); } });
export async function loadDemo(): Promise<Data> { const database = await db(); const existing = await database.get('data', 'state'); if (existing) return existing; const data = seed(); await database.put('data', data, 'state'); return data; }
export async function saveDemo(data: Data) { await (await db()).put('data', data, 'state'); }
export async function saveDraft(key: string, draft: Draft) { await (await db()).put('drafts', draft, key); }
export async function readDraft(key: string): Promise<Draft | undefined> { return (await db()).get('drafts', key); }
export async function clearDraft(key: string) { await (await db()).delete('drafts', key); }
function checked<T>(result: { data: T; error: { message: string } | null }): T { if (result.error) throw new Error(result.error.message); return result.data; }
export async function loadCloud(orgId?: string): Promise<Data | null> {
 if (!supabase) throw new Error('Supabase ist nicht konfiguriert.');
 const user = checked(await supabase.auth.getUser()).user;
 if (!user) throw new Error('Bitte anmelden.');
 const own = checked(await supabase.from('memberships').select('*').eq('user_id', user.id));
 const id = orgId ?? own?.[0]?.organization_id;
 if (!id) return null;
 const organization = checked(await supabase.from('organizations').select('*').eq('id', id).single());
 const tables = ['memberships', 'vehicles', 'drivers', 'orders', 'handovers', 'damages', 'vehicle_events'];
 const rows = await Promise.all(tables.map(async table => checked(await supabase!.from(table).select('*').eq('organization_id', id)) ?? []));
 const rawHandovers = rows[4] as Handover[];
 const photos = checked(await supabase.from('handover_photos').select('*').eq('organization_id', id)) ?? [];
 const signed = async (path: string) => checked(await supabase!.storage.from('evidence').createSignedUrl(path, 3600)).signedUrl;
 const handovers = await Promise.all(rawHandovers.map(async h => ({ ...h, signature: await signed(h.signature), photos: await Promise.all(photos.filter(p => p.handover_id === h.id).map(async p => ({ slot: p.slot, path: p.path, url: await signed(p.path) }))) })));
 return { organization, members: rows[0], vehicles: rows[1], drivers: rows[2], orders: rows[3], handovers, damages: rows[5], events: rows[6] } as Data;
}
export async function insertCloud(table: 'vehicles' | 'drivers' | 'orders', row: Vehicle | Driver | Order) { if (!supabase) throw new Error('Supabase fehlt.'); checked(await supabase.from(table).insert(row)); }
export async function finalize(data: Data, order: Order, kind: Kind, draft: Draft, cloud: boolean): Promise<Data | null> {
 const vehicle = data.vehicles.find(v => v.id === order.vehicle_id)!;
 const errors = validateHandover(draft, order, vehicle, data.handovers, kind);
 if (errors.length) throw new Error(errors.join('\n'));
 const id = crypto.randomUUID(), now = new Date().toISOString();
 if (cloud) {
  if (!supabase) throw new Error('Supabase fehlt.');
  const uploaded: string[] = [];
  const upload = async (url: string, name: string) => { const blob = await (await fetch(url)).blob(); const path = `${data.organization.id}/${order.id}/${id}/${name}`; checked(await supabase!.storage.from('evidence').upload(path, blob, { contentType: blob.type, upsert: false })); uploaded.push(path); return path; };
  try {
   const photos = [];
   for (let i = 0; i < draft.photos.length; i++) photos.push({ slot: draft.photos[i].slot, path: await upload(draft.photos[i].url, `${i}.jpg`) });
   const signature = await upload(draft.signature, 'signature.png');
   checked(await supabase.rpc('finalize_handover', { p_id: id, p_order_id: order.id, p_kind: kind, p_mileage: draft.mileage, p_fuel: draft.fuel, p_signer: draft.signer.trim(), p_signature: signature, p_notes: draft.notes, p_photos: photos, p_damages: draft.damages }));
  } catch (error) { if (uploaded.length) await supabase.storage.from('evidence').remove(uploaded); throw error; }
  return loadCloud(data.organization.id);
 }
 const handover: Handover = { id, organization_id: data.organization.id, order_id: order.id, kind, mileage: draft.mileage, fuel: draft.fuel, signer: draft.signer.trim(), signature: draft.signature, notes: draft.notes, photos: draft.photos, created_at: now };
 const next: Data = { ...data, orders: data.orders.map(o => o.id === order.id ? { ...o, status: kind === 'pickup' ? 'in_transit' : 'completed' } : o), vehicles: data.vehicles.map(v => v.id === vehicle.id ? { ...v, mileage: draft.mileage, location: kind === 'pickup' ? 'In Transport' : order.destination } : v), handovers: [...data.handovers, handover], damages: [...data.damages, ...draft.damages.map(d => ({ ...d, id: crypto.randomUUID(), organization_id: data.organization.id, vehicle_id: vehicle.id, handover_id: id, created_at: now }))], events: [...data.events, { id: crypto.randomUUID(), organization_id: data.organization.id, vehicle_id: vehicle.id, order_id: order.id, description: `${kind === 'pickup' ? 'Übernahme' : 'Übergabe'} ${order.reference} · ${draft.mileage.toLocaleString('de-DE')} km · ${draft.signer}`, created_at: now }] };
 await saveDemo(next); return next;
}
