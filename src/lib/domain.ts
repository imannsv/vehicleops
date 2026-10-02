export type Role = 'admin' | 'dispatcher' | 'driver' | 'viewer';
export type Status = 'assigned' | 'in_transit' | 'completed' | 'cancelled';
export type Kind = 'pickup' | 'delivery';
export const shots = ['Vorne', 'Hinten', 'Links', 'Rechts', 'Vorne links', 'Vorne rechts', 'Hinten links', 'Hinten rechts', 'Innenraum', 'Tacho'] as const;
export const statusLabels: Record<Status, string> = { assigned: 'Zugewiesen', in_transit: 'In Transport', completed: 'Abgeschlossen', cancelled: 'Storniert' };
export type BusinessType = 'dealer'|'transfer'|'combined';
export type StockStatus = 'stock'|'reserved'|'sold'|'rented';
export interface CompanyProfile { legal_form?:string;management?:string;street?:string;postal_code?:string;city?:string;country?:string;email?:string;phone?:string;website?:string;tax_number?:string;vat_id?:string;register_court?:string;register_number?:string }
export interface Organization { id:string; name:string; revision?:number; business_type?:BusinessType; profile?:CompanyProfile; logo_path?:string|null; logo_url?:string }
export interface StockEvent {id:string;organization_id:string;vehicle_id:string;previous_kind:string;next_kind:string;previous_status:StockStatus|null;next_status:StockStatus|null;reason:string;actor_name:string;created_at:string;handover_id?:string|null}
export interface Member { id: string; organization_id: string; user_id: string; name: string; role: Role }
export interface Invitation { id: string; organization_id: string; email: string; name: string; role: Role; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }
export interface InvitePreview { organization_name: string; email: string; name: string; role: Role; expires_at: string }
export interface Vehicle { id: string; organization_id: string; plate: string|null; stock_number?:string;cover_kind?:'protocol'|'asset'|null;cover_id?:string|null; generation?:string; inventory_kind?:'unassigned'|'owned'|'customer'; inventory_status?:StockStatus|null; vin: string; make: string; model: string; color: string; mileage: number; location: string; revision?: number; variant?: string; equipment?: string[]; equipment_notes?: string; build_year?: number | null; first_registration?: string | null; keys_recorded?: boolean; keys_revision?: number; site_id?: string | null; parking_space_id?: string | null }
export interface FleetSite { id: string; organization_id: string; name: string; address: string; revision: number }
export interface ParkingSpace { id: string; organization_id: string; site_id: string; label: string; revision: number }
export interface VehicleMovement { id: string; vehicle_id: string; organization_id: string; from_location: string; to_location: string; from_site_id?: string | null; to_site_id?: string | null; from_space_id?: string | null; to_space_id?: string | null; reason: string; source: 'initial'|'manual'|'legacy'|'pickup'|'delivery'; actor_name: string; created_at: string; handover_id?: string | null }
export interface VehicleHolder { vehicle_id: string; organization_id: string; name: string; address: string; contact: string; revision: number }
export interface VehicleAsset { id: string; vehicle_id: string; organization_id: string; kind: 'photo' | 'registration' | 'document'; name: string; path: string; mime: string; size: number; created_at: string; url?: string }
export type KeyState = 'available' | 'issued' | 'lost' | 'retired';
export interface VehicleKey { id: string; vehicle_id: string; organization_id: string; label: string; identifier: string; location: string; state: KeyState; custodian: string }
export interface KeyMovement { id: string; vehicle_id: string; organization_id: string; key_id: string; key_label: string; action: string; person: string; location: string; created_at: string; handover_id?: string | null; actor_name: string }
export interface KeyChecklist { confirmed: boolean; revision: number; selected: string[]; notes: string }
export interface KeySnapshot { recorded: boolean; selected: { id: string; label: string; identifier: string }[]; expected_count: number; notes: string }
export interface Driver { id: string; organization_id: string; name: string; email: string; phone: string; license_valid_until: string; user_id: string | null; revision?: number }
export interface Order { id: string; organization_id: string; reference: string; vehicle_id: string; driver_id: string; pickup: string; destination: string; scheduled_at: string; contact: string; transport_plate?:string|null; status: Status; revision?: number; cancellation_reason?: string | null; cancelled_at?: string | null }
export interface Photo {id?:string;bucket?:string; slot: string; url: string; path?: string }
export interface Damage { id: string; organization_id: string; vehicle_id: string; handover_id: string; area: string; description: string; created_at: string }
export interface ProtocolSnapshot { organization_name:string; organization?:Organization; known_damages?:{id:string;area:string;description:string}[]; vehicle:Vehicle; driver:Driver|null; order:Order|null }
export type Purpose='transport'|'purchase'|'sale'|'rental'|'return'|'other';
export interface Party {name:string;role:string;signature:string;signature_url?:string}
export interface Parties {giver:Party;receiver:Party;exception_confirmed:boolean;exception_reason:string}
export interface Position {confirmed?:boolean;location:string;site_id?:string|null;space_id?:string|null;space_label?:string|null;stock_status?:StockStatus|null}
export interface ProtocolDraft extends Draft {id:string;purpose:Purpose;parties:Parties;position:Position;transport_plate:string;stock_status:StockStatus|'';stock_confirmed:boolean;company_revision:number;vehicle_revision:number;order_revision:number|null}
export interface Handover { id: string; organization_id: string; order_id: string|null; vehicle_id?:string; version?:number;request_hash?:string; purpose?:Purpose; parties?:Parties; position?:Position; transport_plate?:string|null; signature_bucket?:string; kind: Kind; mileage: number; fuel: number; signer: string; signature: string; notes: string; created_at: string; photos: Photo[]; snapshot?: ProtocolSnapshot; key_snapshot?: KeySnapshot | null }
export interface Event { id: string; organization_id: string; vehicle_id: string; order_id: string | null; description: string; created_at: string }
export interface Data { organization: Organization; members: Member[]; vehicles: Vehicle[]; drivers: Driver[]; orders: Order[]; handovers: Handover[]; damages: Damage[]; events: Event[]; invitations: Invitation[]; holders?: VehicleHolder[]; assets?: VehicleAsset[]; keys?: VehicleKey[]; key_movements?: KeyMovement[]; sites?: FleetSite[]; spaces?: ParkingSpace[]; stock_events?:StockEvent[]; movements?: VehicleMovement[] }
export interface Draft { mileage: number; fuel: number; signer: string; signature: string; notes: string; photos: Photo[]; damages: { area: string; description: string }[]; keys?: KeyChecklist }
export function isActiveOrder(order: Order) { return order.status === 'assigned' || order.status === 'in_transit'; }
export function protocolSnapshot(data: Data, order: Order): ProtocolSnapshot {
  const vehicle = data.vehicles.find(v => v.id === order.vehicle_id)!;
  return { organization_name: data.organization.name, order: { ...order }, vehicle: { ...vehicle, equipment: [...(vehicle.equipment ?? [])] }, driver: { ...data.drivers.find(d => d.id === order.driver_id)! } };
}
export function requiredPhotoCount(photos: Photo[]) {
  return shots.filter(shot => photos.some(photo => photo.slot === shot && photo.url.startsWith('data:image/jpeg;base64,'))).length;
}
export function validateHandover(draft: Draft, order: Order, vehicle: Vehicle, handovers: Handover[], kind: Kind): string[] {
  const errors: string[] = [];
  if (kind === 'pickup' && order.status !== 'assigned') errors.push('Die Übernahme wurde bereits abgeschlossen.');
  if (kind === 'delivery' && order.status !== 'in_transit') errors.push('Zuerst die Übernahme abschließen.');
  const pickup = handovers.find(h => h.order_id === order.id && h.kind === 'pickup');
  const minimum = Math.max(vehicle.mileage, pickup?.mileage ?? 0);
  if (!Number.isSafeInteger(draft.mileage) || draft.mileage < minimum) errors.push(`Kilometerstand muss mindestens ${minimum} km betragen.`);
  if (!Number.isFinite(draft.fuel) || draft.fuel < 0 || draft.fuel > 100) errors.push('Tank-/Ladestand muss zwischen 0 und 100 liegen.');
  for (const shot of shots) if (!draft.photos.some(p => p.slot === shot && p.url.startsWith('data:image/jpeg;base64,'))) errors.push(`Pflichtfoto fehlt: ${shot}.`);
  if (draft.photos.some(p => !shots.some(shot => shot === p.slot) || !p.url.startsWith('data:image/jpeg;base64,'))) errors.push('Die Fotodokumentation enthält ein ungültiges Bild.');
  if (shots.some(shot => shot !== 'Innenraum' && draft.photos.filter(p => p.slot === shot).length > 1)) errors.push('Außenperspektiven und Tacho dürfen jeweils nur ein Foto enthalten.');
  if (!draft.signer.trim()) errors.push('Name der unterzeichnenden Person fehlt.');
  if (!draft.signature.startsWith('data:image/png;base64,') || draft.signature.length < 200) errors.push('Bitte eine Unterschrift zeichnen.');
  if (draft.damages.some(d => !d.area.trim() || !d.description.trim())) errors.push('Schäden brauchen Bereich und Beschreibung.');
  return errors;
}
export function canManage(role: Role) { return role === 'admin' || role === 'dispatcher'; }
export function canInspect(role: Role, order: Order, drivers: Driver[], userId: string) { return canManage(role) || (role === 'driver' && drivers.some(d => d.id === order.driver_id && d.user_id === userId)); }
