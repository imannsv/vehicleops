import type { Data, Vehicle } from './domain';
import { findMake } from './vehicle-catalog';

export type MobileEnvironment='production'|'sandbox';
export interface ExternalListing {
 id:string;organization_id:string;vehicle_id:string;platform:'mobile_de';environment:MobileEnvironment;account_id:string;remote_id:string;metadata:Record<string,unknown>;created_at:string;
}
export interface ImportRun {id:string;organization_id:string;account_id:string;environment:MobileEnvironment;created_at:string;created_count:number;linked_count:number;request_hash?:string}
export interface MobileRow {
 key:string;new_vehicle_id:string;remote_id:string;account_id:string;vin:string;make:string;model:string;variant:string;color:string;mileage:number|null;build_year:number|null;registration_month:string;image_count:number;seller_stock_number:string;warnings:string[];
}
export interface ImportEntry {action:'create'|'link';vehicle_id:string;revision:number;remote_id:string;values:Record<string,unknown>;metadata:Record<string,unknown>}
export interface ImportPayload {account_id:string;environment:MobileEnvironment;entries:ImportEntry[]}
export interface ImportPlan {row:MobileRow;action:'create'|'link'|'linked'|'blocked';vehicle?:Vehicle;errors:string[]}

const idPattern=/^[1-9][0-9]{0,29}$/;
export function mobileId(value:unknown):string {const text=typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';return idPattern.test(text)?text:'';}
const colors:Record<string,string>={BLACK:'Schwarz',WHITE:'Weiß',SILVER:'Silber',GREY:'Grau',BLUE:'Blau',RED:'Rot',GREEN:'Grün',BROWN:'Braun',BEIGE:'Beige',YELLOW:'Gelb',ORANGE:'Orange',GOLD:'Gold',PURPLE:'Violett'};
function text(row:Record<string,unknown>,key:string,max=120){return typeof row[key]==='string'?row[key].trim().slice(0,max):'';}
export function parseMobileAds(input:unknown,account:string):MobileRow[] {
 if(!mobileId(account))throw Error('Bitte die numerische mobile.de-Händler-ID angeben.');
 const ads=input&&typeof input==='object'&&!Array.isArray(input)?(input as Record<string,unknown>).ads:undefined;
 if(!Array.isArray(ads)||ads.length>1000)throw Error('Erwartet wird eine Seller-API-Datei mit einer Liste „ads“ (maximal 1.000 Einträge).');
 return ads.map((value,index)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Ungültiger Eintrag in der Importdatei.');
  const ad=value as Record<string,unknown>,make=findMake(text(ad,'make')),model=make?.models.find(m=>m.key===ad.model),warnings:string[]=[];
  const month=text(ad,'firstRegistration',20),validMonth=/^\d{4}(0[1-9]|1[0-2])$/.test(month)&&month<=new Date().toISOString().slice(0,7).replace('-','')&&month>='190001';
  if(month)warnings.push(validMonth?'Erstzulassung ist nur als Monat bekannt; kein Tagesdatum wird ergänzt.':'Ungültiger Erstzulassungsmonat wird nicht übernommen.');
  const year=typeof ad.constructionYear==='number'&&Number.isInteger(ad.constructionYear)&&ad.constructionYear>=1900&&ad.constructionYear<=new Date().getFullYear()+1?ad.constructionYear:null;
  if(ad.constructionYear!=null&&year===null)warnings.push('Ungültiges Baujahr wird nicht übernommen.');
  if(ad.vehicleClass!=='Car')warnings.push('Diese Iteration unterstützt ausschließlich PKW (Car).');
  const declared=mobileId(ad.mobileSellerId);if(!declared||declared!==account)warnings.push('Händler-ID des Inserats stimmt nicht mit der gewählten Händler-ID überein.');
  return {key:String(index),new_vehicle_id:crypto.randomUUID(),remote_id:mobileId(ad.mobileAdId),account_id:declared,vin:text(ad,'vin',30).toUpperCase(),make:make?.name??text(ad,'make'),model:model?.name??text(ad,'model'),variant:text(ad,'modelDescription'),color:text(ad,'manufacturerColorName')||colors[text(ad,'exteriorColor')]||text(ad,'exteriorColor'),mileage:typeof ad.mileage==='number'&&Number.isSafeInteger(ad.mileage)&&ad.mileage>=0&&ad.mileage<=2147483647?ad.mileage:null,build_year:year,registration_month:validMonth?month:'',image_count:Array.isArray(ad.images)?ad.images.length:0,seller_stock_number:text(ad,'internalNumber',40),warnings};
 });
}
export function planMobileImport(data:Data,rows:MobileRow[],links:ExternalListing[],account:string,environment:MobileEnvironment):ImportPlan[] {
 return rows.map(row=>{
  const errors:string[]=[];
  if(!row.remote_id)errors.push('Inserat-ID fehlt oder ist ungültig.');
  if(row.account_id!==account)errors.push('Abweichende oder fehlende Händler-ID.');
  if(row.warnings.some(w=>w.includes('ausschließlich PKW')))errors.push('Fahrzeugklasse wird nicht unterstützt.');
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(row.vin))errors.push('Eine gültige VIN mit 17 Zeichen ergänzen.');
  if(rows.some(other=>other.key!==row.key&&other.remote_id===row.remote_id))errors.push('Inserat-ID mehrfach in der Vorschau.');
  if(row.vin&&rows.some(other=>other.key!==row.key&&other.vin===row.vin))errors.push('VIN mehrfach in der Vorschau.');
  const listing=links.find(link=>link.account_id===account&&link.environment===environment&&link.remote_id===row.remote_id),vehicle=data.vehicles.find(v=>v.vin===row.vin);
  if(listing){const linked=data.vehicles.find(v=>v.id===listing.vehicle_id);if(!linked||linked.vin!==row.vin)errors.push('Inserat ist mit einem anderen Fahrzeug verknüpft.');return{row,vehicle:linked,errors,action:errors.length?'blocked':'linked'};}
  if(!vehicle){if(!row.make||!row.model)errors.push('Hersteller und Modell ergänzen.');if(row.mileage===null||!Number.isSafeInteger(row.mileage)||row.mileage<0||row.mileage>2147483647)errors.push('Kilometerstand ergänzen.');if(!row.color)errors.push('Farbe ergänzen.');}
  return {row,vehicle,errors,action:errors.length?'blocked':vehicle?'link':'create'};
 });
}
export function buildMobileImport(plans:ImportPlan[],selected:string[],account:string,environment:MobileEnvironment,location:string,ownership:Vehicle['inventory_kind']):ImportPayload {
 if(!mobileId(account)||!['production','sandbox'].includes(environment))throw Error('Händler-ID oder Umgebung ungültig.');
 const chosen=plans.filter(plan=>selected.includes(plan.row.key));
 if(!chosen.length||chosen.length>100)throw Error('Bitte 1 bis 100 Einträge auswählen.');
 if(chosen.some(plan=>plan.action==='blocked'||plan.action==='linked'))throw Error('Bitte die markierten Angaben prüfen.');
 if(chosen.some(plan=>plan.action==='create')&&(!location.trim()||location.trim().length>240))throw Error('Bitte die tatsächliche Position der neuen Fahrzeuge angeben.');
 if(!['unassigned','owned','customer'].includes(ownership??''))throw Error('Bitte eine Bestandszuordnung wählen.');
 return {account_id:account,environment,entries:chosen.map(({row,vehicle,action})=>({action:action as 'create'|'link',vehicle_id:vehicle?.id??row.new_vehicle_id,revision:vehicle?(vehicle.revision??1):0,remote_id:row.remote_id,values:{vin:row.vin,make:row.make,model:row.model,variant:row.variant,color:row.color,mileage:row.mileage,build_year:row.build_year,location:location.trim(),inventory_kind:ownership,inventory_status:ownership==='owned'?'stock':null},metadata:{first_registration_month:row.registration_month,seller_stock_number:row.seller_stock_number,image_count:row.image_count}}))};
}
