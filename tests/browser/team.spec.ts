import { expect, test } from '@playwright/test';

test('Team-Einladungslink erstellen, wiederherstellen und widerrufen', async ({ page }, testInfo) => {
 await page.goto('/'); await page.getByRole('button', { name: 'Organisation', exact: true }).click();
 await page.getByLabel('Name', { exact: true }).fill('Team Test'); await page.getByLabel('E-Mail', { exact: true }).fill('team@example.com'); await page.getByRole('combobox', { name: 'Rolle', exact: true }).selectOption('driver'); await page.getByRole('button', { name: 'Einladungslink erstellen' }).click();
 await expect(page.getByLabel('Einladungslink', { exact: true })).toHaveValue(/\?invite=[a-f0-9]{64}$/); await expect(page.getByText('Team Test', { exact: true })).toBeVisible(); await page.screenshot({ path: testInfo.outputPath('team.png'), fullPage: true });
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
 await page.reload(); await page.getByRole('button', { name: 'Organisation', exact: true }).click(); await expect(page.getByText('Team Test', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Einladung widerrufen' }).click(); await expect(page.getByText('Keine offenen Einladungen.', { exact: true })).toBeVisible();
});

test('Der letzte Administrator kann nicht entfernt oder herabgestuft werden', async ({ page }) => {
 await page.goto('/'); await page.getByRole('button', { name: 'Organisation', exact: true }).click(); await page.getByLabel('Rolle für Alex Morgan', { exact: true }).selectOption('viewer'); await page.getByRole('button', { name: 'Änderung bestätigen' }).click(); await expect(page.getByRole('main').getByRole('alert')).toContainText('Mindestens ein Administrator'); await page.getByRole('button', { name: 'Abbrechen', exact: true }).click(); await page.getByRole('button', { name: 'Alex Morgan entfernen', exact: true }).click(); await page.getByRole('button', { name: 'Änderung bestätigen' }).click(); await expect(page.getByRole('main').getByRole('alert')).toContainText('Mindestens ein Administrator');
});

