// Kurzlinks mit QR-Code – Supabase wird abgefangen (eine kleine Attrappe im Speicher)
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, sicher } = require('./hilfen');

const SUPABASE = 'https://efsznvanzievcxvewgpi.supabase.co';

// Verhält sich wie die Datenbank-Funktionen (Kurzlinks und Statistik)
async function datenbank(context, statistik = []) {
  const db = new Map(); const aufrufe = [];
  let nummer = 0;
  const antwort = (route, x) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(x) });
  await context.route(SUPABASE + '/rest/v1/lw_statistik**', (route) => antwort(route, statistik));
  await context.route(SUPABASE + '/rest/v1/rpc/**', async (route) => {
    const name = route.request().url().split('/rpc/')[1];
    const body = JSON.parse(route.request().postData() || '{}');
    aufrufe.push({ name, body });
    const e = db.get(body.p_code);
    const ok = e && e.token === body.p_token;
    if (name === 'lw_paket_teilen') { const code = ['abc2345', 'xyz6789', 'def3456'][nummer++]; db.set(code, { daten: body.p_daten, token: body.p_token, klasse: body.p_klasse || '', abrufe: 0 }); return antwort(route, code); }
    if (name === 'lw_paket_aktualisieren') { if (ok) { if (body.p_daten) e.daten = body.p_daten; if (body.p_klasse != null) e.klasse = body.p_klasse; } return antwort(route, !!ok); }
    if (name === 'lw_paket_loeschen') { if (ok) db.delete(body.p_code); return antwort(route, !!ok); }
    if (name === 'lw_paket_laden') { if (e) e.abrufe++; return antwort(route, e ? e.daten : null); }
    if (name === 'lw_kurzlinks_info') return antwort(route, body.p_codes.filter((c) => db.has(c)).map((c) => ({ code: c, titel: 'T', klasse: db.get(c).klasse, abrufe: db.get(c).abrufe, erstellt: '2026-11-20T08:00:00Z', aktualisiert: '2026-11-20T08:00:00Z' })));
    if (name === 'lw_statistik_melden') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (name === 'lw_antworten_laden') return antwort(route, []);
    return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' } });
  });
  return { db, aufrufe };
}

async function lehrperson(page, mitNiveaus) {
  await page.goto('/');
  await page.evaluate((niveaus) => {
    const basis = LA.paketPruefen(structuredClone(LA.DEMO));
    const liste = niveaus
      ? [1, 2, 3].map((n) => Object.assign(structuredClone(basis), { id: 'n' + n, gruppe: 'g1', niveau: n, quelle: 'ki', kurzbeschreibung: 'Fassung ' + n }))
      : [Object.assign(basis, { id: 'paket-1', quelle: 'ki' })];
    localStorage.setItem('lernapp.pakete', JSON.stringify(liste));
  }, mitNiveaus);
  await page.reload();
  await page.locator('.karte').click();
}

