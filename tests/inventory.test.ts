import {describe,it,expect} from 'vitest';
import {seed} from '../src/lib/seed';
import {filterInventory,inventoryState,moveInventory,positionLabel} from '../src/lib/inventory-domain';
import {initialParkingSetup,normalizeParkingLabels,parkingPreview} from '../src/lib/parking';
function fixture(){const data=seed(),org=data.organization.id;data.sites=[{id:'site',organization_id:org,name:'Hof Berlin',address:'Straße 1',revision:1}];data.spaces=[{id:'bay',organization_id:org,site_id:'site',label:'A-01',revision:1}];return data;}

describe('Stellplätze gesammelt anlegen',()=>{
 it('Nummernreihe zeigt tatsächliche neue und vorhandene Plätze',()=>{
  const preview=parkingPreview(initialParkingSetup('range'),['A-01','A-02']);
  expect(preview.error).toBe('');expect(preview.labels).toHaveLength(20);expect(preview.added).toHaveLength(18);expect(preview.existing).toEqual(['A-01','A-02']);expect(preview.labels.at(-1)).toBe('A-20');
 });
 it('Nummern, Präfix, Nullstart und führende Nullen sind wählbar',()=>{
  const setup={...initialParkingSetup('range'),prefix:' Halle- ',start:'000',end:'002'};
  expect(parkingPreview(setup).labels).toEqual(['Halle-000','Halle-001','Halle-002']);
  expect(parkingPreview({...setup,padded:false}).labels).toEqual(['Halle-0','Halle-1','Halle-2']);
  expect(parkingPreview({...setup,prefix:'',start:'98',end:'100'}).labels).toEqual(['098','099','100']);
 });
 it('freie Listen bewahren Bezeichnungen und ignorieren Leerzeilen und Wiederholungen',()=>{
  const preview=parkingPreview({...initialParkingSetup('list'),list:' Werkstatt links\r\n\r\n A-01\nWerkstatt links\nVerkaufsfläche 2 '},['A-01']);
  expect(preview.labels).toEqual(['Werkstatt links','A-01','Verkaufsfläche 2']);expect(preview.added).toEqual(['Werkstatt links','Verkaufsfläche 2']);expect(preview.duplicates).toBe(1);
 });
 it('ungültige und übergroße Bereiche können nicht gespeichert werden',()=>{
  const setup=initialParkingSetup('range');
  for(const patch of [{start:''},{start:'1.5'},{start:'-1'},{end:'100000'},{start:'21',end:'20'},{start:'1',end:'201'},{prefix:'x'.repeat(79)}])expect(parkingPreview({...setup,...patch}).error).not.toBe('');
  expect(parkingPreview({...setup,end:'200'}).labels).toHaveLength(200);
  expect(parkingPreview({...initialParkingSetup('list'),list:'\n  \n'}).error).not.toBe('');
 });
 it('optionales Überspringen, eindeutige Bezeichnungen und Unicode-Längen werden korrekt behandelt',()=>{
  expect(parkingPreview(initialParkingSetup()).labels).toEqual([]);
  expect(normalizeParkingLabels([' A-01 ','A-01','a-01'])).toEqual(['A-01','a-01']);
  expect(normalizeParkingLabels(['🚘'.repeat(80)])).toHaveLength(1);
  for(const labels of [[''],['x'.repeat(81)],Array.from({length:201},(_,i)=>String(i))])expect(()=>normalizeParkingLabels(labels)).toThrow();
 });
});
describe('Bestand und Fahrzeugposition',()=>{
 it('ohne Anlass bleibt die Bewegung mit Person und neutraler Beschreibung nachvollziehbar',()=>{for(const reason of ['', '   ']){const data=fixture(),before=structuredClone(data),next=moveInventory(data,data.vehicles[0],null,null,'Hamburg',reason);expect(next.movements).toHaveLength(1);expect(next.movements![0]).toMatchObject({source:'manual',reason:'Fahrzeug umgesetzt',actor_name:'Alex Morgan',from_location:'Berlin',to_location:'Hamburg'});expect(next.vehicles[0].revision).toBe(2);expect(data).toEqual(before);}});
 it('alte Angaben bleiben ohne erfundene Standortzuordnung und Historie erhalten',()=>{const d=fixture();expect(positionLabel(d,d.vehicles[0])).toBe('Berlin');expect(d.vehicles[0].site_id).toBeUndefined();expect(d.movements).toBeUndefined();expect(inventoryState(d,d.vehicles[0])).toBe('reserved');expect(inventoryState(d,d.vehicles[2])).toBe('available');});
 it('belegte Plätze, fremde Plätze, zu lange Gründe und veraltete Änderungen scheitern',()=>{const d=fixture(),v=d.vehicles[0],moved=moveInventory(d,v,'site','bay','','Zuordnung');expect(()=>moveInventory(moved,moved.vehicles[1],'site','bay','','Parken')).toThrow('belegt');expect(()=>moveInventory(d,v,'site','foreign','','Parken')).toThrow('nicht zum Standort');expect(()=>moveInventory(d,v,'foreign',null,'','Parken')).toThrow('nicht zum Arbeitsbereich');expect(()=>moveInventory(d,v,'site',null,'','x'.repeat(1001))).toThrow('1.000');expect(()=>moveInventory(moved,v,'site',null,'','Umsetzen')).toThrow('inzwischen');expect(()=>moveInventory(moved,moved.vehicles[0],'site','bay','','Umsetzen')).toThrow('bereits');});
 it('Bewegungen halten damalige Bezeichnungen fest und lassen keine manuelle Änderung im Transport zu',()=>{let d=fixture();d=moveInventory(d,d.vehicles[0],'site','bay','','Anlieferung');expect(d.movements![0]).toMatchObject({from_location:'Berlin',to_location:'Hof Berlin · A-01',reason:'Anlieferung',actor_name:'Alex Morgan'});d.sites![0].name='Neuer Hof';expect(d.movements![0].to_location).toBe('Hof Berlin · A-01');d.orders[0].status='in_transit';expect(()=>moveInventory(d,d.vehicles[0],null,null,'Hamburg','Transport')).toThrow('in Transport');});
 it('Standort, Stellplatz, Verfügbarkeit, Transport und Suche können kombiniert werden',()=>{let d=fixture();d=moveInventory(d,d.vehicles[0],'site','bay','','Anlieferung');const filters={search:'golf',site:'site',space:'bay',availability:'allocated',transport:'stationary'};expect(filterInventory(d,filters).map(v=>v.plate)).toEqual(['B NM 2048']);expect(filterInventory(d,{...filters,availability:'available'})).toEqual([]);expect(filterInventory(d,{search:'',site:'unassigned',space:'',availability:'available',transport:''}).map(v=>v.plate)).toEqual(['H NM 340']);d.orders[0].status='in_transit';expect(filterInventory(d,{...filters,transport:'in_transit'})).toHaveLength(1);});
});
