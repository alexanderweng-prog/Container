/* Probeprüfungen: aus einem Paket (oder mit neuen KI-Fragen) Prüfungen in mehreren Versionen zusammenstellen.
   - Druck/PDF für die Lehrperson: Version A, B, …, Punkte pro Aufgabe, Lösungsblatt, Notenskala
   - Digital für Lernende: wie eine echte Prüfung, ohne Rückmeldung bis zur Abgabe, Note am Ende */
(function (LA) {
  const { h } = LA;
  const BUCHSTABEN = 'ABCDEFGHIJ';
  const VERSIONEN = 'ABCD';

  // Punkte pro Aufgabentyp
  LA.PRUEFUNG_PUNKTE = { mc: 1, wf: 1, luecke: 1, begriff: 1, offen: 3 };
  LA.PRUEFUNG_TYPEN = [
    { id: 'mc', name: 'Multiple Choice', anzahl: 6 },
    { id: 'wf', name: 'Wahr oder falsch', anzahl: 4 },
    { id: 'luecke', name: 'Lücken füllen', anzahl: 4 },
    { id: 'begriff', name: 'Fachbegriffe nennen', anzahl: 4 },
    { id: 'offen', name: 'Denkfragen (Begründen)', anzahl: 2 },
  ];

  // Satz mit einer Lücke aus einem Lückentext
  function lueckenSaetze(lt) {
    const saetze = [];
    const luecken = [...lt.text.matchAll(/\{\{(.+?)\}\}/g)];
    luecken.forEach((m, nr) => {
      let n = -1;
      const ganz = lt.text.replace(/\{\{(.+?)\}\}/g, (_, w) => { n++; return n === nr ? '\u0000' : w; }).replace(/\n/g, ' ');
      const satz = ganz.split(/(?<=[.!?])\s+/).find((s) => s.includes('\u0000')) || ganz;
      const [vor, nach] = satz.split('\u0000');
      saetze.push({ vor, nach, loesung: m[1] });
    });
    return saetze;
  }

  // Alle möglichen Aufgaben eines Pakets, nach Typ
  LA.pruefungVorrat = function (p) {
    return {
      mc: p.multiple_choice.map((q) => ({ typ: 'mc', frage: q.frage, optionen: q.optionen, richtig: q.richtig, erklaerung: q.erklaerung || '' })),
      wf: p.wahr_falsch.map((a) => ({ typ: 'wf', aussage: a.aussage, wahr: a.wahr, erklaerung: a.erklaerung || '' })),
      luecke: p.lueckentexte.flatMap(lueckenSaetze).map((s) => ({ typ: 'luecke', ...s })),
      begriff: p.begriffe.map((b) => ({ typ: 'begriff', erklaerung: b.erklaerung, loesung: b.begriff })),
      offen: p.offene_fragen.map((f) => ({ typ: 'offen', frage: f.frage, musterantwort: f.musterantwort, kriterien: f.kriterien || [] })),
    };
  };

  /**
   * Versionen zusammenstellen. Jede Version zieht möglichst andere Aufgaben (am wenigsten benutzte zuerst),
   * Reihenfolge und Antworten werden pro Version gemischt.
   * @returns {{ version: string, aufgaben: object[], max: number }[]}
   */
  LA.pruefungBauen = function (p, { anzahl = {}, versionen = 1 } = {}) {
    const vorrat = LA.pruefungVorrat(p);
    const benutzt = new Map();
    const ergebnis = [];
    for (let v = 0; v < versionen; v++) {
      const aufgaben = [];
      for (const t of LA.PRUEFUNG_TYPEN) {
        const n = Math.min(Number(anzahl[t.id] ?? 0), vorrat[t.id].length);
        if (!n) continue;
        const gewaehlt = LA.mischen(vorrat[t.id]).sort((a, b) => (benutzt.get(a) || 0) - (benutzt.get(b) || 0)).slice(0, n);
        gewaehlt.forEach((x) => benutzt.set(x, (benutzt.get(x) || 0) + 1));
        for (const x of LA.mischen(gewaehlt)) {
          const a = { ...x, punkte: LA.PRUEFUNG_PUNKTE[t.id] };
          if (a.typ === 'mc') { const o = LA.mischen(a.optionen.map((_, i) => i)); a.optionen = o.map((i) => x.optionen[i]); a.richtig = o.indexOf(x.richtig); }
          aufgaben.push(a);
        }
      }
      ergebnis.push({ version: VERSIONEN[v], aufgaben, max: aufgaben.reduce((s, a) => s + a.punkte, 0) });
    }
    return ergebnis;
  };

  // Schweizer Noten 1–6. «linear»: 0 P = 1, voll = 6. «60»: 60 % = 4 (darunter und darüber linear).
  LA.note = function (punkte, max, { skala = 'linear', runden = 0.5 } = {}) {
    if (!max) return 1;
    const q = Math.max(0, Math.min(1, punkte / max));
    const roh = skala === '60' ? (q < 0.6 ? 1 + 3 * q / 0.6 : 4 + 2 * (q - 0.6) / 0.4) : 1 + 5 * q;
    return Math.round(roh / runden) * runden;
  };
  const noteText = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  LA.noteText = noteText;

  // KI: neue Prüfungsfragen, die in den Übungen nicht vorkommen
  LA.pruefungKiFragen = async function (p, anzahl, beiFortschritt) {
    const neu = await LA.kiPruefungErzeugen({ paket: p, anzahl, beiFortschritt });
    return { ...p, ...neu };
  };

  /* ---------- Druck: Prüfungen, Lösungen, Notenskala ---------- */
  function linien(n) { return h('div', { class: 'linien' }, Array.from({ length: n }, () => h('div', { class: 'linie' }))); }

  function pruefungBlatt(p, v, opt) {
    const kopf = h('header', { class: 'druck-kopf' },
      h('div', null, h('div', { class: 'druck-fach' }, [p.fach, p.stufe].filter(Boolean).join(' · ')),
        h('h1', null, `Probeprüfung: ${p.titel}`), opt.versionen > 1 ? h('div', { class: 'druck-version' }, `Version ${v.version}`) : null),
      h('div', { class: 'druck-name' }, h('div', null, 'Name: ', h('span', { class: 'feld' })), h('div', null, 'Datum: ', h('span', { class: 'feld kurz' })),
        h('div', null, `Punkte: ____ / ${v.max}`, '   Note: ____')));
    const liste = h('ol', { class: 'pr-aufgaben' }, v.aufgaben.map((a) => h('li', { class: 'pr-aufgabe' },
      h('span', { class: 'pr-punkte' }, `${a.punkte} P.`),
      a.typ === 'mc' ? [a.frage, h('ul', { class: 'druck-optionen' }, a.optionen.map((o, i) => h('li', null, h('span', { class: 'kaestchen' }), ` ${BUCHSTABEN[i]}) ${o}`)))]
        : a.typ === 'wf' ? [a.aussage, h('div', { class: 'pr-wf' }, h('span', { class: 'kaestchen' }), ' wahr   ', h('span', { class: 'kaestchen' }), ' falsch')]
          : a.typ === 'luecke' ? ['Ergänze: ', a.vor, h('span', { class: 'druck-luecke' }), a.nach]
            : a.typ === 'begriff' ? ['Wie heisst der Fachbegriff? ', h('em', null, a.erklaerung), h('div', { class: 'linie' })]
              : [a.frage, opt.linien ? linien(5) : h('div', { style: { height: '40mm' } })])));
    return h('section', { class: 'pr-blatt' }, kopf, liste);
  }

  function loesungBlatt(p, v, opt) {
    return h('section', { class: 'pr-blatt druck-loesung' },
      h('h1', null, `Lösungen: Probeprüfung ${p.titel}` + (opt.versionen > 1 ? ` · Version ${v.version}` : '')),
      h('ol', { class: 'pr-aufgaben' }, v.aufgaben.map((a) => h('li', null, h('span', { class: 'pr-punkte' }, `${a.punkte} P.`),
        a.typ === 'mc' ? [h('strong', null, `${BUCHSTABEN[a.richtig]}) ${a.optionen[a.richtig]}`), a.erklaerung ? ' – ' + a.erklaerung : '']
          : a.typ === 'wf' ? [h('strong', null, a.wahr ? 'wahr' : 'falsch'), a.erklaerung ? ' – ' + a.erklaerung : '']
            : a.typ === 'luecke' || a.typ === 'begriff' ? h('strong', null, a.loesung)
              : [a.musterantwort, a.kriterien.length ? h('div', { class: 'klein' }, `Kriterien (je 1 P.): ${a.kriterien.slice(0, 3).join('; ')}`) : null]))),
      notenskala(v.max, opt));
  }

  function notenskala(max, opt) {
    const zeilen = [];
    for (let pkt = max; pkt >= 0; pkt--) zeilen.push([pkt, LA.note(pkt, max, opt)]);
    // Zusammenfassen: pro Note der Punktebereich
    const bereiche = [];
    for (const [pkt, n] of zeilen) {
      const b = bereiche.at(-1);
      if (b && b.note === n) b.von = pkt; else bereiche.push({ note: n, von: pkt, bis: pkt });
    }
    return h('div', { class: 'pr-skala' }, h('h3', null, `Notenskala (${max} Punkte, ${opt.skala === '60' ? 'Note 4 bei 60 %' : 'linear'})`),
      h('table', { class: 'druck-tabelle' }, h('tbody', null,
        h('tr', null, h('th', null, 'Note'), bereiche.map((b) => h('td', null, noteText(b.note)))),
        h('tr', null, h('th', null, 'Punkte'), bereiche.map((b) => h('td', null, b.von === b.bis ? String(b.von) : `${b.von}–${b.bis}`))))));
  }

  LA.pruefungDrucken = function (p, versionen, opt) {
    let bereich = document.getElementById('druckbereich');
    if (!bereich) { bereich = h('div', { id: 'druckbereich' }); document.body.append(bereich); }
    const o = { ...opt, versionen: versionen.length };
    LA.setzen(bereich, versionen.map((v) => pruefungBlatt(p, v, o)), opt.loesungen ? versionen.map((v) => loesungBlatt(p, v, o)) : null);
    const alterTitel = document.title;
    document.title = 'Probeprüfung ' + p.titel;
    setTimeout(() => { window.print(); document.title = alterTitel; }, 50);
  };

  /* ---------- Dialog für die Lehrperson ---------- */
  LA.pruefungDialog = function (p) {
    const vorrat = LA.pruefungVorrat(p);
    const felder = LA.PRUEFUNG_TYPEN.map((t) => {
      const input = h('input', { type: 'number', min: 0, max: 30, value: Math.min(t.anzahl, vorrat[t.id].length), 'aria-label': t.name, class: 'pr-anzahl' });
      return { t, input, zeile: h('label', { class: 'pr-typ' }, input, ` ${t.name}`, h('span', { class: 'hinweis' }, ` · ${LA.PRUEFUNG_PUNKTE[t.id]} P. pro Aufgabe · im Paket: ${vorrat[t.id].length}`)) };
    });
    const versionen = h('select', { 'aria-label': 'Anzahl Versionen' }, [1, 2, 3, 4].map((n) => h('option', { value: n, selected: n === 2 }, n === 1 ? '1 Version' : `${n} Versionen (${VERSIONEN.slice(0, n).split('').join(', ')})`)));
    const quelleKi = h('input', { type: 'radio', name: 'pr-quelle', value: 'ki' });
    const quellePaket = h('input', { type: 'radio', name: 'pr-quelle', value: 'paket', checked: true });
    const skala = h('select', { 'aria-label': 'Notenskala' }, h('option', { value: 'linear' }, 'Notenskala linear (0 P. = 1, alle = 6)'), h('option', { value: '60' }, 'Notenskala: Note 4 bei 60 %'));
    const runden = h('select', { 'aria-label': 'Runden' }, h('option', { value: '0.5' }, 'auf halbe Noten runden'), h('option', { value: '0.1' }, 'auf Zehntel runden'));
    const loesungen = h('input', { type: 'checkbox', checked: true });
    const status = h('div', { 'aria-live': 'polite' });
    const anzahl = () => Object.fromEntries(felder.map((f) => [f.t.id, Math.max(0, Number(f.input.value) || 0)]));
    const knopf = h('button', { class: 'knopf', onclick: async () => {
      const a = anzahl();
      if (!Object.values(a).some(Boolean)) { LA.meldung('Wähle mindestens eine Aufgabe.', 'fehler'); return; }
      let quelle = p;
      if (quelleKi.checked) {
        if (!LA.kiVerfuegbar()) { LA.meldung('Für neue Fragen braucht es die KI.', 'fehler'); return; }
        knopf.disabled = true;
        LA.setzen(status, h('p', { class: 'hinweis' }, 'Die KI schreibt neue Prüfungsfragen … (meist unter einer Minute)'), h('div', { class: 'balken laeuft' }, h('div')));
        try {
          const n = Number(versionen.value);
          quelle = await LA.pruefungKiFragen(p, Object.fromEntries(Object.entries(a).map(([k, x]) => [k, x * n])));
        } catch (e) { LA.setzen(status, h('p', { class: 'rueckmeldung nein' }, e.message)); knopf.disabled = false; return; }
        knopf.disabled = false; LA.setzen(status);
      }
      const v = LA.pruefungBauen(quelle, { anzahl: a, versionen: Number(versionen.value) });
      if (!v[0].aufgaben.length) { LA.meldung('Dafür hat es zu wenig Aufgaben.', 'fehler'); return; }
      d.close();
      LA.pruefungDrucken(quelle, v, { skala: skala.value, runden: Number(runden.value), loesungen: loesungen.checked, linien: true });
    } }, 'Prüfung erstellen: Drucken / PDF');
    const d = h('dialog', { class: 'dialog' },
      h('div', { class: 'reihe zwischen' }, h('h2', null, 'Probeprüfung erstellen'), h('button', { class: 'mini', 'aria-label': 'schliessen', onclick: () => d.close() }, '✕')),
      h('p', { class: 'hinweis' }, 'Mehrere Versionen mit unterschiedlichen Aufgaben (soweit das Paket genug hat), gemischter Reihenfolge, Punkten, Lösungsblatt und Notenskala. Im Druckfenster «Als PDF speichern» wählen, um ein PDF zu erhalten.'),
      h('fieldset', null, h('legend', null, 'Aufgaben pro Version'), felder.map((f) => f.zeile)),
      h('fieldset', null, h('legend', null, 'Fragen'),
        h('label', { class: 'schalter' }, quellePaket, ' Aus dem Paket (kennen die Lernenden aus den Übungen)'),
        h('label', { class: 'schalter' }, quelleKi, ' Neue Fragen von der KI (kommen in den Übungen nicht vor, prüfen Verständnis statt Auswendiglernen)'),
        LA.kiVerfuegbar() ? null : h('p', { class: 'hinweis' }, 'Neue Fragen gehen nur mit KI.')),
      h('div', { class: 'reihe' }, versionen, skala, runden),
      h('label', { class: 'schalter' }, loesungen, ' Lösungsblätter mit Notenskala anhängen'),
      status, knopf);
    if (!LA.kiVerfuegbar()) quelleKi.disabled = true;
    d.addEventListener('close', () => d.remove());
    document.body.append(d); d.showModal();
  };

  /* ---------- Digitale Probeprüfung für Lernende ---------- */
  // Nur automatisch auswertbare Aufgaben (ohne Denkfragen)
  LA.pruefungDigitalMoeglich = (p) => { const v = LA.pruefungVorrat(p); return v.mc.length + v.wf.length + v.luecke.length + v.begriff.length >= 6; };

  LA.pruefungDigital = function (w, p, { fertig } = {}) {
    const start = () => {
      const [v] = LA.pruefungBauen(p, { anzahl: { mc: 6, wf: 4, luecke: 3, begriff: 3, offen: 0 }, versionen: 1 });
      const antworten = v.aufgaben.map(() => null);
      const felder = v.aufgaben.map((a, i) => {
        if (a.typ === 'mc' || a.typ === 'wf') {
          const optionen = a.typ === 'mc' ? a.optionen : ['Wahr', 'Falsch'];
          const knoepfe = optionen.map((o, j) => h('button', { class: 'option', 'aria-pressed': 'false', onclick: () => {
            knoepfe.forEach((k) => { k.classList.remove('gewaehlt'); k.setAttribute('aria-pressed', 'false'); });
            knoepfe[j].classList.add('gewaehlt'); knoepfe[j].setAttribute('aria-pressed', 'true'); antworten[i] = j;
          } }, a.typ === 'mc' ? `${BUCHSTABEN[j]}) ${o}` : o));
          return h('div', { class: 'optionen' + (a.typ === 'wf' ? ' wf' : '') }, knoepfe);
        }
        const feld = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': `Antwort zu Aufgabe ${i + 1}`, oninput: (e) => { antworten[i] = e.target.value; } });
        return feld;
      });
      const abgeben = h('button', { class: 'knopf gross', onclick: () => {
        const offen = antworten.filter((x) => x === null || x === '').length;
        if (offen && !confirm(`${offen} Aufgabe${offen === 1 ? ' ist' : 'n sind'} noch leer. Trotzdem abgeben?`)) return;
        auswerten(v, antworten);
      } }, 'Prüfung abgeben');
      LA.setzen(w,
        h('h2', null, 'Probeprüfung'),
        h('p', { class: 'hinweis' }, `${v.aufgaben.length} Aufgaben · ${v.max} Punkte. Wie in einer echten Prüfung: keine Hilfen, die Auflösung kommt erst nach dem Abgeben.`),
        h('ol', { class: 'pr-aufgaben digital' }, v.aufgaben.map((a, i) => h('li', { class: 'kasten pr-aufgabe' },
          h('div', { class: 'reihe zwischen' }, h('span', { class: 'label' }, `Aufgabe ${i + 1}`), h('span', { class: 'hinweis' }, `${a.punkte} P.`)),
          h('div', { class: 'frage' }, a.typ === 'mc' ? a.frage : a.typ === 'wf' ? a.aussage : a.typ === 'luecke' ? ['Ergänze: ', a.vor, ' ___ ', a.nach] : ['Wie heisst der Fachbegriff? ', h('em', null, a.erklaerung)]),
          felder[i]))),
        h('div', { class: 'reihe rechts' }, abgeben));
      window.scrollTo({ top: 0 });
    };

    const auswerten = (v, antworten) => {
      let punkte = 0;
      const urteile = v.aufgaben.map((a, i) => {
        const x = antworten[i];
        let ok = false, urteil = 'falsch';
        if (a.typ === 'mc') ok = x === a.richtig;
        else if (a.typ === 'wf') ok = x === (a.wahr ? 0 : 1);
        else { urteil = x ? LA.antwortPruefen(x, a.loesung) : 'falsch'; ok = urteil !== 'falsch'; }
        if (ok) punkte += a.punkte;
        return { ok, urteil };
      });
      const note = LA.note(punkte, v.max);
      if (fertig) fertig(punkte, v.max);
      LA.setzen(w,
        h('div', { class: 'ergebnis' },
          h('div', { class: 'label' }, 'Probeprüfung'),
          h('div', { class: 'ergebnis-zahl' }, `Note ${noteText(note)}`),
          h('p', null, `${punkte} von ${v.max} Punkten (Notenskala linear, auf halbe Noten gerundet).`),
          h('div', { class: 'reihe' }, h('button', { class: 'knopf', onclick: start }, 'Neue Probeprüfung'), h('button', { class: 'knopf sekundaer', onclick: () => LA.zurUebersicht() }, 'Zur Übersicht'))),
        h('h3', null, 'Deine Antworten'),
        h('ol', { class: 'pr-aufgaben digital' }, v.aufgaben.map((a, i) => {
          const x = antworten[i], u = urteile[i];
          const deine = a.typ === 'mc' ? (x === null ? '–' : a.optionen[x]) : a.typ === 'wf' ? (x === null ? '–' : x === 0 ? 'wahr' : 'falsch') : (x || '–');
          const richtig = a.typ === 'mc' ? a.optionen[a.richtig] : a.typ === 'wf' ? (a.wahr ? 'wahr' : 'falsch') : a.loesung;
          return h('li', { class: 'kasten pr-auswertung ' + (u.ok ? 'ok' : 'nein') },
            h('div', null, a.typ === 'mc' ? a.frage : a.typ === 'wf' ? a.aussage : a.typ === 'luecke' ? [a.vor, ' ___ ', a.nach] : a.erklaerung),
            h('div', null, h('span', { class: 'label' }, 'Deine Antwort'), ' ', deine, u.urteil === 'fast' ? ' (Schreibweise beachten)' : ''),
            u.ok && u.urteil !== 'fast' ? null : h('div', null, h('span', { class: 'label' }, 'Richtig'), ' ', h('strong', null, richtig), a.erklaerung && a.typ !== 'begriff' ? ' – ' + a.erklaerung : ''));
        })));
      window.scrollTo({ top: 0 });
    };
    start();
  };
})(window.LA);
