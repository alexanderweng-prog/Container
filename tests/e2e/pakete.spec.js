// Pakete erstellen, teilen, bearbeiten, wiederholen, drucken
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, demoOeffnen, spielOeffnen, zurueck, sicher } = require('./hilfen');

let fehler;
test.beforeEach(async ({ page }) => { fehler = fehlerSammeln(page); });
test.afterEach(() => expect(fehler, 'Fehler im Browser').toEqual([]));

test('Paket ohne KI aus Begriffsliste', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Neues Lernpaket' }).click();
  await page.locator('#otitel').fill('Beinmuskeln');
  await page.locator('#oliste').fill('Strecker > Quadrizeps: streckt das Knie\nBeuger > Hamstrings: beugen das Knie\nStrecker > Wadenmuskel: streckt das Fussgelenk\nBeuger > Hüftbeuger: hebt den Oberschenkel\nStrecker > Gesäss: streckt die Hüfte\nBeuger > Schienbeinmuskel: zieht den Fuss hoch');
  await page.locator('#otext').fill('Der Quadrizeps liegt vorne am Oberschenkel. Er streckt das Knie beim Absprung.\n\nDie Hamstrings liegen hinten und bremsen bei der Landung.');
  await page.getByRole('button', { name: 'Lernpaket erstellen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Beinmuskeln' })).toBeVisible();
  await expect(page.locator('.spiel .spiel-name')).toContainText(['Lernpfad', 'Multiple Choice', 'Memory', 'Lückentext', 'Zuordnen']);
  await spielOeffnen(page, 'Lückentext');
  await expect(page.locator('.luecke')).toHaveCount(2); // Quadrizeps und Hamstrings im eigenen Text
});

test('Teilen-Link öffnet die Schüleransicht ohne Bearbeiten', async ({ page, context }) => {
  await demoOeffnen(page);
  const code = await page.evaluate(() => LA.paketZuLink(LA.DEMO));
  const schueler = await context.newPage();
  fehlerSammeln(schueler);
  await schueler.goto('/#paket=' + code);
  await expect(schueler.getByRole('heading', { level: 1, name: 'Der Wasserkreislauf' })).toBeVisible();
  await expect(schueler.locator('.kopf .tag')).toHaveText('Schüleransicht');
  await expect(schueler.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0);
  await expect(schueler.getByRole('button', { name: 'Drucken' })).toHaveCount(0);
});

test('Kaputter Link: Meldung statt Absturz', async ({ page }) => {
  await page.goto('/#paket=kaputt!!');
  await expect(page.locator('.toast')).toContainText('beschädigt');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lern-App');
});

test('Bearbeiten: Spiel ausschalten und Titel ändern bleibt gespeichert', async ({ page }) => {
  await demoOeffnen(page);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.locator('.formular input[type=text]').first().fill('Wasserkreislauf 7b');
  await page.locator('.schalter', { hasText: 'Memory' }).locator('input').uncheck();
  await page.getByRole('button', { name: 'Speichern', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Wasserkreislauf 7b' })).toBeVisible();
  await expect(page.locator('.spiel', { hasText: 'Memory' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.karte')).toContainText('Wasserkreislauf 7b');
});

test('Lernkartei: Fehler werden fällig, Wiederholung, Fehlerheft', async ({ page }) => {
  await demoOeffnen(page);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  // Eine Wahr/Falsch-Runde mit lauter «Wahr» erzeugt sicher Fehler
  await spielOeffnen(page, 'Wahr oder falsch');
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: 'Wahr', exact: true }).click();
    await sicher(page);
    await page.locator('.reihe.rechts .knopf').click();
  }
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  const faellig = page.locator('.spiel.faellig');
  await expect(faellig).toContainText('3 Karten fällig');

  // Wiederholung: richtige Antworten aus dem Paket holen
  await faellig.click();
  for (let i = 0; i < 3; i++) {
    const aussage = await page.locator('.frage').innerText();
    const wahr = await page.evaluate((t) => LA.DEMO.wahr_falsch.find((a) => t.includes(a.aussage)).wahr, aussage);
    await page.getByRole('button', { name: wahr ? 'Wahr' : 'Falsch', exact: true }).click();
    await sicher(page);
    await page.locator('.reihe.rechts .knopf').click();
  }
  await expect(page.locator('.ergebnis-zahl')).toHaveText('3 / 3');
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(page.locator('.spiel.faellig')).toHaveCount(0);

  await spielOeffnen(page, 'Fehlerheft');
  await expect(page.locator('.fehlerliste li')).toHaveCount(3);
  // Fach 1 leer; Fach 2: die 3 korrigierten plus die 3 von Anfang an richtigen Aussagen
  await expect(page.locator('.stat-fach').nth(0)).toContainText('0');
  await expect(page.locator('.stat-fach').nth(1)).toContainText('6');
});

test('Arbeitsblatt drucken: alle Teile, Lösungsblatt, Kreuzworträtsel mit Gitter', async ({ page }) => {
  await demoOeffnen(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'Drucken' }).click();
  await expect(page.locator('dialog .schalter-raster input:checked')).toHaveCount(10);
  await page.getByRole('button', { name: 'Drucken / PDF' }).click();
  const blatt = page.locator('#druckbereich');
  await expect(blatt.locator('.druck-aufgabe h2').first()).toHaveText('Aufgabe 1: Multiple Choice');
  await expect(blatt.locator('.druck-loesung')).toContainText('Lösungen: Der Wasserkreislauf');
  // Regression: Gitterfelder hatten einmal Breite 0
  await page.emulateMedia({ media: 'print' });
  const zelle = await blatt.locator('.druck-blatt .druck-kw td.voll').first().boundingBox();
  expect(zelle.width).toBeGreaterThan(15);
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  expect(pdf.length).toBeGreaterThan(20_000);
});
