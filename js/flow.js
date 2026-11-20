/* Flow-Training: passt die Schwierigkeit laufend an (Elo/Rasch wie im Flow-Trainer).
   Können θ der lernenden Person und Schwierigkeit d jeder Frage auf derselben Skala 0–100.
   P(richtig) = 1 / (1 + e^-((θ − d) / SKALA)). Ziel: meist ~80 % richtig (Flow-Zone 70–90 %). */
(function (LA) {
  const { h } = LA;
  const SKALA = 10;
  const RUNDE = 12;
  const START_THETA = 50;

  // Startschätzung der Schwierigkeit: Aufgabentyp + KI-Einschätzung (1–5) + Niveau des Pakets
  const BASIS = { wf: 22, kap: 32, kat: 35, mc: 45, lt: 55, begriff: 65 };
  const NIVEAU_VERSATZ = { 1: -18, 2: 0, 3: 18 };

  const begrenzen = (x, a, b) => Math.max(a, Math.min(b, x));
  const p = (theta, d) => 1 / (1 + Math.exp(-(theta - d) / SKALA));
  const zielD = (theta, ziel) => theta - SKALA * Math.log(ziel / (1 - ziel));
  const stufe = (theta) => begrenzen(Math.floor(theta / 10) + 1, 1, 10);

  function startD(karteId, karte, paket) {
    let d = BASIS[karteId.split(':')[0]] ?? 45;
    const s = karte.art === 'mc' ? karte.frage.schwierigkeit : karte.art === 'wf' ? karte.aussage.schwierigkeit : undefined;
    if (s) d += (s - 3) * 8;
    d += NIVEAU_VERSATZ[paket.niveau] || 0;
    return begrenzen(d, 0, 100);
  }

  /* ---------- Speicher ---------- */
  const zustandKey = (gruppe) => 'lernapp.flow.' + (gruppe[0].gruppe || gruppe[0].id);
  const itemKey = (paketId) => 'lernapp.flowitems.' + paketId;
  LA.flowZustand = (gruppe) => Object.assign({ theta: START_THETA, n: 0, verlauf: [] }, LA.speicher.lesen(zustandKey(gruppe), {}));
  const zustandSpeichern = (gruppe, z) => LA.speicher.schreiben(zustandKey(gruppe), z);

  /* ---------- Fragenvorrat aus allen Niveaus ---------- */
  LA.flowVorrat = function (gruppe) {
    const vorrat = [];
    for (const paket of gruppe) {
      const gelernt = LA.speicher.lesen(itemKey(paket.id), {});
      for (const [kid, karte] of LA.karten(paket)) {
        vorrat.push({ schluessel: paket.id + '|' + kid, paket, kid, karte, d: gelernt[kid] ? gelernt[kid].d : startD(kid, karte, paket), n: gelernt[kid] ? gelernt[kid].n : 0 });
      }
    }
    return vorrat;
  };

  // Ziel-Erfolgswahrscheinlichkeit wie im Flow-Trainer
  LA.flowZiel = function (sitzung) {
    if (sitzung.falschSerie >= 2) return { ziel: 0.92, art: 'auffangen' };       // Frust vermeiden
    if (sitzung.anzahl % 7 === 6 && sitzung.falschSerie === 0) return { ziel: 0.55, art: 'herausforderung' };
    if (sitzung.richtigSerie >= 5) return { ziel: 0.72, art: 'steigern' };       // Langeweile vermeiden
    return { ziel: 0.8, art: 'normal' };
  };

  LA.flowWaehlen = function (vorrat, theta, sitzung, zufall = Math.random) {
    const { ziel, art } = LA.flowZiel(sitzung);
    const td = zielD(theta, begrenzen(ziel + (zufall() - 0.5) * 0.06, 0.5, 0.95));
    const kuerzlich = new Set(sitzung.gezeigt.slice(-6));
    let kandidaten = vorrat.filter((x) => !kuerzlich.has(x.schluessel) && !sitzung.geloest.has(x.schluessel));
    if (!kandidaten.length) kandidaten = vorrat.filter((x) => !new Set(sitzung.gezeigt.slice(-2)).has(x.schluessel));
    if (!kandidaten.length) kandidaten = vorrat;
    // Unter den drei passendsten zufällig wählen, damit es nicht immer dieselbe Reihenfolge ist
    const sortiert = kandidaten.map((x) => ({ x, abstand: Math.abs(x.d - td) })).sort((a, b) => a.abstand - b.abstand).slice(0, 3);
    return { item: sortiert[Math.floor(zufall() * sortiert.length)].x, ziel: td, art };
  };

  // Antwort verbuchen: Können und Fragen-Schwierigkeit rücken nach (Elo)
  LA.flowVerbuchen = function (z, item, richtig) {
    const erwartet = p(z.theta, item.d);
    const ergebnis = richtig ? 1 : 0;
    const K = z.n < 8 ? 12 : Math.max(3, 9 / Math.sqrt(1 + (z.n - 8) / 10));
    const vorher = z.theta;
    z.theta = begrenzen(z.theta + K * (ergebnis - erwartet), 0, 100);
    z.n++;
    z.verlauf = [...z.verlauf, { d: Math.round(item.d), ok: richtig, th: Math.round(z.theta) }].slice(-40);
    item.d = begrenzen(item.d - 4 * (ergebnis - erwartet), 0, 100); // oft falsch → Frage gilt als schwerer
    item.n++;
    return { erwartet, vorher };
  };

  // Welches Niveau passt? Das, dessen typische Frage am nächsten an der Ziel-Schwierigkeit (80 %) liegt.
  LA.flowEmpfehlung = function (gruppe) {
    if (gruppe.length < 2) return null;
    const z = LA.flowZustand(gruppe);
    if (z.n < 10) return null;
    const td = zielD(z.theta, 0.8);
    const vorrat = LA.flowVorrat(gruppe);
    let bestes = null;
    for (const paket of gruppe) {
      const ds = vorrat.filter((x) => x.paket.id === paket.id).map((x) => x.d).sort((a, b) => a - b);
      if (!ds.length) continue;
      const median = ds[Math.floor(ds.length / 2)];
      if (!bestes || Math.abs(median - td) < bestes.abstand) bestes = { paket, abstand: Math.abs(median - td) };
    }
    return bestes && bestes.paket;
  };

  function zone(verlauf) {
    const letzte = verlauf.slice(-10);
    if (letzte.length < 5) return { klasse: '', text: 'Messung läuft', anteil: null };
    const a = letzte.filter((x) => x.ok).length / letzte.length;
    if (a > 0.9) return { klasse: 'leicht', text: 'Zu leicht · wird schwerer', anteil: a };
    if (a < 0.7) return { klasse: 'schwer', text: 'Zu schwer · wird leichter', anteil: a };
    return { klasse: 'flow', text: 'Im Flow', anteil: a };
  }

  /* ---------- Ansicht ---------- */
  LA.flowStarten = function (w, gruppe, { niveauWechseln, lernpfadOeffnen } = {}) {
    const z = LA.flowZustand(gruppe);
    const vorrat = LA.flowVorrat(gruppe);
    if (vorrat.length < 4) { LA.setzen(w, h('h2', null, 'Flow-Training'), h('p', null, 'Dieses Paket hat zu wenige Fragen für das Flow-Training.')); return; }
    const sitzung = { anzahl: 0, richtig: 0, richtigSerie: 0, falschSerie: 0, gezeigt: [], geloest: new Set(), log: [], startStufe: stufe(z.theta) };
    const mehrereNiveaus = gruppe.length > 1;

    const itemsSpeichern = (item) => {
      const k = itemKey(item.paket.id), alle = LA.speicher.lesen(k, {});
      alle[item.kid] = { d: Math.round(item.d * 10) / 10, n: item.n };
      LA.speicher.schreiben(k, alle);
    };

    const seitenleiste = () => {
      const zo = zone(z.verlauf);
      return h('div', { class: 'flow-leiste' },
        h('div', { class: 'flow-wert' }, h('div', { class: 'label' }, 'Deine Stufe'), h('div', { class: 'flow-zahl' }, stufe(z.theta)), h('div', { class: 'hinweis' }, 'von 10')),
        h('div', { class: 'flow-zone' },
          h('div', { class: 'label' }, 'Letzte 10 Antworten'),
          h('div', { class: 'flow-skala', 'aria-hidden': 'true' }, h('div', { class: 'flow-band' }), zo.anteil !== null ? h('div', { class: 'flow-marke', style: { left: Math.round(zo.anteil * 100) + '%' } }) : null),
          h('span', { class: 'flow-pill ' + zo.klasse }, zo.text)),
        h('div', { class: 'flow-punkte', 'aria-label': `Aufgabe ${sitzung.anzahl + 1} von ${RUNDE}` },
          Array.from({ length: RUNDE }, (_, i) => h('i', { class: i < sitzung.log.length ? (sitzung.log[i].ok ? 'ok' : 'nein') : i === sitzung.log.length ? 'jetzt' : '' }))));
    };

    const naechste = () => {
      if (sitzung.anzahl >= RUNDE) return rundenEnde();
      const { item, art } = LA.flowWaehlen(vorrat, z.theta, sitzung);
      sitzung.gezeigt.push(item.schluessel);
      const weiter = h('button', { class: 'knopf', disabled: true, onclick: naechste }, sitzung.anzahl + 1 < RUNDE ? 'Weiter' : 'Auswerten');
      const antwort = (ok, info = {}) => {
        LA.flowVerbuchen(z, item, ok);
        zustandSpeichern(gruppe, z); itemsSpeichern(item);
        LA.melden(item.paket.id, item.kid, ok, info); // auch die Lernkartei profitiert
        sitzung.anzahl++;
        sitzung.log.push({ ok, d: item.d });
        if (ok) { sitzung.richtig++; sitzung.richtigSerie++; sitzung.falschSerie = 0; sitzung.geloest.add(item.schluessel); }
        else { sitzung.falschSerie++; sitzung.richtigSerie = 0; }
        leiste.replaceWith(leiste = seitenleiste());
        weiter.disabled = false; weiter.focus();
      };
      let leiste = seitenleiste();
      LA.setzen(w,
        h('div', { class: 'flow-kopf' },
          h('div', null, h('h2', null, 'Flow-Training'),
            h('div', { class: 'reihe' },
              art === 'herausforderung' ? h('span', { class: 'tag flow-herausforderung' }, '⚡ Herausforderung') : null,
              art === 'auffangen' ? h('span', { class: 'tag' }, 'Etwas leichter zum Durchatmen') : null,
              mehrereNiveaus ? h('span', { class: 'tag', title: 'Niveau dieser Frage' }, LA.NIVEAUS[item.paket.niveau].zeichen) : null,
              h('span', { class: 'hinweis' }, 'Aus: ' + item.karte.quelle)))),
        h('div', { class: 'flow-raster' },
          h('div', { class: 'flow-aufgabe' }, LA.karteAnzeigen(item.karte, antwort, { sicherheit: LA.sicherheitAktiv(item.paket) }), h('div', { class: 'reihe rechts' }, weiter)),
          leiste));
      const feld = w.querySelector('input[type=text]'); if (feld) feld.focus();
    };

    const rundenEnde = () => {
      const anteil = sitzung.richtig / sitzung.anzahl;
      const jetzt = stufe(z.theta);
      const empfehlung = LA.flowEmpfehlung(gruppe);
      const aktuell = gruppe.find((x) => x.id === (LA.zustandPaketId && LA.zustandPaketId())) || null;
      LA.setzen(w, h('div', { class: 'ergebnis' },
        h('div', { class: 'ergebnis-zahl' }, `${sitzung.richtig} / ${sitzung.anzahl}`),
        h('h2', null, anteil >= 0.7 && anteil <= 0.9 ? 'Genau im Flow.' : anteil > 0.9 ? 'Zu leicht für dich – es wird schwerer.' : 'Anspruchsvolle Runde – es wird leichter.'),
        h('p', null, jetzt === sitzung.startStufe ? `Du bleibst auf Stufe ${jetzt}.` : `Stufe ${sitzung.startStufe} → ${jetzt}`),
        // Leichtere Fragen als die vorhandenen kann die App nicht erfinden: dann lieber zurück zu den Erklärungen
        anteil < 0.5 ? h('div', { class: 'kasten beispiel' }, 'Tipp: Geh zuerst nochmals durch den Lernpfad. Mit den Erklärungen im Kopf klappt es danach besser.',
          lernpfadOeffnen ? h('div', { class: 'reihe', style: { marginTop: '8px', justifyContent: 'center' } }, h('button', { class: 'knopf sekundaer klein', onclick: lernpfadOeffnen }, 'Zum Lernpfad')) : null) : null,
        empfehlung && mehrereNiveaus && (!aktuell || empfehlung.id !== aktuell.id)
          ? h('div', { class: 'kasten merksatz' }, `Für dich passt gerade ${LA.NIVEAUS[empfehlung.niveau].name} ${LA.NIVEAUS[empfehlung.niveau].zeichen}.`,
            niveauWechseln ? h('div', { class: 'reihe', style: { marginTop: '8px', justifyContent: 'center' } }, h('button', { class: 'knopf sekundaer klein', onclick: () => niveauWechseln(empfehlung) }, 'Dorthin wechseln')) : null)
          : null,
        h('div', { class: 'reihe' },
          h('button', { class: 'knopf', onclick: () => LA.flowStarten(w, gruppe, { niveauWechseln, lernpfadOeffnen }) }, 'Nächste Runde'),
          h('button', { class: 'knopf sekundaer', onclick: () => LA.zurUebersicht() }, 'Zur Übersicht'))));
    };

    naechste();
  };

  LA.flowStufe = (gruppe) => { const z = LA.flowZustand(gruppe); return z.n ? stufe(z.theta) : null; };
  LA._flow = { p, zielD, startD, stufe, SKALA }; // für Tests
})(window.LA);
