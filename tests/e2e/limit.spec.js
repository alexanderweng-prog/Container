// Server-Modus: Gerätekennung für das Stundenlimit, keine automatischen Wiederholungen bei einer Sperre
const { test, expect } = require('@playwright/test');

test('Gerätekennung wird mitgeschickt, gesperrte Anfrage wird nicht wiederholt', async ({ page }) => {
  const anfragen = [];
  await page.route('**/api/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ serverKi: true, codeNoetig: true, modelle: ['claude-haiku-5-5'], maxAnfrage: 4300000 }) }));
  await page.route('**/api/anthropic/v1/messages', async (r) => {
    anfragen.push(await r.request().allHeaders());
    await r.fulfill({ status: 429, contentType: 'application/json', headers: { 'x-should-retry': 'false' },
      body: JSON.stringify({ type: 'error', error: { type: 'lernwerkstatt_error', message: 'Stundenlimit für KI-Anfragen auf diesem Gerät erreicht (60 pro Stunde).' } }) });
  });
  await page.goto('/');
  await page.evaluate(() => LA.einstellungenSpeichern({ klassenCode: 'abc' }));
  const fehler = await page.evaluate(() => LA.antwortBewerten({ frage: 'F', musterantwort: 'M', kriterien: [], antwort: 'A', stufe: 'Sek I' }).then(() => '', (e) => e.message));
  expect(fehler).toMatch(/Stundenlimit/);
  expect(anfragen.length).toBe(1);
  expect(anfragen[0]['x-klassen-code']).toBe('abc');
  expect(anfragen[0]['x-geraet']).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  // Dieselbe Kennung bei der nächsten Anfrage (auch nach dem Neuladen)
  await page.reload();
  await page.evaluate(() => LA.antwortBewerten({ frage: 'F', musterantwort: 'M', kriterien: [], antwort: 'A', stufe: 'Sek I' }).catch(() => {}));
  expect(anfragen[1]['x-geraet']).toBe(anfragen[0]['x-geraet']);
});