test('Kurzlink erstellen, QR-Code, Schüleransicht, Korrektur kommt an', async ({ page, context }) => {
  const fehler = fehlerSammeln(page);
  const { db, aufrufe } = await datenbank(context);
  await lehrperson(page, false);
  await page.getByRole('button', { name: 'Teilen' }).click();
  await page.getByRole('button', { name: 'Kurzlink mit QR-Code erstellen' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/\/#p=abc2345$/);
  await expect(page.locator('.qr-klein svg')).toBeVisible();
  const teilen = aufrufe.find((a) => a.name === 'lw_paket_teilen');
  expect(teilen.body.p_daten.id).toBe('paket-1');
  expect(teilen.body.p_token.length).toBeGreaterThanOrEqual(24);

  // Beamer-Ansicht
  await page.getByRole('button', { name: 'QR gross für Beamer' }).click();
  await expect(page.locator('.qr-vollbild .qr-url')).toContainText('#p=abc2345');
  await page.locator('.qr-vollbild').getByRole('button', { name: 'Schliessen' }).click();
  await page.locator('dialog.dialog').getByRole('button', { name: 'schliessen' }).click();

  // Erneut teilen: derselbe Code, kein zweites Paket
  await page.getByRole('button', { name: 'Teilen' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/\/#p=abc2345$/);
  expect(aufrufe.filter((a) => a.name === 'lw_paket_teilen').length).toBe(1);
  await page.locator('dialog.dialog').getByRole('button', { name: 'schliessen' }).click();

  // Schüler*in öffnet den Kurzlink
  const schueler = await context.newPage();
  const schuelerFehler = fehlerSammeln(schueler);
  await schueler.goto('/#p=abc2345');
  await expect(schueler.getByRole('heading', { level: 1 })).toHaveText('Der Wasserkreislauf');
  await expect(schueler.locator('.kopf .tag')).toHaveText('Schüleransicht');

  // Lehrperson korrigiert den Titel → Kurzlink wird aktualisiert
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.locator('.formular input[type=text]').first().fill('Wasserkreislauf (korrigiert)');
  await page.getByRole('button', { name: 'Speichern', exact: true }).first().click();
  await expect.poll(() => db.get('abc2345').daten.titel).toBe('Wasserkreislauf (korrigiert)');
  await schueler.reload();
  await expect(schueler.getByRole('heading', { level: 1 })).toHaveText('Wasserkreislauf (korrigiert)');
  expect(fehler).toEqual([]);
  expect(schuelerFehler).toEqual([]);
});

test('Alle Niveaus als ein Kurzlink', async ({ page, context }) => {
  const { aufrufe } = await datenbank(context);
  await lehrperson(page, true);
  await page.getByRole('button', { name: 'Teilen' }).click();
  await page.getByRole('button', { name: 'Kurzlink mit QR-Code erstellen' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/#p=abc2345$/);
  expect(Array.isArray(aufrufe[0].body.p_daten)).toBe(true);
  // Einzelnes Niveau bekommt einen eigenen Kurzlink
  await page.locator('dialog select').selectOption({ label: 'Nur Niveau 3 ●●● (erweitert)' });
  await page.getByRole('button', { name: 'Kurzlink mit QR-Code erstellen' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/#p=xyz6789$/);

  const schueler = await context.newPage();
  await schueler.goto('/#p=abc2345');
  await expect(schueler.locator('.niveau-tab')).toHaveCount(3);
  await schueler.goto('/#p=xyz6789');
  await schueler.reload();
  await expect(schueler.locator('.intro')).toHaveText('Fassung 3');
  await expect(schueler.locator('.niveau-tab')).toHaveCount(0);
});

test('Unbekannter Kurzlink: verständliche Meldung; offline: letzte Fassung', async ({ page, context }) => {
  const fehler = fehlerSammeln(page);
  await datenbank(context);
  await page.goto('/#p=zzzzzzz');
  await expect(page.locator('.kasten').first()).toContainText('Diesen Kurzlink gibt es nicht');

  // Erst laden (wird gemerkt), dann ist der Dienst weg
  await lehrperson(page, false);
  await page.getByRole('button', { name: 'Teilen' }).click();
  await page.getByRole('button', { name: 'Kurzlink mit QR-Code erstellen' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/abc2345/);
  const s = await context.newPage();
  await s.goto('/#p=abc2345');
  await expect(s.getByRole('heading', { level: 1 })).toHaveText('Der Wasserkreislauf');
  await context.unroute(SUPABASE + '/rest/v1/rpc/**');
  await context.unroute(SUPABASE + '/rest/v1/lw_statistik**');
  await context.route(SUPABASE + '/**', (r) => r.abort());
  await s.reload();
  await expect(s.getByRole('heading', { level: 1 })).toHaveText('Der Wasserkreislauf');
  await expect(s.locator('.toast').first()).toContainText('Offline');
  expect(fehler.filter((f) => !f.includes('Failed to load resource'))).toEqual([]);
});

test('Ein Kurzlink pro Klasse: Antworten zählen getrennt, «Meine Kurzlinks», Auswertung pro Klasse', async ({ page, context }) => {
  const fehler = fehlerSammeln(page);
  const statistik = [
    { paket_id: 'paket-1', karte_id: 'mc:aa', kurz: 'abc2345', paket_titel: 'Der Wasserkreislauf', frage: 'Frage A', art: 'mc', richtig: 1, falsch: 9, wiederholt: 0, erst_richtig: 1, erst_falsch: 5, aktualisiert: '2026-11-20T09:00:00Z' },
    { paket_id: 'paket-1', karte_id: 'mc:aa', kurz: 'xyz6789', paket_titel: 'Der Wasserkreislauf', frage: 'Frage A', art: 'mc', richtig: 9, falsch: 1, wiederholt: 2, erst_richtig: 8, erst_falsch: 1, aktualisiert: '2026-11-20T09:00:00Z' },
    { paket_id: 'paket-1', karte_id: 'mc:aa', kurz: '', paket_titel: 'Der Wasserkreislauf', frage: 'Frage A', art: 'mc', richtig: 0, falsch: 2, wiederholt: 0, erst_richtig: 0, erst_falsch: 2, aktualisiert: '2026-11-20T09:00:00Z' },
  ];
  const { db, aufrufe } = await datenbank(context, statistik);
  await lehrperson(page, false);
  await page.getByRole('button', { name: 'Teilen' }).click();
  await page.getByRole('textbox', { name: 'Klasse' }).fill('2a');
  await page.getByRole('button', { name: 'Kurzlink mit QR-Code erstellen' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/#p=abc2345$/);
  await expect(page.locator('.kurz-text .label')).toHaveText('Kurzlink · 2a');
  expect(db.get('abc2345').klasse).toBe('2a');
  // zweite Klasse
  await page.getByText('+ Kurzlink für eine weitere Klasse').click();
  await page.getByRole('textbox', { name: 'Klasse' }).fill('2b');
  await page.getByRole('button', { name: 'Kurzlink mit QR-Code erstellen' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/#p=xyz6789$/);
  await expect(page.locator('.kurz-wahl button')).toHaveText(['2b', '2a']);
  await page.locator('.kurz-wahl').getByRole('button', { name: '2a' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/#p=abc2345$/);
  await page.locator('dialog.dialog').getByRole('button', { name: 'schliessen' }).click();

  // Korrektur im Editor erreicht beide Klassen
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.locator('.formular input[type=text]').first().fill('Neu');
  await page.getByRole('button', { name: 'Speichern', exact: true }).first().click();
  await expect.poll(() => [db.get('abc2345').daten.titel, db.get('xyz6789').daten.titel]).toEqual(['Neu', 'Neu']);

  // Schüler*in aus 2b: Antworten tragen den Code der Klasse
  const s = await context.newPage();
  await s.addInitScript(() => localStorage.setItem('lernapp.statistik', JSON.stringify('an')));
  await s.goto('/#p=xyz6789');
  await s.locator('.spiel', { hasText: 'Wahr oder falsch' }).click();
  await s.getByRole('button', { name: 'Wahr', exact: true }).click();
  await sicher(s);
  await expect.poll(() => aufrufe.filter((a) => a.name === 'lw_statistik_melden').length).toBe(1);
  expect(aufrufe.find((a) => a.name === 'lw_statistik_melden').body.p_kurz).toBe('xyz6789');

  // Meine Kurzlinks: Liste mit Aufrufen, umbenennen, löschen
  await page.getByRole('button', { name: 'Meine Pakete' }).click();
  await page.getByRole('button', { name: '🔗 Meine Kurzlinks' }).click();
  await expect(page.locator('.kl-eintrag')).toHaveCount(2);
  await expect(page.locator('.kl-eintrag').first()).toContainText('Klasse: 2b');
  await expect(page.locator('.kl-eintrag').first()).toContainText('1× geöffnet');
  page.once('dialog', (d) => d.accept('2b Sport'));
  await page.locator('.kl-eintrag').first().getByRole('button', { name: 'Umbenennen' }).click();
  await expect(page.locator('.kl-eintrag').first()).toContainText('Klasse: 2b Sport');
  expect(db.get('xyz6789').klasse).toBe('2b Sport');
  expect(db.get('xyz6789').daten.titel).toBe('Neu'); // Inhalt bleibt

  // Auswertung pro Klasse
  await page.locator('.kl-eintrag').nth(1).getByRole('button', { name: 'Auswertung' }).click();
  const klasse = page.getByRole('combobox', { name: 'Klasse wählen' });
  await expect(klasse).toHaveValue('abc2345');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr td').nth(3)).toHaveText('5'); // 2a: erster Versuch 5× falsch
  await page.getByRole('combobox', { name: 'Zählweise' }).selectOption('alle');
  await expect(page.locator('tbody tr td').nth(3)).toHaveText('9'); // alle Versuche
  await klasse.selectOption({ label: 'Klasse 2b Sport (xyz6789)' });
  await expect(page.locator('tbody tr td').nth(3)).toHaveText('1');
  await klasse.selectOption({ label: 'Alle Klassen zusammen' });
  await expect(page.locator('tbody tr td').nth(2)).toHaveText('10');
  await expect(page.locator('tbody tr td').nth(3)).toHaveText('12');
  await expect(page.locator('tbody tr td').nth(7)).toHaveText('2');
  await page.getByRole('combobox', { name: 'Zählweise' }).selectOption('erst');
  await expect(page.locator('tbody tr td').nth(2)).toHaveText('9');
  await expect(page.locator('tbody tr td').nth(3)).toHaveText('8');
  await klasse.selectOption({ label: 'Ohne Kurzlink (eigene Geräte, lange Links)' });
  await expect(page.locator('tbody tr td').nth(3)).toHaveText('2');
  await page.getByRole('button', { name: '← Zurück' }).click();

  page.once('dialog', (d) => d.accept());
  await page.locator('.kl-eintrag').first().getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('.kl-eintrag')).toHaveCount(1);
  expect(db.has('xyz6789')).toBe(false);
  await s.reload();
  await expect(s.locator('.kasten').first()).toContainText('Diesen Kurzlink gibt es nicht');
  expect(fehler).toEqual([]);
});

test('Ältere gespeicherte Kurzlinks werden übernommen', async ({ page, context }) => {
  await datenbank(context);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('lernapp.kurzlinks', JSON.stringify({ 'paket:paket-1': { code: 'abc2345', token: 'x'.repeat(32), erstellt: '2026-11-19T10:00:00Z' } })));
  await lehrperson(page, false);
  await page.getByRole('button', { name: 'Teilen' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/#p=abc2345$/);
  await expect(page.locator('.kurz-text .label')).toHaveText('Kurzlink · ohne Klassenname');
});

test('Wiederholungsrunde: aus zwei Paketen, als Kurzlink, Antworten zählen beim ursprünglichen Paket', async ({ page, context }) => {
  const fehler = fehlerSammeln(page);
  const { db, aufrufe } = await datenbank(context, [
    { paket_id: 'pa', karte_id: 'x', kurz: '', paket_titel: 'A', frage: 'x', art: 'mc', richtig: 1, falsch: 1, wiederholt: 0, erst_richtig: 1, erst_falsch: 1, aktualisiert: '2026-11-20T09:00:00Z' },
  ]);
  await page.goto('/');
  await page.evaluate(() => {
    const p = (id, titel) => Object.assign(LA.paketPruefen(structuredClone(LA.DEMO)), { id, titel, quelle: 'ki' });
    localStorage.setItem('lernapp.pakete', JSON.stringify([p('pa', 'Wasser A'), p('pb', 'Wasser B'), p('pc', 'Nicht gewählt')]));
  });
  await page.reload();
  await page.getByRole('button', { name: '🔀 Wiederholungsrunde' }).click();
  await page.getByRole('button', { name: 'Kurzlink mit QR-Code erstellen' }).click();
  await expect(page.locator('.toast').last()).toContainText('mindestens ein Paket');
  await page.getByLabel('Wasser A').check();
  await page.getByLabel('Wasser B').check();
  await page.getByRole('combobox', { name: 'Anzahl Fragen' }).selectOption('10');
  await page.getByRole('textbox', { name: 'Klasse' }).fill('3c');
  await page.getByRole('button', { name: 'Kurzlink mit QR-Code erstellen' }).click();
  await expect(page.locator('.kurz-url')).toHaveValue(/#p=abc2345$/);
  await expect(page.locator('.kurz-text .label')).toHaveText('Wiederholungsrunde · 10 Fragen · 3c');
  const runde = db.get('abc2345').daten;
  expect(runde.typ).toBe('runde');
  expect(runde.pakete.map((p) => p.id)).toEqual(['pa', 'pb']);
  expect(db.get('abc2345').klasse).toBe('3c');
  expect(aufrufe.some((a) => a.name === 'lw_statistik_melden')).toBe(false);

  // Schüler*in
  const s = await context.newPage();
  const sFehler = fehlerSammeln(s);
  await s.addInitScript(() => localStorage.setItem('lernapp.statistik', JSON.stringify('an')));
  await s.goto('/#p=abc2345');
  await expect(s.getByRole('heading', { level: 1 })).toHaveText('Wiederholungsrunde');
  await expect(s.locator('.intro')).toContainText('10 gemischte Fragen aus: Wasser A, Wasser B');
  await expect(s.locator('.kopf .tag')).toHaveText('Schüleransicht');
  await s.getByRole('button', { name: "Los geht's" }).click();
  for (let i = 0; i < 40 && !(await s.locator('.ergebnis').count()); i++) {
    const feld = s.locator('.spielflaeche input[type=text], main input[type=text]').first();
    if (await feld.count()) { await feld.fill('falsch'); await s.getByRole('button', { name: 'Prüfen' }).click(); }
    else await s.locator('button.option').first().click();
    if (await s.locator('.sicherheit').count()) await s.locator('.sicherheit button').first().click();
    await s.getByRole('button', { name: 'Weiter' }).click();
  }
  await expect(s.locator('.ergebnis-zahl')).toHaveText(/^\d+ \/ 10$/);
  await expect(s.locator('.runde-pakete li')).toHaveCount(2);
  const meldungen = aufrufe.filter((a) => a.name === 'lw_statistik_melden').map((a) => a.body);
  expect(meldungen.length).toBeGreaterThanOrEqual(10);
  expect(new Set(meldungen.map((m) => m.p_paket))).toEqual(new Set(['pa', 'pb']));
  expect(meldungen.every((m) => m.p_kurz === 'abc2345' && m.p_wiederholung === true)).toBe(true);
  expect(fehler).toEqual([]);
  expect(sFehler).toEqual([]);
});
