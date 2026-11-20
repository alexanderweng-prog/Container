// Plenumsmodus: Lehrperson am Beamer, zwei Lernende auf eigenen Geräten (getrennte Browser-Kontexte)
const { test, expect } = require('@playwright/test');
const { fehlerSammeln } = require('./hilfen');

const SUPABASE = 'https://efsznvanzievcxvewgpi.supabase.co';

// Attrappe der Plenums-Funktionen, gemeinsam für alle Geräte
function plenumDienst() {
  const db = { sitzung: null, stimmen: new Map() };
  const antwort = (route, x) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(x) });
  const handler = async (route) => {
    const name = route.request().url().split('/rpc/')[1];
    const b = JSON.parse(route.request().postData() || '{}');
    const s = db.sitzung;
    const lp = s && b.p_token === s.token;
    if (name === 'lw_plenum_erstellen') { db.sitzung = { code: 'abc234', token: b.p_token, titel: b.p_titel, fragen: b.p_fragen, aktuell: 0, runde: 1, status: 'warten' }; return antwort(route, 'abc234'); }
    if (name === 'lw_plenum_steuern') { if (lp) Object.assign(s, { aktuell: b.p_aktuell, runde: b.p_runde, status: b.p_status }); return antwort(route, !!lp); }
    if (name === 'lw_plenum_zustand') {
      if (!s) return antwort(route, null);
      const f = { ...s.fragen[s.aktuell] };
      if (s.status !== 'loesung') { delete f.richtig; delete f.erklaerung; delete f.rueckmeldungen; }
      return antwort(route, { titel: s.titel, aktuell: s.aktuell, anzahl: s.fragen.length, runde: s.runde, status: s.status, frage: f });
    }
    if (name === 'lw_plenum_abstimmen') {
      const ok = s && s.status === 'offen' && s.aktuell === b.p_frage && s.runde === b.p_runde;
      if (ok) db.stimmen.set(`${b.p_frage}|${b.p_runde}|${b.p_geraet}`, b.p_wahl);
      return antwort(route, !!ok);
    }
    if (name === 'lw_plenum_ergebnis') {
      if (!lp) return antwort(route, null);
      const runden = {}, geraete = new Set();
      for (const [k, w] of db.stimmen) {
        const [f, r, g] = k.split('|'); geraete.add(g);
        if (Number(f) !== s.aktuell) continue;
        runden[r] = runden[r] || {}; runden[r][w] = (runden[r][w] || 0) + 1;
      }
      return antwort(route, { teilnehmende: geraete.size, runden });
    }
    if (name === 'lw_plenum_beenden') { if (lp) db.sitzung = null; return antwort(route, !!lp); }
    return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' } });
  };
  return { db, verbinden: (ctx) => ctx.route(SUPABASE + '/rest/v1/rpc/**', handler) };
}

