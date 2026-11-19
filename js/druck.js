/* Druckversion: Arbeitsblatt (A4) mit separatem Lösungsblatt. Über den Druckdialog auch als PDF speicherbar. */
(function (LA) {
  const { h } = LA;
  const BUCHSTABEN = 'ABCDEFGHIJKLMNOP';

  // Welche Teile gibt es für dieses Paket?
  function teile(p) {
    const moeglich = (s) => LA.SPIELE[s] && LA.SPIELE[s].moeglich(p);
    return [
      { id: 'lerntext', name: 'Lerntext (Erklärungen aus dem Lernpfad)', da: p.kapitel.length > 0, an: true },
      { id: 'multiple_choice', name: 'Multiple Choice', da: moeglich('multiple_choice') },
      { id: 'lueckentext', name: 'Lückentext', da: moeglich('lueckentext') },
      { id: 'wahr_falsch', name: 'Wahr oder falsch', da: moeglich('wahr_falsch') },
      { id: 'verbinden', name: 'Begriffe verbinden (statt Memory)', da: p.begriffe.length >= 4, spiel: 'memory' },
      { id: 'zuordnen', name: 'Zuordnen', da: moeglich('zuordnen') },
      { id: 'reihenfolge', name: 'Reihenfolge', da: moeglich('reihenfolge') },
      { id: 'kreuzwort', name: 'Kreuzworträtsel', da: moeglich('kreuzwort') },
      { id: 'offene_fragen', name: 'Denkfragen', da: moeglich('offene_fragen') },
      { id: 'textkorrektur', name: 'Schreibauftrag', da: moeglich('textkorrektur') },
    ].filter((t) => t.da).map((t) => ({ ...t, an: t.an || p.spiele.includes(t.spiel || t.id) }));
  }

  LA.druckDialog = function (p) {
    const liste = teile(p);
    const boxen = liste.map((t) => h('label', { class: 'schalter' }, h('input', { type: 'checkbox', value: t.id, checked: t.an }), ' ' + t.name));
    const loesungen = h('input', { type: 'checkbox', checked: true });
    const linien = h('input', { type: 'checkbox', checked: true });
    const d = h('dialog', { class: 'dialog' },
      h('div', { class: 'reihe zwischen' }, h('h2', null, 'Arbeitsblatt drucken'), h('button', { class: 'mini', 'aria-label': 'schliessen', onclick: () => d.close() }, '✕')),
      h('p', { class: 'hinweis' }, 'Wähle die Teile aus. Im Druckdialog kannst du auch «Als PDF speichern» wählen.'),
      h('div', { class: 'schalter-raster' }, boxen),
      h('label', { class: 'schalter' }, loesungen, ' Lösungsblatt anhängen (neue Seite)'),
      h('label', { class: 'schalter' }, linien, ' Schreiblinien bei Denkfragen und Schreibauftrag'),
      h('div', { class: 'reihe' }, h('button', { class: 'knopf', onclick: () => {
        const gewaehlt = boxen.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
        d.close();
        LA.drucken(p, { teile: gewaehlt, loesungen: loesungen.checked, linien: linien.checked });
      } }, 'Drucken / PDF')));
    d.addEventListener('close', () => d.remove());
    document.body.append(d); d.showModal();
  };

  LA.druckBlatt = function (p, opt) {
    const blatt = h('div', { class: 'druck-blatt' });
    const loesung = h('div', { class: 'druck-loesung' }, h('h1', null, 'Lösungen: ' + p.titel));
    const linienBlock = (n) => opt.linien ? h('div', { class: 'linien' }, Array.from({ length: n }, () => h('div', { class: 'linie' }))) : h('div', { style: { height: n * 9 + 'mm' } });
    let nr = 0;
    const aufgabe = (titel, auftrag, ...inhalt) => { nr++; return h('section', { class: 'druck-aufgabe' }, h('h2', null, `Aufgabe ${nr}: ${titel}`), auftrag ? h('p', { class: 'auftrag' }, auftrag) : null, inhalt); };
    const loesungTeil = (titel, ...inhalt) => h('section', { class: 'druck-aufgabe' }, h('h2', null, `Aufgabe ${nr}: ${titel}`), inhalt);

    blatt.append(h('header', { class: 'druck-kopf' },
      h('div', null, h('div', { class: 'druck-fach' }, [p.fach, p.stufe, LA.niveauText ? LA.niveauText(p) : ''].filter(Boolean).join(' · ')), h('h1', null, p.titel)),
      h('div', { class: 'druck-name' }, h('div', null, 'Name: ', h('span', { class: 'feld' })), h('div', null, 'Datum: ', h('span', { class: 'feld kurz' })))));

    for (const t of opt.teile) {
      if (t === 'lerntext') {
        blatt.append(h('section', { class: 'druck-lerntext' }, p.kapitel.map((k, i) => h('div', { class: 'druck-kapitel' },
          h('h3', null, `${i + 1}. ${k.titel}`), h('div', { html: LA.md(k.erklaerung) }),
          k.beispiel ? h('p', null, h('em', null, 'Beispiel: '), k.beispiel) : null,
          k.merksatz ? h('p', { class: 'druck-merksatz' }, k.merksatz) : null))));
      }

      if (t === 'multiple_choice') {
        const fragen = p.multiple_choice.map((q) => { const o = LA.mischen(q.optionen.map((_, i) => i)); return { q, o }; });
        blatt.append(aufgabe('Multiple Choice', 'Kreuze die richtige Antwort an.', h('ol', { class: 'druck-mc' }, fragen.map(({ q, o }) =>
          h('li', null, q.frage, h('ul', { class: 'druck-optionen' }, o.map((i, n) => h('li', null, h('span', { class: 'kaestchen' }), ` ${BUCHSTABEN[n]}) ${q.optionen[i]}`))))))));
        loesung.append(loesungTeil('Multiple Choice', h('ol', null, fragen.map(({ q, o }) => h('li', null, h('strong', null, BUCHSTABEN[o.indexOf(q.richtig)] + ') ' + q.optionen[q.richtig]), q.erklaerung ? ' – ' + q.erklaerung : '')))));
      }

      if (t === 'lueckentext') {
        for (const lt of p.lueckentexte) {
          const woerter = [];
          const text = h('p', { class: 'druck-luecken' });
          lt.text.split(/(\{\{.+?\}\})/).forEach((teil) => {
            const m = teil.match(/^\{\{(.+?)\}\}$/);
            if (m) { woerter.push(m[1]); text.append(h('span', { class: 'druck-nr' }, `(${woerter.length})`), h('span', { class: 'druck-luecke' })); }
            else teil.split('\n').forEach((z, j) => { if (j) text.append(h('br')); text.append(z); });
          });
          blatt.append(aufgabe(lt.titel || 'Lückentext', 'Setze die Wörter aus dem Kasten ein.', h('div', { class: 'druck-wortkasten' }, LA.mischen(woerter).join('   ·   ')), text));
          loesung.append(loesungTeil(lt.titel || 'Lückentext', h('ol', { class: 'druck-zweispaltig' }, woerter.map((w) => h('li', null, w)))));
        }
      }

      if (t === 'wahr_falsch') {
        blatt.append(aufgabe('Wahr oder falsch', 'Kreuze an. Korrigiere falsche Aussagen auf der Linie darunter.',
          h('table', { class: 'druck-tabelle' }, h('thead', null, h('tr', null, h('th', null, 'Aussage'), h('th', { class: 'schmal' }, 'wahr'), h('th', { class: 'schmal' }, 'falsch'))),
            h('tbody', null, p.wahr_falsch.map((a) => h('tr', null, h('td', null, a.aussage, h('div', { class: 'linie' })), h('td', { class: 'schmal' }, h('span', { class: 'kaestchen' })), h('td', { class: 'schmal' }, h('span', { class: 'kaestchen' }))))))));
        loesung.append(loesungTeil('Wahr oder falsch', h('ol', null, p.wahr_falsch.map((a) => h('li', null, h('strong', null, a.wahr ? 'wahr' : 'falsch'), ' – ', a.erklaerung || '')))));
      }

      if (t === 'verbinden') {
        const paare = LA.mischen(p.begriffe).slice(0, 10);
        const rechts = LA.mischen(paare.map((_, i) => i));
        blatt.append(aufgabe('Begriffe verbinden', 'Verbinde jeden Begriff mit der passenden Erklärung (Linie ziehen oder Buchstaben eintragen).',
          h('div', { class: 'druck-verbinden' },
            h('ol', null, paare.map((b) => h('li', null, h('strong', null, b.begriff), h('span', { class: 'feld eintrag' })))),
            h('ul', null, rechts.map((i, n) => h('li', null, h('strong', null, BUCHSTABEN[n] + ') '), paare[i].erklaerung))))));
        loesung.append(loesungTeil('Begriffe verbinden', h('ol', { class: 'druck-zweispaltig' }, paare.map((b, i) => h('li', null, `${b.begriff} → ${BUCHSTABEN[rechts.indexOf(i)]}`)))));
      }

      if (t === 'zuordnen') {
        const begr = p.begriffe.filter((b) => b.kategorie).slice(0, 14);
        const kat = [...new Set(begr.map((b) => b.kategorie))];
        blatt.append(aufgabe('Zuordnen', 'Schreibe jeden Begriff in die passende Spalte.',
          h('div', { class: 'druck-wortkasten' }, LA.mischen(begr.map((b) => b.begriff)).join('   ·   ')),
          h('table', { class: 'druck-tabelle druck-spalten' }, h('thead', null, h('tr', null, kat.map((k) => h('th', null, k)))),
            h('tbody', null, h('tr', null, kat.map(() => h('td', { style: { height: Math.max(30, Math.ceil(begr.length / kat.length) * 9) + 'mm' } })))))));
        loesung.append(loesungTeil('Zuordnen', h('ul', null, kat.map((k) => h('li', null, h('strong', null, k + ': '), begr.filter((b) => b.kategorie === k).map((b) => b.begriff).join(', '))))));
      }

      if (t === 'reihenfolge') {
        for (const r of p.reihenfolgen) {
          let o = LA.mischen(r.schritte.map((_, i) => i)); if (o.every((v, i) => v === i)) o.reverse();
          blatt.append(aufgabe('Reihenfolge', r.titel + ' Nummeriere die Schritte.', h('ul', { class: 'druck-reihenfolge' }, o.map((i) => h('li', null, h('span', { class: 'kaestchen gross' }), ' ' + r.schritte[i])))));
          loesung.append(loesungTeil('Reihenfolge', h('ol', null, r.schritte.map((s) => h('li', null, s)))));
        }
      }

      if (t === 'kreuzwort') {
        let r = null;
        for (let v = 0; v < 40; v++) {
          const x = LA.kreuzwortBauen(LA.mischen(p.begriffe).slice(0, 12));
          if (x && (!r || x.woerter.length > r.woerter.length || (x.woerter.length === r.woerter.length && x.breite * x.hoehe < r.breite * r.hoehe))) r = x;
        }
        if (r) {
          const gitter = (mitLoesung) => {
            const zellen = new Map();
            r.woerter.forEach((g) => { for (let i = 0; i < g.wort.length; i++) zellen.set((g.x + g.dx * i) + ',' + (g.y + g.dy * i), g.wort[i]); });
            const groesse = Math.min(8, Math.floor(175 / r.breite)); // mm, passt auf A4
            const tab = h('table', { class: 'druck-kw', style: { '--z': groesse + 'mm' } });
            for (let y = 0; y < r.hoehe; y++) {
              const tr = h('tr');
              for (let x = 0; x < r.breite; x++) {
                const b = zellen.get(x + ',' + y);
                const start = r.woerter.find((g) => g.x === x && g.y === y);
                tr.append(b ? h('td', { class: 'voll' }, start ? h('sup', null, start.nr) : null, mitLoesung ? b : '') : h('td'));
              }
              tab.append(tr);
            }
            return tab;
          };
          const hinweise = (dx, titel) => h('div', null, h('h3', null, titel), h('ol', null, r.woerter.filter((g) => g.dx === dx).sort((a, b) => a.nr - b.nr).map((g) => h('li', { value: g.nr }, `${g.erklaerung} (${g.wort.length})`))));
          blatt.append(aufgabe('Kreuzworträtsel', 'Ä = AE, Ö = OE, Ü = UE, ß = SS.', gitter(false), h('div', { class: 'druck-zweispaltig-block' }, hinweise(1, 'Waagrecht'), hinweise(0, 'Senkrecht'))));
          loesung.append(loesungTeil('Kreuzworträtsel', gitter(true)));
        }
      }

      if (t === 'offene_fragen') {
        blatt.append(aufgabe('Denkfragen', 'Antworte in ganzen Sätzen und begründe.', p.offene_fragen.map((f, i) => h('div', { class: 'druck-offen' }, h('p', null, h('strong', null, `${i + 1}. `), f.frage), linienBlock(4)))));
        loesung.append(loesungTeil('Denkfragen', h('ol', null, p.offene_fragen.map((f) => h('li', null, f.musterantwort, f.kriterien.length ? h('div', { class: 'klein' }, 'Kriterien: ' + f.kriterien.join('; ')) : null)))));
      }

      if (t === 'textkorrektur' && p.schreibauftrag) {
        blatt.append(aufgabe('Schreibauftrag', null, h('p', null, p.schreibauftrag.aufgabe), p.schreibauftrag.hinweise ? h('p', { class: 'klein' }, p.schreibauftrag.hinweise) : null, linienBlock(12)));
      }
    }
    return h('div', null, blatt, opt.loesungen && loesung.children.length > 1 ? loesung : null);
  };

  LA.drucken = function (p, opt) {
    let bereich = document.getElementById('druckbereich');
    if (!bereich) { bereich = h('div', { id: 'druckbereich' }); document.body.append(bereich); }
    LA.setzen(bereich, LA.druckBlatt(p, opt));
    const alterTitel = document.title;
    document.title = p.titel; // wird oft als PDF-Dateiname vorgeschlagen
    setTimeout(() => { window.print(); document.title = alterTitel; }, 50);
  };
})(window.LA);
