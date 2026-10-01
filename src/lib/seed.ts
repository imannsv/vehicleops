import { Data } from './domain';
export const DEMO_ORG = '00000000-0000-4000-8000-000000000001';
const v1 = '00000000-0000-4000-8000-000000000011', v2 = '00000000-0000-4000-8000-000000000012', v3 = '00000000-0000-4000-8000-000000000013';
const d1 = '00000000-0000-4000-8000-000000000021', d2 = '00000000-0000-4000-8000-000000000022';
export function seed(): Data {
 const organization_id = DEMO_ORG;
 const scheduled = (hour: number) => { const day = new Date(); day.setHours(hour, 0, 0, 0); return day.toISOString(); };
 return { organization: { id: organization_id, name: 'Nordstern Mobility' }, members: [{ id: crypto.randomUUID(), organization_id, user_id: 'demo', name: 'Alex Morgan', role: 'admin' }],
 vehicles: [
  { id: v1, organization_id, plate: 'B NM 2048', vin: 'WVWZZZ3CZPE123456', make: 'Volkswagen', model: 'Golf Variant', color: 'Silber', mileage: 28450, location: 'Berlin' },
  { id: v2, organization_id, plate: 'HH NM 812', vin: 'WBA8E91070K123456', make: 'BMW', model: '320d Touring', color: 'Schwarz', mileage: 41280, location: 'Hamburg' },
  { id: v3, organization_id, plate: 'H NM 340', vin: 'W1K2060421F123456', make: 'Mercedes-Benz', model: 'C 200', color: 'Weiß', mileage: 15320, location: 'Hannover' }],
 drivers: [{ id: d1, organization_id, name: 'Lena Fischer', email: 'lena@example.com', phone: '+49 151 0000001', license_valid_until: '2028-12-31', user_id: null }, { id: d2, organization_id, name: 'Ben Weber', email: 'ben@example.com', phone: '+49 151 0000002', license_valid_until: '2028-12-31', user_id: null }],
 orders: [{ id: crypto.randomUUID(), organization_id, reference: 'VO-2048', vehicle_id: v1, driver_id: d1, pickup: 'Autohaus Mitte, Berlin', destination: 'Nordstern, Hamburg', scheduled_at: scheduled(10), contact: 'Marie Sommer · +49 30 000000', status: 'assigned' }, { id: crypto.randomUUID(), organization_id, reference: 'VO-2049', vehicle_id: v2, driver_id: d2, pickup: 'Nordstern, Hamburg', destination: 'Autohaus Süd, Hannover', scheduled_at: scheduled(13), contact: 'Tom Berger · +49 511 000000', status: 'assigned' }], handovers: [], damages: [], events: [] };
}
