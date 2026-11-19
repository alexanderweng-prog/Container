// Schnelle Tests der Rechenlogik (ohne Browser): node --test tests/unit
const test = require('node:test');
const assert = require('node:assert/strict');
const { laden } = require('./laden');

test('Antwortprüfung: Tippfehler, Umlaute, kurze Wörter', () => {
  const LA = laden('util.js');
  const faelle = [
    ['Verdunstung', 'Verdunstung', 'richtig'],
    ['verdunstung ', 'Verdunstung', 'richtig'],      // Gross/klein, Leerzeichen
    ['Oberflaeche', 'Oberfläche', 'richtig'],          // Umlaut als ae
    ['Fuss', 'Fuß', 'richtig'],                        // ß = ss
    ['Verdunstug', 'Verdunstung', 'fast'],             // ein Buchstabe fehlt
    ['Verdusntung', 'Verdunstung', 'fast'],            // zwei vertauscht
    ['Kondensattion', 'Kondensation', 'fast'],
    ['Kndnstn', 'Kondensation', 'falsch'],             // zu viele Fehler
    ['Mehr', 'Meer', 'falsch'],                        // kurze Wörter streng
    ['Eis', 'Ei', 'falsch'],
    ['', 'Wolke', 'falsch'],
    ['Schmelzen', 'Gletscher', 'falsch'],
  ];
  for (const [eingabe, loesung, erwartet] of faelle) {
    assert.equal(LA.antwortPruefen(eingabe, loesung), erwartet, `${eingabe} → ${loesung}`);
  }
});

test('Editierdistanz', () => {
  const LA = laden('util.js');
  assert.equal(LA.abstand('abc', 'abc'), 0);
  assert.equal(LA.abstand('abc', 'acb'), 1);
  assert.equal(LA.abstand('', 'abc'), 3);
  assert.equal(LA.abstand('kitten', 'sitting'), 3);
});

test('Kreuzwort-Schreibweise', () => {
  const LA = laden('util.js');
  assert.equal(LA.kreuzwortForm('Grösse'), 'GROESSE');
  assert.equal(LA.kreuzwortForm('Fuß-Ball'), 'FUSSBALL');
  assert.equal(LA.kreuzwortForm('Café'), 'CAFE');
});

test('Kreuzworträtsel: Buchstaben an Kreuzungen stimmen, keine Berührungen', () => {
  const LA = laden('util.js', 'ki.js', 'offline.js', 'spiele.js');
  for (let lauf = 0; lauf < 30; lauf++) {
    const r = LA.kreuzwortBauen(LA.mischen(LA.DEMO.begriffe));
    assert.ok(r && r.woerter.length >= 4, 'zu wenige Wörter platziert');
    const zellen = new Map();
    for (const g of r.woerter) {
      for (let i = 0; i < g.wort.length; i++) {
        const k = (g.x + g.dx * i) + ',' + (g.y + g.dy * i);
        if (zellen.has(k)) assert.equal(zellen.get(k), g.wort[i], `Konflikt bei ${k}`);
        zellen.set(k, g.wort[i]);
      }
    }
    // Jede zusammenhängende Buchstabenreihe (ab 2 Feldern) muss genau ein platziertes Wort sein,
    // sonst entstehen durch Berührungen unsinnige «Wörter».
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      for (let a = 0; a < (dx ? r.hoehe : r.breite); a++) {
        let start = null;
        for (let b = 0; b <= (dx ? r.breite : r.hoehe); b++) {
          const x = dx ? b : a, y = dx ? a : b;
          const voll = zellen.has(x + ',' + y);
          if (voll && start === null) start = b;
          if (!voll && start !== null) {
            const laenge = b - start;
            if (laenge >= 2) {
              const sx = dx ? start : a, sy = dx ? a : start;
              assert.ok(r.woerter.some((g) => g.dx === dx && g.x === sx && g.y === sy && g.wort.length === laenge),
                `Ungewollte Buchstabenreihe bei ${sx},${sy} (Länge ${laenge}, ${dx ? 'waagrecht' : 'senkrecht'})`);
            }
            start = null;
          }
        }
      }
    }
    // Nummern beginnen bei 1 und sind lückenlos
    const nummern = [...new Set(r.woerter.map((g) => g.nr))].sort((a, b) => a - b);
    assert.deepEqual(nummern, nummern.map((_, i) => i + 1));
    // Alles im sichtbaren Bereich
    for (const g of r.woerter) assert.ok(g.x >= 0 && g.y >= 0 && g.x + g.dx * (g.wort.length - 1) < r.breite && g.y + g.dy * (g.wort.length - 1) < r.hoehe);
  }
});

