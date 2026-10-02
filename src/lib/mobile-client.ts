import { mobileId, MobileEnvironment } from './mobile-import-domain';

export async function fetchSellerAds(account:string,environment:MobileEnvironment,username:string,password:string,fetcher:typeof fetch=fetch):Promise<unknown> {
 if(!mobileId(account)||!['production','sandbox'].includes(environment)||!username||username.length>200||username.includes(':')||!password||password.length>300)throw Error('Händler-ID und Seller-API-Zugangsdaten prüfen.');
 const origin=environment==='sandbox'?'https://services.sandbox.mobile.de':'https://services.mobile.de';
 const response=await fetcher(`${origin}/seller-api/sellers/${account}/ads`,{headers:{Accept:'application/vnd.de.mobile.api+json',Authorization:'Basic '+Buffer.from(username+':'+password).toString('base64')},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
 if([401,403,404].includes(response.status))throw Error('Zugang oder Händlerfreigabe wurde abgewiesen. Händler-ID und Seller-API-Freischaltung prüfen.');
 if(response.status===429)throw Error('mobile.de meldet zu viele Abrufe. Bitte später erneut versuchen.');
 if(!response.ok)throw Error('mobile.de-Bestand derzeit nicht erreichbar. Bitte erneut versuchen.');
 const reader=response.body?.getReader();if(!reader)throw Error('mobile.de hat keine Bestandsdaten geliefert.');
 const parts:Uint8Array[]=[];let size=0;
 try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>2*1024*1024)throw Error('Bestandsantwort ist größer als 2 MB. Bitte einen begrenzten Export verwenden.');parts.push(chunk.value);}}catch(error){await reader.cancel();throw error;}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('mobile.de hat keine gültigen JSON-Bestandsdaten geliefert.');}
}
