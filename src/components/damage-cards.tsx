'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { DamagePhoto, RecordedDamage } from '@/lib/domain';
import { resolveDamagePhotos } from '@/lib/damages';

export function DamagePhotos({photos,cloud,area}:{photos:DamagePhoto[];cloud:boolean;area:string}) {
  const [resolved,setResolved]=useState<DamagePhoto[]>([]),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    async function refresh(){try{const [damage]=await resolveDamagePhotos([{id:'preview',area,description:'',photos}],cloud);if(active){setResolved(damage.photos??[]);setError('');}}catch(e){if(active)setError(e instanceof Error?e.message:'Detailfotos konnten nicht geladen werden.');}}
    void refresh();const timer=setInterval(()=>void refresh(),240000);return()=>{active=false;clearInterval(timer);};
  },[photos,cloud,area,attempt]);
  if(!photos.length)return <p className="muted small">Keine Detailfotos erfasst.</p>;
  return <>{error&&<p className="alert" role="alert">{error}<button type="button" className="text-button" onClick={()=>setAttempt(n=>n+1)}>Detailfotos erneut laden</button></p>}<div className="damage-photo-grid">{resolved.map((p,index)=><a key={p.id} href={p.url} target="_blank" rel="noreferrer" aria-label={`Detailfoto ${index+1}: ${area} öffnen`}><Image src={p.url} alt={`Detailfoto ${index+1}: ${area}`} width={320} height={240} unoptimized loading="lazy" onError={()=>setError('Detailfoto konnte nicht geladen werden. Bitte erneut laden.')}/></a>)}</div></>;
}
export function DamageCards({damages,cloud,label,selected,onSelect}:{damages:RecordedDamage[];cloud:boolean;label:string;selected?:string;onSelect?:(id:string)=>void}) {
  const [opened,setOpened]=useState<Set<string>>(()=>new Set()),root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(selected){const detail=Array.from(root.current?.querySelectorAll<HTMLDetailsElement>('details')??[]).find(d=>d.dataset.damage===selected);if(detail)detail.open=true;}},[selected]);
  return <div className="damage-cards" ref={root}>{damages.map((damage,index)=>{
    const open=opened.has(damage.id);
    return <details className="damage-card" key={damage.id} data-damage={damage.id} onToggle={e=>{const expanded=e.currentTarget.open;setOpened(current=>{const next=new Set(current);if(expanded)next.add(damage.id);else next.delete(damage.id);return next;});if(expanded)onSelect?.(damage.id);}}>
      <summary><span className="damage-number">{label} {index+1}</span><strong>{damage.area}</strong><span className="muted small">{damage.photos?.length??0} Detailfotos</span></summary>
      <p className="preserve-lines">{damage.description}</p>{open&&<DamagePhotos photos={damage.photos??[]} cloud={cloud} area={damage.area}/>}
    </details>;
  })}</div>;
}
