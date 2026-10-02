'use client';
import { useId, useState } from 'react';
import { MapPin } from 'lucide-react';
import { joinPlate, registrationDistrict, splitPlate, PlateParts } from '@/lib/registration-plate';
function EuropeBand() {
 return <span className="plate-europe" aria-hidden="true"><svg viewBox="0 0 36 32">{Array.from({length:12},(_,index)=>{const angle=index*Math.PI/6;return <g key={index} transform={'translate('+(18+Math.sin(angle)*10)+','+(16-Math.cos(angle)*10)+')'}><path d="M0-2 0.6-0.6 2-0.6 0.9 0.3 1.3 1.8 0 0.9-1.3 1.8-0.9 0.3-2-0.6-0.6-0.6Z" fill="#ffdc39"/></g>;})}</svg><strong>D</strong></span>;
}
export function RegistrationPlate({initial=''}:{initial?:string}) {
 const id=useId(), parsed=splitPlate(initial);
 const [parts,setParts]=useState<PlateParts>(parsed??{district:'',letters:'',number:'',suffix:''});
 const [free,setFree]=useState(!!initial&&!parsed),[custom,setCustom]=useState(initial);
 const districts=registrationDistrict(free?'':parts.district);
 const value=free?custom.trim().toUpperCase():joinPlate(parts);
 function change(key:keyof PlateParts,value:string) {
  const cleaned=value.toUpperCase().replace(key==='district'?/[^A-ZÄÖÜ]/g:key==='number'?/[^0-9]/g:/[^A-Z]/g,'');
  setParts(previous=>({...previous,[key]:cleaned}));
 }
 function paste(event:React.ClipboardEvent<HTMLInputElement>) {
  const pasted=splitPlate(event.clipboardData.getData('text'));
  if(pasted){event.preventDefault();setParts(pasted);}
 }
 function switchMode() {
  if(!free){setCustom(joinPlate(parts));setFree(true);}
  else{const next=splitPlate(custom);if(next)setParts(next);setFree(false);}
 }
 return <div className="span-2 plate-field" role="group" aria-labelledby={id+'-title'}>
  <div className="plate-heading"><span id={id+'-title'}>Kennzeichen</span><button type="button" className="text-button" onClick={switchMode}>{free?'Deutsches Kennzeichen':'Andere Kennzeichen'}</button></div>
  {free?<label>Vollständiges Kennzeichen<input name="plate" required maxLength={20} value={custom} onChange={e=>setCustom(e.target.value.toUpperCase())} placeholder="Kennzeichen eingeben"/></label>:<>
   <div className="registration-plate">
    <EuropeBand/>
    <input aria-label="Ortskürzel" aria-describedby={id+'-district'} className="plate-district" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={3} pattern="[A-ZÄÖÜ]{1,3}" placeholder="H" value={parts.district} onChange={e=>change('district',e.target.value)} onPaste={paste}/>
    <span className="plate-seals" aria-hidden="true"><i/><i/></span>
    <input aria-label="Kennzeichen-Buchstaben" className="plate-letters" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={2} pattern="[A-Z]{1,2}" placeholder="AB" value={parts.letters} onChange={e=>change('letters',e.target.value)} onPaste={paste}/>
    <input aria-label="Kennzeichen-Zahlen" className="plate-number" autoComplete="off" inputMode="numeric" required maxLength={4} pattern="[0-9]{1,4}" placeholder="1234" value={parts.number} onChange={e=>change('number',e.target.value)} onPaste={paste}/>
    {parts.suffix && <span className="plate-suffix" aria-hidden="true">{parts.suffix}</span>}
   </div>
   <input name="plate" type="hidden" value={value}/>
   <div className="plate-footer"><p id={id+'-district'} className="plate-city" aria-live="polite"><MapPin size={13}/><span>{!parts.district?'Ortskürzel eingeben – Stadt oder Region wird erkannt.':districts.length?districts.map(district=>district.name).join(' / '):'Zulassungsbezirk nicht erkannt'}</span></p><label className="plate-suffix-select"><span className="sr-only">Kennzeichen-Zusatz</span><select aria-label="Kennzeichen-Zusatz" value={parts.suffix} onChange={e=>setParts(previous=>({...previous,suffix:e.target.value}))}><option value="">Ohne Zusatz</option><option value="E">E · Elektro</option><option value="H">H · Oldtimer</option></select></label></div>
  </>}
 </div>;
}
