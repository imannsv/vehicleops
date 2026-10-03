'use client';
import { DamageMarker, RecordedDamage } from '@/lib/domain';
import { VehicleIllustration } from './photo-walkaround';
import { validDamageMarker } from '@/lib/damages';

export function DamageDiagram({known=[],fresh=[],onMark,onSelect}:{
  known?:RecordedDamage[];fresh?:RecordedDamage[];onMark?:(marker:DamageMarker)=>void;onSelect?:(id:string)=>void;
}) {
  const marks=[...known.map((damage,index)=>({damage,index:index+1,known:true})),...fresh.map((damage,index)=>({damage,index:index+1,known:false}))];
  return <div className="damage-diagram-wrap"><p className="muted small damage-orientation">Vorne ↑ · Fahrzeug links / rechts wie im Rundgang</p><div className="damage-diagram">
    <VehicleIllustration/>
    {onMark&&<button type="button" className="damage-map-target" aria-label="Neuen Schaden am Fahrzeug markieren" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();onMark(e.detail===0?{x:50,y:50}:{x:Math.round((e.clientX-rect.left)/rect.width*10000)/100,y:Math.round((e.clientY-rect.top)/rect.height*10000)/100});}}/>}
    {marks.filter(m=>validDamageMarker(m.damage.marker)).map(({damage,index,known})=>{
      const marker=damage.marker!;return <button type="button" key={(known?'known:':'new:')+damage.id} className={'damage-pin '+(known?'known':'fresh')} style={{left:marker.x+'%',top:marker.y+'%'}} aria-label={`${known?'Bekannter':'Neuer'} Schaden ${index}: ${damage.area}`} onClick={()=>onSelect?.(damage.id)}>{known?'B':'N'}{index}</button>;
    })}
  </div><div className="damage-map-legend"><span><i className="known"/>Bekannt ({known.length})</span><span><i className="fresh"/>Neu ({fresh.length})</span></div></div>;
}