test('Begriffsliste lesen (Modus ohne KI)', () => {
  const LA = laden('util.js', 'ki.js', 'offline.js');
  const liste = LA.begriffslisteLesen('Bizeps: beugt den Arm\nTrizeps - streckt den Arm\nOberarm > Deltamuskel = hebt den Arm\nkein Begriff hier\n');
  assert.deepEqual(liste, [
    { begriff: 'Bizeps', erklaerung: 'beugt den Arm', kategorie: '' },
    { begriff: 'Trizeps', erklaerung: 'streckt den Arm', kategorie: '' },
    { begriff: 'Deltamuskel', erklaerung: 'hebt den Arm', kategorie: 'Oberarm' },
  ]);
});

test('Paket ohne KI: alle Teile gültig', () => {
  const LA = laden('util.js', 'ki.js', 'offline.js');
  const p = LA.offlinePaket({
    titel: 'Beine', stufe: 'Sek I',
    begriffsliste: 'Strecker > Quadrizeps: streckt das Knie\nBeuger > Hamstrings: beugen das Knie\nStrecker > Wadenmuskel: streckt das Fussgelenk\nBeuger > Hüftbeuger: hebt den Oberschenkel\nStrecker > Gesäss: streckt die Hüfte',
    text: 'Der Quadrizeps liegt vorne am Oberschenkel.\n\nDie Hamstrings liegen hinten und bremsen bei der Landung.',
  });
  assert.ok(p.spiele.includes('zuordnen'), 'Zuordnen fehlt trotz Kategorien');
  for (const q of p.multiple_choice) assert.equal(q.optionen[q.richtig], q.erklaerung.split(':')[0]);
  assert.match(p.lueckentexte[0].text, /\{\{Quadrizeps\}\}/);
  assert.throws(() => LA.offlinePaket({ begriffsliste: 'A: b' }), /mindestens 4/);
});

test('Paketprüfung entfernt kaputte Inhalte', () => {
  const LA = laden('util.js', 'ki.js');
  const p = LA.paketPruefen({
    titel: 'X', kapitel: [], spiele: ['memory', 'gibtsnicht'],
    multiple_choice: [{ frage: 'ok', optionen: ['a', 'b'], richtig: 1 }, { frage: 'kaputt', optionen: ['a'], richtig: 3 }],
    lueckentexte: [{ titel: 'ohne Lücke', text: 'nichts' }], begriffe: [{ begriff: '', erklaerung: 'x' }],
  });
  assert.equal(p.multiple_choice.length, 1);
  const q = LA.paketPruefen({ multiple_choice: [
    { frage: 'A?', optionen: ['', 'x', '', 'y'], richtig: 3 },   // leere Optionen raus, Index wandert mit
    { frage: '', optionen: ['a', 'b'], richtig: 0 },              // Frage ohne Text
    { frage: 'B?', optionen: ['', 'b'], richtig: 0 },             // richtige Antwort leer
  ], wahr_falsch: [{ aussage: '', wahr: true }, { aussage: 'ok', wahr: false }], reihenfolgen: [{ titel: 't', schritte: ['1', '', '2', '3'] }] });
  assert.deepEqual(q.multiple_choice, [{ frage: 'A?', optionen: ['x', 'y'], richtig: 1 }]);
  assert.equal(q.wahr_falsch.length, 1);
  assert.deepEqual(q.reihenfolgen[0].schritte, ['1', '2', '3']);
  assert.equal(p.lueckentexte.length, 0);
  assert.equal(p.begriffe.length, 0);
  assert.deepEqual(p.spiele, ['memory']);
  assert.ok(p.id);
});

test('Lernkartei (Leitner): Fächer und Fälligkeit', () => {
  const LA = laden('util.js', 'ki.js', 'offline.js', 'wiederholen.js');
  const p = LA.paketPruefen(structuredClone(LA.DEMO));
  const heute = new Date().toISOString().slice(0, 10);
  const lesen = () => JSON.parse(localStorage.getItem('lernapp.lernstand.' + p.id));
  const zurueckdatieren = () => { const s = lesen(); for (const e of Object.values(s)) e.faellig = '2000-01-01'; localStorage.setItem('lernapp.lernstand.' + p.id, JSON.stringify(s)); };

  LA.melden(p.id, 'mc:0', false);
  assert.equal(lesen()['mc:0'].fach, 1, 'falsch → Fach 1');
  assert.equal(LA.lernstand(p).faellig.length, 1, 'Fach 1 sofort fällig');

  LA.melden(p.id, 'mc:0', true);
  assert.equal(lesen()['mc:0'].fach, 2, 'richtig wenn fällig → Fach 2');
  assert.equal(LA.lernstand(p).faellig.length, 0, 'Fach 2 erst morgen');

  LA.melden(p.id, 'mc:0', true);
  assert.equal(lesen()['mc:0'].fach, 2, 'Pauken vor dem Termin befördert nicht');

  for (const erwartet of [3, 4, 5, 5]) { zurueckdatieren(); LA.melden(p.id, 'mc:0', true); assert.equal(lesen()['mc:0'].fach, erwartet); }
  assert.ok(lesen()['mc:0'].faellig > heute);

  LA.melden(p.id, 'mc:0', false);
  assert.equal(lesen()['mc:0'].fach, 1, 'Fehler wirft ganz zurück');

  LA.melden(p.id, 'wf:1', true);
  assert.equal(lesen()['wf:1'].fach, 2, 'neue Karte richtig → Fach 2');

  // Unbekannte Karten (z. B. nach Bearbeiten gelöscht) werden ignoriert
  LA.melden(p.id, 'mc:999', false);
  assert.ok(!LA.lernstand(p).eintraege.some(([id]) => id === 'mc:999'));
});

