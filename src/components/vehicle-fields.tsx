'use client';
import { useRef, useState } from 'react';
import { ScanLine, Search } from 'lucide-react';
import { Vehicle, VehicleHolder } from '@/lib/domain';
import { equipment, equipmentGroup, equipmentGroups, findMake, makes } from '@/lib/vehicle-catalog';
import { validVin, VinSuggestion } from '@/lib/vin';
import { supabase } from '@/lib/supabase';
import { CatalogPicker } from './catalog-picker';
import { RegistrationPlate } from './registration-plate';
export function VehicleFields({vehicle,inTransit,organizationId,holder}: {vehicle:Vehicle|null;inTransit:boolean;organizationId:string;holder?:VehicleHolder}) {
 const [vin,setVin]=useState(vehicle?.vin??''), [make,setMake]=useState(vehicle?.make??''), [model,setModel]=useState(vehicle?.model??'');
 const [selected,setSelected]=useState<string[]>(vehicle?.equipment??[]), [query,setQuery]=useState('');
 const [decoding,setDecoding]=useState(false), [suggestion,setSuggestion]=useState<VinSuggestion|null>(null), [message,setMessage]=useState('');
 const currentVin=useRef(vin);
 const brand=findMake(make);
 async function decode() {
  const captured=vin.trim().toUpperCase();setDecoding(true);setMessage('');setSuggestion(null);
  try {
   const token=supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
   const response=await fetch('/api/vin',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({vin:captured,organization_id:organizationId}),signal:AbortSignal.timeout(16000)});
   const result=await response.json();
   if(currentVin.current.trim().toUpperCase()!==captured)return;
   if(!response.ok)throw new Error(result.error || 'VIN-Abfrage fehlgeschlagen.');
   setSuggestion(result);setMessage(result.message);
  } catch(error) {
   if(currentVin.current.trim().toUpperCase()===captured)setMessage(error instanceof Error && error.name!=='TimeoutError'?error.message:'VIN-Abfrage dauert zu lange. Bitte manuell auswählen.');
  } finally {setDecoding(false);}
 }
 return <>
  <RegistrationPlate initial={vehicle?.plate}/>
  <label className="span-2">VIN<input name="vin" required minLength={17} maxLength={17} placeholder="17-stellige Fahrzeugnummer" value={vin} onChange={e=>{const next=e.target.value.toUpperCase();currentVin.current=next;setVin(next);setSuggestion(null);setMessage('');}}/></label>
  <div className="span-2 vin-panel"><div className="vin-action"><button type="button" className="secondary" disabled={decoding||!validVin(vin.trim())} onClick={decode}><ScanLine size={16}/>{decoding?'VIN wird geprüft …':'VIN prüfen'}</button><p className="muted small">Abfrage bei NHTSA. Erkennung für europäische Fahrzeuge kann unvollständig sein. Ausstattung bitte selbst erfassen.</p></div>
   {message && <div className="vin-result" role="status"><p>{message}</p>{suggestion?.make && <><strong>{suggestion.make} {suggestion.model}{suggestion.year?' · Modelljahr '+suggestion.year:''}</strong><button type="button" className="text-button" onClick={()=>{setMake(suggestion.make);setModel(suggestion.model);setSuggestion(null);setMessage('Hersteller und Modell übernommen. Baujahr bitte selbst prüfen; das Modelljahr ist keine Baujahrbestätigung.');}}>Angaben übernehmen</button></>}</div>}
  </div>
  <CatalogPicker label="Hersteller" name="make" value={make} onChange={next=>{if(next!==make)setModel('');setMake(next);}} options={makes} logos/>
  <CatalogPicker label="Modell" name="model" value={model} onChange={setModel} options={brand?.models??[]} disabled={!make.trim()}/>
  <label className="span-2">Ausführung / Variante (optional)<input name="variant" maxLength={120} placeholder="z. B. Variant, 320d Touring, AMG Line" defaultValue={vehicle?.variant}/></label>
  <label>Baujahr (optional)<input name="build_year" type="number" min="1886" max={new Date().getFullYear()+1} step="1" defaultValue={vehicle?.build_year??''}/></label>
  <label>Erstzulassung (optional)<input name="first_registration" type="date" max={new Date().toISOString().slice(0,10)} defaultValue={vehicle?.first_registration??''}/></label>
  <label>Farbe<input name="color" required defaultValue={vehicle?.color}/></label><label>Kilometerstand<input name="mileage" type="number" min="0" step="1" required defaultValue={vehicle?.mileage} readOnly={inTransit}/></label>
  <label className="span-2">Standort<input name="location" required defaultValue={vehicle?.location} readOnly={inTransit}/></label>
  {inTransit && <p className="span-2 muted small">Während des Transports werden Kilometerstand und Standort über das Übergabeprotokoll aktualisiert.</p>}
  <section className="span-2 record-fields"><h3>Fahrzeughalter</h3><p className="muted small">Optional · sichtbar für Disposition und den zugeteilten Fahrer.</p><label>Name / Firma des Halters<input name="holder_name" maxLength={120} defaultValue={holder?.name}/></label><label>Halteranschrift<textarea name="holder_address" maxLength={1000} defaultValue={holder?.address} placeholder="Straße, Hausnummer, PLZ und Ort"/></label><label>Halterkontakt (optional)<input name="holder_contact" maxLength={240} defaultValue={holder?.contact} placeholder="Telefon oder E-Mail"/></label></section>
  <section className="span-2 record-fields"><h3>Fotos und Dokumente</h3><p className="muted small">Mehrere Dateien · maximal 10 MB je Datei. Nach dem Speichern werden sie in der Fahrzeugakte hochgeladen.</p><label>Fahrzeugfotos hinzufügen<input name="vehicle_photos" type="file" accept="image/jpeg,image/png,image/webp" multiple/></label><label>Fahrzeugschein hinzufügen<input name="vehicle_registration" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple/></label><label>Weitere Dokumente hinzufügen<input name="vehicle_documents" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple/></label><p className="muted small">Schlüssel und vorhandene Anhänge verwaltest du in der Fahrzeugakte.</p></section>
  <section className="span-2 equipment-editor" aria-labelledby="equipment-title"><div className="section-heading"><h3 id="equipment-title">Ausstattung</h3><span className="muted small">{selected.length} ausgewählt</span></div>
   <label className="equipment-search"><span className="sr-only">Ausstattung suchen</span><Search size={16}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="z. B. Sitzheizung, Kamera, CarPlay"/></label>
   {selected.map(key=><input key={key} type="hidden" name="equipment" value={key}/>)}
   <div className="equipment-groups">{equipmentGroups.map(group=>{
    const entries=equipment.filter(item=>equipmentGroup(item.key)===group.name && (item.name.toLowerCase().includes(query.toLowerCase()) || item.key.toLowerCase().includes(query.toLowerCase())));
    if(!entries.length)return null;
    return <details key={group.name} open={query?true:undefined}><summary>{group.name}<span>{entries.filter(item=>selected.includes(item.key)).length} / {entries.length}</span></summary><div className="equipment-options">{entries.map(item=><label key={item.key}><input type="checkbox" checked={selected.includes(item.key)} onChange={e=>setSelected(previous=>e.target.checked?[...previous,item.key]:previous.filter(key=>key!==item.key))}/><span>{item.name}</span></label>)}</div></details>;
   })}{!equipment.some(item=>item.name.toLowerCase().includes(query.toLowerCase()) || item.key.toLowerCase().includes(query.toLowerCase())) && <p className="muted small">Keine passende Ausstattung gefunden. Nutze das Freitextfeld darunter.</p>}</div>
   <label>Zusätzliche Ausstattung (optional)<textarea name="equipment_notes" maxLength={2000} placeholder="z. B. spezielle Pakete, Umbauten oder Zubehör" defaultValue={vehicle?.equipment_notes}/></label>
  </section>
 </>;
}
