import { describe, expect, it } from 'vitest';
import { Draft, Handover, canInspect, isActiveOrder, protocolSnapshot, shots, validateHandover } from '../src/lib/domain';
import { applyCancellation, applyEntityUpdate, upgradeDemo } from '../src/lib/management';
import { seed } from '../src/lib/seed';
const data = seed(), order = data.orders[0], vehicle = data.vehicles[0];
const valid: Draft = { mileage: vehicle.mileage, fuel: 75, signer: 'Lena Fischer', signature: 'data:image/png;base64,' + 'a'.repeat(250), notes: '', photos: shots.map(slot => ({ slot, url: 'data:image/jpeg;base64,test' })), damages: [] };
describe('Protokollabschluss', () => {
 it('akzeptiert eine vollständige Übernahme', () => expect(validateHandover(valid, order, vehicle, [], 'pickup')).toEqual([]));
 it('verhindert Abschluss ohne Pflichtfoto', () => expect(validateHandover({ ...valid, photos: valid.photos.slice(1) }, order, vehicle, [], 'pickup')).toContain('Pflichtfoto fehlt: Vorne.'));
 it('akzeptiert doppelte Perspektiven nicht als Ersatz', () => expect(validateHandover({ ...valid, photos: Array(10).fill(valid.photos[0]) }, order, vehicle, [], 'pickup')).toContain('Pflichtfoto fehlt: Innenraum.'));
 it('akzeptiert mehrere Innenraumfotos', () => expect(validateHandover({ ...valid, photos: [...valid.photos, { slot: 'Innenraum', url: 'data:image/jpeg;base64,extra' }] }, order, vehicle, [], 'pickup')).toEqual([]));
 it('verlangt Innenraum auch bei zehn anderen Fotos', () => expect(validateHandover({ ...valid, photos: [...valid.photos.filter(p => p.slot !== 'Innenraum'), valid.photos[0]] }, order, vehicle, [], 'pickup')).toContain('Pflichtfoto fehlt: Innenraum.'));
 it('erlaubt kein zweites Außenfoto', () => expect(validateHandover({ ...valid, photos: [...valid.photos, valid.photos[0]] }, order, vehicle, [], 'pickup')).toContain('Außenperspektiven und Tacho dürfen jeweils nur ein Foto enthalten.'));
 it('verhindert rückläufige Kilometer', () => expect(validateHandover({ ...valid, mileage: vehicle.mileage - 1 }, order, vehicle, [], 'pickup').length).toBeGreaterThan(0));
 it('verhindert Übergabe vor Übernahme', () => expect(validateHandover(valid, order, vehicle, [], 'delivery')).toContain('Zuerst die Übernahme abschließen.'));
 it('verhindert wiederholte Übernahme', () => expect(validateHandover(valid, { ...order, status: 'in_transit' }, vehicle, [], 'pickup').length).toBeGreaterThan(0));
 it('prüft Unterschrift und Namen', () => expect(validateHandover({ ...valid, signer: ' ', signature: '' }, order, vehicle, [], 'pickup').length).toBe(2));
 it('prüft Tankstand, Dezimal- und NaN-Kilometer', () => { for (const mileage of [NaN, 3.2]) expect(validateHandover({ ...valid, mileage, fuel: 101 }, order, vehicle, [], 'pickup').length).toBe(2); });
 it('prüft Übergabekilometer gegen die Übernahme', () => { const handover = { order_id: order.id, kind: 'pickup', mileage: 30000 } as Handover; expect(validateHandover(valid, { ...order, status: 'in_transit' }, vehicle, [handover], 'delivery').length).toBeGreaterThan(0); });
 it('prüft Schadensbeschreibung', () => expect(validateHandover({ ...valid, damages: [{ area: 'Felge', description: '' }] }, order, vehicle, [], 'pickup').length).toBe(1));
});

