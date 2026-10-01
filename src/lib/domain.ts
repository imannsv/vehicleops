export type Role = 'admin' | 'dispatcher' | 'driver' | 'viewer';
export type Status = 'assigned' | 'in_transit' | 'completed';
export type Kind = 'pickup' | 'delivery';
export const shots = ['Vorne', 'Hinten', 'Links', 'Rechts', 'Vorne links', 'Vorne rechts', 'Hinten links', 'Hinten rechts', 'Innenraum', 'Tacho'] as const;
export const statusLabels: Record<Status, string> = { assigned: 'Zugewiesen', in_transit: 'In Transport', completed: 'Abgeschlossen' };
export interface Organization { id: string; name: string }
export interface Member { id: string; organization_id: string; user_id: string; name: string; role: Role }
export interface Vehicle { id: string; organization_id: string; plate: string; vin: string; make: string; model: string; color: string; mileage: number; location: string }
export interface Driver { id: string; organization_id: string; name: string; email: string; phone: string; license_valid_until: string; user_id: string | null }
export interface Order { id: string; organization_id: string; reference: string; vehicle_id: string; driver_id: string; pickup: string; destination: string; scheduled_at: string; contact: string; status: Status }
export interface Photo { slot: string; url: string; path?: string }
export interface Damage { id: string; organization_id: string; vehicle_id: string; handover_id: string; area: string; description: string; created_at: string }
export interface Handover { id: string; organization_id: string; order_id: string; kind: Kind; mileage: number; fuel: number; signer: string; signature: string; notes: string; created_at: string; photos: Photo[] }
export interface Event { id: string; organization_id: string; vehicle_id: string; order_id: string; description: string; created_at: string }
export interface Data { organization: Organization; members: Member[]; vehicles: Vehicle[]; drivers: Driver[]; orders: Order[]; handovers: Handover[]; damages: Damage[]; events: Event[] }
export interface Draft { mileage: number; fuel: number; signer: string; signature: string; notes: string; photos: Photo[]; damages: { area: string; description: string }[] }
export function validateHandover(draft: Draft, order: Order, vehicle: Vehicle, handovers: Handover[], kind: Kind): string[] {
  const errors: string[] = [];
  if (kind === 'pickup' && order.status !== 'assigned') errors.push('Die Übernahme wurde bereits abgeschlossen.');
  if (kind === 'delivery' && order.status !== 'in_transit') errors.push('Zuerst die Übernahme abschließen.');
  const pickup = handovers.find(h => h.order_id === order.id && h.kind === 'pickup');
  const minimum = Math.max(vehicle.mileage, pickup?.mileage ?? 0);
  if (!Number.isSafeInteger(draft.mileage) || draft.mileage < minimum) errors.push(`Kilometerstand muss mindestens ${minimum} km betragen.`);
  if (!Number.isFinite(draft.fuel) || draft.fuel < 0 || draft.fuel > 100) errors.push('Tank-/Ladestand muss zwischen 0 und 100 liegen.');
  for (const shot of shots) if (!draft.photos.some(p => p.slot === shot && p.url.startsWith('data:image/jpeg;base64,'))) errors.push(`Pflichtfoto fehlt: ${shot}.`);
  if (!draft.signer.trim()) errors.push('Name der unterzeichnenden Person fehlt.');
  if (!draft.signature.startsWith('data:image/png;base64,') || draft.signature.length < 200) errors.push('Bitte eine Unterschrift zeichnen.');
  if (draft.damages.some(d => !d.area.trim() || !d.description.trim())) errors.push('Schäden brauchen Bereich und Beschreibung.');
  return errors;
}
export function canManage(role: Role) { return role === 'admin' || role === 'dispatcher'; }
export function canInspect(role: Role, order: Order, drivers: Driver[], userId: string) { return canManage(role) || (role === 'driver' && drivers.some(d => d.id === order.driver_id && d.user_id === userId)); }
