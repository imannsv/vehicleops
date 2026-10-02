import {test,expect} from '@playwright/test';
import {fillPlate} from './plate-helper';
test('Kennzeichen in Abschnitten eingeben, Stadt erkennen und nach Neuladen bearbeiten',async({page},testInfo)=>{
 await page.goto('/');await page.getByRole('button',{name:'Fahrzeuge',exact:true}).click();await page.getByRole('button',{name:'Fahrzeug hinzufügen'}).click();
 await page.getByRole('button',{name:'Speichern',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('Ortskürzel',{exact:true}).fill('h');await expect(page.getByLabel('Ortskürzel',{exact:true})).toHaveValue('H');await expect(page.locator('.plate-city')).toContainText('Hannover');
 await page.getByLabel('Kennzeichen-Buchstaben',{exact:true}).fill('ab');await page.getByLabel('Kennzeichen-Zahlen',{exact:true}).fill('0123');await page.getByLabel('Kennzeichen-Zusatz',{exact:true}).selectOption('E');
 await page.locator('.plate-field').screenshot({path:testInfo.outputPath('registration-plate.png')});
 await page.getByLabel('VIN',{exact:true}).fill('WVWZZZ3CZPE777777');await page.getByLabel('Hersteller',{exact:true}).fill('Volkswagen');await page.getByRole('option',{name:'Volkswagen',exact:true}).click();await page.getByLabel('Modell',{exact:true}).fill('Golf');await page.getByRole('option',{name:'Golf',exact:true}).click();await page.getByLabel('Farbe',{exact:true}).fill('Schwarz');await page.getByLabel('Kilometerstand',{exact:true}).fill('100');await page.getByLabel('Standort',{exact:true}).fill('Hannover');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await page.getByRole('button',{name:'Speichern',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.reload();await page.getByRole('button',{name:'Fahrzeuge',exact:true}).click();await page.getByRole('button',{name:'Volkswagen Golf',exact:true}).click();await page.getByRole('button',{name:'Fahrzeug bearbeiten'}).click();
 await expect(page.getByLabel('Ortskürzel',{exact:true})).toHaveValue('H');await expect(page.getByLabel('Kennzeichen-Buchstaben',{exact:true})).toHaveValue('AB');await expect(page.getByLabel('Kennzeichen-Zahlen',{exact:true})).toHaveValue('0123');await expect(page.getByLabel('Kennzeichen-Zusatz',{exact:true})).toHaveValue('E');
 await page.getByLabel('Ortskürzel',{exact:true}).fill('M');await expect(page.locator('.plate-city')).toContainText('München');await page.getByRole('button',{name:'Speichern',exact:true}).click();await expect(page.getByText('M AB 0123E', { exact:true})).toBeVisible();
});
test('Umlaute, mehrdeutige Bezirke und freie Kennzeichen bleiben verwendbar',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Fahrzeuge',exact:true}).click();await page.getByRole('button',{name:'Volkswagen Golf Variant',exact:true}).click();await page.getByRole('button',{name:'Fahrzeug bearbeiten'}).click();
 await expect(page.getByLabel('Ortskürzel',{exact:true})).toHaveValue('B');await expect(page.locator('.plate-city')).toContainText('Berlin');
 await fillPlate(page,'DÜW AB 42');await expect(page.locator('.plate-city')).toContainText('Bad Dürkheim');
 await page.getByLabel('Ortskürzel',{exact:true}).fill('BK');await expect(page.locator('.plate-city')).toContainText('Backnang');await expect(page.locator('.plate-city')).toContainText('Börde');
 await page.getByLabel('Ortskürzel',{exact:true}).fill('ZZZ');await expect(page.locator('.plate-city')).toContainText('nicht erkannt');
 await page.getByRole('button',{name:'Andere Kennzeichen',exact:true}).click();await page.getByLabel('Vollständiges Kennzeichen',{exact:true}).fill('AB-123-CD');await page.getByRole('button',{name:'Speichern',exact:true}).click();await expect(page.getByText('AB-123-CD', { exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Fahrzeug bearbeiten'}).click();await expect(page.getByLabel('Vollständiges Kennzeichen',{exact:true})).toHaveValue('AB-123-CD');
});
