// Kurzlinks mit QR-Code – Supabase wird abgefangen (eine kleine Attrappe im Speicher)
const { test, expect } = require('@playwright/test');
const { fehlerSammeln } = require('./hilfen');

const SUPABASE = 'https://efsznvanzievcxvewgpi.supabase.co';

// Verhält sich wie die drei Datenbank-Funktionen
async function datenbank(context) {
  const db = new Map(); const aufrufe = [];
  let nummer = 0;
  await context.route(SUPABASE + '/rest/v1/rpc/**', async (route) => {
    const name = route.request().url().split('/rpc/')[1];
    const body = JSON.parse(route.request().postData() || '{}');
    aufrufe.push({ name, body });
    const antwort = (x) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(x) });
    if (name === 'lw_paket_teilen') { const code = ['abc2345', 'xyz6789'][nummer++]; db.set(code, { daten: body.p_daten, token: body.p_token }); return antwort(code); }
    if (name === 'lw_paket_aktualisieren') { const e = db.get(body.p_code); if (e && e.token === body.p_token) { e.daten = body.p_daten; return antwort(true); } return antwort(false); }
    if (name === 'lw_paket_laden') return antwort(db.has(body.p_code) ? db.get(body.p_code).daten : null);
    return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
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
  await context.route(SUPABASE + '/**', (r) => r.abort());
  await s.reload();
  await expect(s.getByRole('heading', { level: 1 })).toHaveText('Der Wasserkreislauf');
  await expect(s.locator('.toast').first()).toContainText('Offline');
  expect(fehler.filter((f) => !f.includes('Failed to load resource'))).toEqual([]);
});
