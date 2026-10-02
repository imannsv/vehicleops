// Public mobile.de reference data; app usage reads a local snapshot, never scrapes listings.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const root = new URL('../', import.meta.url);
const endpoint = 'https://services.mobile.de/refdata';
async function json(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'de' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.json();
}
const items = data => data.reference.item.map(item => ({ key: item['@key'], name: item['local-description']['$'] }));
const makes = items(await json(`${endpoint}/sites/GERMANY/classes/Car/makes`));
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < makes.length) {
    const make = makes[cursor++];
    make.models = items(await json(`${endpoint}/classes/Car/makes/${encodeURIComponent(make.key)}/models`));
  }
}));
const equipment = items(await json(`${endpoint}/classes/Car/features`));
const logos = await json('https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/data.json');
const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const aliases = { ALFA: 'Alfa Romeo', LAND_ROVER: 'Land Rover', MERCEDES_BENZ: 'Mercedes-Benz', VW: 'Volkswagen', CITROEN: 'Citroën', SKODA: 'Škoda', DS: 'DS', BAIC: 'BAIC Motor', CORVETTE: 'Chevrolet Corvette' };
await mkdir(new URL('public/brands/', root), { recursive: true });
for (const make of makes) {
  const logo = logos.find(logo => normalize(logo.name) === normalize(aliases[make.key] ?? make.name));
  if (!logo) continue;
  const response = await fetch(logo.image.optimized, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Logo ${make.name}: ${response.status}`);
  const filename = make.key.toLowerCase() + '.webp';
  await writeFile(new URL('public/brands/' + filename, root), await sharp(Buffer.from(await response.arrayBuffer())).resize(96, 64, { fit: 'inside', withoutEnlargement: true }).webp().toBuffer());
  make.logo = '/brands/' + filename;
  make.logoSource = logo.image.source;
}
await mkdir(new URL('src/data/', root), { recursive: true });
const catalog = { source: `${endpoint}/sites/GERMANY/classes/Car/makes`, retrievedAt: new Date().toISOString(), vehicleClass: 'Car', makes, equipment };
await writeFile(new URL('src/data/vehicle-catalog.json', root), JSON.stringify(catalog, null, 2) + '\n');
console.log(`${makes.length} makes, ${makes.reduce((n, make) => n + make.models.length, 0)} models, ${equipment.length} features, ${makes.filter(make => make.logo).length} logos`);
