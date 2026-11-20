// Anonyme Statistik und Auswertung – Supabase wird abgefangen, es gehen keine echten Daten raus
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, spielOeffnen } = require('./hilfen');

const SUPABASE = 'https://efsznvanzievcxvewgpi.supabase.co';
let fehler;

async function supabaseAttrappe(page, zeilen = []) {
  const meldungen = [];
  await page.route(SUPABASE + '/**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      meldungen.push({ body: JSON.parse(req.postData()), headers: await req.allHeaders(), url: req.url() });
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(zeilen) });
  });
  return meldungen;
}

async function paketAnlegen(page, statistik) {
  await page.goto('/');
  await page.evaluate((an) => {
    const p = Object.assign(LA.paketPruefen(structuredClone(LA.DEMO)), { id: 'paket-test', quelle: 'ki', titel: 'Testpaket' });
    localStorage.setItem('lernapp.pakete', JSON.stringify([p]));
    if (an) localStorage.setItem('lernapp.statistik', JSON.stringify('an'));
  }, statistik);
  await page.reload();
  await page.locator('.karte').click();
}

test.beforeEach(({ page }) => { fehler = fehlerSammeln(page); });
test.afterEach(() => expect(fehler, 'Fehler im Browser').toEqual([]));

test('Antworten werden anonym gemeldet, Wiederholungen markiert', async ({ page }) => {
  const meldungen = await supabaseAttrappe(page);
  await paketAnlegen(page, true);
  await spielOeffnen(page, 'Wahr oder falsch');
  for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: 'Wahr', exact: true }).click(); await page.locator('.reihe.rechts .knopf').click(); }
  await expect.poll(() => meldungen.length).toBe(6);
  const m = meldungen[0];
  expect(m.url).toBe(SUPABASE + '/rest/v1/rpc/lw_statistik_melden');
  expect(m.headers.apikey).toMatch(/^sb_publishable_/);
  expect(Object.keys(m.body).sort()).toEqual(['p_art', 'p_frage', 'p_karte', 'p_kurz', 'p_paket', 'p_richtig', 'p_titel', 'p_wiederholung']);
  expect(m.body).toMatchObject({ p_paket: 'paket-test', p_titel: 'Testpaket', p_art: 'wf', p_wiederholung: false });
  expect(meldungen.filter((x) => !x.body.p_richtig).length).toBe(3);

  // Wiederholung: dieselben Fragen, jetzt als «wiederholt» markiert
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await page.locator('.spiel.faellig').click();
  await page.getByRole('button', { name: 'Wahr', exact: true }).click();
  await expect.poll(() => meldungen.length).toBe(7);
  expect(meldungen[6].body.p_wiederholung).toBe(true);
});

test('Demo, localhost ohne Freigabe und abgeschaltete Geräte melden nichts', async ({ page }) => {
  const meldungen = await supabaseAttrappe(page);
  await paketAnlegen(page, false); // localhost: standardmässig aus
  await spielOeffnen(page, 'Multiple Choice');
  await page.locator('.option').first().click();
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('lernapp.statistik', JSON.stringify('an')));
  await page.reload();
  await page.getByRole('button', { name: /Demo ansehen/ }).click();
  await spielOeffnen(page, 'Multiple Choice');
  await page.locator('.option').first().click();
  // In den Einstellungen abschalten
  await page.goto('/');
  await page.getByRole('button', { name: /Einstellungen/ }).click();
  await expect(page.locator('#statistik')).toBeChecked();
  await page.locator('#statistik').uncheck();
  await page.getByRole('button', { name: 'Meine Pakete' }).click();
  await page.locator('.karte').click();
  await spielOeffnen(page, 'Multiple Choice');
  await page.locator('.option').first().click();
  await page.waitForTimeout(300);
  expect(meldungen.length).toBe(0);
});

test('Auswertung: Tabelle pro Paket, schwierigste Fragen oben, Filter und CSV', async ({ page }) => {
  await supabaseAttrappe(page, [
    { paket_id: 'a', karte_id: 'mc:1', paket_titel: 'Wasserkreislauf', frage: 'Leichte Frage', art: 'mc', richtig: 9, falsch: 1, wiederholt: 0, aktualisiert: '2026-11-19T10:00:00Z' },
    { paket_id: 'a', karte_id: 'wf:1', paket_titel: 'Wasserkreislauf', frage: 'Schwere Aussage', art: 'wf', richtig: 2, falsch: 8, wiederholt: 5, aktualisiert: '2026-11-19T10:00:00Z' },
    { paket_id: 'b', karte_id: 'begriff:1', paket_titel: 'Muskeln', frage: 'Begriff «Bizeps»', art: 'begriff', richtig: 1, falsch: 1, wiederholt: 1, aktualisiert: '2026-11-19T10:00:00Z' },
  ]);
  await page.goto('/#auswertung');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Auswertung');
  await expect(page.locator('.aw-paket')).toHaveCount(2);
  const wasser = page.locator('.aw-paket', { hasText: 'Wasserkreislauf' });
  await expect(wasser.locator('tbody tr').first()).toContainText('Schwere Aussage');
  await expect(wasser.locator('tbody tr').first()).toContainText('80 %');
  await expect(wasser).toContainText('20 Antworten · 45 % falsch · 5× in Wiederholung');
  await page.getByRole('combobox', { name: 'Mindestanzahl Antworten' }).selectOption('3');
  await expect(page.locator('.aw-paket')).toHaveCount(1); // «Muskeln» hat nur 2 Antworten
  await page.getByRole('textbox', { name: 'Frage suchen' }).fill('leichte');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als CSV (Excel)' }).click();
  const datei = await download;
  expect(datei.suggestedFilename()).toBe('lernwerkstatt-auswertung.csv');
});

test('Auswertung aus dem Paket: nur dieses Paket', async ({ page }) => {
  await supabaseAttrappe(page, [
    { paket_id: 'paket-test', karte_id: 'mc:1', paket_titel: 'Testpaket', frage: 'Frage X', art: 'mc', richtig: 1, falsch: 0, wiederholt: 0, aktualisiert: '2026-11-19T10:00:00Z' },
    { paket_id: 'anderes', karte_id: 'mc:1', paket_titel: 'Anderes', frage: 'Frage Y', art: 'mc', richtig: 1, falsch: 0, wiederholt: 0, aktualisiert: '2026-11-19T10:00:00Z' },
  ]);
  await paketAnlegen(page, false);
  await page.getByRole('button', { name: 'Auswertung', exact: true }).click();
  await expect(page.locator('.aw-paket')).toHaveCount(1);
  await expect(page.locator('.aw-paket h2')).toHaveText('Testpaket');
  await page.getByRole('button', { name: '← Zurück' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Testpaket');
});