test('Lernkartei: Karten-IDs decken alle Abfragearten ab', () => {
  const LA = laden('util.js', 'ki.js', 'offline.js', 'wiederholen.js');
  const p = LA.paketPruefen(structuredClone(LA.DEMO));
  const arten = new Set([...LA.karten(p).keys()].map((id) => id.split(':')[0]));
  assert.deepEqual([...arten].sort(), ['begriff', 'kap', 'kat', 'lt', 'mc', 'wf']);
  const luecken = [...LA.karten(p).keys()].filter((id) => id.startsWith('lt:')).length;
  assert.equal(luecken, (p.lueckentexte[0].text.match(/\{\{/g) || []).length);
});

test('Editor: Lernkartei folgt verschobenen, gelöschten und neu erzeugten Elementen', () => {
  const LA = laden('util.js', 'ki.js', 'offline.js', 'wiederholen.js', 'editor.js');
  const original = LA.paketPruefen(structuredClone(LA.DEMO));
  const kopie = structuredClone(original);
  for (const b of LA.EDITOR_BEREICHE) kopie[b.art].forEach((el, i) => { el._alt = i; });
  kopie.wahr_falsch.splice(0, 1);                              // erste Aussage gelöscht
  kopie.multiple_choice.reverse();                             // Reihenfolge umgedreht
  kopie.multiple_choice[0]._neu = true;                        // eine Frage neu erzeugt
  kopie.begriffe.unshift({ begriff: 'Neu', erklaerung: 'x', kategorie: '' }); // vorne eingefügt
  kopie.lueckentexte[0].text += ' Geändert.';                  // Lückentext verändert
  const z = LA._karteiZuordnung(original, kopie);
  const n = original.multiple_choice.length;
  assert.equal(z('wf:0'), null, 'gelöschte Karte verschwindet');
  assert.equal(z('wf:1'), 'wf:0', 'nachfolgende rücken auf');
  assert.equal(z('mc:0'), `mc:${n - 1}`, 'verschobene Frage behält ihren Lernstand');
  assert.equal(z(`mc:${n - 1}`), null, 'neu erzeugte Frage beginnt neu');
  assert.equal(z('begriff:0'), 'begriff:1');
  assert.equal(z('kat:0'), 'kat:1', 'Gruppen-Karten folgen ihrem Begriff');
  assert.equal(z('kap:2'), 'kap:2', 'unverändert bleibt gleich');
  assert.equal(z('lt:0:3'), null, 'geänderter Lückentext: Lücken-Nummern ungültig');
});

test('Statistik: Fingerabdruck und gemeldete Daten (ohne Personendaten)', () => {
  const LA = laden('util.js', 'ki.js', 'offline.js', 'wiederholen.js', 'statistik.js');
  assert.equal(LA.fingerabdruck('Was ist Energie?'), LA.fingerabdruck('was ist energie'), 'Gross/klein und Satzzeichen am Ende egal');
  assert.notEqual(LA.fingerabdruck('Frage A'), LA.fingerabdruck('Frage B'));
  assert.match(LA.fingerabdruck('x'), /^[0-9a-f]{8}$/);
  const p = Object.assign(LA.paketPruefen(structuredClone(LA.DEMO)), { id: 'p1', niveau: 3, quelle: 'ki' });
  const m = LA.statistikMeldung(p, 'mc:0', false, true);
  assert.deepEqual(Object.keys(m).sort(), ['p_art', 'p_frage', 'p_karte', 'p_paket', 'p_richtig', 'p_titel', 'p_wiederholung']);
  assert.equal(m.p_titel, 'Der Wasserkreislauf · Niveau 3');
  assert.equal(m.p_frage, p.multiple_choice[0].frage);
  assert.match(m.p_karte, /^mc:[0-9a-f]{8}$/);
  assert.equal(m.p_richtig, false);
  assert.equal(m.p_wiederholung, true);
  // Verschobene Frage: gleiche Statistik-Zeile
  const q = structuredClone(p); q.multiple_choice.reverse();
  assert.equal(LA.statistikMeldung(q, `mc:${q.multiple_choice.length - 1}`, true, false).p_karte, m.p_karte);
  assert.equal(LA.statistikMeldung(p, 'mc:999', true, false), null);
});