describe('Bearbeitung und Protokollbestand', () => {
 const setup = () => upgradeDemo(seed());
 it('aktualisiert Stammdaten mit Revision und Historie', () => { const d = setup(), v = d.vehicles[0]; const next = applyEntityUpdate(d, 'vehicles', { ...v, plate: 'B NEU 1' }, 1); expect(next.vehicles[0].revision).toBe(2); expect(next.events[0].description).toContain('B NEU 1'); expect(d.vehicles[0].plate).toBe(v.plate); });
 it('verhindert das Überschreiben einer fremden Änderung', () => { const d = setup(), v = d.vehicles[0]; const next = applyEntityUpdate(d, 'vehicles', { ...v, color: 'Blau' }, 1); expect(() => applyEntityUpdate(next, 'vehicles', { ...v, color: 'Rot' }, 1)).toThrow('inzwischen geändert'); });
 it('behält die Angaben abgeschlossener Protokolle', () => { const d = setup(), o = d.orders[0]; const h = { id: 'protocol', order_id: o.id, snapshot: protocolSnapshot(d, o), mileage: d.vehicles[0].mileage } as Handover; d.handovers.push(h); const next = applyEntityUpdate(d, 'vehicles', { ...d.vehicles[0], plate: 'B NEU 1' }, 1); const updated = applyEntityUpdate(next, 'drivers', { ...next.drivers[0], name: 'Neuer Name' }, 1); expect(updated.handovers[0].snapshot?.vehicle.plate).toBe('B NM 2048'); expect(updated.handovers[0].snapshot?.driver?.name).toBe('Lena Fischer'); });
 it('unterschreitet keine protokollierten Kilometer', () => { const d = setup(); d.handovers.push({ order_id: d.orders[0].id, mileage: 30000 } as Handover); expect(() => applyEntityUpdate(d, 'vehicles', d.vehicles[0], 1)).toThrow('30000'); });
 it('hält Fahrzeug und Abholort nach Übernahme fest', () => { const d = setup(); d.orders[0].status = 'in_transit'; expect(() => applyEntityUpdate(d, 'orders', { ...d.orders[0], pickup: 'Anderer Ort' }, 1)).toThrow('Abholort'); expect(() => applyEntityUpdate(d, 'vehicles', { ...d.vehicles[0], mileage: 29000 }, 1)).toThrow('Während des Transports'); });
 it('erlaubt Ziel- und Fahrerwechsel während des Transports', () => { const d = setup(); d.orders[0].status = 'in_transit'; const next = applyEntityUpdate(d, 'orders', { ...d.orders[0], driver_id: d.drivers[1].id, destination: 'Bremen' }, 1); expect(next.orders[0].destination).toBe('Bremen'); expect(next.orders[0].revision).toBe(2); });
 it('prüft Führerscheingültigkeit bei Fahreränderung', () => { const d = setup(); expect(() => applyEntityUpdate(d, 'drivers', { ...d.drivers[0], license_valid_until: '2020-01-01' }, 1)).toThrow('offenen Aufträge'); });
 it('storniert mit Grund und gibt das Fahrzeug frei', () => { const d = setup(), o = d.orders[0]; const next = applyCancellation(d, o.id, 'Kunde abgesagt', 1); expect(next.orders[0].cancellation_reason).toBe('Kunde abgesagt'); expect(isActiveOrder(next.orders[0])).toBe(false); expect(next.events[0].description).toContain('storniert'); });
 it('verhindert Storno ohne Grund und nach Übernahme', () => { const d = setup(); expect(() => applyCancellation(d, d.orders[0].id, '', 1)).toThrow('Stornogrund'); d.orders[0].status = 'in_transit'; expect(() => applyCancellation(d, d.orders[0].id, 'Grund', 1)).toThrow('vor der Übernahme'); });
 it('sperrt abgeschlossene und stornierte Aufträge', () => { const d = setup(); for (const status of ['completed', 'cancelled'] as const) { d.orders[0].status = status; expect(() => applyEntityUpdate(d, 'orders', d.orders[0], 1)).toThrow('können nicht bearbeitet'); } });
});
describe('Rollen', () => {
 it('erlaubt Disposition, verweigert lesenden Mitgliedern', () => { expect(canInspect('dispatcher', order, data.drivers, 'x')).toBe(true); expect(canInspect('viewer', order, data.drivers, 'x')).toBe(false); });
 it('erlaubt Fahrern nur zugewiesene Aufträge', () => { const drivers = data.drivers.map(d => ({ ...d, user_id: d.id === order.driver_id ? 'assigned-user' : null })); expect(canInspect('driver', order, drivers, 'assigned-user')).toBe(true); expect(canInspect('driver', order, drivers, 'other-user')).toBe(false); });
});
