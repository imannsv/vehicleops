import {describe,it,expect} from 'vitest';
import {damageArea,damageErrors,freezeDamages,protocolDamages,validDamageMarker} from '../src/lib/damages';
import {damageDiagramSvg} from '../src/lib/damage-diagram-image';
import {initialProtocol,updateProtocol} from '../src/lib/protocol';
import {seed} from '../src/lib/seed';
import {Handover} from '../src/lib/domain';
const damage={id:'damage',area:'Vorne links',description:'Kratzer',marker:{x:29,y:15},photos:[{id:'photo',url:'data:image/jpeg;base64,valid'}]};
describe('Schadenakte ohne Status',()=>{
 it('ordnet Markierungen konsistent zur Fahrzeugausrichtung zu',()=>{expect(damageArea({x:29,y:15})).toBe('Vorne links');expect(damageArea({x:71,y:85})).toBe('Hinten rechts');expect(damageArea({x:50,y:50})).toBe('Dach');expect(damageArea({x:20,y:50})).toBe('Links');});
 it('weist ungültige und außerhalb liegende Koordinaten zurück',()=>{for(const value of [undefined,{}, {x:NaN,y:5},{x:101,y:5},{x:-1,y:5},{x:5,y:Infinity},{x:'30',y:20}])expect(validDamageMarker(value)).toBe(false);expect(validDamageMarker({x:0,y:100})).toBe(true);});
 it('lässt Schäden ohne Markierung und ohne Detailfoto für Innenraum und Altbestände zu',()=>{expect(damageErrors([{area:'Innenraum',description:'Riss im Sitz'}])).toEqual([]);expect(damageErrors([damage])).toEqual([]);});
 it('prüft Pflichtangaben, Umfang und Bildformat',()=>{expect(damageErrors([{...damage,description:''}]).join(' ')).toContain('Beschreibung');expect(damageErrors([{...damage,photos:Array.from({length:11},(_,i)=>({id:''+i,url:'data:image/jpeg;base64,ok'}))}]).join(' ')).toContain('zehn Detailfotos');expect(damageErrors([{...damage,photos:[{id:'p',url:'https://example.com/a.jpg'}]}]).join(' ')).toContain('ungültig');});
 it('verhindert doppelte Schaden- und Fotoidentitäten',()=>{expect(damageErrors([damage,{...damage}]).join(' ')).toContain('Schadenkennungen');expect(damageErrors([damage,{...damage,id:'another'}]).join(' ')).toContain('getrennte Kennungen');});
 it('friert Markierungen und Bilder unabhängig von späteren Änderungen ein',()=>{const source=structuredClone(damage),frozen=freezeDamages([source]);source.marker.x=60;source.photos[0].url='changed';expect(frozen[0].marker?.x).toBe(29);expect(frozen[0].photos?.[0].url).toContain('data:image');});
 it('verwendet eingefrorene neue Schäden und ergänzt keine späteren Angaben in ältere Kopien',()=>{const data=seed(),h={id:'h',snapshot:{new_damages:[damage]}} as Handover;expect(protocolDamages(data,h)).toEqual([damage]);data.damages.push({...damage,organization_id:data.organization.id,vehicle_id:data.vehicles[0].id,handover_id:'h',created_at:''});expect(protocolDamages(data,{id:'h'} as Handover)).toHaveLength(1);expect(protocolDamages(data,{...h,snapshot:{...h.snapshot!,new_damages:[]}})).toEqual([]);});
 it('verlangt nach geänderten Schäden erneut beide Unterschriften und rendert nur geprüfte Koordinaten',()=>{const data=seed(),d=initialProtocol(data,data.vehicles[0],data.orders[0],'pickup');d.parties.giver.signature='signed';d.parties.receiver.signature='signed';const next=updateProtocol(d,{damages:[damage]});expect(next.parties.giver.signature).toBe('');expect(next.parties.receiver.signature).toBe('');const svg=damageDiagramSvg([damage],[{...damage,id:'bad',marker:{x:Infinity,y:0}}]);expect(svg).toContain('B1');expect(svg).not.toContain('N1');expect(svg).not.toContain('Infinity');});
});
