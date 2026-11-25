// Lernwerkstatt-Server: liefert die App aus und leitet KI-Anfragen an Anthropic weiter.
// Der API-Schlüssel bleibt auf dem Server (Umgebungsvariable ANTHROPIC_API_KEY).
// Keine Abhängigkeiten – nur Node.js ab Version 20.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const kern = require('./kern.cjs');

const PORT = Number(process.env.PORT || 8080);
// Nur hinter einem eigenen Proxy (z. B. Caddy) einschalten: Sonst könnte jede Person den Header fälschen und das Limit umgehen.
const PROXY_VERTRAUEN = process.env.PROXY_VERTRAUEN === '1';
const MAX_BODY = 32 * 1024 * 1024; // PDFs kommen als Base64
const ROOT = path.resolve(process.env.APP_DIR || path.join(__dirname, '..'));

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
const zaehler = kern.neuerZaehler();

function fehler(res, status, text) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ type: 'error', error: { type: 'lernwerkstatt_error', message: text } }));
}

function koerperLesen(req) {
  return new Promise((ok, nein) => {
    const teile = []; let groesse = 0;
    req.on('data', (c) => { groesse += c.length; if (groesse > MAX_BODY) { nein(new Error('zu gross')); req.destroy(); } else teile.push(c); });
    req.on('end', () => ok(Buffer.concat(teile)));
    req.on('error', nein);
  });
}

// Web-Response (aus dem Kern) in die Node-Antwort schreiben, Streaming inklusive
function senden(res, antwort) {
  res.writeHead(antwort.status, Object.fromEntries(antwort.headers));
  if (!antwort.body) return res.end();
  Readable.fromWeb(antwort.body).on('error', () => res.destroy()).pipe(res);
}

async function kiWeiterleiten(req, res, pfad) {
  // Hinter Caddy steht die echte Adresse im letzten Eintrag von X-Forwarded-For (den setzt Caddy selbst)
  const weitergeleitet = PROXY_VERTRAUEN ? String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() : '';
  const ip = weitergeleitet || req.socket.remoteAddress;
  const body = req.method === 'POST' ? await koerperLesen(req) : undefined;
  const anfrage = new Request('http://intern' + req.url, { method: req.method, headers: req.headers, body });
  senden(res, kern.mitCors(await kern.weiterleiten(anfrage, process.env, { ip, zaehler, pfad }), anfrage, process.env));
}

function statisch(req, res, pfad) {
  if (pfad === '/') pfad = '/index.html';
  const datei = path.resolve(ROOT, '.' + decodeURIComponent(pfad));
  if (!datei.startsWith(ROOT + path.sep) || /[\\/](server|tests|node_modules|\.git)[\\/]/.test(datei.slice(ROOT.length)) || path.basename(datei).startsWith('.')) return fehler(res, 404, 'Nicht gefunden.');
  fs.stat(datei, (err, st) => {
    if (err || !st.isFile()) return fehler(res, 404, 'Nicht gefunden.');
    res.writeHead(200, { 'content-type': TYPEN[path.extname(datei)] || 'application/octet-stream', 'content-length': st.size, 'x-content-type-options': 'nosniff' });
    fs.createReadStream(datei).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const pfad = new URL(req.url, 'http://x').pathname;
  // Für die CORS-Prüfung reicht ein Request mit den Kopfzeilen (ohne Inhalt)
  const nurKopf = () => new Request('http://intern' + req.url, { method: 'GET', headers: req.headers });
  if (pfad.startsWith('/api/') && req.method === 'OPTIONS') return senden(res, kern.vorab(nurKopf(), process.env));
  if (pfad === '/api/status') return senden(res, kern.mitCors(kern.status(process.env), nurKopf(), process.env));
  if (pfad.startsWith('/api/anthropic/')) {
    return kiWeiterleiten(req, res, pfad.slice('/api/anthropic'.length)).catch((e) => { console.error(e); if (!res.headersSent) fehler(res, 500, 'Serverfehler.'); else res.destroy(); });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fehler(res, 405, 'Nicht erlaubt.');
  statisch(req, res, pfad);
});

server.listen(PORT, () => {
  console.log(`Lernwerkstatt läuft auf Port ${PORT}`);
  const e = kern.einstellungen(process.env);
  console.log(e.apiKey ? 'KI über Server: aktiv' : 'KI über Server: AUS (ANTHROPIC_API_KEY fehlt)');
  if (PROXY_VERTRAUEN) console.log('Proxy-Modus: Absender-IP aus X-Forwarded-For');
  console.log(e.klassenCode ? 'Klassencode: aktiv' : 'Klassencode: keiner (jede Person mit Zugriff auf die Adresse kann die KI nutzen)');
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
