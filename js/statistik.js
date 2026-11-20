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

  // Pakete, deren Fragen gemeldet werden dürfen (die App trägt sie beim Öffnen ein).
  // kurz = Code des Kurzlinks, über den die Lernenden gekommen sind (eine Klasse); sonst ''.
  const pakete = new Map();
  LA.statistikPaket = function (p, kurz = '') { if (p && p.id) pakete.set(p.id, { p, kurz: /^[a-z2-9]{7}$/.test(kurz) ? kurz : '' }); };

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
  // extra: { erst (erster Versuch auf diesem Gerät), sicherheit, antwort (gewählte falsche Antwort) }
  LA.statistikMeldung = function (p, karteId, richtig, wiederholung, kurz = '', extra = {}) {
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
      p_kurz: kurz || '',
      p_erst: !!extra.erst,
      p_sicherheit: ['sicher', 'unsicher', 'geraten'].includes(extra.sicherheit) ? extra.sicherheit : '',
      p_antwort: richtig ? '' : String(extra.antwort || '').trim().slice(0, 80),
    };
  };

  // Erster Versuch pro Gerät und Frage: spätere Versuche zählen nur unter «alle Versuche»
  const ERST_KEY = 'lernapp.erstversuch';
  function ersterVersuch(paketId, karte) {
    const gesehen = LA.speicher.lesen(ERST_KEY, {});
    const k = paketId + '|' + karte;
    if (gesehen[k]) return false;
    gesehen[k] = 1;
    const schluessel = Object.keys(gesehen);
    if (schluessel.length > 20000) schluessel.slice(0, 5000).forEach((x) => delete gesehen[x]);
    LA.speicher.schreiben(ERST_KEY, gesehen);
    return true;
  }

  LA.statistikMelden = function (paketId, karteId, richtig, optionen = {}) {
    if (typeof optionen !== 'object' || !optionen) optionen = { wiederholung: !!optionen };
    try {
      if (!LA.statistikAktiv()) return;
      const eintrag = pakete.get(paketId);
      if (!eintrag || eintrag.p.quelle === 'demo') return; // Demo zählt nicht
      const body = LA.statistikMeldung(eintrag.p, karteId, richtig, !!optionen.wiederholung, eintrag.kurz, optionen);
      if (!body) return;
      body.p_erst = ersterVersuch(eintrag.p.id, body.p_karte);
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

  // Häufige falsche Antworten (freie Eingaben erst ab 3 gleichen, das filtert die Datenbank)
  LA.antwortenLaden = async function () {
    const r = await fetch(LA.STATISTIK.url + '/rest/v1/rpc/lw_antworten_laden', {
      method: 'POST', headers: { 'content-type': 'application/json', apikey: LA.STATISTIK.schluessel }, body: '{}',
    });
    if (!r.ok) throw new Error(`Die Antworten konnten nicht geladen werden (${r.status}).`);
    return (await r.json()) || [];
  };

  /* ---------- Auswertung ---------- */
  const ZAHLEN = ['richtig', 'falsch', 'wiederholt', 'erst_richtig', 'erst_falsch', 'sicher_falsch', 'erst_sicher_falsch', 'geraten_richtig', 'erst_geraten_richtig'];
  // Werte je nach Zählweise: nur erster Versuch pro Gerät oder alle Versuche
  LA.statistikWerte = (z, erst) => (erst
    ? { r: z.erst_richtig || 0, f: z.erst_falsch || 0, sf: z.erst_sicher_falsch || 0, gr: z.erst_geraten_richtig || 0, w: z.wiederholt || 0 }
    : { r: z.richtig || 0, f: z.falsch || 0, sf: z.sicher_falsch || 0, gr: z.geraten_richtig || 0, w: z.wiederholt || 0 });
  const anteil = (v) => (v.r + v.f ? v.f / (v.r + v.f) : 0);

  // Zeilen derselben Frage aus verschiedenen Klassen zusammenzählen
  LA.statistikZusammenfassen = function (zeilen) {
    const m = new Map();
    for (const z of zeilen) {
      const k = z.paket_id + '\u0000' + z.karte_id;
      const x = m.get(k);
      if (!x) { m.set(k, { ...z, kurz: '' }); continue; }
      for (const f of ZAHLEN) x[f] = (x[f] || 0) + (z[f] || 0);
      if (String(z.aktualisiert) > String(x.aktualisiert)) Object.assign(x, { aktualisiert: z.aktualisiert, paket_titel: z.paket_titel, frage: z.frage });
    }
    return [...m.values()];
  };

  LA.auswertung = function (ziel, { nurPakete, nurKurz, zurueck } = {}) {
    const status = h('p', { class: 'hinweis', 'aria-live': 'polite' }, 'Lädt …');
    const filterPaket = h('select', { 'aria-label': 'Paket wählen' });
    const suche = h('input', { type: 'text', placeholder: 'Frage suchen …', 'aria-label': 'Frage suchen' });
    const minimum = h('select', { 'aria-label': 'Mindestanzahl Antworten' },
      [1, 3, 5, 10, 20].map((n) => h('option', { value: n }, `ab ${n} Antwort${n === 1 ? '' : 'en'}`)));
    const zaehlweise = h('select', { 'aria-label': 'Zählweise' },
      h('option', { value: 'erst' }, 'Nur erster Versuch'), h('option', { value: 'alle' }, 'Alle Versuche'));
    const filterKlasse = h('select', { 'aria-label': 'Klasse wählen', hidden: true });
    const inhalt = h('div');
    let roh = [], daten = [], namen = new Map(), antworten = [];
    const erst = () => zaehlweise.value === 'erst';
    const klassenName = (code) => (code ? (namen.get(code) ? `${namen.get(code)} (${code})` : code) : 'ohne Kurzlink');
    const klasseGewaehlt = () => (filterKlasse.value === '' ? null : filterKlasse.value === '-' ? '' : filterKlasse.value);
    // Je nach Klassenwahl: eine Klasse allein oder alle zusammengezählt
    const auswahlBerechnen = () => {
      const k = klasseGewaehlt();
      daten = k === null ? LA.statistikZusammenfassen(roh) : roh.filter((z) => z.kurz === k);
    };
    // Häufigste falsche Antworten einer Frage (passend zu Klasse und Zählweise)
    const falscheAntworten = (z) => {
      const k = klasseGewaehlt(), m = new Map();
      for (const a of antworten) {
        if (a.paket_id !== z.paket_id || a.karte_id !== z.karte_id || (k !== null && a.kurz !== k)) continue;
        const n = erst() ? a.erst_anzahl : a.anzahl;
        if (n > 0) m.set(a.antwort, (m.get(a.antwort) || 0) + n);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };

    const zeichnen = () => {
      const gewaehlt = filterPaket.value, s = LA.norm(suche.value), min = Number(minimum.value);
      const gruppen = new Map();
      for (const z of daten) {
        const v = LA.statistikWerte(z, erst());
        if (gewaehlt && z.paket_id !== gewaehlt) continue;
        if (s && !LA.norm(z.frage).includes(s)) continue;
        if (v.r + v.f < min) continue;
        if (!gruppen.has(z.paket_id)) gruppen.set(z.paket_id, { titel: z.paket_titel, zeilen: [] });
        gruppen.get(z.paket_id).zeilen.push({ z, v });
      }
      if (!gruppen.size) { LA.setzen(inhalt, h('p', { class: 'hinweis' }, daten.length ? 'Keine Fragen passen zum Filter.' : 'Noch keine Antworten gezählt.')); return; }
      LA.setzen(inhalt, [...gruppen.entries()].sort((a, b) => a[1].titel.localeCompare(b[1].titel)).map(([id, g]) => {
        const zeilen = g.zeilen.sort((a, b) => anteil(b.v) - anteil(a.v) || (b.v.f - a.v.f));
        const summe = zeilen.reduce((x, { v }) => ({ r: x.r + v.r, f: x.f + v.f, w: x.w + v.w, sf: x.sf + v.sf }), { r: 0, f: 0, w: 0, sf: 0 });
        return h('section', { class: 'aw-paket' },
          h('div', { class: 'reihe zwischen' }, h('h2', null, g.titel || id), h('span', { class: 'hinweis' },
            `${zeilen.length} Fragen · ${summe.r + summe.f} Antworten · ${Math.round(summe.f / Math.max(1, summe.r + summe.f) * 100)} % falsch · ${summe.sf}× sicher falsch · ${summe.w}× in Wiederholung`)),
          h('div', { class: 'aw-tabelle-wrap' }, h('table', { class: 'aw-tabelle' },
            h('thead', null, h('tr', null, h('th', null, 'Frage'), h('th', null, 'Art'), h('th', { class: 'zahl' }, 'richtig'), h('th', { class: 'zahl' }, 'falsch'), h('th', null, 'Anteil falsch'),
              h('th', { class: 'zahl', title: 'Falsch, obwohl «sicher» gewählt: hartnäckige Fehlvorstellung' }, 'sicher falsch'),
              h('th', { class: 'zahl', title: 'Richtig, aber «unsicher» oder «geraten» gewählt' }, 'richtig geraten'),
              h('th', { class: 'zahl' }, 'wiederholt'))),
            h('tbody', null, zeilen.map(({ z, v }) => {
              const q = anteil(v);
              const falsche = falscheAntworten(z);
              return h('tr', null,
                h('td', null, z.frage, falsche.length ? h('div', { class: 'aw-antworten' }, h('span', { class: 'label' }, 'Häufig falsch gewählt: '),
                  falsche.slice(0, 4).map(([t, n]) => h('span', { class: 'aw-antwort' }, `«${t}» ${n}×`))) : null),
                h('td', { class: 'hinweis' }, ARTEN[z.art] || z.art),
                h('td', { class: 'zahl' }, v.r),
                h('td', { class: 'zahl' }, v.f),
                h('td', null, h('div', { class: 'aw-balken', title: `${Math.round(q * 100)} % falsch` },
                  h('div', { class: 'aw-fuellung' + (q >= 0.5 ? ' hoch' : q >= 0.25 ? ' mittel' : ''), style: { width: Math.round(q * 100) + '%' } }),
                  h('span', null, `${Math.round(q * 100)} %`))),
                h('td', { class: 'zahl' + (v.sf ? ' aw-warnung' : '') }, v.sf),
                h('td', { class: 'zahl' }, v.gr),
                h('td', { class: 'zahl' }, v.w));
            })))));
      }));
    };

    const csv = () => {
      const kopf = ['Paket', 'Klasse', 'Zählweise', 'Frage', 'Art', 'richtig', 'falsch', 'Anteil falsch (%)', 'sicher falsch', 'richtig geraten', 'wiederholt', 'häufig falsch gewählt', 'zuletzt'];
      const feld = (x) => `"${String(x).replace(/"/g, '""')}"`;
      const k = klasseGewaehlt();
      const klasse = k === null ? 'alle' : klassenName(k);
      const zeilen = daten.filter((z) => !filterPaket.value || z.paket_id === filterPaket.value)
        .map((z) => {
          const v = LA.statistikWerte(z, erst());
          return [z.paket_titel, klasse, erst() ? 'erster Versuch' : 'alle Versuche', z.frage, ARTEN[z.art] || z.art, v.r, v.f, Math.round(anteil(v) * 100), v.sf, v.gr, v.w,
            falscheAntworten(z).slice(0, 5).map(([t, n]) => `${t} (${n})`).join(', '), z.aktualisiert].map(feld).join(';');
        });
      LA.download('lernwerkstatt-auswertung.csv', '﻿' + [kopf.map(feld).join(';'), ...zeilen].join('\r\n'), 'text/csv;charset=utf-8');
    };

    const laden = async () => {
      status.textContent = 'Lädt …';
      try {
        const [zeilen, falsch] = await Promise.all([LA.statistikLaden(), LA.antwortenLaden().catch(() => [])]);
        antworten = falsch;
        roh = zeilen.map((z) => ({ ...z, kurz: z.kurz || '' }));
        if (nurPakete) roh = roh.filter((z) => nurPakete.includes(z.paket_id));
        // Klassen: Namen aus den eigenen Kurzlinks, sonst aus der Datenbank
        const codes = [...new Set(roh.map((z) => z.kurz).filter(Boolean))];
        if (nurKurz && !codes.includes(nurKurz)) codes.push(nurKurz);
        namen = new Map((LA.kurzlinksAlle ? LA.kurzlinksAlle() : []).filter((e) => e.klasse).map((e) => [e.code, e.klasse]));
        const fehlen = codes.filter((c) => !namen.has(c));
        if (fehlen.length && LA.kurzlinksInfo) { try { (await LA.kurzlinksInfo(fehlen)).forEach((i, c) => { if (i.klasse) namen.set(c, i.klasse); }); } catch { /* nur Codes anzeigen */ } }
        const vorherK = filterKlasse.value || nurKurz || '';
        const ohne = roh.some((z) => !z.kurz);
        LA.setzen(filterKlasse, h('option', { value: '' }, 'Alle Klassen zusammen'),
          codes.sort((a, b) => klassenName(a).localeCompare(klassenName(b), 'de', { numeric: true })).map((c) => h('option', { value: c, selected: c === vorherK }, 'Klasse ' + klassenName(c))),
          ohne && codes.length ? h('option', { value: '-', selected: vorherK === '-' }, 'Ohne Kurzlink (eigene Geräte, lange Links)') : null);
        filterKlasse.hidden = !codes.length;
        auswahlBerechnen();
        const titel = new Map(roh.map((z) => [z.paket_id, z.paket_titel]));
        const vorher = filterPaket.value;
        LA.setzen(filterPaket, h('option', { value: '' }, 'Alle Pakete'), [...titel.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, t]) => h('option', { value: id, selected: id === vorher }, t || id)));
        status.textContent = `${roh.reduce((n, z) => n + z.richtig + z.falsch, 0)} Antworten insgesamt, davon ${roh.reduce((n, z) => n + (z.erst_richtig || 0) + (z.erst_falsch || 0), 0)} erste Versuche. Stand: ${new Date().toLocaleString('de-CH')}`;
        zeichnen();
      } catch (e) { status.textContent = e.message + ' Ist das Gerät online?'; }
    };

    [filterPaket, minimum, zaehlweise].forEach((el) => el.addEventListener('change', zeichnen));
    filterKlasse.addEventListener('change', () => { auswahlBerechnen(); zeichnen(); });
    suche.addEventListener('input', zeichnen);

    LA.setzen(ziel,
      zurueck ? h('button', { class: 'zurueck', onclick: zurueck }, '← Zurück') : null,
      h('h1', null, 'Auswertung'),
      h('p', { class: 'intro' }, 'Wie oft jede Frage richtig und falsch beantwortet wurde, zusammengezählt über alle Geräte. Ohne Namen: Wer was geantwortet hat, ist nicht gespeichert. Die schwierigsten Fragen stehen oben.'),
      h('details', { class: 'kasten aw-lesehilfe' }, h('summary', null, 'So liest du die Zahlen'),
        h('ul', null,
          h('li', null, h('strong', null, 'Nur erster Versuch: '), 'Pro Gerät zählt nur die erste Antwort auf eine Frage. Das zeigt, was die Klasse wirklich konnte. Bei «alle Versuche» zählen auch Wiederholungen, die Lernende sich schon gemerkt haben.'),
          h('li', null, h('strong', null, 'Häufig falsch gewählt: '), 'Welche falschen Antworten gewählt wurden. Ein Hinweis auf Fehlvorstellungen, die du im Unterricht aufgreifen kannst. Frei getippte Antworten (Lückentext, Fachbegriff) erscheinen erst, wenn mindestens drei gleich lauten.'),
          h('li', null, h('strong', null, 'sicher falsch: '), 'Die Lernenden waren sich sicher und lagen falsch. Das sind hartnäckige Fehlvorstellungen.'),
          h('li', null, h('strong', null, 'richtig geraten: '), 'Richtig, aber «unsicher» oder «geraten» gewählt. Das Wissen ist noch wackelig.'),
          h('li', null, h('strong', null, 'wiederholt: '), 'So oft kam die Frage in der Wiederholung (Lernkartei) dran.'),
          h('li', null, 'Klassen getrennt: Für jede Klasse beim Teilen einen eigenen Kurzlink erstellen. Eigene Tests zählen mit, ausser die Statistik ist auf dem Gerät in den Einstellungen ausgeschaltet.'))),
      h('div', { class: 'aw-filter' }, filterKlasse, zaehlweise, filterPaket, suche, minimum,
        h('button', { class: 'knopf sekundaer klein', onclick: laden }, 'Aktualisieren'),
        h('button', { class: 'knopf sekundaer klein', onclick: csv }, 'Als CSV (Excel)')),
      status, inhalt);
    laden();
  };
})(window.LA);
