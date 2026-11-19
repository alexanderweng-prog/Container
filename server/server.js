// Lernwerkstatt-Server: liefert die App aus und leitet KI-Anfragen an Anthropic weiter.
// Der API-Schlüssel bleibt auf dem Server (Umgebungsvariable ANTHROPIC_API_KEY).
// Keine Abhängigkeiten – nur Node.js ab Version 20.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const PORT = Number(process.env.PORT || 8080);
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const KLASSEN_CODE = process.env.KLASSEN_CODE || '';           // leer = kein Code nötig
const UPSTREAM = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const LIMIT_PRO_STUNDE = Number(process.env.LIMIT_PRO_STUNDE || 60); // KI-Anfragen pro Gerät (IP) und Stunde
const ERLAUBTE_MODELLE = (process.env.MODELLE || 'claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5').split(',').map((s) => s.trim());
const MAX_TOKENS = 32000;
const MAX_BODY = 32 * 1024 * 1024; // PDFs kommen als Base64
const ROOT = path.resolve(process.env.APP_DIR || path.join(__dirname, '..'));

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };

const zaehler = new Map(); // ip -> [zeitstempel]
function limitErreicht(ip) {
  const jetzt = Date.now();
  const liste = (zaehler.get(ip) || []).filter((t) => jetzt - t < 3600_000);
  if (liste.length >= LIMIT_PRO_STUNDE) { zaehler.set(ip, liste); return true; }
  liste.push(jetzt); zaehler.set(ip, liste);
  return false;
}
setInterval(() => { const j = Date.now(); for (const [ip, l] of zaehler) if (!l.some((t) => j - t < 3600_000)) zaehler.delete(ip); }, 600_000).unref();

function json(res, status, daten) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(daten));
}
// Fehlerformat wie die Anthropic-API, damit die App es versteht
const fehler = (res, status, text) => json(res, status, { type: 'error', error: { type: 'lernwerkstatt_error', message: text } });

function koerperLesen(req) {
  return new Promise((ok, nein) => {
    const teile = []; let groesse = 0;
    req.on('data', (c) => { groesse += c.length; if (groesse > MAX_BODY) { nein(new Error('zu gross')); req.destroy(); } else teile.push(c); });
    req.on('end', () => ok(Buffer.concat(teile)));
    req.on('error', nein);
  });
}

async function kiWeiterleiten(req, res, pfad) {
  if (!API_KEY) return fehler(res, 503, 'Auf dem Server ist kein ANTHROPIC_API_KEY gesetzt.');
  if (req.method !== 'POST' || pfad !== '/v1/messages') return fehler(res, 404, 'Nur /v1/messages ist freigegeben.');
  if (KLASSEN_CODE && req.headers['x-klassen-code'] !== KLASSEN_CODE) return fehler(res, 401, 'Klassencode fehlt oder ist falsch.');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (limitErreicht(ip)) return fehler(res, 429, 'Stundenlimit für KI-Anfragen erreicht.');

  let body;
  try { body = JSON.parse((await koerperLesen(req)).toString('utf8')); } catch { return fehler(res, 400, 'Ungültige Anfrage.'); }
  if (!ERLAUBTE_MODELLE.includes(body.model)) return fehler(res, 400, 'Dieses Modell ist auf dem Server nicht freigegeben.');
  body.max_tokens = Math.min(Number(body.max_tokens) || 4000, MAX_TOKENS);

  const kopf = { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': req.headers['anthropic-version'] || '2023-06-01' };
  if (req.headers['anthropic-beta']) kopf['anthropic-beta'] = req.headers['anthropic-beta'];

  let antwort;
  try {
    antwort = await fetch(UPSTREAM + '/v1/messages', { method: 'POST', headers: kopf, body: JSON.stringify(body) });
  } catch (e) {
    console.error('Upstream nicht erreichbar:', e.message);
    return fehler(res, 502, 'Der Server erreicht den KI-Dienst nicht.');
  }
  const weiter = { 'content-type': antwort.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' };
  for (const h of ['request-id', 'retry-after']) if (antwort.headers.get(h)) weiter[h] = antwort.headers.get(h);
  res.writeHead(antwort.status, weiter);
  if (!antwort.body) return res.end();
  Readable.fromWeb(antwort.body).on('error', () => res.destroy()).pipe(res); // Streaming direkt durchreichen
}

function statisch(req, res, pfad) {
  if (pfad === '/') pfad = '/index.html';
  const datei = path.resolve(ROOT, '.' + decodeURIComponent(pfad));
  if (!datei.startsWith(ROOT + path.sep) || datei.includes(`${path.sep}server${path.sep}`)) return fehler(res, 404, 'Nicht gefunden.');
  fs.stat(datei, (err, st) => {
    if (err || !st.isFile()) return fehler(res, 404, 'Nicht gefunden.');
    res.writeHead(200, { 'content-type': TYPEN[path.extname(datei)] || 'application/octet-stream', 'content-length': st.size, 'x-content-type-options': 'nosniff' });
    fs.createReadStream(datei).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const pfad = new URL(req.url, 'http://x').pathname;
  if (pfad === '/api/status') return json(res, 200, { serverKi: !!API_KEY, codeNoetig: !!KLASSEN_CODE, modelle: ERLAUBTE_MODELLE });
  if (pfad.startsWith('/api/anthropic/')) {
    return kiWeiterleiten(req, res, pfad.slice('/api/anthropic'.length)).catch((e) => { console.error(e); if (!res.headersSent) fehler(res, 500, 'Serverfehler.'); else res.destroy(); });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fehler(res, 405, 'Nicht erlaubt.');
  statisch(req, res, pfad);
});

server.listen(PORT, () => {
  console.log(`Lernwerkstatt läuft auf Port ${PORT}`);
  console.log(API_KEY ? 'KI über Server: aktiv' : 'KI über Server: AUS (ANTHROPIC_API_KEY fehlt)');
  console.log(KLASSEN_CODE ? 'Klassencode: aktiv' : 'Klassencode: keiner (jede Person mit Zugriff auf die Adresse kann die KI nutzen)');
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
