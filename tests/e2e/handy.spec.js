// Handyansicht: nichts darf seitlich über den Bildschirm hinausragen
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, demoOeffnen, spielOeffnen, zurueck } = require('./hilfen');

test('Kein seitliches Scrollen in Übersicht und Spielen', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await demoOeffnen(page);
  const ueberlauf = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await ueberlauf()).toBeLessThanOrEqual(0);
  for (const spiel of ['Lernpfad', 'Kreuzworträtsel', 'Memory', 'Lückentext', 'Zuordnen', 'Reihenfolge']) {
    await spielOeffnen(page, spiel);
    expect(await ueberlauf(), spiel).toBeLessThanOrEqual(0);
    await zurueck(page);
  }
  expect(fehler).toEqual([]);
});

test('Kreuzworträtsel passt ohne seitliches Scrollen ins Gitter', async ({ page }) => {
  await demoOeffnen(page);
  await spielOeffnen(page, 'Kreuzworträtsel');
  const wrap = page.locator('.kw-wrap');
  await expect.poll(() => wrap.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
});
