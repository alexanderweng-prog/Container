// Flow-Training im Browser
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, demoOeffnen, sicher, vorwissenUeberspringen } = require('./hilfen');

let fehler;
test.beforeEach(({ page }) => { fehler = fehlerSammeln(page); });
test.afterEach(() => expect(fehler, 'Fehler im Browser').toEqual([]));

// Beantwortet die angezeigte Frage richtig oder falsch (Lösung aus den Paketdaten)
async function beantworten(page, richtig) {
  const loesung = await page.evaluate(() => {
    const frage = document.querySelector('.flow-aufgabe .frage')?.innerText || '';
    const satz = document.querySelector('.flow-aufgabe .luecken-text');
    for (const p of JSON.parse(localStorage.getItem('lernapp.pakete') || '[]').concat([LA.DEMO])) {
      for (const [, k] of LA.karten(LA.paketPruefen(structuredClone(p)))) {
        if (k.art === 'mc' && frage.includes(k.frage.frage)) return { opt: k.frage.optionen[k.frage.richtig] };
        if (k.art === 'wf' && frage.includes(k.aussage.aussage)) return { opt: k.aussage.wahr ? 'Wahr' : 'Falsch' };
        if (k.art === 'kat' && frage.includes('«' + k.begriff.begriff + '»')) return { opt: k.begriff.kategorie };
        if (k.art === 'begriff' && frage.includes(k.begriff.erklaerung)) return { ein: k.begriff.begriff };
        if (k.art === 'luecke' && satz) {
          const vor = satz.childNodes[0].textContent.trim();
          const textOhne = k.text.replace(/\{\{(.+?)\}\}/g, (m, w) => w);
          if (vor && textOhne.includes(vor.slice(-25) + ' ' + k.loesung)) return { ein: k.loesung };
        }
      }
    }
    return null;
  });
  expect(loesung, 'Lösung zur Frage gefunden').not.toBeNull();
  const a = page.locator('.flow-aufgabe');
  if (loesung.opt) {
    if (richtig) await a.locator('.option', { hasText: new RegExp('^' + loesung.opt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
    else await a.locator('.option').filter({ hasNotText: new RegExp('^' + loesung.opt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
  } else {
    await a.locator('input[type=text]').fill(richtig ? loesung.ein : 'xyzxyz');
    await a.getByRole('button', { name: 'Prüfen' }).click();
  }
  await sicher(page);
  await page.locator('.flow-aufgabe .reihe.rechts .knopf').click();
}

test('Eine Runde Flow-Training: Anzeige, Auswertung, Stufe in der Übersicht, Lernkartei', async ({ page }) => {
  await demoOeffnen(page);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.locator('.flow-karte').click();
  await expect(page.locator('.flow-pill')).toHaveText('Messung läuft');
  for (let i = 0; i < 12; i++) {
    await expect(page.locator('.flow-punkte i.jetzt')).toHaveCount(1);
    await beantworten(page, i % 4 !== 3); // 75 % richtig
    if (i === 6) await expect(page.locator('.flow-pill')).not.toHaveText('Messung läuft');
  }
  await expect(page.locator('.ergebnis-zahl')).toHaveText('9 / 12');
  await expect(page.locator('.ergebnis h2')).toHaveText('Genau im Flow.');
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(page.locator('.flow-karte .spiel-stand')).toHaveText(/Stufe \d+/);
  // Falsche Antworten landen auch in der Lernkartei
  await expect(page.locator('.spiel.faellig')).toContainText('fällig');
});

test('Sehr schwache Runde: Hinweis auf den Lernpfad', async ({ page }) => {
  await demoOeffnen(page);
  await page.locator('.flow-karte').click();
  for (let i = 0; i < 12; i++) await beantworten(page, false);
  await expect(page.locator('.ergebnis')).toContainText('Lernpfad');
  await page.getByRole('button', { name: 'Zum Lernpfad' }).click();
  await vorwissenUeberspringen(page);
  await expect(page.locator('.spielflaeche h2')).toBeVisible();
  await expect(page.locator('.label').first()).toHaveText('Schritt 1 von 3');
});

test('Mit Niveaus: starke Lernende bekommen Fragen aus Niveau 3, Empfehlung am Reiter', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const pakete = [1, 2, 3].map((n) => Object.assign(LA.paketPruefen(structuredClone(LA.DEMO)), { id: 'n' + n, gruppe: 'g1', niveau: n, kurzbeschreibung: 'Fassung ' + n }));
    localStorage.setItem('lernapp.pakete', JSON.stringify(pakete));
    localStorage.setItem('lernapp.niveau.g1', '2');
    localStorage.setItem('lernapp.flow.g1', JSON.stringify({ theta: 92, n: 30, verlauf: [] })); // starkes Können
  });
  await page.reload();
  await page.locator('.karte').click();
  await expect(page.locator('.niveau-tab.empfohlen')).toContainText('Niveau 3');
  await expect(page.locator('.flow-karte')).toContainText('allen Niveaus');
  await page.locator('.flow-karte').click();
  const niveaus = [];
  for (let i = 0; i < 6; i++) {
    niveaus.push(await page.locator('.flow-kopf .tag', { hasText: /^●+$/ }).innerText());
    await beantworten(page, true);
  }
  expect(niveaus.filter((n) => n === '●●●').length, niveaus.join(' ')).toBeGreaterThanOrEqual(4);
});
