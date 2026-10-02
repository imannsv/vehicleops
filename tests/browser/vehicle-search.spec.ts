import { test, expect } from '@playwright/test';

test('Fahrzeugsuche findet Identität und kombinierte Angaben auch ohne Kennzeichen',async({page},info)=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Fahrzeuge',exact:true}).click();
 // Ein nicht zugelassenes Bestandsfahrzeug bleibt über VIN und Bestandsnummer auffindbar.
 await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('vehicleops-demo-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('data','readwrite'),store=tx.objectStore('data'),request=store.get('state');request.onsuccess=()=>{const data=request.result;data.vehicles[1].plate=null;data.vehicles[1].generation='F30';store.put(data,'state');};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  db.close();
 });
 await page.reload();await page.getByRole('button',{name:'Fahrzeuge',exact:true}).click();
 const search=page.getByRole('searchbox',{name:'Fahrzeuge suchen'}),rows=page.locator('tbody tr');
 await expect(rows).toHaveCount(3);
 await search.fill('  b-nm2048  ');await expect(rows).toHaveCount(1);await expect(rows).toContainText('Volkswagen Golf Variant');
 await search.fill('wvwzzz3czpe');await expect(rows).toHaveCount(1);await expect(rows).toContainText('B NM 2048');
 await search.fill('fz000002');await expect(rows).toHaveCount(1);await expect(rows).toContainText('BMW 320d Touring F30');
 await search.fill('  bmw   f30  ');await expect(page.getByRole('heading',{name:'1 von 3 Fahrzeugen'})).toBeVisible();await expect(rows).toHaveCount(1);
 await page.getByRole('button',{name:'BMW 320d Touring F30',exact:true}).click();await expect(page.getByRole('heading',{name:'BMW 320d Touring F30'})).toBeVisible();
 await page.getByRole('button',{name:'← Zurück zu Fahrzeugen',exact:true}).click();await expect(search).toHaveValue('  bmw   f30  ');await expect(rows).toHaveCount(1);
 await search.fill('hamburg');await expect(rows).toHaveCount(1);await expect(rows).toContainText('BMW 320d Touring F30');
 await search.fill('nichtvorhanden');await expect(rows).toHaveCount(0);await expect(page.getByText('Keine Fahrzeuge für diese Suche gefunden.')).toBeVisible();await expect(page.getByRole('heading',{name:'0 von 3 Fahrzeugen'})).toBeVisible();
 await page.getByRole('button',{name:'Fahrzeugsuche löschen'}).click();await expect(search).toHaveValue('');await expect(rows).toHaveCount(3);
 await search.fill('golf berlin');await expect(rows).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('vehicle-search.png'),fullPage:true});
 await page.getByRole('button',{name:'Bestand',exact:true}).click();await page.getByLabel('Bestand durchsuchen').fill('golf berlin');await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText('Volkswagen Golf Variant');
});
