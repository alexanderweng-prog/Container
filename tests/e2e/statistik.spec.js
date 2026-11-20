// Anonyme Statistik und Auswertung – Supabase wird abgefangen, es gehen keine echten Daten raus
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, spielOeffnen, sicher } = require('./hilfen');

const SUPABASE = 'https://efsznvanzievcxvewgpi.supabase.co';
let fehler;

async function supabaseAttrappe(page, zeilen = [], antworten = []) {
  const meldungen = [];
  await page.route(SUPABASE + '/**', async (route) => {
    const req = route.request();
    if (req.url().endsWith('/rpc/lw_antworten_laden')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(antworten) });
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
  for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: 'Wahr', exact: true }).click(); await sicher(page); await page.locator('.reihe.rechts .knopf').click(); }
  await expect.poll(() => meldungen.length).toBe(6);
  const m = meldungen[0];
  expect(m.url).toBe(SUPABASE + '/rest/v1/rpc/lw_statistik_melden');
  expect(m.headers.apikey).toMatch(/^sb_publishable_/);
  expect(Object.keys(m.body).sort()).toEqual(['p_antwort', 'p_art', 'p_erst', 'p_frage', 'p_karte', 'p_kurz', 'p_paket', 'p_richtig', 'p_sicherheit', 'p_titel', 'p_wiederholung']);
  expect(m.body).toMatchObject({ p_paket: 'paket-test', p_titel: 'Testpaket', p_art: 'wf', p_wiederholung: false, p_erst: true, p_sicherheit: 'sicher' });
  expect(meldungen.filter((x) => !x.body.p_richtig).length).toBe(3);

  // Wiederholung: dieselben Fragen, jetzt als «wiederholt» markiert
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await page.locator('.spiel.faellig').click();
  await page.getByRole('button', { name: 'Wahr', exact: true }).click();
  await sicher(page);
  await expect.poll(() => meldungen.length).toBe(7);
  expect(meldungen[6].body.p_wiederholung).toBe(true);
  expect(meldungen[6].body.p_erst).toBe(false); // dieselbe Frage zum zweiten Mal
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
    { paket_id: 'a', karte_id: 'mc:1', paket_titel: 'Wasserkreislauf', frage: 'Leichte Frage', art: 'mc', richtig: 9, falsch: 1, wiederholt: 0, erst_richtig: 9, erst_falsch: 1, aktualisiert: '2026-11-19T10:00:00Z' },
    { paket_id: 'a', karte_id: 'wf:1', paket_titel: 'Wasserkreislauf', frage: 'Schwere Aussage', art: 'wf', richtig: 2, falsch: 8, wiederholt: 5, erst_richtig: 2, erst_falsch: 8, aktualisiert: '2026-11-19T10:00:00Z' },
    { paket_id: 'b', karte_id: 'begriff:1', paket_titel: 'Muskeln', frage: 'Begriff «Bizeps»', art: 'begriff', richtig: 1, falsch: 1, wiederholt: 1, erst_richtig: 1, erst_falsch: 1, aktualisiert: '2026-11-19T10:00:00Z' },
  ]);
  await page.goto('/#auswertung');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Auswertung');
  await expect(page.locator('.aw-paket')).toHaveCount(2);
  const wasser = page.locator('.aw-paket', { hasText: 'Wasserkreislauf' });
  await expect(wasser.locator('tbody tr').first()).toContainText('Schwere Aussage');
  await expect(wasser.locator('tbody tr').first()).toContainText('80 %');
  await expect(wasser).toContainText('20 Antworten · 45 % falsch · 0× sicher falsch · 5× in Wiederholung');
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
    { paket_id: 'paket-test', karte_id: 'mc:1', paket_titel: 'Testpaket', frage: 'Frage X', art: 'mc', richtig: 1, falsch: 0, wiederholt: 0, erst_richtig: 1, erst_falsch: 0, aktualisiert: '2026-11-19T10:00:00Z' },
    { paket_id: 'anderes', karte_id: 'mc:1', paket_titel: 'Anderes', frage: 'Frage Y', art: 'mc', richtig: 1, falsch: 0, wiederholt: 0, erst_richtig: 1, erst_falsch: 0, aktualisiert: '2026-11-19T10:00:00Z' },
  ]);
  await paketAnlegen(page, false);
  await page.getByRole('button', { name: 'Auswertung', exact: true }).click();
  await expect(page.locator('.aw-paket')).toHaveCount(1);
  await expect(page.locator('.aw-paket h2')).toHaveText('Testpaket');
  await page.getByRole('button', { name: '← Zurück' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Testpaket');
});

