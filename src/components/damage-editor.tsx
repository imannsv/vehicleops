'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { DamageDraft, DamageMarker, RecordedDamage } from '@/lib/domain';
import { compressDamagePhoto, damageArea, damageZones } from '@/lib/damages';
import { DamageDiagram } from './damage-diagram';
import { DamageCards } from './damage-cards';

export function DamageEditor({known,damages,cloud,onChange,onProcessing}:{known:RecordedDamage[];damages:DamageDraft[];cloud:boolean;onChange:(damages:DamageDraft[])=>void;onProcessing:(delta:number)=>void}) {
  const [moving,setMoving]=useState(''),[selected,setSelected]=useState(''),[error,setError]=useState('');
  function update(id:string,patch:Partial<DamageDraft>){setError('');onChange(damages.map(d=>d.id===id?{...d,...patch}:d));}
  function add(marker?:DamageMarker,area=marker?damageArea(marker):'') {
    setError('');
    if(moving&&marker){update(moving,{marker,area});setMoving('');return;}
    if(damages.length>=50){setError('Höchstens 50 neue Schäden je Protokoll.');return;}
    const id=crypto.randomUUID();onChange([...damages,{id,area,description:'',marker:marker??null,photos:[]}]);setSelected(id);
  }
  async function photos(id:string,files:File[]) {
    setError('');const damage=damages.find(d=>d.id===id);if(!damage)return;
    if((damage.photos?.length??0)+files.length>10){setError('Höchstens zehn Detailfotos je Schaden.');return;}
    onProcessing(1);
    try{const images=await Promise.all(files.map(async file=>({id:crypto.randomUUID(),url:await compressDamagePhoto(file)})));update(id,{photos:[...(damage.photos??[]),...images]});}
    catch(e){setError(e instanceof Error?e.message:'Schadenfotos konnten nicht gelesen werden. Bitte erneut auswählen.');}
    finally{onProcessing(-1);}
  }
  return <><div className="damage-editor-layout"><div><DamageDiagram known={known} fresh={damages as RecordedDamage[]} onMark={marker=>add(marker)} onSelect={id=>{setSelected(id);document.getElementById('damage-'+id)?.scrollIntoView({behavior:'smooth',block:'center'});}}/><p className="muted small">{moving?'Neue Position für die ausgewählte Markierung antippen.':'Am Fahrzeug tippen, um einen neuen Schaden anzulegen. Details und Innenraumschäden lassen sich auch über den Bereich erfassen.'}</p>{moving&&<button type="button" className="text-button" onClick={()=>setMoving('')}>Versetzen abbrechen</button>}<div className="damage-zone-buttons" aria-label="Schadenbereich auswählen">{damageZones.map(zone=><button type="button" className="secondary" key={zone.area} onClick={()=>add({x:zone.x,y:zone.y},zone.area)}>{zone.area}</button>)}<button type="button" className="secondary" onClick={()=>{setMoving('');add(undefined,'Innenraum');}}>Innenraum</button></div></div>
    <div><h3>Bekannte Schäden</h3>{!known.length?<p className="muted">Keine bisherigen Schäden dokumentiert.</p>:<DamageCards damages={known} cloud={cloud} label="Bekannt" selected={selected}/>}<h3 className="mt">Neue Schäden</h3>{error&&<p className="alert" role="alert">{error}</p>}{!damages.length&&<p className="muted">Noch keine neuen Schäden erfasst.</p>}
    {damages.map((damage,index)=><section className="damage-card damage-edit-card" id={'damage-'+damage.id} key={damage.id}>
      <div className="section-heading"><h4>Neuer Schaden {index+1}</h4><button type="button" className="icon-button" aria-label={`Schaden ${index+1} entfernen`} onClick={()=>{onChange(damages.filter(d=>d.id!==damage.id));if(moving===damage.id)setMoving('');}}><Trash2 size={17}/></button></div>
      <label>Bereich<input aria-label={`Bereich Schaden ${index+1}`} value={damage.area} maxLength={120} onChange={e=>update(damage.id!,{area:e.target.value})} placeholder="z. B. Felge vorne rechts"/></label>
      <label>Beschreibung<textarea aria-label={`Beschreibung Schaden ${index+1}`} value={damage.description} maxLength={2000} onChange={e=>update(damage.id!,{description:e.target.value})} placeholder="Art und Umfang des Schadens"/></label>
      <div className="damage-image-actions"><button type="button" className="text-button" onClick={()=>setMoving(damage.id!)}>{damage.marker?'Markierung versetzen':'Am Fahrzeug markieren'}</button>{damage.marker&&<button type="button" className="text-button" onClick={()=>update(damage.id!,{marker:null})}>Markierung entfernen</button>}</div>
      <p className="muted small">{damage.photos?.length??0} / 10 Detailfotos · Ergänzend zum Pflicht-Rundgang</p><div className="damage-photo-grid">{damage.photos?.map((photo,i)=><figure key={photo.id}><Image src={photo.url} alt={`Schaden ${index+1}, Detailfoto ${i+1}`} width={320} height={240} unoptimized/><button type="button" className="icon-button" aria-label={`Detailfoto ${i+1} von Schaden ${index+1} entfernen`} onClick={()=>update(damage.id!,{photos:damage.photos?.filter(p=>p.id!==photo.id)})}><Trash2 size={16}/></button></figure>)}</div>
      <div className="damage-image-actions"><label className="secondary damage-file-picker"><Plus size={16}/>Bilder hinzufügen<input aria-label={`Detailfotos Schaden ${index+1}`} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';if(files.length)void photos(damage.id!,files);}}/></label><label className="secondary damage-file-picker"><Camera size={16}/>Foto aufnehmen<input aria-label={`Detailfoto Schaden ${index+1} aufnehmen`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';if(files.length)void photos(damage.id!,files);}}/></label></div>
    </section>)}<button type="button" className="secondary" onClick={()=>{setMoving('');add();}}><Plus size={16}/>Schaden hinzufügen</button></div></div></>;
}
