// Sicherung aller Pakete und Kurzlinks in einer Datei, Wiederherstellen auf einem «neuen» Gerät
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { fehlerSammeln } = require('./hilfen');

test('Alle Pakete sichern, Browser leeren, Sicherung einlesen', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await page.goto('/');
  await page.evaluate(() => {
    const p = (id, titel) => Object.assign(LA.paketPruefen(structuredClone(LA.DEMO)), { id, titel, quelle: 'ki' });
    localStorage.setItem('lernapp.pakete', JSON.stringify([p('p1', 'Paket Eins'), p('p2', 'Paket Zwei')]));
    localStorage.setItem('lernapp.kurzlinks', JSON.stringify([{ code: 'abc2345', token: 't'.repeat(32), auswahl: 'paket:p1', titel: 'Paket Eins', klasse: '2a', erstellt: '2026-11-20T08:00:00Z' }]));
    localStorage.setItem('lernapp.einstellungen', JSON.stringify({ apiKey: 'sk-ant-GEHEIM', klassenCode: 'wasser7b' }));
  });
  await page.reload();
  // Erinnerung, solange nie gesichert
  await expect(page.locator('.sicherung-hinweis')).toContainText('noch nie gesichert');

  const download = page.waitForEvent('download');
  await page.locator('.sicherung-hinweis').getByRole('button', { name: 'Jetzt sichern' }).click();
  const datei = await download;
  expect(datei.suggestedFilename()).toMatch(/^lernwerkstatt-sicherung-\d{4}-\d{2}-\d{2}\.json$/);
  const pfad = await datei.path();
  const inhalt = fs.readFileSync(pfad, 'utf8');
  const daten = JSON.parse(inhalt);
  expect(daten.typ).toBe('lernwerkstatt-sicherung');
  expect(daten.pakete.map((p) => p.id)).toEqual(['p1', 'p2']);
  expect(daten.kurzlinks[0]).toMatchObject({ code: 'abc2345', klasse: '2a' });
  expect(inhalt).not.toContain('sk-ant-GEHEIM');
  expect(inhalt).not.toContain('wasser7b');
  await expect(page.locator('.sicherung-hinweis')).toHaveCount(0);
  await expect(page.getByText('Letzte Sicherung: heute.')).toBeVisible();

  // «Neues Gerät»: alles weg, dann Sicherung einlesen
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.karte')).toHaveCount(0);
  await page.locator('input[type=file][accept*="json"]').setInputFiles(pfad);
  await expect(page.locator('.toast').last()).toContainText('eingelesen: 2 Pakete, 1 Kurzlink');
  await expect(page.locator('.karte')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '🔗 Meine Kurzlinks' })).toBeVisible();
  const token = await page.evaluate(() => LA.kurzlinksAlle()[0].token);
  expect(token).toBe('t'.repeat(32));

  // Nochmals einlesen: vorhandene Pakete nur nach Rückfrage ersetzen
  page.once('dialog', (d) => d.dismiss());
  await page.locator('input[type=file][accept*="json"]').setInputFiles(pfad);
  await expect(page.locator('.toast').last()).toContainText('eingelesen: 0 Pakete');
  await expect(page.locator('.karte')).toHaveCount(2);
  expect(fehler).toEqual([]);
});
