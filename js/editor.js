/* Editor: alle Inhalte eines Pakets ohne JSON bearbeiten, einzelne Elemente mit KI neu erzeugen.
   Die Lernkartei wird beim Speichern mitgeführt (Positionen ändern sich durch Löschen/Hinzufügen). */
(function (LA) {
  const { h } = LA;

  // Bereiche des Editors: Feld im Paket, Titel, Kartei-Präfix, leere Vorlage
  const BEREICHE = [
    { art: 'kapitel', titel: 'Lernschritte', praefix: 'kap', vorlage: () => ({ titel: '', erklaerung: '', beispiel: '', merksatz: '', check: { frage: '', optionen: ['', '', ''], richtig: 0, erklaerung: '' } }) },
    { art: 'begriffe', titel: 'Fachbegriffe', praefix: ['begriff', 'kat'], vorlage: () => ({ begriff: '', erklaerung: '', kategorie: '' }) },
    { art: 'multiple_choice', titel: 'Multiple Choice', praefix: 'mc', vorlage: () => ({ frage: '', optionen: ['', '', '', ''], richtig: 0, erklaerung: '' }) },
    { art: 'lueckentexte', titel: 'Lückentexte', praefix: 'lt', vorlage: () => ({ titel: '', text: '' }) },
    { art: 'wahr_falsch', titel: 'Wahr oder falsch', praefix: 'wf', vorlage: () => ({ aussage: '', wahr: true, erklaerung: '' }) },
    { art: 'reihenfolgen', titel: 'Reihenfolgen', vorlage: () => ({ titel: '', schritte: ['', '', ''] }) },
    { art: 'offene_fragen', titel: 'Denkfragen', vorlage: () => ({ frage: '', musterantwort: '', kriterien: [] }) },
  ];

  /* ---------- Eingabefelder, direkt an das Objekt gebunden ---------- */
  function feld(obj, key, label, opt = {}) {
    const attrs = { 'aria-label': label, placeholder: opt.platzhalter || '' };
    const el = opt.zeilen
      ? h('textarea', { ...attrs, rows: opt.zeilen }, obj[key] || '')
      : h('input', { ...attrs, type: 'text', value: obj[key] || '' });
    el.addEventListener('input', () => { obj[key] = el.value; if (opt.beiAenderung) opt.beiAenderung(); });
    return opt.ohneLabel ? el : h('label', { class: 'ed-feld' + (opt.breit ? ' breit' : '') }, h('span', null, label), el);
  }
  // Liste als Textfeld, ein Eintrag pro Zeile
  function zeilenFeld(obj, key, label, zeilen = 4) {
    const el = h('textarea', { rows: zeilen, 'aria-label': label }, (obj[key] || []).join('\n'));
    el.addEventListener('input', () => { obj[key] = el.value.split('\n').map((s) => s.trim()).filter(Boolean); });
    return h('label', { class: 'ed-feld breit' }, h('span', null, label + ' (eine pro Zeile)'), el);
  }

  function stufenWahl(el) {
    const w = h('select', { 'aria-label': 'Schwierigkeit', onchange: (e) => { if (e.target.value) el.schwierigkeit = Number(e.target.value); else delete el.schwierigkeit; } },
      h('option', { value: '' }, 'automatisch'),
      [1, 2, 3, 4, 5].map((n) => h('option', { value: n, selected: el.schwierigkeit === n }, `${n} – ${['sehr leicht', 'leicht', 'mittel', 'schwer', 'sehr schwer'][n - 1]}`)));
    return h('label', { class: 'ed-feld' }, h('span', null, 'Schwierigkeit (für das Flow-Training)'), w);
  }

  function mcEditor(q, zeichne, mitStufe) {
    const name = 'r' + LA.id();
    return h('div', { class: 'ed-mc' },
      feld(q, 'frage', 'Frage', { breit: true }),
      h('div', { class: 'ed-optionen' },
        h('span', { class: 'hinweis' }, 'Antworten – die richtige anklicken:'),
        q.optionen.map((o, i) => h('div', { class: 'ed-option-block' },
          h('div', { class: 'ed-option' },
            h('input', { type: 'radio', name, checked: q.richtig === i, 'aria-label': `Antwort ${i + 1} ist richtig`, onchange: () => { q.richtig = i; zeichne(); } }),
            (() => { const el = h('input', { type: 'text', value: o, 'aria-label': `Antwort ${i + 1}` }); el.addEventListener('input', () => { q.optionen[i] = el.value; }); return el; })(),
            q.optionen.length > 2 ? h('button', { class: 'mini', type: 'button', 'aria-label': `Antwort ${i + 1} entfernen`, onclick: () => {
              q.optionen.splice(i, 1);
              if (Array.isArray(q.rueckmeldungen)) q.rueckmeldungen.splice(i, 1);
              if (q.richtig === i) q.richtig = 0; else if (q.richtig > i) q.richtig--;
              zeichne();
            } }, '✕') : null),
          // Rückmeldung, wenn genau diese falsche Antwort gewählt wird
          q.richtig === i ? null : (() => {
            const el = h('input', { type: 'text', class: 'ed-warum', value: (q.rueckmeldungen && q.rueckmeldungen[i]) || '', placeholder: 'Warum stimmt diese Antwort nicht? (optional, erscheint wenn gewählt)', 'aria-label': `Rückmeldung zu Antwort ${i + 1}` });
            el.addEventListener('input', () => {
              if (!Array.isArray(q.rueckmeldungen)) q.rueckmeldungen = [];
              while (q.rueckmeldungen.length < q.optionen.length) q.rueckmeldungen.push('');
              q.rueckmeldungen[i] = el.value;
            });
            return el;
          })())),
        q.optionen.length < 6 ? h('button', { class: 'knopf sekundaer klein', type: 'button', onclick: () => { q.optionen.push(''); if (Array.isArray(q.rueckmeldungen)) q.rueckmeldungen.push(''); zeichne(); } }, '+ Antwort') : null),
      feld(q, 'erklaerung', 'Erklärung, warum die richtige Antwort stimmt', { breit: true }),
      mitStufe ? stufenWahl(q) : null);
  }

  function lueckenInfo(text) {
    const w = [...String(text).matchAll(/\{\{(.+?)\}\}/g)].map((m) => m[1]);
    return w.length ? `${w.length} Lücke${w.length === 1 ? '' : 'n'}: ${w.join(', ')}` : 'Noch keine Lücke. Wort markieren und «Zur Lücke machen» drücken.';
  }

  // Inhalt eines einzelnen Elements je nach Bereich
  function elementFelder(art, el, zeichne) {
    switch (art) {
      case 'kapitel': return [
        feld(el, 'titel', 'Titel', { breit: true }),
        feld(el, 'erklaerung', 'Erklärung (**fett**, Aufzählung mit «- »)', { zeilen: 6, breit: true }),
        feld(el, 'beispiel', 'Beispiel', { breit: true }),
        feld(el, 'merksatz', 'Merksatz', { breit: true }),
        h('div', { class: 'ed-unter' }, h('div', { class: 'label' }, 'Verständnisfrage'), mcEditor(el.check, zeichne)),
      ];
      case 'begriffe': return [h('div', { class: 'ed-drei' },
        feld(el, 'begriff', 'Begriff'), feld(el, 'erklaerung', 'Erklärung (ohne den Begriff)'), feld(el, 'kategorie', 'Gruppe (für Zuordnen)'))];
      case 'multiple_choice': return [mcEditor(el, zeichne, true)];
      case 'lueckentexte': {
        const info = h('div', { class: 'hinweis' }, lueckenInfo(el.text));
        const ta = feld(el, 'text', 'Text', { zeilen: 6, ohneLabel: true, beiAenderung: () => { info.textContent = lueckenInfo(el.text); } });
        return [
          feld(el, 'titel', 'Titel', { breit: true }),
          h('label', { class: 'ed-feld breit' }, h('span', null, 'Text – Lücken stehen in {{doppelten Klammern}}'), ta),
          h('div', { class: 'reihe' },
            h('button', { class: 'knopf sekundaer klein', type: 'button', onclick: () => {
              const a = ta.selectionStart, b = ta.selectionEnd;
              const wort = ta.value.slice(a, b).trim();
              if (!wort || wort.includes('{{')) { LA.meldung('Zuerst ein Wort im Text markieren.'); return; }
              const vor = ta.value.slice(0, a), nach = ta.value.slice(b);
              const leer = ta.value.slice(a, b).match(/^\s*/)[0], ende = ta.value.slice(a, b).match(/\s*$/)[0];
              ta.value = vor + leer + '{{' + wort + '}}' + ende + nach;
              ta.dispatchEvent(new Event('input'));
            } }, 'Markiertes Wort zur Lücke machen'),
            info),
        ];
      }
      case 'wahr_falsch': {
        const wahl = h('select', { 'aria-label': 'Stimmt die Aussage?', onchange: (e) => { el.wahr = e.target.value === 'wahr'; } },
          h('option', { value: 'wahr', selected: el.wahr }, 'stimmt'), h('option', { value: 'falsch', selected: !el.wahr }, 'stimmt nicht'));
        return [feld(el, 'aussage', 'Aussage', { breit: true }), h('div', { class: 'zwei' }, h('label', { class: 'ed-feld' }, h('span', null, 'Die Aussage …'), wahl), stufenWahl(el)), feld(el, 'erklaerung', 'Erklärung', { breit: true })];
      }
      case 'reihenfolgen': return [feld(el, 'titel', 'Auftrag', { breit: true }), zeilenFeld(el, 'schritte', 'Schritte in der richtigen Reihenfolge', 6)];
      case 'offene_fragen': return [feld(el, 'frage', 'Frage', { breit: true }), feld(el, 'musterantwort', 'Musterantwort', { zeilen: 3, breit: true }), zeilenFeld(el, 'kriterien', 'Bewertungskriterien', 3)];
      default: return [];
    }
  }

  function kurzname(art, el) {
    const t = { kapitel: el.titel, begriffe: el.begriff, multiple_choice: el.frage, lueckentexte: el.titel || String(el.text).slice(0, 60), wahr_falsch: el.aussage, reihenfolgen: el.titel, offene_fragen: el.frage }[art];
    return (t || '(leer)').slice(0, 90);
  }

  /* ---------- KI-Knopf pro Element ---------- */
  function kiZeile(paket, art, liste, index, zeichne) {
    if (!LA.kiVerfuegbar()) return null;
    const wunsch = h('input', { type: 'text', placeholder: 'Wunsch, z. B. «einfacher», «andere Falschantworten» (optional)', 'aria-label': 'Wunsch an die KI' });
    const status = h('span', { class: 'hinweis', 'aria-live': 'polite' });
    const knopf = h('button', { class: 'knopf sekundaer klein', type: 'button', onclick: async () => {
      knopf.disabled = true; status.textContent = 'Die KI arbeitet …';
      try {
        const neu = await LA.elementNeuErzeugen({ paket, art, element: liste[index], wunsch: wunsch.value.trim() });
        neu._neu = true;
        liste[index] = neu;
        zeichne();
        LA.meldung('Neu erzeugt. Prüfen und dann speichern.');
      } catch (e) { status.textContent = e.message; knopf.disabled = false; }
    } }, '✨ Neu erzeugen');
    return h('details', { class: 'ed-ki' }, h('summary', null, '✨ Mit KI neu erzeugen'), h('div', { class: 'reihe' }, wunsch, knopf), status);
  }

  /* ---------- Lernkartei nach dem Bearbeiten umschreiben ---------- */
  // Jedes Element trägt beim Öffnen des Editors seine ursprüngliche Position in «_alt».
  function karteiZuordnung(original, kopie) {
    const neueStelle = {};
    for (const b of BEREICHE) {
      if (!b.praefix) continue;
      const m = new Map();
      (kopie[b.art] || []).forEach((el, neu) => {
        if (el._alt === undefined || el._neu) return;
        // Lückentext: nur behalten, wenn der Text gleich geblieben ist (sonst stimmen die Lücken-Nummern nicht)
        if (b.art === 'lueckentexte' && el.text !== original.lueckentexte[el._alt].text) return;
        m.set(el._alt, neu);
      });
      for (const p of [].concat(b.praefix)) neueStelle[p] = m;
    }
    return (karteId) => {
      const [p, alt, ...rest] = karteId.split(':');
      const m = neueStelle[p];
      if (!m || !m.has(Number(alt))) return null;
      return [p, m.get(Number(alt)), ...rest].join(':');
    };
  }
  function markierungenEntfernen(p) {
    for (const b of BEREICHE) for (const el of p[b.art] || []) { delete el._alt; delete el._neu; }
    return p;
  }

  /* ---------- Editor-Ansicht ---------- */
  LA.editor = function (ziel, p, { speichern, abbrechen, loeschen }) {
    const kopie = structuredClone(p);
    for (const b of BEREICHE) (kopie[b.art] || (kopie[b.art] = [])).forEach((el, i) => { el._alt = i; });
    kopie.schreibauftrag = kopie.schreibauftrag || { aufgabe: '', hinweise: '' };
    // Lernschritt ohne Verständnisfrage: leere Vorlage (bleibt leer → wird beim Speichern wieder entfernt)
    kopie.kapitel.forEach((k) => { if (!k.check) k.check = { frage: '', optionen: ['', '', ''], richtig: 0, erklaerung: '' }; });
    const offen = new Set();

    const bereich = (b) => {
      const liste = kopie[b.art];
      const box = h('details', { class: 'ed-bereich', open: offen.has(b.art), ontoggle: (e) => { if (e.target.open) offen.add(b.art); else offen.delete(b.art); } });
      const zeichne = () => {
        LA.setzen(box,
          h('summary', null, h('strong', null, b.titel), h('span', { class: 'tag' }, liste.length)),
          liste.map((el, i) => h('div', { class: 'ed-element' + (el._neu ? ' neu' : '') },
            h('div', { class: 'reihe zwischen' },
              h('span', { class: 'ed-nr' }, `${i + 1}. ${kurzname(b.art, el)}`),
              h('span', { class: 'reihe' },
                h('button', { class: 'mini', type: 'button', 'aria-label': 'nach oben', disabled: i === 0, onclick: () => { [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]]; zeichne(); } }, '▲'),
                h('button', { class: 'mini', type: 'button', 'aria-label': 'nach unten', disabled: i === liste.length - 1, onclick: () => { [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]]; zeichne(); } }, '▼'),
                h('button', { class: 'mini gefahr', type: 'button', 'aria-label': 'löschen', onclick: () => { liste.splice(i, 1); zeichne(); } }, '🗑'))),
            elementFelder(b.art, el, zeichne),
            kiZeile(kopie, b.art, liste, i, zeichne))),
          h('div', { class: 'reihe' },
            h('button', { class: 'knopf sekundaer klein', type: 'button', onclick: () => { liste.push(b.vorlage()); zeichne(); } }, '+ Leer hinzufügen'),
            LA.kiVerfuegbar() ? h('button', { class: 'knopf sekundaer klein', type: 'button', onclick: async (e) => {
              const k = e.currentTarget; k.disabled = true; k.textContent = 'Die KI arbeitet …';
              try { const neu = await LA.elementNeuErzeugen({ paket: kopie, art: b.art, element: null }); neu._neu = true; liste.push(neu); zeichne(); }
              catch (err) { LA.meldung(err.message, 'fehler'); k.disabled = false; k.textContent = '✨ Mit KI hinzufügen'; }
            } }, '✨ Mit KI hinzufügen') : null));
      };
      zeichne();
      return box;
    };

    const schreib = h('details', { class: 'ed-bereich' }, h('summary', null, h('strong', null, 'Schreibauftrag')),
      h('div', { class: 'ed-element' }, feld(kopie.schreibauftrag, 'aufgabe', 'Auftrag', { breit: true }), feld(kopie.schreibauftrag, 'hinweise', 'Hinweise', { breit: true })));

    const auswahl = LA.SPIELTYPEN.map((s) => h('label', { class: 'schalter' }, h('input', { type: 'checkbox', value: s, checked: kopie.spiele.includes(s) }), ` ${LA.SPIELE[s].symbol} ${LA.SPIELE[s].name}`));
    const sicherheit = h('input', { type: 'checkbox', checked: !kopie.sicherheit_aus });
    const json = h('textarea', { rows: 16, class: 'mono', spellcheck: 'false' });
    const status = h('div', { 'aria-live': 'polite' });

    const fertigMachen = () => {
      kopie.spiele = auswahl.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
      if (sicherheit.checked) delete kopie.sicherheit_aus; else kopie.sicherheit_aus = true;
      const zuordnung = karteiZuordnung(p, kopie);
      const sauber = LA.paketPruefen(markierungenEntfernen(structuredClone(kopie)));
      // Unvollständige Einträge fallen bei der Prüfung weg: vorher fragen
      const weg = BEREICHE.reduce((n, b) => n + (kopie[b.art].length - sauber[b.art].length), 0);
      if (weg && !confirm(`${weg} unvollständige${weg === 1 ? 'r Eintrag wird' : ' Einträge werden'} beim Speichern entfernt (z. B. Lückentext ohne Lücke, Frage ohne richtige Antwort). Trotzdem speichern?`)) return null;
      // Spiele ohne genug Inhalt ausblenden, statt leere Spiele zu zeigen
      const ohneInhalt = sauber.spiele.filter((s) => !LA.SPIELE[s].moeglich(sauber));
      if (ohneInhalt.length) LA.meldung('Zu wenig Inhalt, ausgeblendet: ' + ohneInhalt.map((s) => LA.SPIELE[s].name).join(', '));
      return { paket: sauber, zuordnung };
    };

    LA.setzen(ziel,
      h('div', { class: 'reihe zwischen' }, h('h1', null, 'Paket bearbeiten'),
        h('div', { class: 'reihe' }, h('button', { class: 'knopf', onclick: () => { const r = fertigMachen(); if (r) speichern(r.paket, r.zuordnung); } }, 'Speichern'), h('button', { class: 'knopf sekundaer', onclick: abbrechen }, 'Abbrechen'))),
      h('div', { class: 'formular' },
        h('div', { class: 'zwei' }, feld(kopie, 'titel', 'Titel'), feld(kopie, 'fach', 'Fach')),
        feld(kopie, 'kurzbeschreibung', 'Kurzbeschreibung', { breit: true }),
        h('fieldset', null, h('legend', null, 'Welche Spiele sollen erscheinen?'), h('div', { class: 'schalter-raster' }, auswahl),
          h('label', { class: 'schalter' }, sicherheit, ' Vor dem Auflösen fragen: «Wie sicher bist du?» (Multiple Choice, Wahr/Falsch, Wiederholen, Flow-Training)')),
        h('p', { class: 'hinweis' }, 'Bereiche aufklappen zum Bearbeiten. ' + (LA.kiVerfuegbar() ? 'Mit ✨ erzeugt die KI ein einzelnes Element neu. ' : '') + 'Gelöschte oder neu erzeugte Fragen verlieren ihren Lernstand in der Lernkartei.'),
        BEREICHE.map(bereich), schreib,
        h('div', { class: 'reihe' },
          h('button', { class: 'knopf', onclick: () => { const r = fertigMachen(); if (r) speichern(r.paket, r.zuordnung); } }, 'Speichern'),
          h('button', { class: 'knopf sekundaer', onclick: abbrechen }, 'Abbrechen'),
          loeschen ? h('button', { class: 'knopf gefahr', onclick: loeschen }, 'Paket löschen') : null),
        h('details', { ontoggle: (e) => { if (e.target.open) json.value = JSON.stringify(markierungenEntfernen(structuredClone(kopie)), null, 2); } },
          h('summary', null, 'Für Fortgeschrittene: alles als JSON'),
          json,
          h('button', { class: 'knopf sekundaer', onclick: () => {
            try {
              const neu = LA.paketPruefen(JSON.parse(json.value));
              Object.assign(neu, { id: p.id, gruppe: p.gruppe, niveau: p.niveau });
              speichern(neu, () => null); // Struktur unbekannt: Lernstand neu beginnen
            } catch (e) { LA.setzen(status, h('div', { class: 'rueckmeldung nein' }, 'JSON-Fehler: ' + e.message)); }
          } }, 'JSON übernehmen (setzt den Lernstand zurück)'), status)));
  };

  LA.EDITOR_BEREICHE = BEREICHE;
  LA._karteiZuordnung = karteiZuordnung; // für Tests
})(window.LA);
