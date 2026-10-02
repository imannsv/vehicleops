import {CompanyProfile,Data,Organization,Vehicle,StockStatus} from './domain';
import {supabase} from './supabase';
import {loadCloud,mutateDemo} from './repository';
import type {Json} from './database.types';
export const businessLabels={dealer:'Autohaus',transfer:'Überführer',combined:'Kombiniert'};
export const stockLabels:Record<StockStatus,string>={stock:'Im Bestand',reserved:'Reserviert',sold:'Verkauft',rented:'Vermietet'};
export function vehicleTitle(v:Vehicle){return [v.make,v.model,v.generation].filter(Boolean).join(' ');}
export function vehicleIdentity(v:Vehicle){return v.plate||v.stock_number||v.vin;}
export const profileFields:[keyof CompanyProfile,string][]=[['legal_form','Rechtsform'],['management','Inhaber / Geschäftsführung'],['street','Straße und Hausnummer'],['postal_code','Postleitzahl'],['city','Ort'],['country','Land'],['email','E-Mail des Unternehmens'],['phone','Telefon des Unternehmens'],['website','Webseite'],['tax_number','Steuernummer'],['vat_id','USt-ID'],['register_court','Registergericht'],['register_number','Handelsregisternummer']];
export async function companyLogo(org:Organization,cloud:boolean){if(!org.logo_path)return '';if(!cloud)return org.logo_url??'';const r=await supabase!.storage.from('company-logos').createSignedUrl(org.logo_path,300);if(r.error)throw Error(r.error.message);return r.data.signedUrl;}
export async function normalizedImage(file:File,maxSide=1024){if(!file.size||file.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Bitte JPEG, PNG oder WebP bis 10 MB auswählen.');const bitmap=await createImageBitmap(file);const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/png');}
export async function saveCompany(data:Data,org:Organization,file:File|null,remove:boolean,cloud:boolean):Promise<Data>{
 if(!org.name.trim()||org.name.length>120)throw Error('Bitte einen Firmennamen angeben.');
 if(Object.values(org.profile??{}).some(v=>typeof v!=='string'||v.length>300))throw Error('Firmenangaben sind zu lang.');
 if(org.profile?.website&&!/^https?:\/\//.test(org.profile.website))throw Error('Webseite benötigt http oder https.');
 let path=remove?null:org.logo_path??null,url=remove?'':org.logo_url;
 if(file){url=await normalizedImage(file);path=org.id+'/'+crypto.randomUUID()+'.png';if(cloud){const form=new FormData();form.set('organization_id',org.id);form.set('logo',new File([await(await fetch(url)).blob()],'logo.png',{type:'image/png'}));const token=(await supabase!.auth.getSession()).data.session?.access_token;const response=await fetch('/api/company-logo',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});const result=await response.json();if(!response.ok)throw Error(result.error);path=result.path;}}
 if(cloud){const r=await supabase!.rpc('save_company',{p_org:org.id,p_revision:org.revision??1,p_name:org.name,p_type:org.business_type??'combined',p_profile:(org.profile??{}) as Json,p_logo:path as unknown as string});if(r.error)throw Error(r.error.message);return(await loadCloud(org.id))!;}
 return mutateDemo(latest=>{if((latest.organization.revision??1)!==(org.revision??1))throw Error('Unternehmen wurde inzwischen geändert. Bitte neu laden.');return{...latest,organization:{...org,logo_path:path,logo_url:url,revision:(org.revision??1)+1}};});
}
