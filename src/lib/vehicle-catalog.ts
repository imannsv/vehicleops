import catalog from '../data/vehicle-catalog.json';
export const makes = catalog.makes;
export const normalizeName = (value: string) => value.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
export function findMake(value: string) {
 const normalized = normalizeName(value);
 return makes.find(make => normalizeName(make.name) === normalized || normalizeName(make.key) === normalized);
}
const additionalEquipment = [
 ['CLIMATE_MANUAL','Klimaanlage'], ['CLIMATE_AUTO','Klimaautomatik'], ['CLIMATE_2_ZONE','2-Zonen-Klimaautomatik'], ['CLIMATE_3_ZONE','3-Zonen-Klimaautomatik'], ['CLIMATE_4_ZONE','4-Zonen-Klimaautomatik'],
 ['CRUISE_CONTROL','Tempomat'], ['ADAPTIVE_CRUISE_CONTROL','Abstandstempomat'],
 ['PARKING_FRONT','Einparkhilfe vorne'], ['PARKING_REAR','Einparkhilfe hinten'], ['REAR_CAMERA','Rückfahrkamera'], ['CAMERA_360','360°-Kamera'], ['PARKING_SELF_STEERING','Selbstlenkende Einparkhilfe'],
 ['LED_HEADLIGHTS','LED-Scheinwerfer'], ['XENON_HEADLIGHTS','Xenonscheinwerfer'], ['BI_XENON_HEADLIGHTS','Bi-Xenon Scheinwerfer'], ['LASER_HEADLIGHTS','Laserlicht'], ['LED_DAYTIME_LIGHTS','LED-Tagfahrlicht'], ['ADAPTIVE_CORNERING_LIGHTS','Adaptives Kurvenlicht'],
 ['LEATHER_INTERIOR','Vollleder'], ['PART_LEATHER_INTERIOR','Teilleder'], ['ALCANTARA_INTERIOR','Alcantara'], ['FABRIC_INTERIOR','Stoff'],
 ['TRAILER_HITCH_FIXED','Anhängerkupplung fest'], ['TRAILER_HITCH_REMOVABLE','Anhängerkupplung abnehmbar'], ['TRAILER_HITCH_SWIVEL','Anhängerkupplung schwenkbar'], ['ALL_WHEEL_DRIVE','Allradantrieb']
].map(([key,name]) => ({key,name}));
export const equipment = [...catalog.equipment, ...additionalEquipment].sort((a,b) => a.name.localeCompare(b.name,'de'));
export function equipmentLabel(key: string) { return equipment.find(item => item.key === key)?.name ?? key; }
export function validateVehicleExtras(vehicle: { equipment?: string[]; equipment_notes?: string; variant?: string }) {
 const selected = vehicle.equipment ?? [];
 if (!Array.isArray(selected) || selected.length > equipment.length || new Set(selected).size !== selected.length || selected.some(key => !equipment.some(item => item.key === key))) throw new Error('Die Ausstattung enthält ungültige oder doppelte Einträge.');
 if ((vehicle.variant ?? '').length > 120 || (vehicle.equipment_notes ?? '').length > 2000) throw new Error('Ausführung oder zusätzliche Ausstattung ist zu lang.');
}
export const equipmentGroups = [
 { name:'Sicherheit & Assistenz', match:/ABS|ESP|MONITOR|WARNING|AVOIDANCE|ISOFIX|ASSIST|RECOGNITION|EMERGENCY|IMMOBILIZER|ALARM|TRACTION|CRUISE|PARKING|CAMERA|SPEED_LIMITER/ },
 { name:'Infotainment & Kommunikation', match:/ANDROID|CARPLAY|BLUETOOTH|CD_|PHONE|COCKPIT|HEAD_UP|MUSIC|NAVIGATION|COMPUTER|SOUND|TOUCHSCREEN|USB|VOICE|WIFI|CHARGING|^TV$/ },
 { name:'Komfort & Innenraum', match:/CLIMATE|HEAT|SEAT|ARM_REST|MIRROR|WINDOWS$|KEYLESS|LOCKING|STEERING|LUMBAR|MASSAGE|LEATHER|INTERIOR|SKI|SMOKER|CARGO/ },
 { name:'Licht & Außenbereich', match:/LIGHT|XENON|LED_|LASER|HEADLIGHT|SENSOR|ROOF|TIRE|WHEEL|TAILGATE|TRAILER|TINTED|METALLIC|COLOR|SUSPENSION|CHASSIS|PERFORMANCE/ },
 { name:'Weitere Merkmale', match:/.*/ }
];
export function equipmentGroup(key: string) { return equipmentGroups.find(group => group.match.test(key))!.name; }
