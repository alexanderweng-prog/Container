/* Anonyme Statistik für Lehrpersonen: pro Frage, wie oft richtig, falsch und in einer Wiederholung beantwortet.
   Keine Namen, keine Geräte-Kennung. Gespeichert in Supabase (Tabelle lw_statistik), öffentlich lesbar.
   Schreiben nur über die Datenbank-Funktion lw_statistik_melden (zählt nur hoch). */
(function (LA) {
  const { h } = LA;

  // Öffentliche Verbindungsdaten (der «publishable key» ist dafür gedacht, in Webseiten zu stehen).
  // Leer lassen, um die Statistik abzuschalten.
  LA.STATISTIK = {
    url: 'https://efsznvanzievcxvewgpi.supabase.co',
    schluessel: 'sb_publishable_mJIRn9_fyhTj2Wwm9A_fSw_1xifb1HF',
  };

  const ARTEN = { mc: 'Multiple Choice', kap: 'Lernpfad', wf: 'Wahr/Falsch', begriff: 'Fachbegriff', kat: 'Zuordnen', lt: 'Lückentext' };
  LA.STATISTIK_ARTEN = ARTEN;

  // Pro Gerät abschaltbar (z. B. auf dem Gerät der Lehrperson, damit eigene Tests nicht mitzählen).
  // Auf localhost aus, damit Entwicklung und Tests keine echten Zahlen verfälschen.
  LA.statistikAktiv = function () {
    if (!LA.STATISTIK.url || !LA.STATISTIK.schluessel) return false;
    const wahl = LA.speicher.lesen('lernapp.statistik', null);
    if (wahl === 'aus') return false;
    if (wahl === 'an') return true;
    return !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && location.protocol !== 'file:';
  };
  LA.statistikEinstellen = (an) => LA.speicher.schreiben('lernapp.statistik', an ? 'an' : 'aus');

  // Pakete, deren Fragen gemeldet werden dürfen (die App trägt sie beim Öffnen ein)
  const pakete = new Map();
  LA.statistikPaket = function (p) { if (p && p.id) pakete.set(p.id, p); };

  // Kurzer Fingerabdruck (FNV-1a, 32 Bit): Frage bleibt dieselbe Zeile, auch wenn sie im Paket verschoben wird
  LA.fingerabdruck = function (text) {
    let x = 0x811c9dc5;
    const s = LA.norm(text);
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return x.toString(16).padStart(8, '0');
  };

  // Lesbarer Text einer Karte für die Auswertung
  LA.karteText = function (k) {
    switch (k.art) {
      case 'mc': return k.frage.frage;
      case 'wf': return k.aussage.aussage;
      case 'begriff': return `Begriff «${k.begriff.begriff}» (${k.begriff.erklaerung})`;
      case 'kat': return `Gruppe von «${k.begriff.begriff}» (→ ${k.begriff.kategorie})`;
      case 'luecke': return `Lücke «${k.loesung}» in «${k.quelle}»`;
      default: return '';
    }
  };

  // Die Daten, die gemeldet werden: nur Paket, Frage und Ergebnis
  LA.statistikMeldung = function (p, karteId, richtig, wiederholung) {
    const k = LA.karten(p).get(karteId);
    if (!k) return null;
    const art = karteId.split(':')[0];
    const text = LA.karteText(k);
    return {
      p_paket: String(p.id).slice(0, 64),
      p_titel: (p.titel + (p.niveau ? ` · Niveau ${p.niveau}` : '')).slice(0, 200),
      p_karte: `${art}:${LA.fingerabdruck(art + '|' + text)}`,
      p_frage: text.slice(0, 400),
      p_art: art,
      p_richtig: !!richtig,
      p_wiederholung: !!wiederholung,
    };
  };

  LA.statistikMelden = function (paketId, karteId, richtig, wiederholung) {
    try {
      if (!LA.statistikAktiv()) return;
      const p = pakete.get(paketId);
      if (!p || p.quelle === 'demo') return; // Demo zählt nicht
      const body = LA.statistikMeldung(p, karteId, richtig, wiederholung);
      if (!body) return;
      fetch(LA.STATISTIK.url + '/rest/v1/rpc/lw_statistik_melden', {
        method: 'POST', keepalive: true,
        headers: { 'content-type': 'application/json', apikey: LA.STATISTIK.schluessel },
        body: JSON.stringify(body),
      }).catch(() => { /* offline oder gesperrt: Lernen geht trotzdem weiter */ });
    } catch { /* Statistik darf das Lernen nie stören */ }
  };

  // Alle Zeilen laden (Supabase liefert höchstens 1000 pro Anfrage)
  LA.statistikLaden = async function () {
    const zeilen = [];
    for (let von = 0; von < 50000; von += 1000) {
      const r = await fetch(LA.STATISTIK.url + '/rest/v1/lw_statistik?select=*&order=paket_titel.asc,karte_id.asc', {
        headers: { apikey: LA.STATISTIK.schluessel, 'range-unit': 'items', range: `${von}-${von + 999}` },
      });
      if (!r.ok && r.status !== 206) throw new Error(`Die Statistik konnte nicht geladen werden (${r.status}).`);
      const teil = await r.json();
      zeilen.push(...teil);
      if (teil.length < 1000) break;
    }
    return zeilen;
  };

  /* ---------- Auswertung ---------- */
  const prozent = (z) => (z.richtig + z.falsch ? z.falsch / (z.richtig + z.falsch) : 0);

  LA.auswertung = function (ziel, { nurPakete, zurueck } = {}) {
    const status = h('p', { class: 'hinweis', 'aria-live': 'polite' }, 'Lädt …');
    const filterPaket = h('select', { 'aria-label': 'Paket wählen' });
    const suche = h('input', { type: 'text', placeholder: 'Frage suchen …', 'aria-label': 'Frage suchen' });
    const minimum = h('select', { 'aria-label': 'Mindestanzahl Antworten' },
      [1, 3, 5, 10, 20].map((n) => h('option', { value: n }, `ab ${n} Antwort${n === 1 ? '' : 'en'}`)));
    const inhalt = h('div');
    let daten = [];

    const zeichnen = () => {
      const gewaehlt = filterPaket.value, s = LA.norm(suche.value), min = Number(minimum.value);
      const gruppen = new Map();
      for (const z of daten) {
        if (gewaehlt && z.paket_id !== gewaehlt) continue;
        if (s && !LA.norm(z.frage).includes(s)) continue;
        if (z.richtig + z.falsch < min) continue;
        if (!gruppen.has(z.paket_id)) gruppen.set(z.paket_id, { titel: z.paket_titel, zeilen: [] });
        gruppen.get(z.paket_id).zeilen.push(z);
      }
      if (!gruppen.size) { LA.setzen(inhalt, h('p', { class: 'hinweis' }, daten.length ? 'Keine Fragen passen zum Filter.' : 'Noch keine Antworten gezählt.')); return; }
      LA.setzen(inhalt, [...gruppen.entries()].sort((a, b) => a[1].titel.localeCompare(b[1].titel)).map(([id, g]) => {
        const zeilen = g.zeilen.sort((a, b) => prozent(b) - prozent(a) || (b.falsch - a.falsch));
        const summe = zeilen.reduce((x, z) => ({ r: x.r + z.richtig, f: x.f + z.falsch, w: x.w + z.wiederholt }), { r: 0, f: 0, w: 0 });
        return h('section', { class: 'aw-paket' },
          h('div', { class: 'reihe zwischen' }, h('h2', null, g.titel || id), h('span', { class: 'hinweis' },
            `${zeilen.length} Fragen · ${summe.r + summe.f} Antworten · ${Math.round(summe.f / Math.max(1, summe.r + summe.f) * 100)} % falsch · ${summe.w}× in Wiederholung`)),
          h('div', { class: 'aw-tabelle-wrap' }, h('table', { class: 'aw-tabelle' },
            h('thead', null, h('tr', null, h('th', null, 'Frage'), h('th', null, 'Art'), h('th', { class: 'zahl' }, 'richtig'), h('th', { class: 'zahl' }, 'falsch'), h('th', null, 'Anteil falsch'), h('th', { class: 'zahl' }, 'wiederholt'))),
            h('tbody', null, zeilen.map((z) => {
              const q = prozent(z);
              return h('tr', null,
                h('td', null, z.frage),
                h('td', { class: 'hinweis' }, ARTEN[z.art] || z.art),
                h('td', { class: 'zahl' }, z.richtig),
                h('td', { class: 'zahl' }, z.falsch),
                h('td', null, h('div', { class: 'aw-balken', title: `${Math.round(q * 100)} % falsch` },
                  h('div', { class: 'aw-fuellung' + (q >= 0.5 ? ' hoch' : q >= 0.25 ? ' mittel' : ''), style: { width: Math.round(q * 100) + '%' } }),
                  h('span', null, `${Math.round(q * 100)} %`))),
                h('td', { class: 'zahl' }, z.wiederholt));
            })))));
      }));
    };

    const csv = () => {
      const kopf = ['Paket', 'Frage', 'Art', 'richtig', 'falsch', 'Anteil falsch (%)', 'wiederholt', 'zuletzt'];
      const feld = (x) => `"${String(x).replace(/"/g, '""')}"`;
      const zeilen = daten.filter((z) => !filterPaket.value || z.paket_id === filterPaket.value)
        .map((z) => [z.paket_titel, z.frage, ARTEN[z.art] || z.art, z.richtig, z.falsch, Math.round(prozent(z) * 100), z.wiederholt, z.aktualisiert].map(feld).join(';'));
      LA.download('lernwerkstatt-auswertung.csv', '﻿' + [kopf.map(feld).join(';'), ...zeilen].join('\r\n'), 'text/csv;charset=utf-8');
    };

    const laden = async () => {
      status.textContent = 'Lädt …';
      try {
        daten = await LA.statistikLaden();
        if (nurPakete) daten = daten.filter((z) => nurPakete.includes(z.paket_id));
        const titel = new Map(daten.map((z) => [z.paket_id, z.paket_titel]));
        const vorher = filterPaket.value;
        LA.setzen(filterPaket, h('option', { value: '' }, 'Alle Pakete'), [...titel.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, t]) => h('option', { value: id, selected: id === vorher }, t || id)));
        status.textContent = `${daten.reduce((n, z) => n + z.richtig + z.falsch, 0)} Antworten zu ${daten.length} Fragen. Stand: ${new Date().toLocaleString('de-CH')}`;
        zeichnen();
      } catch (e) { status.textContent = e.message + ' Ist das Gerät online?'; }
    };

    [filterPaket, minimum].forEach((el) => el.addEventListener('change', zeichnen));
    suche.addEventListener('input', zeichnen);

    LA.setzen(ziel,
      zurueck ? h('button', { class: 'zurueck', onclick: zurueck }, '← Zurück') : null,
      h('h1', null, 'Auswertung'),
      h('p', { class: 'intro' }, 'Wie oft jede Frage richtig und falsch beantwortet wurde, zusammengezählt über alle Geräte. Ohne Namen: Wer was geantwortet hat, ist nicht gespeichert. Die schwierigsten Fragen stehen oben.'),
      h('div', { class: 'kasten' }, h('p', { class: 'hinweis' }, '«wiederholt» = so oft kam die Frage in der Wiederholung (Lernkartei) dran. Gezählt werden Lernpfad, Multiple Choice, Wahr/Falsch, Lückentext, Kreuzworträtsel, Zuordnen, Wiederholen und Flow-Training. Eigene Tests zählen mit, ausser die Statistik ist auf dem Gerät in den Einstellungen ausgeschaltet.')),
      h('div', { class: 'aw-filter' }, filterPaket, suche, minimum,
        h('button', { class: 'knopf sekundaer klein', onclick: laden }, 'Aktualisieren'),
        h('button', { class: 'knopf sekundaer klein', onclick: csv }, 'Als CSV (Excel)')),
      status, inhalt);
    laden();
  };
})(window.LA);
