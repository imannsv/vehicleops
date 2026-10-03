'use client';
import { useState } from 'react';
import { Damage } from '@/lib/domain';
import { DamageDiagram } from './damage-diagram';
import { DamageCards } from './damage-cards';
export function VehicleDamages({damages,cloud}:{damages:Damage[];cloud:boolean}) {
  const [selected,setSelected]=useState('');
  return <section className="panel vehicle-damages"><div className="section-heading"><div><h2>Dokumentierte Schäden</h2><p className="muted">Aus abgeschlossenen Übernahmen und Übergaben.</p></div><span className="badge">{damages.length}</span></div>{!damages.length?<p className="muted">Keine Schäden dokumentiert.</p>:<div className="damage-editor-layout"><DamageDiagram known={damages} onSelect={setSelected}/><DamageCards damages={damages} cloud={cloud} label="Schaden" selected={selected}/></div>}</section>;
}
