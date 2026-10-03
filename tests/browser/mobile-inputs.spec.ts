import {test,expect,Page} from '@playwright/test';

async function touchFields(page:Page,mobile:boolean){
 if(!mobile)return;
 const small=await page.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select').evaluateAll(fields=>fields.filter(field=>field.getClientRects().length&&getComputedStyle(field).visibility!=='hidden'&&parseFloat(getComputedStyle(field).fontSize)<16).map(field=>field.outerHTML));
 expect(small).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
}
test('Mobile Eingabegrößen und passende Tastaturen in Fahrzeug, Protokoll und Unternehmen',async({page},info)=>{
 const mobile=info.project.name==='mobile';await page.goto('/');
 const viewport=await page.locator('meta[name=viewport]').getAttribute('content');expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1(?:,|$)/);
 await page.getByRole('button',{name:'Fahrzeuge',exact:true}).click();await touchFields(page,mobile);
 await page.getByRole('button',{name:'Fahrzeug hinzufügen',exact:true}).click();await expect(page.getByLabel('Kilometerstand',{exact:true})).toHaveAttribute('inputmode','numeric');await expect(page.getByLabel('Baujahr (optional)')).toHaveAttribute('inputmode','numeric');await expect(page.getByLabel('Kennzeichen-Zahlen')).toHaveAttribute('inputmode','numeric');await touchFields(page,mobile);
 if(mobile){await expect(page.getByLabel('Kennzeichen-Zahlen')).toHaveCSS('font-size','36px');await page.getByLabel('Farbe',{exact:true}).focus();expect(await page.evaluate(()=>window.visualViewport?.scale)).toBe(1);}
 await page.getByRole('combobox',{name:'Hersteller',exact:true}).click();await touchFields(page,mobile);await page.getByLabel('Farbe',{exact:true}).click();await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
 await page.getByRole('button',{name:'Volkswagen Golf Variant',exact:true}).click();await page.getByRole('button',{name:'Übernahme am Fahrzeug',exact:true}).click();await expect(page.getByLabel('Kilometerstand',{exact:true})).toHaveAttribute('inputmode','numeric');await expect(page.getByLabel('Tank-/Ladestand (%)')).toHaveAttribute('inputmode','numeric');await touchFields(page,mobile);
 await page.getByRole('button',{name:'Zurück zum Fahrzeug',exact:true}).click();await page.getByRole('button',{name:'Organisation',exact:true}).click();await page.getByRole('button',{name:'Unternehmen bearbeiten',exact:true}).click();await expect(page.getByLabel('Telefon des Unternehmens',{exact:true})).toHaveAttribute('type','tel');await expect(page.getByLabel('Postleitzahl',{exact:true})).toHaveAttribute('inputmode','numeric');await touchFields(page,mobile);
});

test('Fahrzeug ohne Begründung umsetzen und Historie nach Neuladen behalten',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Fahrzeuge',exact:true}).click();await page.getByRole('button',{name:'Volkswagen Golf Variant',exact:true}).click();await page.getByRole('button',{name:'Fahrzeug umsetzen',exact:true}).click();await expect(page.getByLabel('Anlass der Bewegung (optional)',{exact:true})).not.toHaveAttribute('required','');await page.getByLabel('Standortangabe',{exact:true}).fill('Werkstatt ohne Anlass');await page.getByRole('button',{name:'Bewegung speichern'}).click();await expect(page.locator('.current-position')).toContainText('Werkstatt ohne Anlass');await expect(page.locator('.movement-row')).toContainText('Fahrzeug umgesetzt');await expect(page.locator('.movement-row')).toContainText('Alex Morgan');
 await page.reload();await page.getByRole('button',{name:'Fahrzeuge',exact:true}).click();await page.getByRole('button',{name:'Volkswagen Golf Variant',exact:true}).click();await expect(page.locator('.movement-row')).toHaveCount(1);await expect(page.locator('.current-position')).toContainText('Werkstatt ohne Anlass');await expect(page.locator('.movement-row')).toContainText('Fahrzeug umgesetzt');
});
