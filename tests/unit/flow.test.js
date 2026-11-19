// Flow-Training: Modell (Elo/Rasch) und Simulation mit virtuellen Lernenden
const test = require('node:test');
const assert = require('node:assert/strict');
const { laden } = require('./laden');

function setup() {
  const LA = laden('util.js', 'ki.js', 'offline.js', 'wiederholen.js', 'flow.js');
  const gruppe = [1, 2, 3].map((n) => Object.assign(LA.paketPruefen(structuredClone(LA.DEMO)), { id: 'p' + n, gruppe: 'g', niveau: n }));
  return { LA, gruppe };
}
// Zufallszahlen mit festem Startwert, damit die Simulation immer gleich läuft
function zufall(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

test('Startschwierigkeit: Typ, KI-Einschätzung und Niveau', () => {
  const { LA, gruppe } = setup();
  const { startD } = LA._flow;
  const k = LA.karten(gruppe[1]);
  assert.ok(startD('wf:0', k.get('wf:0'), gruppe[1]) < startD('mc:0', k.get('mc:0'), gruppe[1]), 'Wahr/Falsch leichter als Multiple Choice');
  assert.ok(startD('mc:0', k.get('mc:0'), gruppe[1]) < startD('begriff:0', k.get('begriff:0'), gruppe[1]), 'Wiedererkennen leichter als Eintippen');
  assert.ok(startD('mc:0', k.get('mc:0'), gruppe[0]) < startD('mc:0', k.get('mc:0'), gruppe[2]), 'Niveau 1 leichter als Niveau 3');
  const leicht = { art: 'mc', frage: { schwierigkeit: 1 } }, schwer = { art: 'mc', frage: { schwierigkeit: 5 } };
  assert.ok(startD('mc:0', leicht, gruppe[1]) + 30 <= startD('mc:0', schwer, gruppe[1]), 'KI-Einschätzung 1–5 wirkt');
});

test('Ziel-Erfolgsquote wie im Flow-Trainer', () => {
  const { LA } = setup();
  const s = (o) => Object.assign({ anzahl: 0, richtigSerie: 0, falschSerie: 0 }, o);
  assert.equal(LA.flowZiel(s({})).ziel, 0.8);
  assert.equal(LA.flowZiel(s({ falschSerie: 2 })).ziel, 0.92);
  assert.equal(LA.flowZiel(s({ richtigSerie: 5, anzahl: 5 })).ziel, 0.72);
  assert.equal(LA.flowZiel(s({ anzahl: 6 })).art, 'herausforderung');
  assert.equal(LA.flowZiel(s({ anzahl: 6, falschSerie: 1 })).art, 'normal', 'keine Herausforderung direkt nach einem Fehler');
});

test('Keine Wiederholung derselben Frage in kurzer Folge', () => {
  const { LA, gruppe } = setup();
  const vorrat = LA.flowVorrat(gruppe);
  const sitzung = { anzahl: 0, richtigSerie: 0, falschSerie: 0, gezeigt: [], geloest: new Set() };
  const r = zufall(7);
  for (let i = 0; i < 40; i++) {
    const { item } = LA.flowWaehlen(vorrat, 50, sitzung, r);
    assert.ok(!sitzung.gezeigt.slice(-6).includes(item.schluessel), 'Frage kam innerhalb der letzten 6 schon');
    sitzung.gezeigt.push(item.schluessel); sitzung.anzahl++;
  }
});

// Können so gewählt, dass die typische Frage des jeweiligen Niveaus mit ~80 % gelöst wird
// (Niveau-1-Fragen liegen um 20, Niveau 2 um 40, Niveau 3 um 60 auf der Skala).
for (const [name, koennen, erwartetesNiveau] of [['schwache', 25, 1], ['mittlere', 55, 2], ['starke', 85, 3]]) {
  test(`Simulation: ${name} Lernende (Können ${koennen}) – Schätzung, Flow-Zone, Niveau`, () => {
    const { LA, gruppe } = setup();
    const r = zufall(koennen * 31 + 1);
    const vorrat = LA.flowVorrat(gruppe);
    const wahreD = new Map(vorrat.map((x) => [x.schluessel, x.d])); // «wahre» Schwierigkeit = Startschätzung
    const z = { theta: 50, n: 0, verlauf: [] };
    let sitzung;
    const niveaus = [];
    let richtigSpaet = 0, spaet = 0;
    for (let i = 0; i < 60; i++) {
      if (i % 12 === 0) sitzung = { anzahl: 0, richtigSerie: 0, falschSerie: 0, gezeigt: [], geloest: new Set() }; // Runden à 12 wie in der App
      const { item } = LA.flowWaehlen(vorrat, z.theta, sitzung, r);
      const ok = r() < LA._flow.p(koennen, wahreD.get(item.schluessel));
      LA.flowVerbuchen(z, item, ok);
      sitzung.gezeigt.push(item.schluessel); sitzung.anzahl++;
      if (ok) { sitzung.richtigSerie++; sitzung.falschSerie = 0; sitzung.geloest.add(item.schluessel); } else { sitzung.falschSerie++; sitzung.richtigSerie = 0; }
      if (i >= 20) { spaet++; if (ok) richtigSpaet++; niveaus.push(item.paket.niveau); }
    }
    assert.ok(Math.abs(z.theta - koennen) < 15, `Können geschätzt ${z.theta.toFixed(1)}, wahr ${koennen}`);
    const quote = richtigSpaet / spaet;
    assert.ok(quote > 0.6 && quote <= 0.97, `Erfolgsquote ${Math.round(quote * 100)} %`);
    // Meistgenutztes Niveau nach der Einschwingphase
    const haeufig = [1, 2, 3].map((n) => niveaus.filter((x) => x === n).length);
    const meist = haeufig.indexOf(Math.max(...haeufig)) + 1;
    assert.equal(meist, erwartetesNiveau, `Fragen meist aus Niveau ${meist} (${haeufig.join('/')})`);
    // Empfehlung (liest den gespeicherten Zustand)
    localStorage.setItem('lernapp.flow.g', JSON.stringify(z));
    assert.equal(LA.flowEmpfehlung(gruppe).niveau, erwartetesNiveau);
  });
}

test('Empfehlung erst nach 10 Antworten, nie bei nur einem Niveau', () => {
  const { LA, gruppe } = setup();
  localStorage.setItem('lernapp.flow.g', JSON.stringify({ theta: 90, n: 5, verlauf: [] }));
  assert.equal(LA.flowEmpfehlung(gruppe), null);
  assert.equal(LA.flowEmpfehlung([gruppe[0]]), null);
});
