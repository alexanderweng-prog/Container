// Editor (ohne JSON) und Niveaus
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, kiAttrappe, demoOeffnen, spielOeffnen } = require('./hilfen');

let fehler;
test.beforeEach(async ({ page }) => {
  fehler = fehlerSammeln(page);
  page.on('dialog', (d) => d.accept()); // Rückfragen (confirm) bestätigen
});
test.afterEach(() => expect(fehler, 'Fehler im Browser').toEqual([]));

const bereich = (page, name) => page.locator('.ed-bereich', { has: page.locator('summary', { hasText: name }) });
const speichern = (page) => page.getByRole('button', { name: 'Speichern', exact: true }).first().click();
const lernstand = (page, id) => page.evaluate((i) => JSON.parse(localStorage.getItem('lernapp.lernstand.' + i) || '{}'), id);

async function demoGespeichert(page) {
  await demoOeffnen(page);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
}

async function kiEinschalten(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('lernapp.einstellungen', JSON.stringify({ apiKey: 'sk-ant-test' })));
}

test('Multiple-Choice-Frage bearbeiten: Text und richtige Antwort', async ({ page }) => {
  await demoGespeichert(page);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const mc = bereich(page, 'Multiple Choice');
  await mc.locator(':scope > summary').click();
  const erste = mc.locator('.ed-element').first();
  await erste.getByLabel('Frage', { exact: true }).fill('Was braucht Verdunstung?');
  await erste.getByLabel('Antwort 1', { exact: true }).fill('Energie (Wärme)');
  await erste.getByLabel('Antwort 1 ist richtig').check();
  await speichern(page);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('lernapp.pakete'))[0]);
  expect(p.multiple_choice[0]).toMatchObject({ frage: 'Was braucht Verdunstung?', richtig: 0 });
  expect(p.multiple_choice[0].optionen[0]).toBe('Energie (Wärme)');
});

test('Lückentext: markiertes Wort wird zur Lücke', async ({ page }) => {
  await demoGespeichert(page);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const lt = bereich(page, 'Lückentexte');
  await lt.locator(':scope > summary').click();
  const text = lt.locator('textarea').first();
  await text.fill('Die Sonne erwärmt das Meer.');
  await text.evaluate((t) => { const a = t.value.indexOf('Meer'); t.setSelectionRange(a, a + 4); });
  await lt.getByRole('button', { name: 'Markiertes Wort zur Lücke machen' }).click();
  await expect(text).toHaveValue('Die Sonne erwärmt das {{Meer}}.');
  await expect(lt.locator('.hinweis').filter({ hasText: 'Lücke' }).first()).toContainText('1 Lücke: Meer');
});

test('Löschen: Lernstand der übrigen Fragen bleibt bei der richtigen Frage', async ({ page }) => {
  await demoGespeichert(page);
  await spielOeffnen(page, 'Wahr oder falsch');
  for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: 'Wahr', exact: true }).click(); await page.locator('.reihe.rechts .knopf').click(); }
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  const vorher = await lernstand(page, 'demo-wasserkreislauf');
  expect(Object.keys(vorher).filter((k) => k.startsWith('wf:')).length).toBe(6);

  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const wf = bereich(page, 'Wahr oder falsch');
  await wf.locator(':scope > summary').click();
  await wf.locator('.ed-element').first().getByRole('button', { name: 'löschen' }).click();
  await speichern(page);
  await expect(page.locator('.toast').last()).toContainText('1 Karte aus der Lernkartei entfernt');

  const nachher = await lernstand(page, 'demo-wasserkreislauf');
  for (let i = 1; i < 6; i++) expect(nachher[`wf:${i - 1}`], `wf:${i} → wf:${i - 1}`).toEqual(vorher[`wf:${i}`]);
  expect(nachher['wf:5']).toBeUndefined();
});

test('Unvollständiger Eintrag: Rückfrage, dann wird er entfernt', async ({ page }) => {
  await demoGespeichert(page);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const mc = bereich(page, 'Multiple Choice');
  await mc.locator(':scope > summary').click();
  const anzahl = await mc.locator('.ed-element').count();
  await mc.getByRole('button', { name: '+ Leer hinzufügen' }).click();
  await expect(mc.locator('.ed-element')).toHaveCount(anzahl + 1);
  let frage = '';
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => { frage = d.message(); d.accept(); });
  await speichern(page);
  expect(frage).toContain('1 unvollständiger Eintrag');
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('lernapp.pakete'))[0]);
  expect(p.multiple_choice.length).toBe(anzahl);
});

test('Mit KI: einzelne Frage neu erzeugen, Wunsch wird mitgeschickt', async ({ page }) => {
  await kiEinschalten(page);
  const anfragen = await kiAttrappe(page, () => ({ element: { frage: 'Neue KI-Frage?', optionen: ['a', 'b', 'c', 'd'], richtig: 2, erklaerung: 'weil c' } }));
  await demoGespeichert(page);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const mc = bereich(page, 'Multiple Choice');
  await mc.locator(':scope > summary').click();
  const erste = mc.locator('.ed-element').first();
  await erste.getByText('✨ Mit KI neu erzeugen').click();
  await erste.getByLabel('Wunsch an die KI').fill('einfacher');
  await erste.getByRole('button', { name: '✨ Neu erzeugen' }).click();
  await expect(mc.locator('.ed-element.neu')).toHaveCount(1);
  await expect(mc.locator('.ed-element').first().getByLabel('Frage', { exact: true })).toHaveValue('Neue KI-Frage?');
  const { body } = anfragen[0];
  expect(body.output_config.format.schema.properties.element.properties).toHaveProperty('optionen');
  expect(body.messages[0].content[0].text).toContain('Wunsch der Lehrperson: einfacher');
  expect(body.messages[0].content[0].text).toContain('Welcher Vorgang braucht Energie?'); // altes Element als Vorlage
  await speichern(page);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('lernapp.pakete'))[0]);
  expect(p.multiple_choice[0].frage).toBe('Neue KI-Frage?');
  expect(p.multiple_choice[0]._neu).toBeUndefined(); // interne Markierung nicht gespeichert
});

