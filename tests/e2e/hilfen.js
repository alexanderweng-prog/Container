// Gemeinsame Hilfen für die Browser-Tests
const { expect } = require('@playwright/test');

// Fängt Seitenfehler ab; am Testende muss die Liste leer sein
function fehlerSammeln(page) {
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') fehler.push('Konsole: ' + m.text()); });
  return fehler;
}

// Simuliert die Anthropic-API (Streaming wie das Original). antwort(body) gibt ein Objekt zurück.
async function kiAttrappe(page, antwort) {
  const anfragen = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    anfragen.push({ body, headers: await route.request().allHeaders() });
    const json = JSON.stringify(await antwort(body));
    const ev = (t, d) => `event: ${t}\ndata: ${JSON.stringify(d)}\n\n`;
    let sse = ev('message_start', { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } })
      + ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    for (let i = 0; i < json.length; i += 400) sse += ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: json.slice(i, i + 400) } });
    sse += ev('content_block_stop', { type: 'content_block_stop', index: 0 })
      + ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } })
      + ev('message_stop', { type: 'message_stop' });
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse });
  });
  return anfragen;
}

async function demoOeffnen(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Demo ansehen/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Der Wasserkreislauf' })).toBeVisible();
}

const spielOeffnen = (page, name) => page.locator('.spiel', { hasText: name }).click();
const zurueck = (page) => page.locator('.zurueck').click();

// Antwort auf «Wie sicher bist du?» (erscheint vor dem Auflösen)
const sicher = (page, wert = 'Sicher') => page.locator('.sicherheit').getByRole('button', { name: wert, exact: true }).click();

module.exports = { fehlerSammeln, kiAttrappe, demoOeffnen, spielOeffnen, zurueck, sicher };
