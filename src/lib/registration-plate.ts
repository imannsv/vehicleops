import data from '../data/registration-codes.json';
export interface PlateParts { district:string; letters:string; number:string; suffix:string }
export function splitPlate(value:string): PlateParts|null {
 const normalized=value.trim().toUpperCase();
 const separated=normalized.match(/^([A-ZÄÖÜ]{1,3})[\s-]+([A-Z]{1,2})[\s-]*(\d{1,4})([EH]?)$/);
 if(!separated)return null;
 return {district:separated[1],letters:separated[2],number:separated[3],suffix:separated[4]};
}
export function joinPlate(parts:PlateParts) { return [parts.district,parts.letters,parts.number+parts.suffix].filter(Boolean).join(' '); }
export function registrationDistrict(prefix:string) {
 const codes:Record<string,{name:string;state:string;historic?:boolean}[]>=data.codes;
 return codes[prefix.trim().toUpperCase()]??[];
}
