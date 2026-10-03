// Read-only check of the public login; OS keyboards and Safari focus zoom require a real device.
import {chromium,devices,expect} from '@playwright/test';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({...devices['Pixel 7']});await page.goto(process.env.VEHICLEOPS_BASE_URL??'http://localhost:3000/');await expect(page.getByRole('heading',{name:'Willkommen zurück'})).toBeVisible();
 const fonts=await page.locator('input').evaluateAll(fields=>fields.filter(field=>field.getClientRects().length&&field.type!=='hidden').map(field=>parseFloat(getComputedStyle(field).fontSize)));expect(fonts.length).toBeGreaterThan(0);expect(fonts.every(size=>size>=16)).toBe(true);await page.getByLabel('Passwort',{exact:true}).focus();expect(await page.evaluate(()=>window.visualViewport?.scale)).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 console.log('PASS: public mobile login input sizes, unchanged emulated focus scale and responsive layout');
}finally{await browser.close();}