test('Plenum: abstimmen, Verteilung erst danach, Diskussion, zweite Runde, Lösung', async ({ page, context, browser }) => {
  test.setTimeout(90000);
  const fehler = fehlerSammeln(page);
  const dienst = plenumDienst();
  await dienst.verbinden(context);
  await page.goto('/');
  await page.evaluate(() => {
    const p = Object.assign(LA.paketPruefen(structuredClone(LA.DEMO)), { id: 'p1', quelle: 'ki' });
    localStorage.setItem('lernapp.pakete', JSON.stringify([p]));
  });
  await page.reload();
  await page.locator('.karte').click();
  await page.getByRole('button', { name: '🗳️ Plenum' }).click();
  await page.getByRole('button', { name: 'Keine' }).click();
  await page.getByRole('button', { name: 'Plenum starten' }).click();
  await expect(page.locator('.toast').last()).toContainText('mindestens eine Frage');
  await page.getByLabel(/Woraus bestehen Wolken/).check();
  await page.getByLabel(/Welcher Vorgang braucht Energie/).check();
  await page.getByRole('button', { name: 'Plenum starten' }).click();
  await expect(page).toHaveURL(/#plenum=abc234$/);
  await expect(page.locator('.pl-frage')).toHaveText('Welcher Vorgang braucht Energie?');
  await expect(page.locator('.pl-qr svg')).toBeVisible();
  expect(dienst.db.sitzung.fragen.length).toBe(2);

  // Zwei Lernende auf eigenen Geräten
  const geraete = [];
  for (let i = 0; i < 2; i++) {
    const ctx = await browser.newContext({ baseURL: page.url().split('#')[0].replace(/\/$/, '') });
    await dienst.verbinden(ctx);
    const s = await ctx.newPage();
    await s.goto('/#l=abc234');
    geraete.push(s);
  }
  const [anna, ben] = geraete;
  await expect(anna.locator('.pl-warten')).toContainText('Gleich geht');
  await expect(anna.locator('.kopf .tag')).toHaveText('Schüleransicht');

  // Runde 1
  await page.getByRole('button', { name: 'Abstimmung starten' }).click();
  await expect(anna.locator('.pl-sus .frage')).toHaveText('Welcher Vorgang braucht Energie?');
  await anna.locator('.option', { hasText: 'Kondensieren' }).click();
  await anna.locator('.option', { hasText: 'Verdunsten' }).click(); // Meinung geändert
  await expect(anna.locator('.option.gewaehlt')).toContainText('Verdunsten');
  await expect(anna.locator('.rueckmeldung')).toContainText('Deine Stimme ist angekommen');
  await ben.locator('.option', { hasText: 'Kondensieren' }).click();
  await expect(page.locator('.pl-status')).toContainText('2 Stimmen');
  await expect(page.locator('.pl-zahl')).toHaveText('2');
  await expect(page.locator('.pl-balken')).toHaveCount(0); // Verteilung noch verborgen
  expect(await anna.evaluate(() => document.body.innerText)).not.toContain('Beim Verdunsten nimmt'); // keine Lösung vorab

  await page.getByRole('button', { name: 'Abstimmung beenden' }).click();
  await expect(page.locator('.pl-balken')).toHaveCount(4);
  await expect(page.locator('.pl-status')).toContainText('geteilter Meinung');
  await expect(ben.locator('.option').first()).toBeDisabled();

  // Diskussion und Runde 2
  await page.getByRole('button', { name: 'Zu zweit diskutieren, dann nochmals abstimmen' }).click();
  await expect(ben.locator('.kasten')).toContainText('Diskutiere mit deiner Nachbarin');
  await ben.locator('.option', { hasText: 'Verdunsten' }).click();
  await anna.locator('.option', { hasText: 'Verdunsten' }).click();
  await expect(page.locator('.pl-status')).toContainText('2 Stimmen');
  await page.getByRole('button', { name: 'Abstimmung beenden' }).click();
  await expect(page.locator('.pl-balken.runde1')).toHaveCount(4);
  await expect(page.locator('.pl-option', { hasText: 'Verdunsten' }).locator('.pl-balken').last()).toContainText('2 · 100 %');

  // Lösung
  await page.getByRole('button', { name: 'Lösung zeigen' }).click();
  await expect(page.locator('.pl-option.richtig')).toContainText('Verdunsten');
  await expect(ben.locator('.rueckmeldung')).toContainText('Die Diskussion hat sich gelohnt');
  await expect(anna.locator('.rueckmeldung')).toContainText('Richtig.');

  // Nächste Frage, dann beenden
  await page.getByRole('button', { name: 'Nächste Frage' }).click();
  await expect(page.locator('.pl-frage')).toHaveText('Woraus bestehen Wolken?');
  await expect(anna.locator('.pl-warten')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Beenden' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aus deinem Material wird eine Lern-App');
  expect(dienst.db.sitzung).toBeNull();
  await expect(anna.locator('.pl-sus')).toContainText('gibt es nicht (mehr)');
  expect(fehler).toEqual([]);
});