test('Gewählte falsche Antwort und Sicherheit werden gemeldet; Auswertung zeigt Fehlvorstellungen', async ({ page }) => {
  const meldungen = await supabaseAttrappe(page, [
    { paket_id: 'paket-test', karte_id: 'mc:aa', paket_titel: 'Testpaket', frage: 'Was treibt den Wasserkreislauf an?', art: 'mc', richtig: 6, falsch: 9, wiederholt: 0,
      erst_richtig: 4, erst_falsch: 6, sicher_falsch: 5, erst_sicher_falsch: 4, geraten_richtig: 2, erst_geraten_richtig: 1, aktualisiert: '2026-11-20T10:00:00Z' },
  ], [
    { paket_id: 'paket-test', karte_id: 'mc:aa', kurz: '', art: 'mc', antwort: 'Der Wind', anzahl: 7, erst_anzahl: 5 },
    { paket_id: 'paket-test', karte_id: 'mc:aa', kurz: '', art: 'mc', antwort: 'Der Mond', anzahl: 2, erst_anzahl: 0 },
  ]);
  await paketAnlegen(page, true);
  await spielOeffnen(page, 'Multiple Choice');
  // Eine falsche Antwort sicher wählen
  const richtigText = await page.evaluate(() => { const t = document.querySelector('.mc .frage span').textContent; const q = LA.DEMO.multiple_choice.find((x) => x.frage === t); return q.optionen[q.richtig]; });
  const falsch = page.locator('.option').filter({ hasNotText: richtigText }).first();
  const falschText = await falsch.innerText();
  await falsch.click();
  await expect(page.locator('.option.richtig')).toHaveCount(0); // noch nicht aufgelöst
  await expect(page.locator('.sicherheit')).toContainText('Wie sicher bist du?');
  await sicher(page, 'Sicher');
  await expect(page.locator('.rueckmeldung')).toContainText('Du warst dir sicher');
  await expect.poll(() => meldungen.length).toBe(1);
  expect(meldungen[0].body).toMatchObject({ p_richtig: false, p_sicherheit: 'sicher', p_antwort: falschText, p_erst: true });
  // Richtig, aber geraten
  await page.locator('.reihe.rechts .knopf').click();
  const r2 = await page.evaluate(() => { const t = document.querySelector('.mc .frage span').textContent; const q = LA.DEMO.multiple_choice.find((x) => x.frage === t); return q.optionen[q.richtig]; });
  await page.locator('.option', { hasText: r2 }).first().click();
  await sicher(page, 'Geraten');
  await expect(page.locator('.rueckmeldung')).toContainText('noch nicht sicher');
  await expect.poll(() => meldungen.length).toBe(2);
  expect(meldungen[1].body).toMatchObject({ p_richtig: true, p_sicherheit: 'geraten', p_antwort: '' });

  // Auswertung
  await page.goto('/#auswertung');
  await page.reload();
  const zeile = page.locator('tbody tr').first();
  await expect(zeile).toContainText('Häufig falsch gewählt: «Der Wind» 5×');
  await expect(zeile).not.toContainText('Der Mond'); // im ersten Versuch nie gewählt
  await expect(zeile.locator('td').nth(3)).toHaveText('6');
  await expect(zeile.locator('td').nth(5)).toHaveText('4');
  await expect(zeile.locator('td').nth(6)).toHaveText('1');
  await page.getByRole('combobox', { name: 'Zählweise' }).selectOption('alle');
  await expect(zeile).toContainText('«Der Wind» 7×');
  await expect(zeile).toContainText('«Der Mond» 2×');
  await expect(zeile.locator('td').nth(5)).toHaveText('5');
});

test('Sicherheitsfrage lässt sich im Editor ausschalten', async ({ page }) => {
  await supabaseAttrappe(page);
  await paketAnlegen(page, false);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel(/Wie sicher bist du/).uncheck();
  await page.getByRole('button', { name: 'Speichern', exact: true }).first().click();
  await spielOeffnen(page, 'Wahr oder falsch');
  await page.getByRole('button', { name: 'Wahr', exact: true }).click();
  await expect(page.locator('.sicherheit')).toHaveCount(0);
  await expect(page.locator('.rueckmeldung')).toContainText(/Richtig|Nein/);
});
