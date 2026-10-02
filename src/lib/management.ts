import { Data, Driver, Event, Order, Vehicle, isActiveOrder, protocolSnapshot } from './domain';
import { validateVehicleExtras } from './vehicle-catalog';

export type EntityTable = 'vehicles' | 'drivers' | 'orders';
export const conflictMessage = 'Dieser Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.';
export function scheduledDay(value: string) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(value)); }
export function upgradeDemo(data: Data): Data {
  return { ...data, invitations: data.invitations ?? [], vehicles: data.vehicles.map(v => ({ ...v, revision: v.revision ?? 1 })), drivers: data.drivers.map(d => ({ ...d, revision: d.revision ?? 1 })), orders: data.orders.map(o => ({ ...o, revision: o.revision ?? 1 })), handovers: data.handovers.map(h => ({ ...h, snapshot: h.snapshot ?? protocolSnapshot(data, data.orders.find(o => o.id === h.order_id)!) })) };
}
function event(data: Data, vehicle_id: string, order_id: string | null, description: string): Event {
  return { id: crypto.randomUUID(), organization_id: data.organization.id, vehicle_id, order_id, description, created_at: new Date().toISOString() };
}
export function applyEntityUpdate(data: Data, table: EntityTable, row: Vehicle | Driver | Order, expectedRevision: number): Data {
  const old = data[table].find(entity => entity.id === row.id);
  if (!old || old.organization_id !== row.organization_id || row.organization_id !== data.organization.id) throw new Error('Datensatz fehlt.');
  if ((old.revision ?? 1) !== expectedRevision) throw new Error(conflictMessage);
  const revision = expectedRevision + 1;
  if (table === 'vehicles') {
    const previous = old as Vehicle, next = row as Vehicle;
    validateVehicleExtras(next);
    if (!next.plate.trim() || !next.make.trim() || !next.model.trim() || !next.color.trim() || !next.location.trim()) throw new Error('Bitte alle Fahrzeugfelder ausfüllen.');
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(next.vin)) throw new Error('VIN muss 17 gültige Zeichen enthalten.');
    if (data.vehicles.some(v => v.id !== row.id && (v.plate === next.plate || v.vin === next.vin))) throw new Error('Kennzeichen oder VIN existiert bereits.');
    const floor = Math.max(0, ...data.handovers.filter(h => (h.snapshot?.vehicle.id ?? data.orders.find(o => o.id === h.order_id)?.vehicle_id) === row.id).map(h => h.mileage));
    if (!Number.isSafeInteger(next.mileage) || next.mileage < floor) throw new Error(`Kilometerstand muss mindestens ${floor} km betragen.`);
    if (data.orders.some(o => o.vehicle_id === row.id && o.status === 'in_transit') && (next.mileage !== previous.mileage || next.location !== previous.location)) throw new Error('Während des Transports werden Kilometerstand und Standort durch das Protokoll aktualisiert.');
    return { ...data, invitations: data.invitations ?? [], vehicles: data.vehicles.map(v => v.id === row.id ? { ...next, revision } : v), events: [...data.events, event(data, row.id, null, `Fahrzeugdaten aktualisiert: ${previous.plate} → ${next.plate}`)] };
  }
  if (table === 'drivers') {
    const next = row as Driver;
    if (!next.name.trim() || !next.email.trim() || !next.phone.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(next.license_valid_until)) throw new Error('Bitte alle Fahrerfelder ausfüllen.');
    if (next.user_id && !data.members.some(m => m.user_id === next.user_id && m.role === 'driver')) throw new Error('Bitte ein Teammitglied mit Fahrerrolle auswählen.');
    const active = data.orders.filter(o => o.driver_id === next.id && isActiveOrder(o));
    if (active.some(o => next.license_valid_until < scheduledDay(o.scheduled_at))) throw new Error('Die Führerscheingültigkeit muss alle offenen Aufträge abdecken.');
    return { ...data, drivers: data.drivers.map(d => d.id === row.id ? { ...next, revision } : d), events: [...data.events, ...active.map(o => event(data, o.vehicle_id, o.id, `Fahrerdaten aktualisiert: ${next.name} · ${o.reference}`))] };
  }
  const previous = old as Order, next = row as Order;
  if (!isActiveOrder(previous)) throw new Error('Abgeschlossene und stornierte Aufträge können nicht bearbeitet werden.');
  if (next.status !== previous.status || next.reference !== previous.reference) throw new Error('Auftragsstatus und Referenz können hier nicht verändert werden.');
  if (previous.status === 'in_transit' && (next.vehicle_id !== previous.vehicle_id || next.pickup !== previous.pickup)) throw new Error('Nach der Übernahme bleiben Fahrzeug und Abholort unverändert.');
  if (!next.pickup.trim() || !next.destination.trim() || !Number.isFinite(new Date(next.scheduled_at).getTime())) throw new Error('Route oder Termin ist ungültig.');
  if (!data.vehicles.some(v => v.id === next.vehicle_id)) throw new Error('Fahrzeug fehlt.');
  if (data.orders.some(o => o.id !== row.id && o.vehicle_id === next.vehicle_id && isActiveOrder(o))) throw new Error('Dieses Fahrzeug hat bereits einen offenen Auftrag.');
  const driver = data.drivers.find(d => d.id === next.driver_id);
  if (!driver || driver.license_valid_until < scheduledDay(next.scheduled_at)) throw new Error('Die Führerscheingültigkeit endet vor dem Auftrag.');
  const description = `Auftrag ${next.reference} aktualisiert · Fahrer: ${driver.name} · Termin: ${new Date(next.scheduled_at).toLocaleString('de-DE')}`;
  const events = [event(data, next.vehicle_id, next.id, description)];
  if (previous.vehicle_id !== next.vehicle_id) events.push(event(data, previous.vehicle_id, next.id, `Fahrzeug aus Auftrag ${next.reference} entfernt.`));
  return { ...data, orders: data.orders.map(o => o.id === row.id ? { ...next, revision } : o), events: [...data.events, ...events] };
}
export function applyCancellation(data: Data, id: string, reason: string, expectedRevision: number): Data {
  const order = data.orders.find(o => o.id === id);
  if (!order) throw new Error('Auftrag fehlt.');
  if ((order.revision ?? 1) !== expectedRevision) throw new Error(conflictMessage);
  if (order.status !== 'assigned') throw new Error('Nur Aufträge vor der Übernahme können storniert werden.');
  if (!reason.trim() || reason.trim().length > 1000) throw new Error('Bitte einen Stornogrund mit maximal 1000 Zeichen angeben.');
  return { ...data, orders: data.orders.map(o => o.id === id ? { ...o, status: 'cancelled', cancellation_reason: reason.trim(), cancelled_at: new Date().toISOString(), revision: expectedRevision + 1 } : o), events: [...data.events, event(data, order.vehicle_id, order.id, `Auftrag ${order.reference} storniert: ${reason.trim()}`)] };
}

