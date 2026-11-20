/* Plenumsmodus (Peer Instruction): Die Lehrperson zeigt eine Frage am Beamer, alle stimmen auf ihrem Gerät ab.
   Die Verteilung erscheint erst nach dem Abstimmen. Danach: zu zweit diskutieren, nochmals abstimmen, Lösung.
   Gespeichert in Supabase (lw_plenum, lw_plenum_stimmen), nur über Datenbank-Funktionen erreichbar.
   Stimmen sind anonym (zufällige Gerätekennung), Sitzungen werden nach zwei Tagen gelöscht. */
(function (LA) {
  const { h } = LA;
  const KEY = 'lernapp.plenum';
  const BUCHSTABEN = 'ABCDEFGHIJ';
  const TAKT_LP = 2000, TAKT_SUS = 2500;

  async function rpc(name, body) {
    const r = await fetch(`${LA.STATISTIK.url}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { 'content-type': 'application/json', apikey: LA.STATISTIK.schluessel }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Der Plenums-Dienst antwortet nicht (${r.status}).`);
    return r.status === 204 ? null : r.json();
  }
  const sitzungen = () => LA.speicher.lesen(KEY, {});
  LA.plenumUrl = (code) => location.origin + location.pathname + '#l=' + code;

  // Fragen eines Pakets fürs Plenum: Multiple Choice und Wahr/Falsch
  LA.plenumFragen = function (p) {
    return [
      ...p.multiple_choice.map((q) => ({ frage: q.frage, optionen: q.optionen, richtig: q.richtig, erklaerung: q.erklaerung || '', rueckmeldungen: q.rueckmeldungen || [], art: 'Multiple Choice' })),
      ...p.wahr_falsch.map((a) => ({ frage: a.aussage, optionen: ['Wahr', 'Falsch'], richtig: a.wahr ? 0 : 1, erklaerung: a.erklaerung || '', rueckmeldungen: [], art: 'Wahr oder falsch' })),
    ];
  };

  LA.plenumErstellen = async function (titel, fragen) {
    const b = new Uint8Array(24); crypto.getRandomValues(b);
    const token = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const code = await rpc('lw_plenum_erstellen', { p_titel: titel, p_fragen: fragen, p_token: token });
    if (!/^[a-z2-9]{6}$/.test(code)) throw new Error('Unerwartete Antwort vom Plenums-Dienst.');
    const s = sitzungen(); s[code] = { token, titel, fragen, erstellt: new Date().toISOString() };
    // nur die letzten 20 Sitzungen merken
    const codes = Object.keys(s).sort((a, c) => String(s[c].erstellt).localeCompare(String(s[a].erstellt)));
    codes.slice(20).forEach((c) => delete s[c]);
    LA.speicher.schreiben(KEY, s);
    return code;
  };
  LA.plenumBekannt = (code) => !!sitzungen()[code];

  // Balken der Verteilung (Anteil in %)
  function balken(anzahl, total, klasse) {
    const q = total ? anzahl / total : 0;
    return h('div', { class: 'pl-balken ' + (klasse || '') },
      h('div', { class: 'pl-fuellung', style: { width: Math.round(q * 100) + '%' } }),
      h('span', null, `${anzahl} · ${Math.round(q * 100)} %`));
  }

  /* ---------- Ansicht der Lehrperson (für den Beamer) ---------- */
  LA.plenumLehrperson = function (w, code, { beenden } = {}) {
    const s = sitzungen()[code];
    if (!s) { LA.setzen(w, h('p', null, 'Diese Plenums-Sitzung wurde in einem anderen Browser gestartet.')); return; }
    const url = LA.plenumUrl(code);
    let zustand = null, ergebnis = null, letzterSchluessel = '', aktiv = true, laeuft = false;
    const teilnehmende = h('span', { class: 'pl-zahl' }, '0');
    const stimmen = h('span');
    const inhalt = h('div');

    const steuern = async (aktuell, runde, status) => {
      try {
        if (!(await rpc('lw_plenum_steuern', { p_code: code, p_token: s.token, p_aktuell: aktuell, p_runde: runde, p_status: status }))) throw new Error('Steuern nicht möglich.');
        await laden(true);
      } catch (e) { LA.meldung(e.message, 'fehler'); }
    };

    const zeichnen = () => {
      const z = zustand, f = s.fragen[z.aktuell], v = (ergebnis && ergebnis.runden) || {};
      const r1 = v['1'] || {}, r2 = v['2'] || {};
      const summe = (r) => Object.values(r).reduce((a, b) => a + b, 0);
      const zeigeVerteilung = z.status === 'geschlossen' || z.status === 'loesung';
      const loesung = z.status === 'loesung';
      const knoepfe = [];
      if (z.status === 'warten') knoepfe.push(h('button', { class: 'knopf gross', onclick: () => steuern(z.aktuell, 1, 'offen') }, 'Abstimmung starten'));
      if (z.status === 'offen') knoepfe.push(h('button', { class: 'knopf gross', onclick: () => steuern(z.aktuell, z.runde, 'geschlossen') }, 'Abstimmung beenden'));
      if (z.status === 'geschlossen') {
        if (z.runde === 1) knoepfe.push(h('button', { class: 'knopf', onclick: () => steuern(z.aktuell, 2, 'offen') }, 'Zu zweit diskutieren, dann nochmals abstimmen'));
        knoepfe.push(h('button', { class: z.runde === 1 ? 'knopf sekundaer' : 'knopf', onclick: () => steuern(z.aktuell, z.runde, 'loesung') }, 'Lösung zeigen'));
      }
      if (loesung) knoepfe.push(z.aktuell + 1 < s.fragen.length
        ? h('button', { class: 'knopf gross', onclick: () => steuern(z.aktuell + 1, 1, 'warten') }, 'Nächste Frage')
        : h('button', { class: 'knopf gross', onclick: () => beendenKlick() }, 'Plenum beenden'));
      // Empfehlung nach Mazur: bei 30–70 % richtig lohnt sich die Diskussion (Zahl wird nicht gezeigt)
      const anteilRichtig = summe(r1) ? (r1[f.richtig] || 0) / summe(r1) : null;
      const empfehlung = z.status === 'geschlossen' && z.runde === 1 && anteilRichtig !== null
        ? (anteilRichtig >= 0.3 && anteilRichtig <= 0.7 ? 'Die Klasse ist geteilter Meinung: ideal für eine Diskussion zu zweit.'
          : anteilRichtig > 0.7 ? 'Die meisten liegen richtig: Lösung zeigen und kurz begründen lassen.'
            : 'Viele liegen falsch: Lösung erklären, eine Diskussion bringt hier wenig.') : null;

      LA.setzen(inhalt,
        h('div', { class: 'pl-kopf' },
          h('div', null, h('div', { class: 'label' }, `Frage ${z.aktuell + 1} von ${s.fragen.length} · ${f.art || ''}`), h('h1', { class: 'pl-frage' }, f.frage)),
          h('button', { class: 'pl-qr', title: 'QR-Code gross zeigen', onclick: () => LA.qrVollbild(url, s.titel), html: LA.qrSvg(url) })),
        z.runde === 2 && z.status === 'offen' ? h('div', { class: 'kasten merksatz pl-auftrag' }, h('strong', null, 'Zu zweit: '), 'Überzeugt euch gegenseitig. Wer hat recht und warum? Dann stimmt nochmals ab.') : null,
        h('div', { class: 'pl-status' },
          h('span', null, z.status === 'warten' ? 'Bereit.' : z.status === 'offen' ? ['Abstimmung läuft · ', stimmen] : z.status === 'geschlossen' ? 'Abstimmung beendet.' : 'Lösung'),
          empfehlung ? h('span', { class: 'hinweis' }, ' ' + empfehlung) : null),
        h('div', { class: 'reihe pl-knoepfe' }, knoepfe),
        h('ol', { class: 'pl-optionen' }, f.optionen.map((o, i) => h('li', { class: 'pl-option' + (loesung && i === f.richtig ? ' richtig' : '') },
          h('span', { class: 'pl-buchstabe' }, BUCHSTABEN[i]),
          h('div', { class: 'pl-option-text' }, o,
            zeigeVerteilung ? h('div', { class: 'pl-verteilung' },
              summe(r2) ? balken(r1[i] || 0, summe(r1), 'runde1') : null,
              balken((summe(r2) ? r2 : r1)[i] || 0, summe(summe(r2) ? r2 : r1), summe(r2) ? 'runde2' : '')) : null)))),
        zeigeVerteilung && summe(r2) ? h('p', { class: 'hinweis' }, 'Heller Balken: erste Abstimmung · dunkler Balken: nach der Diskussion') : null,
        loesung && f.erklaerung ? h('div', { class: 'kasten' }, h('div', { class: 'label' }, 'Erklärung'), f.erklaerung) : null,
        h('div', { class: 'reihe pl-navi' },
          h('button', { class: 'knopf sekundaer klein', disabled: z.aktuell === 0, onclick: () => steuern(z.aktuell - 1, 1, 'warten') }, '◀ Vorherige'),
          h('button', { class: 'knopf sekundaer klein', disabled: z.aktuell + 1 >= s.fragen.length, onclick: () => steuern(z.aktuell + 1, 1, 'warten') }, 'Nächste ▶'),
          z.status !== 'warten' ? h('button', { class: 'knopf sekundaer klein', onclick: () => steuern(z.aktuell, 1, 'warten') }, 'Frage neu starten') : null));
    };

    const zaehlerAktualisieren = () => {
      teilnehmende.textContent = ergebnis ? ergebnis.teilnehmende : 0;
      const r = (ergebnis && ergebnis.runden && ergebnis.runden[String(zustand.runde)]) || {};
      const n = Object.values(r).reduce((a, b) => a + b, 0);
      stimmen.textContent = `${n} Stimme${n === 1 ? '' : 'n'}`;
    };

    const laden = async (sofort) => {
      if (laeuft && !sofort) return;
      laeuft = true;
      try {
        [zustand, ergebnis] = await Promise.all([rpc('lw_plenum_zustand', { p_code: code }), rpc('lw_plenum_ergebnis', { p_code: code, p_token: s.token })]);
        if (!zustand) { aktiv = false; LA.setzen(inhalt, h('p', null, 'Diese Sitzung gibt es nicht mehr (nach zwei Tagen gelöscht).')); return; }
        const schluessel = `${zustand.aktuell}|${zustand.runde}|${zustand.status}|${zustand.status === 'offen' ? '' : JSON.stringify(ergebnis && ergebnis.runden)}`;
        if (schluessel !== letzterSchluessel) { letzterSchluessel = schluessel; zeichnen(); }
        zaehlerAktualisieren();
      } catch (e) { stimmen.textContent = '(keine Verbindung)'; } finally { laeuft = false; }
    };

    const beendenKlick = async () => {
      if (!confirm('Plenum beenden? Die Stimmen werden gelöscht.')) return;
      aktiv = false;
      try { await rpc('lw_plenum_beenden', { p_code: code, p_token: s.token }); } catch { /* läuft nach zwei Tagen ohnehin ab */ }
      const alle = sitzungen(); delete alle[code]; LA.speicher.schreiben(KEY, alle);
      if (beenden) beenden();
    };

    LA.setzen(w,
      h('div', { class: 'pl-leiste' },
        h('div', null, h('strong', null, 'Plenum · '), s.titel),
        h('div', { class: 'pl-beitreten' }, 'Mitmachen: QR-Code scannen oder ', h('span', { class: 'mono' }, url.replace(/^https?:\/\//, ''))),
        h('div', null, teilnehmende, ' dabei'),
        h('button', { class: 'knopf sekundaer klein', onclick: beendenKlick }, 'Beenden')),
      inhalt);
    LA.setzen(inhalt, h('p', { class: 'hinweis' }, 'Lädt …'));
    laden(true);
    const takt = setInterval(() => { if (!aktiv || !w.isConnected || !inhalt.isConnected) { clearInterval(takt); return; } laden(); }, TAKT_LP);
  };

  /* ---------- Ansicht der Lernenden ---------- */
  LA.plenumSchueler = function (w, code) {
    const geraet = LA.geraetKennung();
    const meine = new Map(); // «frage|runde» → gewählte Option
    let zustand = null, letzterSchluessel = '', laeuft = false;
    const inhalt = h('div', { class: 'pl-sus' });

    const abstimmen = async (i) => {
      const k = `${zustand.aktuell}|${zustand.runde}`;
      const vorher = meine.get(k);
      meine.set(k, i); zeichnen();
      try {
        const ok = await rpc('lw_plenum_abstimmen', { p_code: code, p_geraet: geraet, p_frage: zustand.aktuell, p_runde: zustand.runde, p_wahl: i });
        if (!ok) { meine.set(k, vorher); LA.meldung('Die Abstimmung ist schon beendet.', 'fehler'); await laden(true); }
      } catch (e) { meine.set(k, vorher); zeichnen(); LA.meldung(e.message + ' Nochmals tippen.', 'fehler'); }
    };

    const zeichnen = () => {
      const z = zustand;
      if (!z) { LA.setzen(inhalt, h('div', { class: 'kasten' }, h('p', null, 'Diese Abstimmung gibt es nicht (mehr). Frag deine Lehrperson nach dem aktuellen Code.'))); return; }
      const f = z.frage, eigene = meine.get(`${z.aktuell}|${z.runde}`), erste = meine.get(`${z.aktuell}|1`);
      const kopf = h('div', { class: 'label' }, `${z.titel} · Frage ${z.aktuell + 1} von ${z.anzahl}`);
      if (z.status === 'warten') { LA.setzen(inhalt, kopf, h('div', { class: 'pl-warten' }, h('p', null, 'Gleich geht\'s los.'), h('p', { class: 'hinweis' }, 'Schau nach vorne. Die Frage erscheint hier, sobald abgestimmt wird.'))); return; }
      const optionen = h('div', { class: 'optionen' }, f.optionen.map((o, i) => {
        const klassen = ['option'];
        if (i === eigene) klassen.push('gewaehlt');
        if (z.status === 'loesung') { if (i === f.richtig) klassen.push('richtig'); else if (i === eigene) klassen.push('falsch'); }
        return h('button', { class: klassen.join(' '), disabled: z.status !== 'offen', onclick: () => abstimmen(i) }, h('span', { class: 'pl-buchstabe klein' }, BUCHSTABEN[i]), ' ', o);
      }));
      let info = null;
      if (z.status === 'offen') info = eigene === undefined
        ? (z.runde === 2 ? h('div', { class: 'kasten merksatz' }, h('strong', null, 'Zu zweit: '), 'Diskutiere mit deiner Nachbarin oder deinem Nachbarn. Wer hat recht und warum? Dann stimm nochmals ab.') : h('p', { class: 'hinweis' }, 'Wähle deine Antwort.'))
        : h('p', { class: 'rueckmeldung ok' }, 'Deine Stimme ist angekommen. Du kannst sie ändern, solange abgestimmt wird.');
      if (z.status === 'geschlossen') info = h('p', { class: 'hinweis' }, eigene === undefined ? 'Die Abstimmung ist beendet. Schau nach vorne.' : 'Die Abstimmung ist beendet. Schau nach vorne, wie die Klasse abgestimmt hat.');
      if (z.status === 'loesung') {
        const gewaehlt = eigene !== undefined ? eigene : erste;
        const ok = gewaehlt === f.richtig;
        const warum = gewaehlt !== undefined && !ok && f.rueckmeldungen && f.rueckmeldungen[gewaehlt];
        info = h('div', { class: 'rueckmeldung ' + (gewaehlt === undefined ? '' : ok ? 'ok' : 'nein') },
          h('strong', null, gewaehlt === undefined ? 'Lösung: ' : ok ? 'Richtig. ' : 'Nicht ganz. '),
          warum ? h('div', null, h('span', { class: 'label' }, `Warum nicht «${f.optionen[gewaehlt]}»?`), ' ', warum) : null,
          f.erklaerung || '',
          z.runde === 2 && erste !== undefined && erste !== f.richtig && eigene === f.richtig ? h('div', null, 'Die Diskussion hat sich gelohnt: Du hast deine Meinung geändert.') : null);
      }
      LA.setzen(inhalt, kopf, h('div', { class: 'frage' }, f.frage), optionen, info);
    };

    const laden = async (sofort) => {
      if (laeuft && !sofort) return;
      laeuft = true;
      try {
        zustand = await rpc('lw_plenum_zustand', { p_code: code });
        const schluessel = JSON.stringify(zustand);
        if (schluessel !== letzterSchluessel) { letzterSchluessel = schluessel; zeichnen(); }
      } catch { /* kurz offline: beim nächsten Takt */ } finally { laeuft = false; }
    };

    LA.setzen(w, h('h1', null, 'Abstimmung'), inhalt);
    LA.setzen(inhalt, h('p', { class: 'hinweis' }, 'Verbindet …'));
    laden(true).then(() => { if (!letzterSchluessel) zeichnen(); });
    const takt = setInterval(() => { if (!inhalt.isConnected) { clearInterval(takt); return; } laden(); }, TAKT_SUS);
  };
})(window.LA);
