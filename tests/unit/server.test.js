// Tests für den Schlüssel-Server: startet server.js gegen eine Attrappe der Anthropic-API.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ECHTER_KEY = 'sk-ant-test-ECHT';
let upstream, server, basis;
const gesehen = [];

function freierPort() {
  return new Promise((ok) => { const s = http.createServer().listen(0, () => { const p = s.address().port; s.close(() => ok(p)); }); });
}

test.before(async () => {
  // Attrappe: merkt sich, was ankommt, und antwortet wie die API
  upstream = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      gesehen.push({ url: req.url, headers: req.headers, body: JSON.parse(b || '{}') });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' }));
    });
  });
  await new Promise((ok) => upstream.listen(0, ok));
  const port = await freierPort();
  server = spawn(process.execPath, [path.join(__dirname, '..', '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: ECHTER_KEY, KLASSEN_CODE: 'wasser7b', LIMIT_PRO_STUNDE: '3',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${upstream.address().port}`, MODELLE: 'claude-haiku-5-5,claude-opus-5-5' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((ok, nein) => { server.stdout.on('data', (d) => { if (String(d).includes('läuft')) ok(); }); server.on('exit', () => nein(new Error('Server beendet'))); });
  basis = `http://127.0.0.1:${port}`;
});
test.after(() => { server.kill(); upstream.close(); });

const ki = (body, kopf = {}) => fetch(basis + '/api/anthropic/v1/messages', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': 'platzhalter-aus-dem-browser', authorization: 'Bearer platzhalter-aus-dem-browser', ...kopf }, body: JSON.stringify(body),
});

test('Status meldet Server-KI und Klassencode', async () => {
  const s = await (await fetch(basis + '/api/status')).json();
  assert.deepEqual(s, { serverKi: true, codeNoetig: true, modelle: ['claude-haiku-5-5', 'claude-opus-5-5'] });
});

test('App wird ausgeliefert, Server-Code und fremde Pfade nicht', async () => {
  const index = await fetch(basis + '/');
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(basis + '/server/server.js')).status, 404);
  assert.equal((await fetch(basis + '/%2e%2e/%2e%2e/etc/passwd')).status, 404);
  assert.equal((await fetch(basis + '/..%2f..%2fetc%2fpasswd')).status, 404);
});

test('Ohne oder mit falschem Klassencode: abgewiesen, nichts weitergeleitet', async () => {
  const vorher = gesehen.length;
  assert.equal((await ki({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] })).status, 401);
  assert.equal((await ki({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] }, { 'x-klassen-code': 'falsch' })).status, 401);
  assert.equal(gesehen.length, vorher);
});

test('Nicht freigegebenes Modell und andere Pfade: abgewiesen', async () => {
  const r = await ki({ model: 'claude-sonnet-5-5', max_tokens: 10 }, { 'x-klassen-code': 'wasser7b' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error.message, /nicht freigegeben/);
  const r2 = await fetch(basis + '/api/anthropic/v1/models', { method: 'POST', headers: { 'x-klassen-code': 'wasser7b' }, body: '{}' });
  assert.equal(r2.status, 404);
});

test('Gültige Anfrage: echter Schlüssel ersetzt den Platzhalter, Klassencode bleibt intern, Tokens begrenzt', async () => {
  const r = await ki({ model: 'claude-haiku-5-5', max_tokens: 999999, messages: [{ role: 'user', content: 'Hallo' }] },
    { 'x-klassen-code': 'wasser7b', 'anthropic-beta': 'server-side-fallback-2026-07-01' });
  assert.equal(r.status, 200);
  const a = gesehen.at(-1);
  assert.equal(a.url, '/v1/messages');
  assert.equal(a.headers['x-api-key'], ECHTER_KEY);
  assert.equal(a.headers.authorization, undefined, 'Platzhalter aus dem Browser darf nicht weitergehen');
  assert.equal(a.headers['x-klassen-code'], undefined);
  assert.equal(a.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(a.body.max_tokens, 32000);
});

test('Stundenlimit pro Gerät', async () => {
  // Limit ist 3. Gezählt wird jede Anfrage mit gültigem Klassencode, auch abgelehnte (falsches Modell).
  // Verbraucht sind schon 2: das gesperrte Modell und die gültige Anfrage aus den Tests davor.
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await ki({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] }, { 'x-klassen-code': 'wasser7b' })).status);
  assert.deepEqual(codes, [200, 429, 429]);
  const r = await ki({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] }, { 'x-klassen-code': 'wasser7b' });
  assert.match((await r.json()).error.message, /Stundenlimit/);
});
