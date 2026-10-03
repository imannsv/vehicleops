import {test,expect} from '@playwright/test';

test('Erster Standort wird direkt mit mehreren Stellplätzen eingerichtet und bleibt gespeichert',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Bestand',exact:true}).click();
 await page.getByRole('button',{name:'Standort einrichten',exact:true}).click();
 await page.getByLabel('Standortname').fill('Verkaufshof');await page.getByLabel('Standortanschrift').fill('Hauptstraße 1');
 await page.getByLabel('Stellplätze anlegen (optional)',{exact:true}).selectOption('range');
 await expect(page.getByText('20 neue Stellplätze',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Erste Nummer')).toHaveAttribute('inputmode','numeric');
 await expect(page.getByLabel('Letzte Nummer')).toHaveAttribute('inputmode','numeric');
 await page.getByRole('button',{name:'Standort speichern',exact:true}).click();
 const card=page.locator('.site-card');await expect(card.locator('.space-row')).toHaveCount(20);
 await expect(card.locator('.site-total')).toContainText('20 Stellplätze');await expect(card.locator('.space-row').first()).toContainText('A-01');
 await page.reload();await page.getByRole('button',{name:'Standorte',exact:true}).click();await expect(card.locator('.space-row')).toHaveCount(20);
 await page.screenshot({path:info.outputPath('parking-setup.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.getByRole('button',{name:'Bestand',exact:true}).click();await expect(page.getByRole('button',{name:'Standort einrichten',exact:true})).toHaveCount(0);
});

test('Bereiche ergänzen, vorhandene Plätze überspringen, Liste und Einzelbearbeitung',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Standorte',exact:true}).click();
 await page.getByLabel('Standortname').fill('Hof');await page.getByLabel('Stellplätze anlegen (optional)',{exact:true}).selectOption('range');
 await page.getByRole('button',{name:'Standort speichern',exact:true}).click();const card=page.locator('.site-card');
 await card.getByRole('button',{name:'Mehrere Stellplätze anlegen',exact:true}).click();
 await card.getByLabel('Erste Nummer').fill('10');await card.getByLabel('Letzte Nummer').fill('25');
 await expect(card.getByText('5 neue Stellplätze',{exact:true})).toBeVisible();await expect(card.getByText('11 bereits vorhanden – werden übersprungen.')).toBeVisible();
 await card.getByRole('button',{name:'5 Stellplätze anlegen',exact:true}).click();await expect(card.locator('.site-total')).toContainText('25 Stellplätze');
 await expect(card.locator('.space-row')).toHaveCount(20);await card.getByRole('button',{name:'Weitere Stellplätze anzeigen (5)'}).click();await expect(card.locator('.space-row')).toHaveCount(25);
 await card.getByRole('button',{name:'Mehrere Stellplätze anlegen',exact:true}).click();await card.getByLabel('Stellplätze anlegen',{exact:true}).selectOption('list');
 await card.getByLabel('Stellplatzbezeichnungen').fill('A-01\nWerkstatt links\n\nWerkstatt links\nVerkaufsfläche 2');
 await expect(card.getByText('2 neue Stellplätze',{exact:true})).toBeVisible();await expect(card.getByText('1 doppelte Bezeichnungen in der Liste – werden nur einmal angelegt.')).toBeVisible();
 await page.screenshot({path:info.outputPath('parking-list-preview.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await card.getByRole('button',{name:'2 Stellplätze anlegen',exact:true}).click();await expect(card.locator('.site-total')).toContainText('27 Stellplätze');
 await card.getByLabel('Stellplätze in Hof suchen').fill('werkstatt');await expect(card.locator('.space-row')).toHaveCount(1);
 await card.getByRole('button',{name:'Stellplatz Werkstatt links bearbeiten',exact:true}).click();await card.getByLabel('Stellplatz bearbeiten',{exact:true}).fill('Werkstatt rechts');await card.getByRole('button',{name:'Stellplatz speichern',exact:true}).click();
 await expect(card.locator('.space-row')).toContainText('Werkstatt rechts');await expect(card.locator('.space-row')).not.toContainText('Werkstatt links');
 await card.getByRole('button',{name:'Mehrere Stellplätze anlegen',exact:true}).click();await expect(card.getByRole('button',{name:'0 Stellplätze anlegen'})).toBeDisabled();
 await expect(card.getByText('Alle angegebenen Stellplätze sind bereits vorhanden.')).toBeVisible();
});

test('Ungültige Nummernreihen blockieren die Anlage, Stellplätze können später folgen',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Standorte',exact:true}).click();await page.getByLabel('Standortname').fill('Ohne Pflichtplätze');
 await page.getByLabel('Stellplätze anlegen (optional)',{exact:true}).selectOption('range');await page.getByLabel('Letzte Nummer').fill('201');
 await expect(page.getByText('Bitte höchstens 200 Stellplätze auf einmal anlegen.')).toBeVisible();await expect(page.getByRole('button',{name:'Standort speichern',exact:true})).toBeDisabled();
 await page.getByLabel('Letzte Nummer').fill('0');await expect(page.getByText('Die letzte Nummer muss mindestens so groß wie die erste sein.')).toBeVisible();
 await page.getByLabel('Stellplätze anlegen (optional)',{exact:true}).selectOption('none');await page.getByRole('button',{name:'Standort speichern',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Ohne Pflichtplätze',exact:true})).toBeVisible();await expect(page.locator('.space-row')).toHaveCount(0);
});