test('Niveaus: erzeugen, umschalten, Bibliothek, Teilen, Schüleransicht, Druck', async ({ page, context }) => {
  await kiEinschalten(page);
  const anfragen = await kiAttrappe(page, (body) => {
    const n = body.messages[0].content[0].text.includes('Niveau 1') ? 1 : 3;
    return page.evaluate((niveau) => {
      const d = structuredClone(LA.DEMO);
      d.titel = 'Anderer Titel';
      d.kurzbeschreibung = `Fassung für Niveau ${niveau}`;
      if (niveau === 1) d.multiple_choice = d.multiple_choice.slice(0, 4);
      return d;
    }, n);
  });
  await demoGespeichert(page);
  await page.getByRole('button', { name: 'Niveaus erzeugen' }).click();
  await expect(page.locator('.niveau-tab')).toHaveCount(3);
  expect(anfragen.length).toBe(2);
  expect(anfragen.map((a) => a.body.system).join()).toContain('Niveau 1 (grundlegend)');
  expect(anfragen.map((a) => a.body.system).join()).toContain('Niveau 3 (erweitert)');

  // Umschalten; Titel bleibt einheitlich, Inhalt ist die jeweilige Fassung
  await expect(page.locator('.niveau-tab.aktiv')).toContainText('Niveau 2');
  await page.locator('.niveau-tab', { hasText: 'Niveau 1' }).click();
  await expect(page.locator('.intro')).toHaveText('Fassung für Niveau 1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Der Wasserkreislauf');
  await expect(page.getByRole('button', { name: 'Niveaus erzeugen' })).toHaveCount(0);

  // Bibliothek: eine Karte für die ganze Gruppe, öffnet das zuletzt gewählte Niveau
  await page.getByRole('button', { name: 'Meine Pakete' }).click();
  await expect(page.locator('.karte')).toHaveCount(1);
  await expect(page.locator('.karte')).toContainText('3 Niveaus');
  await page.locator('.karte').click();
  await expect(page.locator('.niveau-tab.aktiv')).toContainText('Niveau 1');

  // Druck: Niveau steht im Kopf
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'Drucken' }).click();
  await page.getByRole('button', { name: 'Drucken / PDF' }).click();
  await expect(page.locator('#druckbereich .druck-fach')).toContainText('Niveau 1 ●');

  // Teilen: alle Niveaus → Schüleransicht mit Auswahl, ohne Lehrer-Bezeichnungen
  await page.getByRole('button', { name: 'Teilen' }).click();
  await expect(page.locator('dialog select')).toHaveValue('alle');
  const link = await page.locator('dialog textarea').inputValue();
  const schueler = await context.newPage();
  const schuelerFehler = fehlerSammeln(schueler);
  await schueler.goto(link);
  await expect(schueler.locator('.niveau-tab')).toHaveCount(3);
  await expect(schueler.locator('.niveau-tab').first()).toHaveText('● Niveau 1');
  await schueler.locator('.niveau-tab', { hasText: 'Niveau 3' }).click();
  await expect(schueler.locator('.intro')).toHaveText('Fassung für Niveau 3');
  expect(schuelerFehler).toEqual([]);

  // Teilen: nur ein Niveau → keine Auswahl in der Schüleransicht
  await page.locator('dialog select').selectOption({ label: 'Nur Niveau 3 ●●● (erweitert)' });
  await expect.poll(() => page.locator('dialog textarea').inputValue()).not.toBe(link);
  const einzel = await context.newPage();
  await einzel.goto(await page.locator('dialog textarea').inputValue());
  await expect(einzel.locator('.intro')).toHaveText('Fassung für Niveau 3');
  await expect(einzel.locator('.niveau-tab')).toHaveCount(0);
});

test('Neues Paket gleich in drei Niveaus', async ({ page }) => {
  await kiEinschalten(page);
  await kiAttrappe(page, () => page.evaluate(() => { const d = structuredClone(LA.DEMO); delete d.id; d.titel = 'Dreifach'; return d; }));
  await page.goto('/');
  await page.getByRole('button', { name: '+ Neues Lernpaket' }).click();
  await page.locator('#material').fill('Text über den Wasserkreislauf');
  await page.locator('#dreiniveaus').check();
  await page.getByRole('button', { name: 'Lernpaket erstellen' }).click();
  await expect(page.locator('.niveau-tab')).toHaveCount(3);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dreifach');
  const gruppen = await page.evaluate(() => JSON.parse(localStorage.getItem('lernapp.pakete')).map((p) => `${p.gruppe ? 'g' : '-'}${p.niveau}`).sort());
  expect(gruppen).toEqual(['g1', 'g2', 'g3']);
});
