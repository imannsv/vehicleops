// New-company setup, batch creation and a lost server response on the local stack.
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {chromium,devices,expect} from '@playwright/test';
const status=JSON.parse(execFileSync(process.platform==='win32'?'npx.cmd':'npx',['supabase','status','--output','json'],{encoding:'utf8',shell:process.platform==='win32',stdio:['ignore','pipe','pipe']}));
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false}}),users=[],orgs=[],browser=await chromium.launch();
const ok=result=>{if(result.error)throw Error(result.error.message);return result.data;};
async function account(){const email='parking-browser-'+crypto.randomUUID()+'@example.com',password=crypto.randomUUID()+'Aa1!';const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user);return{email,password,user};}
async function login(page,account){await page.goto('http://localhost:3000/');await page.getByLabel('E-Mail',{exact:true}).fill(account.email);await page.getByLabel('Passwort',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();}
try {
 for(const device of ['desktop','mobile']){
  const owner=await account(),viewer=await account(),context=await browser.newContext(device==='mobile'?devices['Pixel 7']:{}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await login(page,owner);
  await expect(page.getByRole('heading',{name:'Organisation einrichten',exact:true})).toBeVisible();
  await page.getByLabel('Unternehmen',{exact:true}).fill('Neues Unternehmen '+device);await page.getByLabel('Dein Name',{exact:true}).fill('Owner');await page.getByRole('button',{name:'Organisation erstellen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Standort einrichten',exact:true})).toBeVisible();
  const org=ok(await admin.from('memberships').select('organization_id').eq('user_id',owner.user.id).single()).organization_id;orgs.push(org);
  await page.getByRole('button',{name:'Standort einrichten',exact:true}).click();await page.getByLabel('Standortname').fill('Neuer Hof');await page.getByLabel('Standortanschrift').fill('Teststraße 1');
  await page.getByLabel('Stellplätze anlegen (optional)',{exact:true}).selectOption('range');
  let lostResponse=true;
  await page.route('**/rest/v1/rpc/create_fleet_site_with_spaces',async route=>{
   if(lostResponse){lostResponse=false;const response=await route.fetch();expect(response.ok()).toBe(true);await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Verbindung unterbrochen. Bitte erneut versuchen.'})});}else await route.continue();
  });
  await page.getByRole('button',{name:'Standort speichern',exact:true}).click();await expect(page.locator('#site-editor').getByRole('alert')).toContainText('Verbindung unterbrochen');
  expect(ok(await admin.from('fleet_sites').select('id').eq('organization_id',org))).toHaveLength(1);
  expect(ok(await admin.from('parking_spaces').select('id').eq('organization_id',org))).toHaveLength(20);
  await expect(page.getByLabel('Standortname')).toHaveValue('Neuer Hof');await expect(page.getByLabel('Letzte Nummer')).toHaveValue('20');
  await page.getByRole('button',{name:'Standort speichern',exact:true}).click();const card=page.locator('.site-card');await expect(card.locator('.space-row')).toHaveCount(20);
  expect(ok(await admin.from('parking_spaces').select('id').eq('organization_id',org))).toHaveLength(20);
  await card.getByRole('button',{name:'Mehrere Stellplätze anlegen',exact:true}).click();await card.getByLabel('Stellplätze anlegen',{exact:true}).selectOption('list');
  await card.getByLabel('Stellplatzbezeichnungen').fill('A-01\nWerkstatt\nWerkstatt\nAnlieferung');await expect(card.getByText('2 neue Stellplätze',{exact:true})).toBeVisible();await card.getByRole('button',{name:'2 Stellplätze anlegen',exact:true}).click();await expect(card.locator('.site-total')).toContainText('22 Stellplätze');
  await page.reload();await page.getByRole('button',{name:'Standorte',exact:true}).click();await expect(card.locator('.site-total')).toContainText('22 Stellplätze');await card.getByLabel('Stellplätze in Neuer Hof suchen').fill('werkstatt');await expect(card.locator('.space-row')).toHaveCount(1);
  const bays=ok(await admin.from('parking_spaces').select('*').eq('organization_id',org));expect(new Set(bays.map(bay=>bay.label)).size).toBe(22);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  if(device==='mobile')expect(await page.getByLabel('Stellplätze in Neuer Hof suchen').evaluate(input=>parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
  await card.getByLabel('Stellplätze in Neuer Hof suchen').fill('');
  let lostArchiveResponse=true;
  await page.route('**/rest/v1/rpc/set_fleet_archived',async route=>{
   if(lostArchiveResponse){lostArchiveResponse=false;const response=await route.fetch();expect(response.ok()).toBe(true);await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Archivantwort verloren. Bitte erneut versuchen.'})});}else await route.continue();
  });
  await card.getByRole('button',{name:'Stellplatz A-01 archivieren',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Archivieren bestätigen'}).click();await expect(dialog.getByRole('alert')).toContainText('Archivantwort verloren');
  const archivedBay=ok(await admin.from('parking_spaces').select('*').eq('organization_id',org).eq('label','A-01').single());expect(archivedBay.archived_at).toBeTruthy();
  await dialog.getByRole('button',{name:'Archivieren bestätigen'}).click();await expect(dialog).toHaveCount(0);await expect(card.locator('.site-total')).toContainText('21 Stellplätze');
  expect(ok(await admin.from('parking_spaces').select('revision').eq('id',archivedBay.id).single()).revision).toBe(archivedBay.revision);
  await card.getByRole('button',{name:'Standort Neuer Hof archivieren',exact:true}).click();await dialog.getByRole('button',{name:'Archivieren bestätigen'}).click();await expect(card).toHaveCount(0);await page.reload();await page.getByRole('button',{name:'Standorte',exact:true}).click();await page.getByRole('button',{name:'Archivierte Standorte (1)',exact:true}).click();await expect(card.locator('.space-row')).toHaveCount(20);await expect(card.locator('.site-total')).toContainText('22 Stellplätze · Standort archiviert');
  await card.getByRole('button',{name:'Standort Neuer Hof wiederherstellen',exact:true}).click();await dialog.getByRole('button',{name:'Wiederherstellen',exact:true}).click();await page.getByRole('button',{name:'Aktive Standorte (1)',exact:true}).click();await expect(card.locator('.site-total')).toContainText('21 Stellplätze');
  await card.getByRole('button',{name:'Archivierte Stellplätze anzeigen (1)'}).click();await expect(card.locator('.space-row')).toHaveCount(1);await card.getByRole('button',{name:'Stellplatz A-01 wiederherstellen',exact:true}).click();await dialog.getByRole('button',{name:'Wiederherstellen',exact:true}).click();await card.getByRole('button',{name:'Aktive Stellplätze anzeigen'}).click();await expect(card.locator('.site-total')).toContainText('22 Stellplätze');
  ok(await admin.from('memberships').insert({organization_id:org,user_id:viewer.user.id,name:'Viewer',role:'viewer'}));
  const readContext=await browser.newContext(),read=await readContext.newPage();await login(read,viewer);await read.getByRole('button',{name:'Standorte',exact:true}).click();await expect(read.getByRole('heading',{name:'Neuer Hof',exact:true})).toBeVisible();await expect(read.getByRole('button',{name:'Mehrere Stellplätze anlegen',exact:true})).toHaveCount(0);await expect(read.getByRole('button',{name:'Standort einrichten',exact:true})).toHaveCount(0);await expect(read.getByRole('button',{name:'Stellplatz hinzufügen',exact:true})).toHaveCount(0);
  await expect(read.getByRole('button',{name:/archivieren|wiederherstellen/})).toHaveCount(0);
  expect(errors).toEqual([]);await readContext.close();await context.close();
 }
 console.log('PASS: new-account onboarding, desktop/mobile bulk setup, lost creation/archive response retries without duplicates, site archive/reload/restore preserving individually archived bays, bay restore, search and viewer read-only UI');
} finally {
 await browser.close();for(const org of orgs){for(const table of ['parking_spaces','fleet_sites','memberships'])ok(await admin.from(table).delete().eq('organization_id',org));ok(await admin.from('organizations').delete().eq('id',org));}for(const user of users)ok(await admin.auth.admin.deleteUser(user.id));
}
