import type { Page } from '@playwright/test';
export async function fillPlate(page:Page,value:string) {
 const match=value.match(/^([A-ZÄÖÜ]{1,3})\s+([A-Z]{1,2})\s+(\d{1,4})([EH]?)$/);
 if(!match){await page.getByRole('button',{name:'Andere Kennzeichen',exact:true}).click();await page.getByLabel('Vollständiges Kennzeichen',{exact:true}).fill(value);return;}
 await page.getByLabel('Ortskürzel',{exact:true}).fill(match[1]);await page.getByLabel('Kennzeichen-Buchstaben',{exact:true}).fill(match[2]);await page.getByLabel('Kennzeichen-Zahlen',{exact:true}).fill(match[3]);await page.getByLabel('Kennzeichen-Zusatz',{exact:true}).selectOption(match[4]);
}
