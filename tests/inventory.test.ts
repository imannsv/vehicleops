import {describe,it,expect} from 'vitest';
import {seed} from '../src/lib/seed';
import {filterInventory,inventoryState,moveInventory,positionLabel} from '../src/lib/inventory-domain';
import {initialParkingSetup,normalizeParkingLabels,parkingPreview} from '../src/lib/parking';
import {activeSites,activeSpaces,applyFleetArchive,fleetArchiveUsage} from '../src/lib/fleet-archive';
import {normalizeOrderRoute} from '../src/lib/order-route';
function fixture(){const data=seed(),org=data.organization.id;data.sites=[{id:'site',organization_id:org,name:'Hof Berlin',address:'Straße 1',revision:1}];data.spaces=[{id:'bay',organization_id:org,site_id:'site',label:'A-01',revision:1}];return data;}

describe('Standort- und Stellplatzarchiv',()=>{
 it('archiviert und stellt mit unveränderten Kennungen und Historie wieder her',()=>{
  const data=fixture(),before=structuredClone(data),archived=applyFleetArchive(data,'site','site',1,true);
  expect(archived.sites![0].archived_at).toBeTruthy();expect(archived.sites![0].revision).toBe(2);expect(activeSites(archived)).toHaveLength(0);expect(activeSpaces(archived)).toHaveLength(0);
  const restored=applyFleetArchive(archived,'site','site',2,false);expect(restored.sites![0]).toMatchObject({id:'site',name:'Hof Berlin',revision:3,archived_at:null});expect(restored.spaces).toEqual(data.spaces);expect(restored.movements).toEqual(data.movements);expect(restored.handovers).toEqual(data.handovers);expect(data).toEqual(before);
 });
 it('belegte Plätze und noch benötigte Auftragsorte sind gesperrt',()=>{
  const data=fixture();data.vehicles[0]={...data.vehicles[0],site_id:'site',parking_space_id:'bay'};
  expect(()=>applyFleetArchive(data,'space','bay',1,true)).toThrow('belegt');expect(()=>applyFleetArchive(data,'site','site',1,true)).toThrow('Fahrzeuge');
  data.vehicles[0].site_id=null;data.vehicles[0].parking_space_id=null;data.orders[0].pickup_site_id='site';
  expect(()=>applyFleetArchive(data,'site','site',1,true)).toThrow('Offene Aufträge');
  data.orders[0].status='in_transit';expect(fleetArchiveUsage(data,'site','site').orders).toHaveLength(0);
  data.orders[0].destination_site_id='site';data.orders[0].destination_space_id='bay';
  for(const kind of ['site','space'] as const)expect(()=>applyFleetArchive(data,kind,kind==='site'?'site':'bay',1,true)).toThrow('Offene Aufträge');
  data.orders[0].status='completed';expect(()=>applyFleetArchive(data,'site','site',1,true)).not.toThrow();
 });
 it('einzeln archivierte Plätze werden durch Standortwiederherstellung nicht reaktiviert',()=>{
  let data=fixture();data=applyFleetArchive(data,'space','bay',1,true);data=applyFleetArchive(data,'site','site',1,true);
  expect(()=>applyFleetArchive(data,'space','bay',2,false)).toThrow('zuerst den Standort');
  data=applyFleetArchive(data,'site','site',2,false);expect(activeSpaces(data)).toHaveLength(0);
  data=applyFleetArchive(data,'space','bay',2,false);expect(activeSpaces(data)).toHaveLength(1);
 });
 it('Wiederholungen sind idempotent und veraltete Gegenaktionen werden abgelehnt',()=>{
  const data=fixture(),archived=applyFleetArchive(data,'space','bay',1,true);
  expect(applyFleetArchive(archived,'space','bay',1,true)).toBe(archived);
  expect(()=>applyFleetArchive(archived,'space','bay',1,false)).toThrow('inzwischen');
  expect(()=>applyFleetArchive(data,'site','foreign',1,true)).toThrow('fehlt');
 });
 it('archivierte Ziele scheiden für Bewegungen und neue Aufträge aus; vergangene Abholung bleibt erhalten',()=>{
  const data=applyFleetArchive(fixture(),'site','site',1,true),vehicle=data.vehicles[0];
  expect(()=>moveInventory(data,vehicle,'site',null,'','')).toThrow('archiviert');
  expect(()=>normalizeOrderRoute(data,{...data.orders[0],pickup_site_id:'site'})).toThrow('archiviert');
  const previous={...data.orders[0],status:'in_transit' as const,pickup_site_id:'site',pickup:'Hof Berlin',pickup_address:'Straße 1'};
  expect(normalizeOrderRoute(data,previous,previous).pickup_address).toBe('Straße 1');
  const bayData=applyFleetArchive(fixture(),'space','bay',1,true);
  expect(()=>moveInventory(bayData,bayData.vehicles[0],'site','bay','','')).toThrow('archiviert');
  expect(()=>normalizeOrderRoute(bayData,{...bayData.orders[0],destination_site_id:'site',destination_space_id:'bay'})).toThrow('archiviert');
 });
});

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
