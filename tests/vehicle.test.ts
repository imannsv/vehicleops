import { describe, expect, it } from 'vitest';
import { equipment, findMake, makes, validateVehicleExtras } from '../src/lib/vehicle-catalog';
import { validVin, vinSuggestion } from '../src/lib/vin';
import { protocolSnapshot } from '../src/lib/domain';
import { applyEntityUpdate, upgradeDemo } from '../src/lib/management';
import { seed } from '../src/lib/seed';
describe('Fahrzeugkatalog und Ausstattung', () => {
 it('enthält einen vollständigen Snapshot mit herstellerspezifischen Modellen', () => {
  expect(makes.length).toBeGreaterThan(150); expect(makes.reduce((n,m)=>n+m.models.length,0)).toBeGreaterThan(2000);
  expect(findMake('VW')?.name).toBe('Volkswagen'); expect(findMake('Škoda')?.name).toBe('Skoda');
  expect(findMake('VW')?.models.some(m=>m.name==='Golf')).toBe(true); expect(findMake('BMW')?.models.some(m=>m.name==='Golf')).toBe(false);
  expect(equipment.find(item=>item.key==='CARPLAY')?.name).toBe('Apple CarPlay');
 });
 it('bewahrt Ausstattung in der Akte und im abgeschlossenen Snapshot', () => {
  const data=upgradeDemo(seed()), v=data.vehicles[0]; v.equipment=['CARPLAY','ELECTRIC_HEATED_SEATS'];v.variant='Variant';v.equipment_notes='Sonderumbau';
  const snapshot=protocolSnapshot(data,data.orders[0]);
  v.equipment.push('ABS'); expect(snapshot.vehicle.equipment).toEqual(['CARPLAY','ELECTRIC_HEATED_SEATS']);
  const next=applyEntityUpdate(data,'vehicles',{...v,equipment:['ABS'],equipment_notes:'Dachbox'},1);
  expect(next.vehicles[0].equipment).toEqual(['ABS']);expect(next.vehicles[0].equipment_notes).toBe('Dachbox');expect(snapshot.vehicle.equipment_notes).toBe('Sonderumbau');
 });
 it('verhindert ungültige, doppelte und überlange Ausstattung', () => {
  expect(()=>validateVehicleExtras({equipment:['UNKNOWN']})).toThrow('ungültige');expect(()=>validateVehicleExtras({equipment:['ABS','ABS']})).toThrow('doppelte');
  expect(()=>validateVehicleExtras({equipment_notes:'x'.repeat(2001)})).toThrow('lang'); expect(()=>validateVehicleExtras({})).not.toThrow();
 });
});
describe('VIN-Vorschläge', () => {
 it('ordnet erkannte Namen den Katalogherstellern zu', () => {
  expect(vinSuggestion({Results:[{ErrorCode:'0',Make:'VOLKSWAGEN',Model:'Golf',ModelYear:'2020'}]})).toMatchObject({make:'Volkswagen',model:'Golf',year:'2020'});
 });
 it('stellt Teilergebnisse und Prüfzifferfehler nicht als vollständige Erkennung dar', () => {
  for (const ErrorCode of ['1','0, 4','6','']) expect(vinSuggestion({Results:[{ErrorCode,Make:'BMW',Model:'X3',ModelYear:'2011'}]})).toMatchObject({make:'BMW',model:'',year:''});
 });
 it('meldet fehlende Angaben und validiert VIN vor einer Abfrage', () => {
  expect(vinSuggestion({Results:[{ErrorCode:'7',Make:'',Model:''}]}).make).toBe(''); expect(()=>vinSuggestion({})).toThrow('keine verwertbaren');
  expect(validVin('WVWZZZ3CZPE123456')).toBe(true);expect(validVin('WVWZZZ3CZPE12345I')).toBe(false);expect(validVin('short')).toBe(false);
 });
});
