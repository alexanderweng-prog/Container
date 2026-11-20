// Alle Spiele im Demo-Paket: öffnen, spielen, auswerten
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, demoOeffnen, spielOeffnen, zurueck, sicher } = require('./hilfen');

let fehler;
test.beforeEach(async ({ page }) => { fehler = fehlerSammeln(page); await demoOeffnen(page); });
test.afterEach(() => expect(fehler, 'Fehler im Browser').toEqual([]));

test('Übersicht zeigt Lernpfad und alle passenden Spiele', async ({ page }) => {
  await expect(page.locator('.spiel .spiel-name')).toHaveText([
    'Lernpfad', 'Flow-Training', 'Multiple Choice', 'Reihenfolge', 'Kreuzworträtsel', 'Memory', 'Zuordnen', 'Lückentext', 'Wahr oder falsch', 'Denkfragen', 'Schreiben & Korrektur',
  ]);
  // Ohne KI-Schlüssel ist die Textkorrektur als nicht verfügbar markiert
  await expect(page.locator('.spiel', { hasText: 'Schreiben' })).toContainText('braucht KI-Schlüssel');
});

test('Lernpfad: Weiter erst nach der Verständnisfrage, kein «null» im Text', async ({ page }) => {
  await spielOeffnen(page, 'Lernpfad');
  for (let schritt = 1; schritt <= 3; schritt++) {
    await expect(page.locator('.label').first()).toHaveText(`Schritt ${schritt} von 3`);
    await expect(page.locator('.spielflaeche')).not.toContainText('null');
    const weiter = page.locator('.reihe.rechts .knopf');
    await expect(weiter).toBeDisabled();
    await page.locator('.option').first().click();
    await expect(page.locator('.rueckmeldung')).toBeVisible();
    await weiter.click();
  }
  await expect(page.locator('.ergebnis')).toContainText('Lernpfad abgeschlossen');
});

test('Multiple Choice: Rückmeldung und Punktzahl', async ({ page }) => {
  await spielOeffnen(page, 'Multiple Choice');
  for (let i = 0; i < 6; i++) {
    await page.locator('.option').first().click();
    await sicher(page);
    await expect(page.locator('.option.richtig')).toHaveCount(1); // richtige Antwort wird immer markiert
    await page.locator('.reihe.rechts .knopf').click();
  }
  await expect(page.locator('.ergebnis-zahl')).toHaveText(/\d \/ 6/);
});

test('Lückentext: Tippfehler zählen als «fast», Lücken bleiben im Satz', async ({ page }) => {
  await spielOeffnen(page, 'Lückentext');
  const luecken = page.locator('.luecke');
  const breite = await luecken.first().evaluate((e) => e.getBoundingClientRect().width);
  expect(breite).toBeLessThan(250); // Regression: Lücken waren einmal bildschirmbreit
  for (const l of await luecken.all()) {
    const loesung = await l.getAttribute('data-loesung');
    await l.fill(loesung === 'Wasserdampf' ? 'Wasserdamf' : loesung === 'Wolke' ? 'Nebel' : loesung);
  }
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.locator('.luecke.fast')).toHaveCount(1);
  await expect(page.locator('.luecke.falsch')).toHaveCount(1);
  await expect(page.locator('.rueckmeldung')).toContainText('7 von 8 richtig');
  await expect(page.locator('.rueckmeldung')).toContainText('«Wasserdamf» → Wasserdampf');
});

test('Kreuzworträtsel: Umlaut verteilt sich auf zwei Felder, Auflösen und Prüfen', async ({ page }) => {
  await spielOeffnen(page, 'Kreuzworträtsel');
  const felder = page.locator('.kw-feld');
  await felder.first().click();
  await page.keyboard.type('Ä');
  const belegt = await felder.evaluateAll((fs) => fs.filter((f) => f.value).map((f) => f.value).join(''));
  expect(belegt).toBe('AE');
  await page.getByRole('button', { name: 'Auflösen' }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.locator('.rueckmeldung')).toContainText('Perfekt');
});

test('Memory: zwei Karten aufdecken', async ({ page }) => {
  await spielOeffnen(page, 'Memory');
  await expect(page.locator('.memo-karte')).toHaveCount(16);
  await page.locator('.memo-karte').nth(0).click();
  await page.locator('.memo-karte').nth(1).click();
  await expect(page.locator('.label')).toContainText('1 Züge');
});

test('Wahr oder falsch, Reihenfolge, Zuordnen', async ({ page }) => {
  await spielOeffnen(page, 'Wahr oder falsch');
  await page.getByRole('button', { name: 'Wahr', exact: true }).click();
  await sicher(page);
  await expect(page.locator('.rueckmeldung')).toContainText(/Richtig|Nein/);
  await zurueck(page);

  await spielOeffnen(page, 'Reihenfolge');
  await expect(page.locator('.sortier-el')).toHaveCount(6);
  await page.locator('.sortier-el').first().getByRole('button', { name: 'nach unten' }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.locator('.rueckmeldung')).toContainText(/Schritten am richtigen Platz|richtigen Reihenfolge/);
  await zurueck(page);

  await spielOeffnen(page, 'Zuordnen');
  await page.locator('.wortbank .chip').first().click();
  await page.locator('.kategorie').first().click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.locator('.rueckmeldung')).toContainText(/von 10 richtig zugeordnet/);
});

test('Denkfragen ohne KI: erst Kriterien und ergänzen, dann Musterantwort und Selbsteinschätzung', async ({ page }) => {
  await spielOeffnen(page, 'Denkfragen');
  await page.locator('textarea').fill('Weil Wasser verdunstet.');
  await page.getByRole('button', { name: 'Mit den Kriterien prüfen' }).click();
  await expect(page.locator('.ki-antwort')).toContainText('Darauf kommt es an');
  await expect(page.locator('.ki-antwort .label', { hasText: 'Musterantwort' })).toHaveCount(0); // noch nicht verraten
  await page.locator('textarea').fill('Weil Wasser verdunstet und dabei Energie braucht.');
  await page.getByRole('button', { name: 'Musterantwort zeigen' }).click();
  await expect(page.locator('.ki-antwort')).toContainText('Musterantwort');
  await page.getByRole('button', { name: '2 Punkte' }).click();
  await expect(page.locator('.label').first()).toHaveText('Frage 2 von 2');
});

test('Vorlese-Knöpfe sind vorhanden', async ({ page }) => {
  await spielOeffnen(page, 'Lernpfad');
  await expect(page.locator('.vorlesen')).toHaveCount(2);
});

test('Multiple Choice: Rückmeldung erklärt, warum die gewählte falsche Antwort nicht stimmt', async ({ page }) => {
  await spielOeffnen(page, 'Multiple Choice');
  for (let i = 0; i < 6; i++) {
    const frage = await page.locator('.mc .frage span').innerText();
    if (frage === 'Woraus bestehen Wolken?') {
      await page.locator('.option', { hasText: /^Aus Wasserdampf$/ }).click();
      await sicher(page);
      await expect(page.locator('.rueckmeldung')).toContainText('Warum nicht «Aus Wasserdampf»?');
      await expect(page.locator('.rueckmeldung')).toContainText('Wasserdampf ist ein unsichtbares Gas');
      await expect(page.locator('.rueckmeldung')).toContainText('Richtig ist «Aus winzigen Wassertröpfchen oder Eiskristallen»');
      return;
    }
    await page.locator('.option').first().click();
    await sicher(page);
    await page.locator('.reihe.rechts .knopf').click();
  }
  throw new Error('Frage nicht gefunden');
});
