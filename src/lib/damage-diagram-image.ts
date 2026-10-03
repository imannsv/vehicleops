import { RecordedDamage } from './domain';
import { validDamageMarker } from './damages';

/** Fixed geometry; only validated numeric coordinates and generated labels enter SVG. */
export function damageDiagramSvg(known:RecordedDamage[],fresh:RecordedDamage[]) {
  const pins=[...known.map((d,i)=>({d,label:'B'+(i+1),color:'#51677e'})),...fresh.map((d,i)=>({d,label:'N'+(i+1),color:'#c65319'}))]
    .filter(p=>validDamageMarker(p.d.marker)).map(({d,label,color})=>`<g><circle cx="${d.marker!.x*2.2}" cy="${d.marker!.y*4.2}" r="15" fill="${color}" stroke="white" stroke-width="2"/><text x="${d.marker!.x*2.2}" y="${d.marker!.y*4.2+4}" text-anchor="middle" font-family="Arial" font-size="11" fill="white">${label}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="840" viewBox="0 0 220 420"><rect width="220" height="420" fill="white"/><g fill="#243349"><rect x="29" y="83" width="16" height="58" rx="5"/><rect x="175" y="83" width="16" height="58" rx="5"/><rect x="29" y="282" width="16" height="57" rx="5"/><rect x="175" y="282" width="16" height="57" rx="5"/></g><path d="M46 56 Q50 22 79 18 Q110 12 141 18 Q170 22 174 56 L181 105 L179 327 Q176 384 157 398 Q110 412 63 398 Q44 384 41 327 L39 105 Z" fill="#e2eaf1" stroke="#8b9eb3" stroke-width="2"/><path d="M66 120 Q110 112 154 120 L161 167 Q110 151 59 167 Z M60 301 Q110 316 160 301 L155 343 Q110 354 65 343 Z" fill="#344e68"/><path d="M65 175 Q110 159 155 175 L151 286 Q110 299 69 286 Z" fill="#f0f4f8" stroke="#a8bacb"/><path d="M54 172 L59 191 L62 281 L51 300 Z M166 172 L161 191 L158 281 L169 300 Z" fill="#2e455d"/><path d="M54 365 L74 373 L72 383 L54 378 Z M166 365 L146 373 L148 383 L166 378 Z" fill="#d66870"/>${pins}</svg>`;
}
export async function damageDiagramImage(known:RecordedDamage[],fresh:RecordedDamage[]) {
  const url=URL.createObjectURL(new Blob([damageDiagramSvg(known,fresh)],{type:'image/svg+xml'}));
  try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=440;canvas.height=840;canvas.getContext('2d')!.drawImage(image,0,0);return canvas.toDataURL('image/png');}
  finally{URL.revokeObjectURL(url);}
}
