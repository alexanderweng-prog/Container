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
