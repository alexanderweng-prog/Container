// Gemeinsamer Kern für den Container-Server (server/server.js) und Vercel (api/).
// Arbeitet mit Web-Standard Request/Response. Der API-Schlüssel kommt nur aus der Umgebung.
'use strict';

const MAX_TOKENS = 32000;
const MAX_BODY = 32 * 1024 * 1024; // PDFs kommen als Base64 (Vercel selbst erlaubt nur ca. 4,5 MB)

function einstellungen(env) {
  return {
    apiKey: env.ANTHROPIC_API_KEY || '',
    klassenCode: env.KLASSEN_CODE || '',
    upstream: (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
    limit: Number(env.LIMIT_PRO_STUNDE || 60), // pro Gerät
    // pro IP-Adresse: im Schulnetz teilen sich oft alle Geräte eine Adresse, darum grosszügig
    limitIp: Number(env.LIMIT_PRO_IP_STUNDE || 1500),
    modelle: (env.MODELLE || 'claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5').split(',').map((s) => s.trim()).filter(Boolean),
    // Auf Vercel ist die Adresse öffentlich: ohne Klassencode keine KI (ausser ausdrücklich abgeschaltet)
    codePflicht: env.VERCEL === '1' && env.OHNE_KLASSENCODE !== '1',
  };
}

// Stundenlimit pro Schlüssel (Gerät oder IP). Auf Vercel zählt jede laufende Instanz für sich:
// Das Limit ist dort eher grosszügiger als eingestellt, blockiert aber nie zu früh.
function neuerZaehler() {
  const zaehler = new Map();
  return {
    // Mehrere Limits gemeinsam: gezählt wird nur, wenn keines voll ist. Gibt den Index des vollen Limits zurück, sonst -1.
    pruefen(regeln) {
      const jetzt = Date.now();
      const listen = regeln.map(([k]) => (zaehler.get(k) || []).filter((t) => jetzt - t < 3600_000));
      const voll = regeln.findIndex(([, limit], i) => listen[i].length >= limit);
      regeln.forEach(([k], i) => { if (voll < 0) listen[i].push(jetzt); zaehler.set(k, listen[i]); });
      if (zaehler.size > 5000) for (const [k, l] of zaehler) if (!l.some((t) => jetzt - t < 3600_000)) zaehler.delete(k);
      return voll;
    },
  };
}

const json = (status, daten) => new Response(JSON.stringify(daten), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
// Fehlerformat wie die Anthropic-API, damit die App es versteht
const fehler = (status, text) => {
  const r = json(status, { type: 'error', error: { type: 'lernwerkstatt_error', message: text } });
  // Die Anthropic-Bibliothek soll bei unseren Sperren nicht automatisch wiederholen (jeder Versuch würde mitzählen)
  if (status === 429) r.headers.set('x-should-retry', 'false');
  return r;
};

// Zufällige Kennung aus dem Browser (kein Name, nur für das Limit). Fehlt sie, zählt die IP-Adresse als Gerät.
const geraetVon = (request) => {
  const g = request.headers.get('x-geraet') || '';
  return /^[A-Za-z0-9_-]{16,64}$/.test(g) ? g : '';
};

function status(env) {
  const e = einstellungen(env);
  const ki = !!e.apiKey && !(e.codePflicht && !e.klassenCode);
  // Vercel nimmt pro Anfrage nur ca. 4,5 MB an: die App warnt vorher bei grossen Dateien
  const maxAnfrage = env.VERCEL === '1' ? 4_300_000 : MAX_BODY;
  return json(200, { serverKi: ki, codeNoetig: !!e.klassenCode, modelle: e.modelle, maxAnfrage });
}

/**
 * KI-Anfrage prüfen und an Anthropic weiterleiten.
 * @param {Request} request  eingehende Anfrage (Pfad endet auf /v1/messages)
 * @param {object} env       Umgebungsvariablen
 * @param {object} opt       { ip, zaehler, pfad }
 */
async function weiterleiten(request, env, { ip, zaehler, pfad }) {
  const e = einstellungen(env);
  if (!e.apiKey) return fehler(503, 'Auf dem Server ist kein ANTHROPIC_API_KEY gesetzt.');
  if (e.codePflicht && !e.klassenCode) return fehler(503, 'Auf Vercel muss ein KLASSEN_CODE gesetzt sein, sonst könnte jede Person mit der Adresse die KI auf deine Kosten nutzen.');
  if (request.method !== 'POST' || pfad !== '/v1/messages') return fehler(404, 'Nur /v1/messages ist freigegeben.');
  if (e.klassenCode && request.headers.get('x-klassen-code') !== e.klassenCode) return fehler(401, 'Klassencode fehlt oder ist falsch.');
  const adresse = ip || 'unbekannt', geraet = geraetVon(request);
  const regeln = [[geraet ? 'g:' + geraet : 'ip-geraet:' + adresse, e.limit]];
  if (geraet) regeln.push(['ip:' + adresse, e.limitIp]);
  const voll = zaehler.pruefen(regeln);
  if (voll === 0) return fehler(429, `Stundenlimit für KI-Anfragen auf diesem Gerät erreicht (${e.limit} pro Stunde). Bitte später nochmals versuchen.`);
  if (voll === 1) return fehler(429, 'Stundenlimit für KI-Anfragen in diesem Netz erreicht. Bitte später nochmals versuchen.');

  const laenge = Number(request.headers.get('content-length') || 0);
  if (laenge > MAX_BODY) return fehler(413, 'Die Anfrage ist zu gross.');
  let body;
  try { body = JSON.parse(await request.text()); } catch { return fehler(400, 'Ungültige Anfrage.'); }
  if (!e.modelle.includes(body.model)) return fehler(400, 'Dieses Modell ist auf dem Server nicht freigegeben.');
  body.max_tokens = Math.min(Number(body.max_tokens) || 4000, MAX_TOKENS);

  // Nur diese Header gehen weiter; Schlüssel/Platzhalter aus dem Browser und der Klassencode nicht
  const kopf = { 'content-type': 'application/json', 'x-api-key': e.apiKey, 'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01' };
  if (request.headers.get('anthropic-beta')) kopf['anthropic-beta'] = request.headers.get('anthropic-beta');

  let antwort;
  try {
    antwort = await fetch(e.upstream + '/v1/messages', { method: 'POST', headers: kopf, body: JSON.stringify(body) });
  } catch (err) {
    console.error('Upstream nicht erreichbar:', err.message);
    return fehler(502, 'Der Server erreicht den KI-Dienst nicht.');
  }
  const weiter = new Headers({ 'content-type': antwort.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' });
  for (const h of ['request-id', 'retry-after']) if (antwort.headers.get(h)) weiter.set(h, antwort.headers.get(h));
  return new Response(antwort.body, { status: antwort.status, headers: weiter }); // Streaming direkt durchreichen
}

module.exports = { status, weiterleiten, neuerZaehler, einstellungen };
