'use client';
import { useId, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { normalizeName } from '@/lib/vehicle-catalog';
import { BrandLogo } from './brand-logo';
export function CatalogPicker({label,name,value,onChange,options,logos=false,disabled=false}: {
 label:string;name:string;value:string;onChange:(value:string)=>void;options:{name:string;key?:string}[];logos?:boolean;disabled?:boolean;
}) {
 const id=useId(), input=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false), [query,setQuery]=useState(''), [active,setActive]=useState(0);
 const matches=options.filter(item=>normalizeName(item.name).includes(normalizeName(query)) || !!item.key && normalizeName(item.key).includes(normalizeName(query)));
 function choose(next:string) {onChange(next);setOpen(false);input.current?.focus();}
 return <div className="catalog-field">
  <label htmlFor={id}>{label}</label>
  <div className="catalog-input">{logos && <BrandLogo make={value} />}
   <input ref={input} id={id} name={name} value={value} required maxLength={120} disabled={disabled} role="combobox" aria-expanded={open} aria-controls={id+'-options'} aria-autocomplete="list" aria-activedescendant={open && matches[active] ? id+'-'+active : undefined} autoComplete="off" placeholder={disabled?'Zuerst Hersteller wählen':label+' auswählen'} onFocus={()=>{setQuery(value);setActive(0);setOpen(true);}} onBlur={()=>setOpen(false)} onChange={e=>{onChange(e.target.value);setQuery(e.target.value);setActive(0);setOpen(true);}} onKeyDown={e=>{
    if(e.key==='Escape' && open){e.preventDefault();e.stopPropagation();setOpen(false);}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);const next=Math.max(0,Math.min(matches.length-1,active+(e.key==='ArrowDown'?1:-1)));setActive(next);document.getElementById(id+'-'+next)?.scrollIntoView({block:'nearest'});}
    if(e.key==='Enter' && open){e.preventDefault();if(matches[active])choose(matches[active].name);else setOpen(false);}
   }} />
   <button type="button" className="catalog-toggle" aria-label={label+'-Liste öffnen'} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>{input.current?.focus();setQuery('');setActive(0);setOpen(!open);}}><ChevronDown size={17}/></button>
  </div>
  {open && !disabled && <div className="catalog-popover"><div id={id+'-options'} role="listbox" aria-label={label+' auswählen'} className="catalog-options">{matches.map((item,index)=><button type="button" tabIndex={-1} role="option" id={id+'-'+index} aria-selected={value===item.name} className={active===index?'active':''} key={item.name} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(item.name)}>{logos && <BrandLogo make={item.name}/>}<span>{item.name}</span>{value===item.name && <Check size={15}/>}</button>)}</div><p className="muted small">{matches.length ? matches.length+' Treffer · Tippen zum Suchen' : 'Kein Treffer.'} Nicht gelistet? Namen direkt eingeben.</p></div>}
 </div>;
}
