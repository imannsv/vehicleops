import {describe,it,expect} from 'vitest';
import {seed} from '../src/lib/seed';
import {upgradeDemo,applyEntityUpdate} from '../src/lib/management';
import {initialProtocol,protocolErrors,suggestedStatus,updateProtocol} from '../src/lib/protocol';
import {coverImage,vehicleImages} from '../src/lib/vehicle-images';
import {vehicleTitle,vehicleIdentity} from '../src/lib/company';
import {Handover,shots} from '../src/lib/domain';
function fixture(){const data=upgradeDemo(seed()),v={...data.vehicles[0],plate:null,generation:'8V',inventory_kind:'owned' as const,inventory_status:'stock' as const};data.vehicles[0]=v;return {data,v};}
function signed(){const {data,v}=fixture(),d=initialProtocol(data,v,null,'delivery');d.fuel=60;d.photos=shots.map(slot=>({slot,url:'data:image/jpeg;base64,test'}));d.parties={giver:{name:'Dealer',role:'Employee',signature:'data:image/png;base64,giver'},receiver:{name:'Buyer',role:'Customer',signature:'data:image/png;base64,receiver'},exception_confirmed:false,exception_reason:''};d.position.confirmed=true;d.stock_confirmed=true;return{data,v,d};}
describe('Gemeinsame Fahrzeugakte',()=>{
 it('identifiziert Fahrzeuge ohne Kennzeichen über Modell und Bestandsnummer',()=>{const{v}=fixture();expect(vehicleIdentity(v)).toBe(v.stock_number);expect(vehicleTitle(v)).toBe('Volkswagen Golf Variant 8V');});
 it('akzeptiert mehrere Fahrzeuge ohne Kennzeichen bei verschiedenen VINs',()=>{const{data,v}=fixture();data.vehicles[1]={...data.vehicles[1],plate:null};expect(()=>applyEntityUpdate(data,'vehicles',v,1)).not.toThrow();});
 it('ordnet Altbestände keinem Eigentümer automatisch zu',()=>{expect(upgradeDemo(seed()).vehicles.every(v=>!v.inventory_kind||v.inventory_kind==='unassigned')).toBe(true);});
 it('schlägt Bestandsstatus nach Anlass und Richtung nur für eigenen Bestand vor',()=>{const{v}=fixture();expect(suggestedStatus(v,'delivery','sale')).toBe('sold');expect(suggestedStatus(v,'delivery','rental')).toBe('rented');expect(suggestedStatus({...v,inventory_status:'sold'},'pickup','return')).toBe('stock');expect(suggestedStatus({...v,inventory_kind:'customer'},'delivery','sale')).toBe('');expect(suggestedStatus(v,'pickup','sale')).toBe('stock');});
});
describe('Neue Protokollbestätigung',()=>{
 it('akzeptiert zwei Beteiligte und zwei Unterschriften',()=>{const{data,v,d}=signed();expect(protocolErrors(data,v,d,true)).toEqual([]);});
 it('verlangt Position und ausdrückliche Bestandsbestätigung',()=>{const{data,v,d}=signed();d.position.confirmed=false;d.stock_confirmed=false;expect(protocolErrors(data,v,d,true)).toContain('Tatsächliche Position bestätigen.');expect(protocolErrors(data,v,d,true)).toContain('Bestandsstatus bestätigen.');});
 it('verlangt mindestens eine Unterschrift auch mit Ausnahme',()=>{const{data,v,d}=signed();d.parties.giver.signature='';d.parties.receiver.signature='';d.parties.exception_confirmed=true;d.parties.exception_reason='Nicht erreichbar';expect(protocolErrors(data,v,d,true)).toContain('Mindestens eine Unterschrift erforderlich.');});
 it('akzeptiert eine fehlende Unterschrift nur mit begründeter Ausnahme',()=>{const{data,v,d}=signed();d.parties.receiver.signature='';expect(protocolErrors(data,v,d,true).length).toBeGreaterThan(0);d.parties.exception_confirmed=true;d.parties.exception_reason='Person verweigert Unterschrift';expect(protocolErrors(data,v,d,true)).toEqual([]);});
 it('löscht beide Unterschriften bei Inhaltsänderungen und erhält sie beim zweiten Signieren',()=>{const{d}=signed();const changed=updateProtocol(d,{notes:'Neuer Hinweis'});expect(changed.parties.giver.signature).toBe('');expect(changed.parties.receiver.signature).toBe('');expect(updateProtocol(d,{parties:{...d.parties,receiver:{...d.parties.receiver,signature:'new'}}},true).parties.giver.signature).toBe(d.parties.giver.signature);});
 it('verlangt erneute Prüfung nach Unternehmensänderung',()=>{const{data,v,d}=signed();data.organization.revision=(data.organization.revision??1)+1;expect(protocolErrors(data,v,d,true)).toContain('Unternehmensprofil geändert. Bitte Entwurf neu prüfen.');});
});
describe('Fahrzeugbilder',()=>{
 it('verwendet vorne links aus dem neuesten Protokoll ohne Dokumente und Signaturen',()=>{const{data,v}=fixture();data.handovers=[{id:'old',vehicle_id:v.id,created_at:'2026-01-01',kind:'pickup',photos:[{slot:'Vorne links',url:'old'}]},{id:'new',vehicle_id:v.id,created_at:'2026-02-01',kind:'delivery',photos:[{slot:'Vorne',url:'front'},{slot:'Vorne links',url:'preferred'}]}] as Handover[];expect(coverImage(data,v)?.url).toBe('preferred');expect(vehicleImages(data,v)).toHaveLength(3);});
 it('respektiert ein explizites Titelbild und fällt bei entfernter Auswahl zurück',()=>{const{data,v}=fixture();data.assets=[{id:'photo',organization_id:v.organization_id,vehicle_id:v.id,kind:'photo',path:'p',name:'car.jpg',mime:'image/jpeg',size:10,created_at:'2026-01-01',url:'photo'},{id:'document',organization_id:v.organization_id,vehicle_id:v.id,kind:'registration',path:'d',name:'private.pdf',mime:'application/pdf',size:10,created_at:'2026-02-01'}];expect(vehicleImages(data,v).map(i=>i.id)).toEqual(['photo']);expect(coverImage(data,{...v,cover_kind:'asset',cover_id:'photo'})?.url).toBe('photo');expect(coverImage(data,{...v,cover_kind:'asset',cover_id:'document'})?.url).toBe('photo');});
});
