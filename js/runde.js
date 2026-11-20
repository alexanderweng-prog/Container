/* Wiederholungsrunde für die Klasse: gemischte Fragen aus mehreren Paketen (verteiltes und gemischtes Üben).
   Die Lehrperson stellt die Runde zusammen und teilt sie als Kurzlink. Fragen, die in der Auswertung oft
   falsch beantwortet wurden, kommen häufiger dran. Antworten zählen beim ursprünglichen Paket. */
(function (LA) {
  const { h } = LA;

  // Fehlerquote pro Frage aus der Statistik: Schlüssel «paketId|karte» → Anteil falsch (0–1)
  LA.rundeGewichte = function (zeilen) {
    const m = new Map(), summe = new Map();
    for (const z of zeilen || []) {
      const k = z.paket_id + '|' + z.karte_id;
      const s = summe.get(k) || { r: 0, f: 0, er: 0, ef: 0 };
      s.r += z.richtig || 0; s.f += z.falsch || 0; s.er += z.erst_richtig || 0; s.ef += z.erst_falsch || 0;
      summe.set(k, s);
    }
    for (const [k, s] of summe) {
      // Erster Versuch, wenn genug Antworten da sind, sonst alle Versuche
      const [r, f] = s.er + s.ef >= 3 ? [s.er, s.ef] : [s.r, s.f];
      if (r + f >= 1) m.set(k, f / (r + f));
    }
    return m;
  };

  // Gewichtete Auswahl ohne Zurücklegen
  function ziehen(liste, gewicht, n) {
    const rest = liste.slice(), weg = [];
    while (weg.length < n && rest.length) {
      const total = rest.reduce((s, x) => s + gewicht(x), 0);
      let z = Math.random() * total, i = 0;
      while (i < rest.length - 1 && (z -= gewicht(rest[i])) > 0) i++;
      weg.push(rest.splice(i, 1)[0]);
    }
    return weg;
  }

  /**
   * Runde zusammenstellen.
   * @param {object[]} pakete    ausgewählte Pakete
   * @param {object} opt         { anzahl, gewichte (Map aus LA.rundeGewichte) }
   */
  LA.rundeBauen = function (pakete, { anzahl = 15, gewichte = new Map() } = {}) {
    pakete = pakete.filter((p) => p && LA.karten(p).size);
    if (!pakete.length) throw new Error('Die gewählten Pakete enthalten keine Übungsfragen.');
    // gleichmässig auf die Pakete verteilen; was ein Paket nicht füllen kann, übernehmen die anderen
    const kandidaten = pakete.map((p) => [...LA.karten(p).keys()]);
    const anteil = pakete.map(() => 0);
    let offen = Math.min(anzahl, kandidaten.reduce((s, k) => s + k.length, 0));
    while (offen > 0) {
      let vergeben = false;
      for (let i = 0; i < pakete.length && offen > 0; i++) if (anteil[i] < kandidaten[i].length) { anteil[i]++; offen--; vergeben = true; }
      if (!vergeben) break;
    }
    const gewaehlt = pakete.map((p, i) => {
      const fq = (kid) => {
        const m = LA.statistikMeldung ? LA.statistikMeldung(p, kid, true, false) : null;
        return m ? gewichte.get(p.id + '|' + m.p_karte) : undefined;
      };
      // unbeantwortete Fragen zählen mittel (1,5), sicher gekonnte 1, oft falsch beantwortete bis 6
      const g = new Map(kandidaten[i].map((kid) => { const q = fq(kid); return [kid, q === undefined ? 1.5 : 1 + 5 * q]; }));
      return ziehen(kandidaten[i], (kid) => g.get(kid), anteil[i]).map((kid) => ({ paket: p.id, kid }));
    });
    // abwechselnd aus den Paketen (gemischtes Üben)
    const auswahl = [];
    for (let r = 0; auswahl.length < gewaehlt.reduce((s, g) => s + g.length, 0); r++) gewaehlt.forEach((g) => { if (g[r]) auswahl.push(g[r]); });
    const schlank = (p) => ({ ...structuredClone(p), reihenfolgen: [], offene_fragen: [], schreibauftrag: { aufgabe: '', hinweise: '' } });
    const titel = pakete.map((p) => p.titel).join(', ');
    return {
      typ: 'runde', id: 'runde-' + LA.id(), erstellt: new Date().toISOString(),
      titel: ('Wiederholung: ' + titel).slice(0, 160),
      pakete: pakete.map(schlank),
      auswahl,
    };
  };

  LA.istRunde = (d) => !!(d && !Array.isArray(d) && d.typ === 'runde' && Array.isArray(d.pakete) && Array.isArray(d.auswahl));

  // Ansicht für die Lernenden
  LA.rundeStarten = function (w, daten, { kurz = '' } = {}) {
    const pakete = new Map(daten.pakete.map((x) => { const p = LA.paketPruefen(structuredClone(x)); LA.statistikPaket(p, kurz); return [p.id, p]; }));
    const fragen = daten.auswahl.filter((a) => pakete.has(a.paket) && LA.karten(pakete.get(a.paket)).has(a.kid));
    const titelOhne = daten.titel.replace(/^Wiederholung: /, '');

    const start = () => {
      LA.setzen(w,
        h('h1', null, 'Wiederholungsrunde'),
        h('p', { class: 'intro' }, `${fragen.length} gemischte Fragen aus: ${titelOhne}.`),
        h('p', { class: 'hinweis' }, 'Die Fragen kommen bunt gemischt. Was du falsch hast, kommt am Ende nochmals.'),
        h('button', { class: 'knopf', onclick: runde }, 'Los geht\'s'));
    };

    const runde = () => {
      let warteschlange = LA.mischen(fragen);
      const gesamt = warteschlange.length, schonFalsch = new Set(), proPaket = new Map();
      let geloest = 0;
      const naechste = () => {
        window.scrollTo({ top: 0 });
        if (!warteschlange.length) return ende();
        const f = warteschlange.shift(), p = pakete.get(f.paket), karte = LA.karten(p).get(f.kid);
        const schluessel = f.paket + '|' + f.kid;
        const weiter = h('button', { class: 'knopf', disabled: true, onclick: naechste }, 'Weiter');
        const antwort = (ok, info = {}) => {
          LA.melden(p.id, f.kid, ok, { ...info, wiederholung: true });
          if (!schonFalsch.has(schluessel)) {
            const s = proPaket.get(p.id) || { titel: p.titel, r: 0, n: 0 };
            s.n++; if (ok) { s.r++; geloest++; }
            proPaket.set(p.id, s);
          }
          if (!ok && !schonFalsch.has(schluessel)) { schonFalsch.add(schluessel); warteschlange.push(f); }
          weiter.disabled = false; weiter.focus();
        };
        const beantwortet = [...proPaket.values()].reduce((n, x) => n + x.n, 0);
        LA.setzen(w,
          h('div', { class: 'balken' }, h('div', { style: { width: Math.round(beantwortet / gesamt * 100) + '%' } })),
          h('div', { class: 'reihe zwischen' }, h('div', { class: 'label' }, schonFalsch.has(schluessel) ? 'Zweiter Versuch' : `Frage ${beantwortet + 1} von ${gesamt}`), h('span', { class: 'tag' }, p.titel)),
          h('div', { class: 'hinweis' }, 'Aus: ' + karte.quelle),
          LA.karteAnzeigen(karte, antwort, { sicherheit: LA.sicherheitAktiv(p) }),
          h('div', { class: 'reihe rechts' }, weiter));
        const feld = w.querySelector('input[type=text]'); if (feld) feld.focus();
      };
      const ende = () => {
        const liste = [...proPaket.values()];
        LA.setzen(w, h('div', { class: 'ergebnis' },
          h('div', { class: 'ergebnis-zahl' }, `${geloest} / ${gesamt}`),
          h('p', null, geloest === gesamt ? 'Alles auf Anhieb gewusst.' : 'Auf Anhieb gewusst. Was falsch war, hast du am Ende nochmals geübt.'),
          liste.length > 1 ? h('ul', { class: 'runde-pakete' }, liste.map((s) => h('li', null, h('strong', null, s.titel), `: ${s.r} von ${s.n}`, s.r / s.n < 0.6 ? h('span', { class: 'hinweis' }, ' – hier lohnt sich nochmals üben') : null))) : null,
          h('div', { class: 'reihe' }, h('button', { class: 'knopf', onclick: runde }, 'Nochmals (neue Reihenfolge)'))));
      };
      naechste();
    };
    start();
  };
})(window.LA);
