// Probeprüfungen: Druck/PDF in Versionen (aus dem Paket und mit neuen KI-Fragen), digitale Probeprüfung
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, kiAttrappe, spielOeffnen } = require('./hilfen');

async function paket(page, mitKi) {
  await page.goto('/');
  await page.evaluate((ki) => {
    const p = Object.assign(LA.paketPruefen(structuredClone(LA.DEMO)), { id: 'p1', quelle: 'ki' });
    localStorage.setItem('lernapp.pakete', JSON.stringify([p]));
    if (ki) localStorage.setItem('lernapp.einstellungen', JSON.stringify({ apiKey: 'sk-ant-test' }));
    window.print = () => { window.gedruckt = (window.gedruckt || 0) + 1; };
  }, mitKi);
  await page.reload();
  await page.evaluate(() => { window.print = () => { window.gedruckt = (window.gedruckt || 0) + 1; }; });
  await page.locator('.karte').click();
}

test('Probeprüfung drucken: zwei Versionen mit Punkten, Lösungen und Notenskala', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await paket(page, false);
  await expect(page.getByRole('button', { name: '📄 Drucken / PDF' })).toBeVisible();
  await page.getByRole('button', { name: '📝 Probeprüfung' }).click();
  await expect(page.getByLabel(/Neue Fragen von der KI/)).toBeDisabled(); // ohne KI
  await page.getByRole('spinbutton', { name: 'Multiple Choice' }).fill('3');
  await page.getByRole('spinbutton', { name: 'Wahr oder falsch' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Lücken füllen' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Fachbegriffe nennen' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Denkfragen (Begründen)' }).fill('1');
  await page.getByRole('combobox', { name: 'Notenskala' }).selectOption('60');
  await page.getByRole('button', { name: 'Prüfung erstellen: Drucken / PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.gedruckt)).toBe(1);
  const druck = page.locator('#druckbereich');
  await expect(druck.locator('.pr-blatt:not(.druck-loesung)')).toHaveCount(2);
  await expect(druck.locator('.druck-version')).toHaveText(['Version A', 'Version B']);
  await expect(druck.locator('.pr-blatt').first()).toContainText('Punkte: ____ / 12');
  await expect(druck.locator('.pr-blatt').first().locator('.pr-aufgaben > li')).toHaveCount(10);
  await expect(druck.locator('.druck-loesung')).toHaveCount(2);
  await expect(druck.locator('.pr-skala').first()).toContainText('Notenskala (12 Punkte, Note 4 bei 60 %)');
  await expect(druck.locator('.pr-skala').first()).toContainText('4');
  expect(fehler).toEqual([]);
});

test('Probeprüfung mit neuen KI-Fragen', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  const anfragen = await kiAttrappe(page, () => ({
    multiple_choice: [{ frage: 'NEU: Warum trocknet Wäsche im Wind schneller?', optionen: ['Mehr Verdunstung', 'Mehr Regen', 'Weniger Sonne', 'Kälter'], richtig: 0, erklaerung: 'Wind trägt feuchte Luft weg.', rueckmeldungen: ['', 'a', 'b', 'c'] },
      { frage: 'NEU: Was zeigt beschlagenes Glas?', optionen: ['Kondensation', 'Verdunstung', 'Schmelzen', 'Gefrieren'], richtig: 0, erklaerung: 'Dampf kondensiert am kalten Glas.', rueckmeldungen: ['', 'a', 'b', 'c'] }],
    wahr_falsch: [{ aussage: 'NEU: Pfützen verdunsten nur bei Sonne.', wahr: false, erklaerung: 'Auch ohne Sonne.' }],
    lueckentexte: [], begriffe: [], offene_fragen: [],
  }));
  await paket(page, true);
  await page.getByRole('button', { name: '📝 Probeprüfung' }).click();
  await page.getByLabel(/Neue Fragen von der KI/).check();
  await page.getByRole('combobox', { name: 'Anzahl Versionen' }).selectOption('1');
  for (const [name, n] of [['Multiple Choice', '2'], ['Wahr oder falsch', '1'], ['Lücken füllen', '0'], ['Fachbegriffe nennen', '0'], ['Denkfragen (Begründen)', '0']]) await page.getByRole('spinbutton', { name }).fill(n);
  await page.getByRole('button', { name: 'Prüfung erstellen: Drucken / PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.gedruckt)).toBe(1);
  await expect(page.locator('#druckbereich .pr-blatt').first()).toContainText('NEU: Warum trocknet Wäsche');
  await expect(page.locator('#druckbereich .pr-blatt').first()).not.toContainText('Welcher Vorgang braucht Energie');
  const system = anfragen.at(-1).body.system;
  expect(system).toContain('genau 2 Fragen');
  expect(system).toContain('NEU sein');
  expect(fehler).toEqual([]);
});

test('Digitale Probeprüfung: keine Auflösung bis zur Abgabe, Note am Ende', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await paket(page, false);
  await spielOeffnen(page, 'Probeprüfung');
  await expect(page.locator('.pr-aufgaben.digital > li')).toHaveCount(16);
  // Alle Multiple-Choice-Fragen richtig, den Rest leer lassen
  const richtige = await page.evaluate(() => [...document.querySelectorAll('.pr-aufgaben.digital > li')].map((li) => {
    const t = li.querySelector('.frage').textContent; const q = LA.DEMO.multiple_choice.find((x) => x.frage === t); return q ? q.optionen[q.richtig] : null;
  }));
  for (const [i, r] of richtige.entries()) if (r) await page.locator('.pr-aufgaben.digital > li').nth(i).locator('.option', { hasText: r }).click();
  await expect(page.locator('.option.richtig, .option.falsch')).toHaveCount(0);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Prüfung abgeben' }).click();
  await expect(page.locator('.ergebnis-zahl')).toHaveText(/^Note \d(,5)?$/);
  await expect(page.locator('.ergebnis')).toContainText('6 von 16 Punkten');
  await expect(page.locator('.ergebnis-zahl')).toHaveText('Note 3');
  await expect(page.locator('.pr-auswertung.nein')).toHaveCount(10);
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(page.locator('.spiel', { hasText: 'Probeprüfung' }).locator('.spiel-stand')).toHaveText('6/16');
  expect(fehler).toEqual([]);
});
