/* Alle Spieltypen. Jedes Spiel: start(wurzel, paket, fertig(punkte, max)) */
(function (LA) {
  const { h } = LA;

  function fortschrittsbalken(i, n) {
    return h('div', { class: 'balken', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': i },
      h('div', { style: { width: Math.round((i / n) * 100) + '%' } }));
  }
  function ergebnis(wurzel, punkte, max, nochmal, text) {
    const q = max ? punkte / max : 0;
    wurzel.replaceChildren(h('div', { class: 'ergebnis' },
      h('div', { class: 'ergebnis-zahl' }, `${punkte} / ${max}`),
      h('p', null, text || (q >= 0.9 ? 'Ausgezeichnet!' : q >= 0.7 ? 'Gut gemacht. Schau dir die Fehler nochmals an.' : q >= 0.5 ? 'Solide Basis – üb das nochmals.' : 'Geh zurück in den Lernpfad und versuch es dann nochmals.')),
      h('div', { class: 'reihe' }, h('button', { class: 'knopf', onclick: nochmal }, 'Nochmals'), h('button', { class: 'knopf sekundaer', onclick: () => LA.zurUebersicht() }, 'Zur Übersicht'))));
  }

  /* ---------------- Multiple-Choice-Frage (auch im Lernpfad verwendet) ---------------- */
  function mcKarte(frage, beiAntwort) {
    const reihenfolge = LA.mischen(frage.optionen.map((_, i) => i));
    const knoepfe = [];
    const rueck = h('div', { class: 'rueckmeldung', 'aria-live': 'polite' });
    const box = h('div', { class: 'mc' }, h('div', { class: 'frage' }, frage.frage),
      h('div', { class: 'optionen' }, reihenfolge.map((i) => {
        const k = h('button', { class: 'option', onclick: () => waehle(i, k) }, frage.optionen[i]);
        knoepfe.push([i, k]); return k;
      })), rueck);
    let fertig = false;
    function waehle(i, k) {
      if (fertig) return; fertig = true;
      const richtig = i === frage.richtig;
      for (const [j, kn] of knoepfe) { kn.disabled = true; if (j === frage.richtig) kn.classList.add('richtig'); }
      if (!richtig) k.classList.add('falsch');
      rueck.className = 'rueckmeldung ' + (richtig ? 'ok' : 'nein');
      rueck.replaceChildren(h('strong', null, richtig ? 'Richtig. ' : 'Leider falsch. '), frage.erklaerung || '');
      beiAntwort(richtig);
    }
    return box;
  }

  const SPIELE = {};

  /* ---------------- Lernpfad: erklären → Beispiel → Merksatz → Check ---------------- */
  SPIELE.lernpfad = {
    name: 'Lernpfad', symbol: '📖', info: 'Schritt für Schritt erklärt, mit Verständnisfrage.',
    moeglich: (p) => p.kapitel.length > 0,
    start(w, p, fertig) {
      let i = 0, punkte = 0;
      const zeige = () => {
        if (i >= p.kapitel.length) { fertig(punkte, p.kapitel.length); return ergebnis(w, punkte, p.kapitel.length, () => { i = 0; punkte = 0; zeige(); }, 'Lernpfad abgeschlossen. Jetzt kannst du mit den Übungen weitermachen.'); }
        const k = p.kapitel[i];
        const weiter = h('button', { class: 'knopf', disabled: true, onclick: () => { i++; zeige(); window.scrollTo({ top: 0 }); } }, i + 1 < p.kapitel.length ? 'Weiter' : 'Abschliessen');
        const nachfrage = LA.kiVerfuegbar() ? nachfrageBox(k, p) : null;
        w.replaceChildren(
          fortschrittsbalken(i, p.kapitel.length),
          h('div', { class: 'label' }, `Schritt ${i + 1} von ${p.kapitel.length}`),
          h('h2', null, k.titel),
          h('div', { class: 'erklaerung', html: LA.md(k.erklaerung) }),
          k.beispiel ? h('div', { class: 'kasten beispiel' }, h('div', { class: 'label' }, 'Beispiel'), k.beispiel) : null,
          k.merksatz ? h('div', { class: 'kasten merksatz' }, h('div', { class: 'label' }, 'Merksatz'), k.merksatz) : null,
          nachfrage,
          k.check && k.check.optionen ? h('div', { class: 'kasten' }, h('div', { class: 'label' }, 'Hast du es verstanden?'), mcKarte(k.check, (ok) => { if (ok) punkte++; weiter.disabled = false; })) : (weiter.disabled = false, null),
          h('div', { class: 'reihe rechts' }, weiter));
      };
      zeige();
    },
  };

  function nachfrageBox(kapitel, p) {
    const eingabe = h('input', { type: 'text', placeholder: 'Frage zu diesem Schritt stellen …', 'aria-label': 'Frage an die KI' });
    const antwort = h('div', { class: 'ki-antwort', 'aria-live': 'polite' });
    const knopf = h('button', { class: 'knopf sekundaer klein', onclick: fragen }, 'Fragen');
    async function fragen() {
      const f = eingabe.value.trim(); if (!f) return;
      knopf.disabled = true; antwort.textContent = 'Die KI denkt nach …';
      try { antwort.innerHTML = LA.md(await LA.nachfragen({ kapitel, frage: f, stufe: p.stufe })); }
      catch (e) { antwort.textContent = e.message; }
      knopf.disabled = false;
    }
    eingabe.addEventListener('keydown', (e) => { if (e.key === 'Enter') fragen(); });
    return h('details', { class: 'nachfrage' }, h('summary', null, 'Nicht ganz klar? Frag die KI'), h('div', { class: 'reihe' }, eingabe, knopf), antwort);
  }

  /* ---------------- Multiple Choice ---------------- */
  SPIELE.multiple_choice = {
    name: 'Multiple Choice', symbol: '✅', info: 'Wähle die richtige Antwort.',
    moeglich: (p) => p.multiple_choice.length >= 3,
    start(w, p, fertig) {
      const fragen = LA.mischen(p.multiple_choice);
      let i = 0, punkte = 0;
      const zeige = () => {
        if (i >= fragen.length) { fertig(punkte, fragen.length); return ergebnis(w, punkte, fragen.length, () => SPIELE.multiple_choice.start(w, p, fertig)); }
        const weiter = h('button', { class: 'knopf', disabled: true, onclick: () => { i++; zeige(); } }, 'Weiter');
        w.replaceChildren(fortschrittsbalken(i, fragen.length), h('div', { class: 'label' }, `Frage ${i + 1} von ${fragen.length} · ${punkte} richtig`),
          mcKarte(fragen[i], (ok) => { if (ok) punkte++; weiter.disabled = false; weiter.focus(); }), h('div', { class: 'reihe rechts' }, weiter));
      };
      zeige();
    },
  };

  /* ---------------- Lückentext ---------------- */
  SPIELE.lueckentext = {
    name: 'Lückentext', symbol: '✏️', info: 'Setze die fehlenden Wörter ein.',
    moeglich: (p) => p.lueckentexte.length > 0,
    start(w, p, fertig) {
      const lt = p.lueckentexte[Math.floor(Math.random() * p.lueckentexte.length)];
      const teile = lt.text.split(/(\{\{.+?\}\})/);
      const felder = [];
      let aktiv = null;
      const text = h('div', { class: 'luecken-text' });
      for (const t of teile) {
        const m = t.match(/^\{\{(.+?)\}\}$/);
        if (m) {
          const f = h('input', { type: 'text', class: 'luecke', size: Math.max(4, m[1].length + 1), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Lücke ' + (felder.length + 1) });
          f.dataset.loesung = m[1];
          f.addEventListener('focus', () => { aktiv = f; });
          felder.push(f); text.append(f);
        } else {
          t.split('\n').forEach((s, j) => { if (j) text.append(h('br')); text.append(s); });
        }
      }
      const bank = h('div', { class: 'wortbank' }, LA.mischen(felder.map((f) => f.dataset.loesung)).map((wort) =>
        h('button', { class: 'chip', onclick: (e) => {
          const ziel = aktiv && !aktiv.value ? aktiv : felder.find((f) => !f.value);
          if (!ziel) return;
          ziel.value = wort; e.currentTarget.classList.add('benutzt');
          const naechste = felder.find((f) => !f.value); if (naechste) naechste.focus();
        } }, wort)));
      const pruefen = h('button', { class: 'knopf', onclick: () => {
        let punkte = 0;
        for (const f of felder) {
          const ok = LA.norm(f.value) === LA.norm(f.dataset.loesung);
          f.classList.toggle('richtig', ok); f.classList.toggle('falsch', !ok);
          if (!ok) f.title = 'Richtig: ' + f.dataset.loesung;
          if (ok) punkte++;
        }
        fertig(punkte, felder.length);
        info.textContent = `${punkte} von ${felder.length} richtig.` + (punkte < felder.length ? ' Fahre über rote Felder (oder tippe darauf) für die Lösung.' : '');
        felder.forEach((f) => { if (f.classList.contains('falsch')) f.addEventListener('click', () => { f.value = f.dataset.loesung; }, { once: true }); });
      } }, 'Prüfen');
      const info = h('div', { class: 'rueckmeldung', 'aria-live': 'polite' });
      const hilfe = h('label', { class: 'schalter' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { bank.hidden = !e.target.checked; } }), ' Wörter anzeigen');
      w.replaceChildren(h('h2', null, lt.titel || 'Lückentext'), hilfe, bank, text, h('div', { class: 'reihe' }, pruefen, h('button', { class: 'knopf sekundaer', onclick: () => SPIELE.lueckentext.start(w, p, fertig) }, 'Neu')), info);
    },
  };

  /* ---------------- Memory ---------------- */
  SPIELE.memory = {
    name: 'Memory', symbol: '🧠', info: 'Finde Begriff und Erklärung.',
    moeglich: (p) => p.begriffe.length >= 4,
    start(w, p, fertig) {
      const paare = LA.mischen(p.begriffe).slice(0, 8);
      const karten = LA.mischen(paare.flatMap((b, i) => [{ paar: i, text: b.begriff, art: 'begriff' }, { paar: i, text: b.erklaerung, art: 'erkl' }]));
      let offen = [], gefunden = 0, zuege = 0, sperre = false;
      const status = h('div', { class: 'label' });
      const raster = h('div', { class: 'memory' });
      const aktualisieren = () => { status.textContent = `${gefunden} von ${paare.length} Paaren · ${zuege} Züge`; };
      for (const k of karten) {
        const el = h('button', { class: 'memo-karte ' + k.art, 'aria-label': 'verdeckte Karte' }, h('span', null, k.text));
        el.addEventListener('click', () => {
          if (sperre || el.classList.contains('offen')) return;
          el.classList.add('offen'); el.setAttribute('aria-label', k.text); offen.push([k, el]);
          if (offen.length === 2) {
            zuege++;
            const [[a, ea], [b, eb]] = offen;
            if (a.paar === b.paar) {
              ea.classList.add('gefunden'); eb.classList.add('gefunden'); offen = []; gefunden++;
              if (gefunden === paare.length) {
                const punkte = Math.max(1, Math.round(paare.length * Math.min(1, (paare.length * 1.5) / zuege)));
                fertig(punkte, paare.length);
                setTimeout(() => ergebnis(w, punkte, paare.length, () => SPIELE.memory.start(w, p, fertig), `Alle Paare in ${zuege} Zügen gefunden.`), 700);
              }
            } else {
              sperre = true;
              setTimeout(() => { ea.classList.remove('offen'); eb.classList.remove('offen'); ea.setAttribute('aria-label', 'verdeckte Karte'); eb.setAttribute('aria-label', 'verdeckte Karte'); offen = []; sperre = false; }, 1300);
            }
          }
          aktualisieren();
        });
        raster.append(el);
      }
      aktualisieren();
      w.replaceChildren(h('h2', null, 'Memory'), h('p', { class: 'hinweis' }, 'Decke zwei Karten auf: Ein Begriff (dunkel) und seine Erklärung (hell) bilden ein Paar.'), status, raster);
    },
  };

  /* ---------------- Kreuzworträtsel ---------------- */
  function kreuzwortBauen(eintraege) {
    const woerter = eintraege.map((e) => ({ ...e, wort: LA.kreuzwortForm(e.begriff) }))
      .filter((e) => e.wort.length >= 3 && e.wort.length <= 16 && !/\s/.test(e.begriff.trim()))
      .sort((a, b) => b.wort.length - a.wort.length);
    const zelle = new Map(); // "x,y" -> Buchstabe
    const gesetzt = [];
    const key = (x, y) => x + ',' + y;
    function passt(wort, x, y, dx, dy) {
      let kreuzungen = 0;
      if (zelle.has(key(x - dx, y - dy)) || zelle.has(key(x + dx * wort.length, y + dy * wort.length))) return -1;
      for (let i = 0; i < wort.length; i++) {
        const cx = x + dx * i, cy = y + dy * i, vorh = zelle.get(key(cx, cy));
        if (vorh) { if (vorh !== wort[i]) return -1; kreuzungen++; continue; }
        // Nachbarn quer zur Richtung müssen frei sein
        if (zelle.has(key(cx + dy, cy + dx)) || zelle.has(key(cx - dy, cy - dx))) return -1;
      }
      return kreuzungen;
    }
    function setze(e, x, y, dx, dy) {
      for (let i = 0; i < e.wort.length; i++) zelle.set(key(x + dx * i, y + dy * i), e.wort[i]);
      gesetzt.push({ ...e, x, y, dx, dy });
    }
    if (!woerter.length) return null;
    setze(woerter[0], 0, 0, 1, 0);
    const rest = woerter.slice(1);
    for (let runde = 0; runde < 2; runde++) {
      for (const e of rest.slice()) {
        let bester = null;
        for (const g of gesetzt) for (let i = 0; i < g.wort.length; i++) for (let j = 0; j < e.wort.length; j++) {
          if (g.wort[i] !== e.wort[j]) continue;
          const dx = g.dy, dy = g.dx; // quer zum vorhandenen Wort
          const x = g.x + g.dx * i - dx * j, y = g.y + g.dy * i - dy * j;
          const k = passt(e.wort, x, y, dx, dy);
          if (k > 0 && (!bester || k > bester.k)) bester = { x, y, dx, dy, k };
        }
        if (bester) { setze(e, bester.x, bester.y, bester.dx, bester.dy); rest.splice(rest.indexOf(e), 1); }
      }
    }
    const xs = [...zelle.keys()].map((k) => +k.split(',')[0]), ys = [...zelle.keys()].map((k) => +k.split(',')[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    gesetzt.forEach((g) => { g.x -= minX; g.y -= minY; });
    // Nummern nach Lesereihenfolge
    const starts = [...new Set(gesetzt.map((g) => key(g.x, g.y)))].sort((a, b) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return ay - by || ax - bx; });
    gesetzt.forEach((g) => { g.nr = starts.indexOf(key(g.x, g.y)) + 1; });
    return { breite: Math.max(...xs) - minX + 1, hoehe: Math.max(...ys) - minY + 1, woerter: gesetzt };
  }

  SPIELE.kreuzwort = {
    name: 'Kreuzworträtsel', symbol: '🔠', info: 'Fachbegriffe ins Gitter eintragen.',
    moeglich: (p) => { const r = kreuzwortBauen(p.begriffe); return !!r && r.woerter.length >= 4; },
    start(w, p, fertig) {
      // Mehrere Versuche mit gemischter Reihenfolge, das dichteste Rätsel gewinnt
      let raetsel = null;
      for (let v = 0; v < 40; v++) {
        const r = kreuzwortBauen(LA.mischen(p.begriffe).slice(0, 12));
        // Auf schmalen Bildschirmen schmale Rätsel bevorzugen, sonst kompakte
        const mass = (x) => (window.innerWidth < 600 ? x.breite * 100 + x.hoehe : x.breite * x.hoehe);
        if (r && (!raetsel || r.woerter.length > raetsel.woerter.length || (r.woerter.length === raetsel.woerter.length && mass(r) < mass(raetsel)))) raetsel = r;
      }
      const { breite, hoehe, woerter } = raetsel;
      const felder = new Map();
      const gitter = h('div', { class: 'kw-gitter', style: { gridTemplateColumns: `repeat(${breite}, var(--kw))` } });
      let richtung = { dx: 1, dy: 0 };
      for (let y = 0; y < hoehe; y++) for (let x = 0; x < breite; x++) {
        const teil = woerter.filter((g) => (g.dy === 0 && g.y === y && x >= g.x && x < g.x + g.wort.length) || (g.dx === 0 && g.x === x && y >= g.y && y < g.y + g.wort.length));
        if (!teil.length) { gitter.append(h('div', { class: 'kw-leer' })); continue; }
        const g = teil[0], idx = g.dx ? x - g.x : y - g.y;
        const nr = woerter.find((s) => s.x === x && s.y === y);
        const inp = h('input', { class: 'kw-feld', maxlength: 1, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': `Feld ${x + 1},${y + 1}` });
        inp.dataset.loesung = g.wort[idx];
        inp.addEventListener('focus', () => {
          const hat = (dx) => teil.some((t) => t.dx === dx);
          if (!hat(richtung.dx)) richtung = hat(1) ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
          markiere(x, y);
        });
        inp.addEventListener('input', () => {
          inp.value = LA.kreuzwortForm(inp.value).slice(-1);
          inp.classList.remove('falsch', 'richtig');
          const n = felder.get((x + richtung.dx) + ',' + (y + richtung.dy)); if (inp.value && n) n.focus();
        });
        inp.addEventListener('keydown', (e) => {
          const ziele = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
          if (ziele[e.key]) { const [dx, dy] = ziele[e.key]; richtung = { dx: Math.abs(dx), dy: Math.abs(dy) }; const n = felder.get((x + dx) + ',' + (y + dy)); if (n) n.focus(); e.preventDefault(); }
          if (e.key === 'Backspace' && !inp.value) { const n = felder.get((x - richtung.dx) + ',' + (y - richtung.dy)); if (n) { n.focus(); n.value = ''; } e.preventDefault(); }
        });
        felder.set(x + ',' + y, inp);
        gitter.append(h('div', { class: 'kw-zelle' }, nr ? h('span', { class: 'kw-nr' }, nr.nr) : null, inp));
      }
      function markiere(x, y) {
        felder.forEach((f) => f.parentElement.classList.remove('aktiv'));
        const g = woerter.find((s) => s.dx === richtung.dx && (s.dx ? s.y === y && x >= s.x && x < s.x + s.wort.length : s.x === x && y >= s.y && y < s.y + s.wort.length));
        if (!g) return;
        for (let i = 0; i < g.wort.length; i++) felder.get((g.x + g.dx * i) + ',' + (g.y + g.dy * i)).parentElement.classList.add('aktiv');
        hinweisZeile.textContent = `${g.nr} ${g.dx ? 'waagrecht' : 'senkrecht'}: ${g.erklaerung}`;
      }
      const hinweisZeile = h('div', { class: 'kw-aktuell', 'aria-live': 'polite' }, 'Tippe auf ein Feld.');
      const liste = (dx, titel) => h('div', null, h('div', { class: 'label' }, titel), h('ol', { class: 'kw-hinweise' },
        woerter.filter((g) => g.dx === dx).sort((a, b) => a.nr - b.nr).map((g) => h('li', { value: g.nr }, `${g.erklaerung} (${g.wort.length})`))));
      const info = h('div', { class: 'rueckmeldung', 'aria-live': 'polite' });
      const pruefen = h('button', { class: 'knopf', onclick: () => {
        let richtigeWoerter = 0;
        for (const g of woerter) {
          let ok = true;
          for (let i = 0; i < g.wort.length; i++) { const f = felder.get((g.x + g.dx * i) + ',' + (g.y + g.dy * i)); if (f.value !== f.dataset.loesung) ok = false; }
          if (ok) richtigeWoerter++;
        }
        felder.forEach((f) => { if (f.value) { f.classList.toggle('richtig', f.value === f.dataset.loesung); f.classList.toggle('falsch', f.value !== f.dataset.loesung); } });
        fertig(richtigeWoerter, woerter.length);
        info.textContent = `${richtigeWoerter} von ${woerter.length} Wörtern richtig.` + (richtigeWoerter === woerter.length ? ' Perfekt!' : '');
      } }, 'Prüfen');
      const aufloesen = h('button', { class: 'knopf sekundaer', onclick: () => felder.forEach((f) => { f.value = f.dataset.loesung; f.classList.remove('falsch'); }) }, 'Auflösen');
      const wrap = h('div', { class: 'kw-wrap' }, gitter);
      // Feldgrösse an verfügbare Breite anpassen (Handy), zwischen 22 und 36 px
      const groesse = () => { if (!gitter.isConnected) return window.removeEventListener('resize', groesse); const px = Math.floor((wrap.clientWidth - 2 * (breite - 1)) / breite); gitter.style.setProperty('--kw', Math.max(18, Math.min(36, px)) + 'px'); };
      requestAnimationFrame(groesse);
      window.addEventListener('resize', groesse);
      w.replaceChildren(h('h2', null, 'Kreuzworträtsel'), h('p', { class: 'hinweis' }, 'Umlaute als AE, OE, UE schreiben. Pfeiltasten wechseln die Richtung.'),
        hinweisZeile, wrap, h('div', { class: 'kw-listen' }, liste(1, 'Waagrecht'), liste(0, 'Senkrecht')),
        h('div', { class: 'reihe' }, pruefen, aufloesen, h('button', { class: 'knopf sekundaer', onclick: () => SPIELE.kreuzwort.start(w, p, fertig) }, 'Neues Rätsel')), info);
    },
  };

  /* ---------------- Wahr / Falsch ---------------- */
  SPIELE.wahr_falsch = {
    name: 'Wahr oder falsch', symbol: '⚖️', info: 'Stimmt die Aussage?',
    moeglich: (p) => p.wahr_falsch.length >= 3,
    start(w, p, fertig) {
      const liste = LA.mischen(p.wahr_falsch);
      let i = 0, punkte = 0;
      const zeige = () => {
        if (i >= liste.length) { fertig(punkte, liste.length); return ergebnis(w, punkte, liste.length, () => SPIELE.wahr_falsch.start(w, p, fertig)); }
        const a = liste[i];
        const rueck = h('div', { class: 'rueckmeldung', 'aria-live': 'polite' });
        const weiter = h('button', { class: 'knopf', disabled: true, onclick: () => { i++; zeige(); } }, 'Weiter');
        const antwort = (wahl, k) => {
          wk.disabled = fk.disabled = true;
          const ok = wahl === a.wahr; if (ok) punkte++;
          k.classList.add(ok ? 'richtig' : 'falsch');
          rueck.className = 'rueckmeldung ' + (ok ? 'ok' : 'nein');
          rueck.replaceChildren(h('strong', null, (ok ? 'Richtig – ' : 'Nein – ') + (a.wahr ? 'die Aussage stimmt. ' : 'die Aussage stimmt nicht. ')), a.erklaerung || '');
          weiter.disabled = false; weiter.focus();
        };
        const wk = h('button', { class: 'option gross', onclick: () => antwort(true, wk) }, 'Wahr');
        const fk = h('button', { class: 'option gross', onclick: () => antwort(false, fk) }, 'Falsch');
        w.replaceChildren(fortschrittsbalken(i, liste.length), h('div', { class: 'label' }, `Aussage ${i + 1} von ${liste.length}`),
          h('div', { class: 'frage aussage' }, a.aussage), h('div', { class: 'wf' }, wk, fk), rueck, h('div', { class: 'reihe rechts' }, weiter));
      };
      zeige();
    },
  };

  /* ---------------- Reihenfolge ---------------- */
  SPIELE.reihenfolge = {
    name: 'Reihenfolge', symbol: '🔢', info: 'Bring die Schritte in die richtige Abfolge.',
    moeglich: (p) => p.reihenfolgen.length > 0,
    start(w, p, fertig) {
      const r = p.reihenfolgen[Math.floor(Math.random() * p.reihenfolgen.length)];
      let ordnung = LA.mischen(r.schritte.map((_, i) => i));
      if (ordnung.every((v, i) => v === i)) ordnung.reverse();
      const liste = h('ol', { class: 'sortier' });
      const info = h('div', { class: 'rueckmeldung', 'aria-live': 'polite' });
      const zeichne = (markieren) => {
        liste.replaceChildren(...ordnung.map((idx, pos) => h('li', { class: 'sortier-el' + (markieren ? (idx === pos ? ' richtig' : ' falsch') : '') },
          h('span', { class: 'sortier-text' }, r.schritte[idx]),
          h('span', { class: 'sortier-knoepfe' },
            h('button', { class: 'mini', 'aria-label': 'nach oben', disabled: pos === 0, onclick: () => tausche(pos, pos - 1) }, '▲'),
            h('button', { class: 'mini', 'aria-label': 'nach unten', disabled: pos === ordnung.length - 1, onclick: () => tausche(pos, pos + 1) }, '▼')))));
      };
      const tausche = (a, b) => { [ordnung[a], ordnung[b]] = [ordnung[b], ordnung[a]]; zeichne(false); info.textContent = ''; };
      zeichne(false);
      w.replaceChildren(h('h2', null, 'Reihenfolge'), h('p', { class: 'hinweis' }, r.titel), liste,
        h('div', { class: 'reihe' }, h('button', { class: 'knopf', onclick: () => {
          const punkte = ordnung.filter((v, i) => v === i).length;
          zeichne(true); fertig(punkte, ordnung.length);
          info.textContent = punkte === ordnung.length ? 'Alles in der richtigen Reihenfolge!' : `${punkte} von ${ordnung.length} Schritten am richtigen Platz.`;
        } }, 'Prüfen'), h('button', { class: 'knopf sekundaer', onclick: () => SPIELE.reihenfolge.start(w, p, fertig) }, 'Neu mischen')), info);
    },
  };

  /* ---------------- Zuordnen (Begriffe in Kategorien) ---------------- */
  SPIELE.zuordnen = {
    name: 'Zuordnen', symbol: '🗂️', info: 'Sortiere die Begriffe in die passenden Gruppen.',
    moeglich: (p) => new Set(p.begriffe.map((b) => b.kategorie).filter(Boolean)).size >= 2,
    start(w, p, fertig) {
      const begriffe = LA.mischen(p.begriffe.filter((b) => b.kategorie)).slice(0, 12);
      const kategorien = [...new Set(begriffe.map((b) => b.kategorie))];
      const zuordnung = new Map();
      let gewaehlt = null;
      const vorrat = h('div', { class: 'wortbank' });
      const spalten = h('div', { class: 'kategorien' });
      const info = h('div', { class: 'rueckmeldung', 'aria-live': 'polite' });
      const zeichne = () => {
        vorrat.replaceChildren(...begriffe.filter((b) => !zuordnung.has(b)).map((b) =>
          h('button', { class: 'chip' + (gewaehlt === b ? ' gewaehlt' : ''), onclick: () => { gewaehlt = gewaehlt === b ? null : b; zeichne(); } }, b.begriff)));
        if (!vorrat.children.length) vorrat.append(h('span', { class: 'hinweis' }, 'Alle Begriffe sind verteilt. Jetzt prüfen!'));
        spalten.replaceChildren(...kategorien.map((k) => h('div', { class: 'kategorie' + (gewaehlt ? ' bereit' : ''), onclick: () => { if (gewaehlt) { zuordnung.set(gewaehlt, k); gewaehlt = null; zeichne(); } } },
          h('div', { class: 'kategorie-titel' }, k),
          begriffe.filter((b) => zuordnung.get(b) === k).map((b) => h('button', { class: 'chip klein', title: 'zurücklegen', onclick: (e) => { e.stopPropagation(); zuordnung.delete(b); zeichne(); } }, b.begriff)))));
      };
      zeichne();
      w.replaceChildren(h('h2', null, 'Zuordnen'), h('p', { class: 'hinweis' }, 'Tippe zuerst einen Begriff an, dann die passende Gruppe. Antippen in der Gruppe legt ihn zurück.'), vorrat, spalten,
        h('div', { class: 'reihe' }, h('button', { class: 'knopf', onclick: () => {
          let punkte = 0;
          spalten.querySelectorAll('.kategorie').forEach((sp, ki) => sp.querySelectorAll('.chip').forEach((c) => {
            const b = begriffe.find((x) => x.begriff === c.textContent && zuordnung.get(x) === kategorien[ki]);
            const ok = b && b.kategorie === kategorien[ki]; if (ok) punkte++;
            c.classList.add(ok ? 'richtig' : 'falsch');
          }));
          fertig(punkte, begriffe.length);
          info.textContent = `${punkte} von ${begriffe.length} richtig zugeordnet.`;
        } }, 'Prüfen'), h('button', { class: 'knopf sekundaer', onclick: () => SPIELE.zuordnen.start(w, p, fertig) }, 'Neu')), info);
    },
  };

  /* ---------------- Offene Fragen (mit KI-Bewertung oder Selbsteinschätzung) ---------------- */
  SPIELE.offene_fragen = {
    name: 'Denkfragen', symbol: '💬', info: 'Antworte in eigenen Worten – mit Rückmeldung.',
    moeglich: (p) => p.offene_fragen.length > 0,
    start(w, p, fertig) {
      let i = 0, punkte = 0;
      const max = p.offene_fragen.length * 3;
      const zeige = () => {
        if (i >= p.offene_fragen.length) { fertig(punkte, max); return ergebnis(w, punkte, max, () => SPIELE.offene_fragen.start(w, p, fertig)); }
        const f = p.offene_fragen[i];
        const feld = h('textarea', { rows: 5, placeholder: 'Deine Antwort …', 'aria-label': 'Deine Antwort' });
        const rueck = h('div', { class: 'ki-antwort', 'aria-live': 'polite' });
        const weiter = h('button', { class: 'knopf', disabled: true, onclick: () => { i++; zeige(); } }, 'Weiter');
        const abgeben = h('button', { class: 'knopf' }, LA.kiVerfuegbar() ? 'Rückmeldung holen' : 'Musterantwort zeigen');
        abgeben.addEventListener('click', async () => {
          if (!feld.value.trim()) { rueck.textContent = 'Schreib zuerst eine Antwort.'; return; }
          abgeben.disabled = true;
          if (LA.kiVerfuegbar()) {
            rueck.textContent = 'Die KI liest deine Antwort …';
            try {
              const r = await LA.antwortBewerten({ ...f, antwort: feld.value, stufe: p.stufe });
              const pkt = Math.max(0, Math.min(3, r.punkte)); punkte += pkt;
              rueck.replaceChildren(h('div', { class: 'punkte' }, '●'.repeat(pkt) + '○'.repeat(3 - pkt), ` ${pkt} / 3`), h('p', null, r.feedback), h('p', null, h('strong', null, 'Tipp: '), r.tipp),
                h('details', null, h('summary', null, 'Musterantwort'), h('p', null, f.musterantwort)));
              weiter.disabled = false;
            } catch (e) { rueck.textContent = e.message; abgeben.disabled = false; }
          } else {
            const selbst = (pkt) => { punkte += pkt; weiter.disabled = false; weiter.click(); };
            rueck.replaceChildren(h('div', { class: 'label' }, 'Musterantwort'), h('p', null, f.musterantwort),
              h('div', { class: 'label' }, 'Darauf kommt es an'), h('ul', null, f.kriterien.map((k) => h('li', null, k))),
              h('p', null, 'Wie gut war deine Antwort?'), h('div', { class: 'reihe' }, [0, 1, 2, 3].map((n) => h('button', { class: 'knopf sekundaer klein', onclick: () => selbst(n) }, `${n} Punkt${n === 1 ? '' : 'e'}`))));
          }
        });
        w.replaceChildren(fortschrittsbalken(i, p.offene_fragen.length), h('div', { class: 'label' }, `Frage ${i + 1} von ${p.offene_fragen.length}`),
          h('div', { class: 'frage' }, f.frage), feld, h('div', { class: 'reihe' }, abgeben), rueck, h('div', { class: 'reihe rechts' }, weiter));
      };
      zeige();
    },
  };

  /* ---------------- Textkorrektur ---------------- */
  SPIELE.textkorrektur = {
    name: 'Schreiben & Korrektur', symbol: '📝', info: 'Schreib einen Text – die KI korrigiert und erklärt.',
    moeglich: (p) => !!(p.schreibauftrag && p.schreibauftrag.aufgabe),
    braucht_ki: true,
    start(w, p, fertig) {
      const a = p.schreibauftrag;
      const feld = h('textarea', { rows: 10, placeholder: 'Schreib hier deinen Text …', 'aria-label': 'Dein Text', spellcheck: 'false' });
      const zaehler = h('span', { class: 'hinweis' }, '0 Wörter');
      feld.addEventListener('input', () => { zaehler.textContent = (feld.value.trim().split(/\s+/).filter(Boolean).length) + ' Wörter'; });
      const ausgabe = h('div', { 'aria-live': 'polite' });
      const knopf = h('button', { class: 'knopf', onclick: async () => {
        if (!LA.kiVerfuegbar()) { ausgabe.replaceChildren(h('div', { class: 'kasten' }, 'Für die Korrektur braucht es die KI. Die Lehrperson kann in den Einstellungen einen API-Schlüssel hinterlegen.')); return; }
        if (feld.value.trim().split(/\s+/).length < 5) { ausgabe.textContent = 'Schreib zuerst etwas mehr.'; return; }
        knopf.disabled = true; ausgabe.textContent = 'Die KI korrigiert deinen Text …';
        try {
          const r = await LA.textKorrigieren({ aufgabe: a.aufgabe, text: feld.value, stufe: p.stufe, fachinhalt: p.kurzbeschreibung + ' ' + p.kapitel.map((k) => k.merksatz).join(' ') });
          ausgabe.replaceChildren(korrekturAnsicht(feld.value, r));
          fertig(Math.max(0, 10 - r.fehler.length), 10);
        } catch (e) { ausgabe.textContent = e.message; }
        knopf.disabled = false;
      } }, 'Korrigieren lassen');
      w.replaceChildren(h('h2', null, 'Schreiben & Korrektur'), h('div', { class: 'kasten' }, h('div', { class: 'label' }, 'Auftrag'), a.aufgabe, a.hinweise ? h('p', { class: 'hinweis' }, a.hinweise) : null),
        feld, h('div', { class: 'reihe zwischen' }, zaehler, knopf), ausgabe);
    },
  };

  function korrekturAnsicht(original, r) {
    // Fehlerstellen im Originaltext markieren (erste Fundstelle je Fehler, von hinten nach vorne)
    const treffer = [];
    let suchStart = 0;
    for (const [n, f] of r.fehler.entries()) {
      if (!f.original) continue;
      let pos = original.indexOf(f.original, suchStart);
      if (pos < 0) pos = original.indexOf(f.original);
      if (pos >= 0 && !treffer.some((t) => pos < t.ende && pos + f.original.length > t.pos)) { treffer.push({ pos, ende: pos + f.original.length, n }); suchStart = pos + f.original.length; }
    }
    treffer.sort((a, b) => a.pos - b.pos);
    const text = h('div', { class: 'korr-text' });
    let p = 0;
    for (const t of treffer) {
      text.append(original.slice(p, t.pos));
      const f = r.fehler[t.n];
      text.append(h('mark', { class: 'korr-' + f.art.toLowerCase(), title: `${f.art}: ${f.korrektur} – ${f.erklaerung}` }, original.slice(t.pos, t.ende), h('sup', null, t.n + 1)));
      p = t.ende;
    }
    text.append(original.slice(p));
    return h('div', { class: 'korrektur' },
      h('div', { class: 'label' }, `Dein Text · ${r.fehler.length} Hinweise`), text,
      r.fehler.length ? h('ol', { class: 'korr-liste' }, r.fehler.map((f) => h('li', null, h('span', { class: 'tag korr-' + f.art.toLowerCase() }, f.art), ' ', h('s', null, f.original), ' → ', h('strong', null, f.korrektur), h('div', { class: 'hinweis' }, f.erklaerung)))) : h('p', null, 'Keine Fehler gefunden.'),
      h('div', { class: 'kasten' }, h('div', { class: 'label' }, 'Das ist gelungen'), r.staerken),
      h('div', { class: 'kasten' }, h('div', { class: 'label' }, 'Inhalt'), r.inhalt),
      h('div', { class: 'kasten merksatz' }, h('div', { class: 'label' }, 'Dein Schwerpunkt fürs nächste Mal'), r.tipp),
      h('details', null, h('summary', null, 'Korrigierte Fassung anzeigen'), h('div', { class: 'korr-text' }, r.korrigierter_text)));
  }

  LA.SPIELE = SPIELE;
  LA.kreuzwortBauen = kreuzwortBauen;
})(window.LA);
