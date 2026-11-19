// Vercel-Funktionen direkt aufrufen (wie Vercel es tut), gegen eine Attrappe der Anthropic-API
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

let upstream;
const gesehen = [];
const laden = async (datei) => (await import(path.join(__dirname, '..', '..', 'api', datei))).default;

function umgebung(werte) {
  for (const k of ['ANTHROPIC_API_KEY', 'KLASSEN_CODE', 'VERCEL', 'OHNE_KLASSENCODE', 'MODELLE', 'LIMIT_PRO_STUNDE']) delete process.env[k];
  Object.assign(process.env, { ANTHROPIC_BASE_URL: `http://127.0.0.1:${upstream.address().port}` }, werte);
}
const anfrage = (body, kopf = {}) => new Request('https://lernwerkstatt.vercel.app/api/anthropic/v1/messages', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer platzhalter', 'x-real-ip': '1.2.3.4', ...kopf }, body: JSON.stringify(body),
});

test.before(async () => {
  upstream = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      gesehen.push({ headers: req.headers, body: JSON.parse(b) });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('event: ping\ndata: {}\n\n');
      setTimeout(() => res.end('event: message_stop\ndata: {}\n\n'), 20); // gestreamt in zwei Teilen
    });
  });
  await new Promise((ok) => upstream.listen(0, ok));
});
test.after(() => upstream.close());

test('Status auf Vercel: ohne Klassencode keine KI, Grössenlimit wird gemeldet', async () => {
  const status = await laden('status.mjs');
  umgebung({ VERCEL: '1', ANTHROPIC_API_KEY: 'sk-ant-geheim' });
  let s = await (await status.fetch(new Request('https://x/api/status'))).json();
  assert.equal(s.serverKi, false, 'öffentliche Adresse ohne Code: KI aus');
  assert.ok(s.maxAnfrage < 4_500_000);
  umgebung({ VERCEL: '1', ANTHROPIC_API_KEY: 'sk-ant-geheim', KLASSEN_CODE: 'abc' });
  s = await (await status.fetch(new Request('https://x/api/status'))).json();
  assert.equal(s.serverKi, true);
  assert.equal(s.codeNoetig, true);
  umgebung({ VERCEL: '1', ANTHROPIC_API_KEY: 'sk-ant-geheim', OHNE_KLASSENCODE: '1' });
  s = await (await status.fetch(new Request('https://x/api/status'))).json();
  assert.equal(s.serverKi, true, 'bewusst ohne Code erlaubt');
});

test('Weiterleitung auf Vercel: Code nötig, Schlüssel ersetzt, Streaming kommt durch', async () => {
  const fn = await laden('anthropic/v1/messages.mjs');
  umgebung({ VERCEL: '1', ANTHROPIC_API_KEY: 'sk-ant-geheim' });
  let r = await fn.fetch(anfrage({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] }));
  assert.equal(r.status, 503);
  assert.match((await r.json()).error.message, /KLASSEN_CODE/);

  umgebung({ VERCEL: '1', ANTHROPIC_API_KEY: 'sk-ant-geheim', KLASSEN_CODE: 'abc' });
  r = await fn.fetch(anfrage({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] }, { 'x-klassen-code': 'falsch' }));
  assert.equal(r.status, 401);

  const vorher = gesehen.length;
  r = await fn.fetch(anfrage({ model: 'claude-haiku-5-5', max_tokens: 99999, messages: [] }, { 'x-klassen-code': 'abc' }));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /event-stream/);
  const text = await r.text();
  assert.match(text, /ping[\s\S]*message_stop/, 'beide gestreamten Teile kommen an');
  const a = gesehen[vorher];
  assert.equal(a.headers['x-api-key'], 'sk-ant-geheim');
  assert.equal(a.headers.authorization, undefined);
  assert.equal(a.headers['x-klassen-code'], undefined);
  assert.equal(a.body.max_tokens, 32000);
});

test('Ausserhalb von Vercel gilt die Code-Pflicht nicht (Container im eigenen Netz)', async () => {
  const fn = await laden('anthropic/v1/messages.mjs');
  umgebung({ ANTHROPIC_API_KEY: 'sk-ant-geheim' });
  const r = await fn.fetch(anfrage({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] }));
  assert.equal(r.status, 200);
  await r.text();
});
