/* Gezieltes Wiederholen: Lernkartei nach Leitner (5 Fächer) über alle Spiele eines Pakets.
   Falsch → Fach 1, heute nochmals fällig. Richtig, wenn fällig → ein Fach weiter.
   Abstände: Fach 1 = sofort, 2 = 1 Tag, 3 = 3 Tage, 4 = 7 Tage, 5 = 16 Tage. */
(function (LA) {
  const { h } = LA;
  const ABSTAND = [0, 0, 1, 3, 7, 16]; // Index = Fach
  const MAX_PRO_RUNDE = 15;

  const heute = () => tagString(new Date());
  function tagString(d) { const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
  function plusTage(n) { const d = new Date(); d.setDate(d.getDate() + n); return tagString(d); }
  const schluessel = (id) => 'lernapp.lernstand.' + id;

  /* ---------- Karten aus dem Paket (stabile IDs über Position im Paket) ---------- */
  LA.karten = function (p) {
    const k = new Map();
    p.kapitel.forEach((kap, i) => { if (kap.check && kap.check.optionen) k.set('kap:' + i, { art: 'mc', frage: kap.check, quelle: kap.titel }); });
    p.multiple_choice.forEach((q, i) => k.set('mc:' + i, { art: 'mc', frage: q, quelle: 'Multiple Choice' }));
    p.wahr_falsch.forEach((a, i) => k.set('wf:' + i, { art: 'wf', aussage: a, quelle: 'Wahr oder falsch' }));
    p.begriffe.forEach((b, i) => {
      k.set('begriff:' + i, { art: 'begriff', begriff: b, quelle: 'Fachbegriff' });
      if (b.kategorie) k.set('kat:' + i, { art: 'kat', begriff: b, kategorien: [...new Set(p.begriffe.map((x) => x.kategorie).filter(Boolean))], quelle: 'Zuordnen' });
    });
    p.lueckentexte.forEach((lt, j) => {
      const luecken = [...lt.text.matchAll(/\{\{(.+?)\}\}/g)];
      luecken.forEach((m, n) => k.set(`lt:${j}:${n}`, { art: 'luecke', text: lt.text, nr: n, loesung: m[1], quelle: lt.titel || 'Lückentext' }));
    });
    return k;
  };

  /* ---------- Lernstand ---------- */
  const lesen = (id) => LA.speicher.lesen(schluessel(id), {});
  const schreiben = (id, s) => LA.speicher.schreiben(schluessel(id), s);

  // Jedes Spiel meldet hier jede einzelne Antwort
  LA.melden = function (paketId, karteId, richtig) {
    if (!paketId || !karteId) return;
    const s = lesen(paketId);
    const e = s[karteId] || { fach: 0, faellig: heute(), richtig: 0, falsch: 0 };
    if (richtig) {
      e.richtig++;
      // Nur befördern, wenn die Karte fällig war (sonst würde Pauken am selben Tag die Abstände aufblähen)
      if (e.fach === 0) { e.fach = 2; e.faellig = plusTage(ABSTAND[2]); }
      else if (e.faellig <= heute()) { e.fach = Math.min(5, e.fach + 1); e.faellig = plusTage(ABSTAND[e.fach]); }
    } else {
      e.falsch++;
      e.fach = 1; e.faellig = heute();
    }
    e.zuletzt = heute();
    s[karteId] = e;
    schreiben(paketId, s);
  };

  LA.lernstand = function (p) {
    const s = lesen(p.id), karten = LA.karten(p), t = heute();
    const eintraege = Object.entries(s).filter(([id]) => karten.has(id)); // gelöschte/geänderte Inhalte ignorieren
    const faellig = eintraege.filter(([, e]) => e.faellig <= t)
      .sort((a, b) => a[1].fach - b[1].fach || a[1].faellig.localeCompare(b[1].faellig));
    const faecher = [0, 0, 0, 0, 0, 0];
    eintraege.forEach(([, e]) => { faecher[e.fach]++; });
    return { karten, eintraege, faellig, faecher, gesehen: eintraege.length, total: karten.size, fehler: eintraege.filter(([, e]) => e.falsch > 0) };
  };

  LA.lernstandLoeschen = (id) => LA.speicher.loeschen(schluessel(id));

  // Nach dem Bearbeiten: Karten-IDs auf neue Positionen umschreiben; null = Karte verwerfen
  LA.lernstandUmschreiben = function (id, zuordnung) {
    const alt = lesen(id), neu = {};
    for (const [karteId, e] of Object.entries(alt)) {
      const ziel = zuordnung(karteId);
      if (ziel) neu[ziel] = e;
    }
    schreiben(id, neu);
    return { vorher: Object.keys(alt).length, nachher: Object.keys(neu).length };
  };

  /* ---------- Wiederholungsrunde ---------- */
  LA.wiederholenStarten = function (w, p, fertig, nurIds) {
    const st = LA.lernstand(p);
    let warteschlange = (nurIds || st.faellig.map(([id]) => id)).slice(0, MAX_PRO_RUNDE);
    if (!warteschlange.length) {
      LA.setzen(w, h('h2', null, 'Wiederholen'), h('p', null, 'Heute ist nichts fällig. 🎉'), naechsteTermine(p), h('button', { class: 'knopf sekundaer', onclick: () => LA.zurUebersicht() }, 'Zur Übersicht'));
      return;
    }
    const schonFalsch = new Set();
    let geloest = 0, versuche = 0;
    const gesamt = warteschlange.length;

    const naechste = () => {
      if (!warteschlange.length) {
        fertig(geloest, gesamt);
        return LA.setzen(w, h('div', { class: 'ergebnis' },
          h('div', { class: 'ergebnis-zahl' }, `${geloest} / ${gesamt}`),
          h('p', null, rundenText(geloest, gesamt, LA.lernstand(p).faellig.length)),
          LA.lernstand(p).faellig.length ? h('button', { class: 'knopf', onclick: () => LA.wiederholenStarten(w, p, fertig) }, 'Nochmals üben') : null,
          naechsteTermine(p),
          h('div', { class: 'reihe' }, h('button', { class: 'knopf sekundaer', onclick: () => LA.zurUebersicht() }, 'Zur Übersicht'))));
      }
      const id = warteschlange.shift();
      const karte = st.karten.get(id);
      const eintrag = lesen(p.id)[id];
      const weiter = h('button', { class: 'knopf', disabled: true, onclick: naechste }, 'Weiter');
      const antwort = (ok) => {
        versuche++;
        LA.melden(p.id, id, ok);
        if (ok && !schonFalsch.has(id)) geloest++;
        // Falsch: in dieser Runde nochmals, aber nicht sofort hintereinander
        if (!ok && !schonFalsch.has(id)) { schonFalsch.add(id); warteschlange.splice(Math.min(3, warteschlange.length), 0, id); }
        weiter.disabled = false; weiter.focus();
      };
      LA.setzen(w,
        h('div', { class: 'balken' }, h('div', { style: { width: Math.round(((gesamt - warteschlange.length - 1) / gesamt) * 100) + '%' } })),
        h('div', { class: 'reihe zwischen' }, h('div', { class: 'label' }, `Wiederholen · noch ${warteschlange.length + 1}`), fachAnzeige(eintrag ? eintrag.fach : 0)),
        h('div', { class: 'hinweis' }, 'Aus: ' + karte.quelle),
        karteAnzeigen(karte, antwort),
        h('div', { class: 'reihe rechts' }, weiter));
      const erstesFeld = w.querySelector('input[type=text]'); if (erstesFeld) erstesFeld.focus();
    };
    naechste();
  };

  function rundenText(geloest, gesamt, nochFaellig) {
    const k = (n) => `${n} Karte${n === 1 ? '' : 'n'}`;
    if (geloest === gesamt) return 'Alles auf Anhieb gewusst.';
    const teil = `${k(gesamt - geloest)} brauchte${gesamt - geloest === 1 ? '' : 'n'} einen zweiten Anlauf.`;
    return nochFaellig ? `${teil} ${k(nochFaellig)} ${nochFaellig === 1 ? 'sitzt' : 'sitzen'} noch nicht und ${nochFaellig === 1 ? 'ist' : 'sind'} heute nochmals fällig.` : `${teil} Sie kommen morgen wieder.`;
  }

  function fachAnzeige(fach) {
    return h('span', { class: 'faecher', title: `Fach ${fach || '–'} von 5`, 'aria-label': `Fach ${fach || 'neu'} von 5` },
      [1, 2, 3, 4, 5].map((n) => h('span', { class: 'fach-punkt' + (n <= fach ? ' voll' : '') })));
  }
  LA.fachAnzeige = fachAnzeige;

  function naechsteTermine(p) {
    const st = LA.lernstand(p), t = heute();
    const kuenftig = st.eintraege.map(([, e]) => e.faellig).filter((d) => d > t).sort();
    if (!kuenftig.length) return null;
    const naechster = kuenftig[0];
    const anzahl = kuenftig.filter((d) => d === naechster).length;
    const tage = Math.round((new Date(naechster) - new Date(t)) / 86400000);
    return h('p', { class: 'hinweis' }, `Nächste Wiederholung: ${tage === 1 ? 'morgen' : 'in ' + tage + ' Tagen'} (${anzahl} Karte${anzahl === 1 ? '' : 'n'}).`);
  }

  // Satz mit der gesuchten Lücke; andere Lücken werden ausgefüllt gezeigt
  function lueckenSatz(k) {
    let n = -1;
    const ganz = k.text.replace(/\{\{(.+?)\}\}/g, (_, wort) => { n++; return n === k.nr ? '\u0000' : wort; }).replace(/\n/g, ' ');
    const satz = ganz.split(/(?<=[.!?])\s+/).find((s) => s.includes('\u0000')) || ganz;
    const [vor, nach] = satz.split('\u0000');
    return { vor, nach };
  }

  /* ---------- Darstellung je Kartenart ---------- */
  function karteAnzeigen(k, antwort) {
    if (k.art === 'mc') return LA.mcKarte(k.frage, antwort);

    if (k.art === 'wf') {
      const rueck = h('div', { class: 'rueckmeldung', 'aria-live': 'polite' });
      const knopf = (wert, text) => {
        const b = h('button', { class: 'option gross', onclick: () => {
          box.querySelectorAll('button.option').forEach((x) => { x.disabled = true; });
          const ok = wert === k.aussage.wahr;
          b.classList.add(ok ? 'richtig' : 'falsch');
          rueck.className = 'rueckmeldung ' + (ok ? 'ok' : 'nein');
          LA.setzen(rueck, h('strong', null, (ok ? 'Richtig – ' : 'Nein – ') + (k.aussage.wahr ? 'die Aussage stimmt. ' : 'die Aussage stimmt nicht. ')), k.aussage.erklaerung);
          antwort(ok);
        } }, text);
        return b;
      };
      const box = h('div', null, h('div', { class: 'frage aussage mit-ton' }, h('span', null, k.aussage.aussage), LA.vorleseKnopf(k.aussage.aussage, 'Aussage vorlesen')),
        h('div', { class: 'wf' }, knopf(true, 'Wahr'), knopf(false, 'Falsch')), rueck);
      return box;
    }

    if (k.art === 'kat') {
      const rueck = h('div', { class: 'rueckmeldung', 'aria-live': 'polite' });
      const box = h('div', null, h('div', { class: 'frage' }, `Zu welcher Gruppe gehört «${k.begriff.begriff}»?`),
        h('div', { class: 'optionen' }, k.kategorien.map((kat) => {
          const b = h('button', { class: 'option', onclick: () => {
            box.querySelectorAll('button.option').forEach((x) => { x.disabled = true; if (x.textContent === k.begriff.kategorie) x.classList.add('richtig'); });
            const ok = kat === k.begriff.kategorie; if (!ok) b.classList.add('falsch');
            rueck.className = 'rueckmeldung ' + (ok ? 'ok' : 'nein');
            LA.setzen(rueck, h('strong', null, ok ? 'Richtig. ' : 'Nein. '), `${k.begriff.begriff}: ${k.begriff.erklaerung}`);
            antwort(ok);
          } }, kat);
          return b;
        })), rueck);
      return box;
    }

    // Eingabe-Karten: Begriff aus Erklärung abrufen, oder eine einzelne Lücke
    let frage, loesung, zusatz = null;
    if (k.art === 'begriff') {
      frage = h('div', { class: 'frage mit-ton' }, h('span', null, `Welcher Fachbegriff ist gemeint? «${k.begriff.erklaerung}»`), LA.vorleseKnopf(k.begriff.erklaerung, 'Erklärung vorlesen'));
      loesung = k.begriff.begriff;
    } else {
      frage = h('div', { class: 'frage' }, 'Welches Wort fehlt?');
      zusatz = lueckenSatz(k);
      loesung = k.loesung;
    }
    const feld = h('input', { type: 'text', class: zusatz ? 'luecke' : 'eingabe-gross', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Deine Antwort', size: zusatz ? Math.max(6, loesung.length + 2) : null });
    const rueck = h('div', { class: 'rueckmeldung', 'aria-live': 'polite' });
    const tipp = h('button', { class: 'knopf sekundaer klein', type: 'button', onclick: () => { tipp.disabled = true; LA.setzen(rueck, `Tipp: beginnt mit «${loesung.slice(0, 1)}», ${loesung.length} Buchstaben.`); feld.focus(); } }, 'Tipp');
    let erledigt = false;
    const pruefen = h('button', { class: 'knopf', onclick: () => {
      if (erledigt || !feld.value.trim()) return;
      erledigt = true; feld.disabled = true; pruefen.disabled = true; tipp.disabled = true;
      const urteil = LA.antwortPruefen(feld.value, loesung);
      feld.classList.add(urteil);
      const ok = urteil !== 'falsch';
      rueck.className = 'rueckmeldung ' + (ok ? 'ok' : 'nein');
      LA.setzen(rueck, h('strong', null, urteil === 'richtig' ? 'Richtig. ' : urteil === 'fast' ? 'Fast – achte auf die Schreibweise: ' : 'Gesucht war: '), urteil === 'richtig' ? '' : loesung,
        k.art === 'begriff' && urteil === 'richtig' ? k.begriff.erklaerung : '');
      antwort(ok);
    } }, 'Prüfen');
    feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pruefen.click(); } });
    return h('div', null, frage,
      zusatz ? h('p', { class: 'luecken-text' }, zusatz.vor, feld, zusatz.nach) : feld,
      h('div', { class: 'reihe' }, pruefen, tipp), rueck);
  }

  /* ---------- Fehlerheft: Übersicht aller Karten mit Fehlern ---------- */
  LA.fehlerheft = function (w, p) {
    const st = LA.lernstand(p);
    const text = (k) => k.art === 'mc' ? [k.frage.frage, k.frage.optionen[k.frage.richtig]]
      : k.art === 'wf' ? [k.aussage.aussage, k.aussage.wahr ? 'wahr' : 'falsch']
      : k.art === 'kat' ? [`Gruppe von «${k.begriff.begriff}»`, k.begriff.kategorie]
      : k.art === 'begriff' ? [k.begriff.erklaerung, k.begriff.begriff]
      : (() => { const s = lueckenSatz(k); return [s.vor + '___' + s.nach, k.loesung]; })();
    const liste = st.fehler.sort((a, b) => a[1].fach - b[1].fach || b[1].falsch - a[1].falsch);
    LA.setzen(w,
      h('h2', null, 'Fehlerheft'),
      h('p', { class: 'hinweis' }, 'Alles, was du schon einmal falsch hattest. Die Punkte zeigen das Fach: je mehr, desto sicherer. Ab Fach 5 gilt eine Karte als gelernt.'),
      h('div', { class: 'statistik' }, [1, 2, 3, 4, 5].map((n) => h('div', { class: 'stat-fach' }, h('div', { class: 'stat-zahl' }, st.faecher[n]), h('div', { class: 'label' }, 'Fach ' + n)))),
      liste.length ? h('ol', { class: 'fehlerliste' }, liste.map(([id, e]) => {
        const [f, l] = text(st.karten.get(id));
        return h('li', null, h('div', { class: 'reihe zwischen' }, h('span', null, f), fachAnzeige(e.fach)), h('div', null, h('strong', null, '→ ' + l)), h('div', { class: 'hinweis' }, `${e.falsch}× falsch, ${e.richtig}× richtig`));
      })) : h('p', null, 'Noch keine Fehler gespeichert.'),
      h('div', { class: 'reihe' },
        liste.length ? h('button', { class: 'knopf', onclick: () => LA.wiederholenStarten(w, p, () => {}, liste.map(([id]) => id)) }, 'Alle Fehler jetzt üben') : null,
        h('button', { class: 'knopf sekundaer', onclick: () => LA.zurUebersicht() }, 'Zur Übersicht'),
        st.gesehen ? h('button', { class: 'knopf gefahr', onclick: () => { if (confirm('Lernstand für dieses Paket wirklich löschen?')) { LA.lernstandLoeschen(p.id); LA.fehlerheft(w, p); } } }, 'Lernstand zurücksetzen') : null));
  };
})(window.LA);
