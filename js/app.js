/* Ansichten und Ablauf der App */
(function (LA) {
  const { h } = LA;
  const PAKETE_KEY = 'lernapp.pakete';
  const main = () => document.getElementById('inhalt');

  const zustand = { paket: null, schuelerModus: false, gruppe: null, kurz: '', runde: null, plenum: null };

  /* ---------- Niveaus: Pakete derselben Gruppe ---------- */
  function gruppeVon(p) {
    if (!p || !p.gruppe) return p ? [p] : [];
    // Schüleransicht: nur, was im Link steckt (auch wenn im selben Browser die ganze Gruppe gespeichert ist)
    if (zustand.schuelerModus) return zustand.gruppe && zustand.gruppe.some((x) => x.id === p.id) ? [...zustand.gruppe].sort((a, b) => (a.niveau || 2) - (b.niveau || 2)) : [p];
    const liste = pakete().filter((x) => x.gruppe === p.gruppe);
    return (liste.some((x) => x.id === p.id) ? liste : [p, ...liste]).sort((a, b) => (a.niveau || 2) - (b.niveau || 2));
  }
  const niveauMerken = (p) => { if (p.gruppe) LA.speicher.schreiben('lernapp.niveau.' + p.gruppe, p.niveau); };
  function bevorzugtesNiveau(liste) {
    const gemerkt = liste[0] && liste[0].gruppe ? LA.speicher.lesen('lernapp.niveau.' + liste[0].gruppe, 2) : 2;
    return liste.find((x) => x.niveau === gemerkt) || liste.find((x) => x.niveau === 2) || liste[0];
  }
  const niveauText = (p) => (p.niveau && LA.NIVEAUS[p.niveau] ? `${LA.NIVEAUS[p.niveau].name} ${LA.NIVEAUS[p.niveau].zeichen}` : '');
  LA.niveauText = niveauText;

  /* ---------- Bibliothek ---------- */
  const pakete = () => LA.speicher.lesen(PAKETE_KEY, []);
  function paketSpeichern(p) {
    const liste = pakete().filter((x) => x.id !== p.id);
    liste.unshift(p);
    if (!LA.speicher.schreiben(PAKETE_KEY, liste)) LA.meldung('Speichern im Browser nicht möglich (privater Modus?). Exportiere das Paket als Datei.', 'fehler');
  }
  function paketLoeschen(id) {
    LA.speicher.schreiben(PAKETE_KEY, pakete().filter((x) => x.id !== id));
    LA.speicher.loeschen('lernapp.fortschritt.' + id);
    LA.lernstandLoeschen(id);
  }
  const fortschritt = (id) => LA.speicher.lesen('lernapp.fortschritt.' + id, {});
  function fortschrittMerken(id, spiel, punkte, max) {
    const f = fortschritt(id);
    const alt = f[spiel] || { best: 0, max, versuche: 0 };
    const besser = punkte / (max || 1) >= alt.best / (alt.max || 1);
    f[spiel] = { best: besser ? punkte : alt.best, max: besser ? max : alt.max, versuche: alt.versuche + 1 };
    LA.speicher.schreiben('lernapp.fortschritt.' + id, f);
  }

  /* ---------- Kopfzeile ---------- */
  function kopf() {
    const k = document.getElementById('kopf');
    LA.setzen(k, 
      h('button', { class: 'marke', onclick: () => (zustand.plenum ? null : zustand.runde ? rundeAnsicht(zustand.runde) : zustand.schuelerModus && zustand.paket ? LA.zurUebersicht() : startAnsicht()) }, h('span', { class: 'marke-zeichen', 'aria-hidden': 'true' }, 'L'), 'Lernwerkstatt'),
      h('nav', null,
        zustand.schuelerModus ? h('span', { class: 'tag' }, 'Schüleransicht') : h('button', { class: 'knopf sekundaer klein', onclick: startAnsicht }, 'Meine Pakete'),
        zustand.schuelerModus && LA.serverStatus && LA.serverStatus.serverKi && LA.serverStatus.codeNoetig
          ? h('button', { class: 'knopf sekundaer klein', onclick: klassencodeDialog }, LA.kiVerfuegbar() ? '🔓 KI aktiv' : '🔑 Klassencode') : null,
        zustand.schuelerModus ? null : h('button', { class: 'knopf sekundaer klein', onclick: einstellungenAnsicht, 'aria-label': 'Einstellungen' }, LA.kiVerfuegbar() ? '⚙︎ KI aktiv' : '⚙︎ Einstellungen')));
  }

  /* ---------- Sicherung: alle Pakete und Kurzlinks in einer Datei ---------- */
  const SICHERUNG_TYP = 'lernwerkstatt-sicherung';
  const SICHERUNG_KEY = 'lernapp.letzteSicherung';
  const heuteText = () => new Date().toISOString().slice(0, 10);

  function sicherungErstellen() {
    const daten = {
      typ: SICHERUNG_TYP, version: 1, erstellt: new Date().toISOString(),
      // Keine Einstellungen (API-Schlüssel, Klassencode) und kein Lernstand
      pakete: pakete(),
      kurzlinks: LA.kurzlinksAlle ? LA.kurzlinksAlle() : [],
    };
    LA.download(`lernwerkstatt-sicherung-${heuteText()}.json`, JSON.stringify(daten, null, 1));
    LA.speicher.schreiben(SICHERUNG_KEY, new Date().toISOString());
    LA.meldung(`${daten.pakete.length} Paket${daten.pakete.length === 1 ? '' : 'e'} gesichert. Die Datei gut aufbewahren (z. B. OneDrive), nicht weitergeben: Sie enthält die Schlüssel zum Ändern deiner Kurzlinks.`);
  }

  function sicherungEinlesen(daten) {
    const neu = (Array.isArray(daten.pakete) ? daten.pakete : []).filter((x) => x && typeof x === 'object')
      .map((x) => { const p = LA.paketPruefen(x); if (!p.id) p.id = LA.id(); return p; });
    const vorhanden = new Set(pakete().map((p) => p.id));
    const doppelt = neu.filter((p) => vorhanden.has(p.id));
    const ersetzen = doppelt.length ? confirm(`${doppelt.length} der ${neu.length} Pakete gibt es hier schon. Durch die Fassung aus der Sicherung ersetzen?\n\nOK = ersetzen, Abbrechen = nur fehlende Pakete hinzufügen.`) : false;
    let n = 0;
    const liste = pakete();
    for (const p of neu) {
      const i = liste.findIndex((x) => x.id === p.id);
      if (i < 0) { liste.push(p); n++; } else if (ersetzen) { liste[i] = p; n++; }
    }
    if (!LA.speicher.schreiben(PAKETE_KEY, liste)) { LA.meldung('Speichern im Browser nicht möglich (privater Modus?).', 'fehler'); return; }
    const k = LA.kurzlinksUebernehmen ? LA.kurzlinksUebernehmen(daten.kurzlinks) : 0;
    LA.meldung(`Sicherung vom ${new Date(daten.erstellt).toLocaleDateString('de-CH')} eingelesen: ${n} Paket${n === 1 ? '' : 'e'}` + (k ? `, ${k} Kurzlink${k === 1 ? '' : 's'}` : '') + '.');
    startAnsicht();
  }

  // Erinnerung, wenn lange nicht gesichert wurde
  function sicherungsHinweis(liste) {
    if (!liste.length) return null;
    const letzte = LA.speicher.lesen(SICHERUNG_KEY, null);
    const tage = letzte ? Math.floor((Date.now() - new Date(letzte)) / 86400000) : null;
    if (tage !== null && tage < 14) return h('p', { class: 'hinweis' }, `Letzte Sicherung: ${tage === 0 ? 'heute' : tage === 1 ? 'gestern' : `vor ${tage} Tagen`}.`);
    return h('div', { class: 'kasten sicherung-hinweis' },
      h('p', null, h('strong', null, 'Deine Pakete sind nur in diesem Browser gespeichert. '),
        tage === null ? 'Du hast sie noch nie gesichert.' : `Letzte Sicherung vor ${tage} Tagen.`,
        ' Wenn Browserdaten gelöscht werden oder du das Gerät wechselst, sind sie sonst weg.'),
      h('button', { class: 'knopf klein', onclick: () => { sicherungErstellen(); startAnsicht(); } }, 'Jetzt sichern'));
  }

  /* ---------- Start: Paketliste ---------- */
  function startAnsicht() {
    zustand.paket = null; zustand.schuelerModus = false; zustand.gruppe = null; zustand.kurz = ''; zustand.runde = null; zustand.plenum = null; kopf();
    const liste = pakete();
    const dateiInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
      try {
        const daten = JSON.parse(await e.target.files[0].text());
        if (daten && daten.typ === SICHERUNG_TYP) return sicherungEinlesen(daten);
        const liste = (Array.isArray(daten) ? daten : [daten]).map((x) => LA.paketPruefen(x));
        liste.forEach(paketSpeichern);
        LA.meldung(liste.length > 1 ? `${liste.length} Niveaus importiert.` : 'Paket importiert.');
        paketAnsicht(bevorzugtesNiveau(liste));
      } catch { LA.meldung('Diese Datei ist kein gültiges Lernpaket.', 'fehler'); }
    } });
    LA.setzen(main(), 
      h('section', { class: 'held' },
        h('h1', null, 'Aus deinem Material wird eine Lern-App'),
        h('p', { class: 'intro' }, 'Text, PDF oder Foto eines Arbeitsblatts hineingeben. Die KI baut daraus einen Lernpfad mit Erklärungen und wählt passende Übungen: Multiple Choice, Lückentext, Memory, Kreuzworträtsel, Reihenfolge, Zuordnen, Denkfragen und Textkorrektur.'),
        h('div', { class: 'reihe' },
          h('button', { class: 'knopf', onclick: erstellenAnsicht }, '+ Neues Lernpaket'),
          h('button', { class: 'knopf sekundaer', onclick: () => paketAnsicht(LA.paketPruefen(structuredClone(LA.DEMO))) }, 'Demo ansehen (Wasserkreislauf)'),
          h('button', { class: 'knopf sekundaer', onclick: () => dateiInput.click() }, 'Paket oder Sicherung importieren'), dateiInput,
          h('button', { class: 'knopf sekundaer', onclick: () => auswertungAnsicht() }, '📊 Auswertung'),
          LA.kurzlinksAlle && LA.kurzlinksAlle().length ? h('button', { class: 'knopf sekundaer', onclick: kurzlinksAnsicht }, '🔗 Meine Kurzlinks') : null,
          liste.length ? h('button', { class: 'knopf sekundaer', onclick: rundeDialog }, '🔀 Wiederholungsrunde') : null)),
      h('section', null,
        h('div', { class: 'reihe zwischen' }, h('h2', null, 'Meine Lernpakete'),
          liste.length ? h('button', { class: 'knopf sekundaer klein', onclick: () => { sicherungErstellen(); startAnsicht(); } }, '💾 Alle Pakete sichern') : null),
        sicherungsHinweis(liste),
        liste.length ? h('div', { class: 'karten' }, liste.filter((p, i) => !p.gruppe || liste.findIndex((x) => x.gruppe === p.gruppe) === i).map((p0) => {
          const gruppe = gruppeVon(p0);
          const p = bevorzugtesNiveau(gruppe);
          const f = fortschritt(p.id);
          const erledigt = Object.keys(f).length;
          const faellig = gruppe.reduce((n, x) => n + LA.lernstand(x).faellig.length, 0);
          return h('button', { class: 'karte', onclick: () => paketAnsicht(p) },
            h('div', { class: 'label' }, [p.fach, p.stufe].filter(Boolean).join(' · ') || 'Lernpaket'),
            h('div', { class: 'karte-titel' }, p.titel),
            h('div', { class: 'hinweis' }, p.kurzbeschreibung),
            h('div', { class: 'hinweis' }, `${p.spiele.length} Spiele · ${erledigt} gespielt${p.quelle === 'offline' ? ' · ohne KI' : ''}`),
            h('div', { class: 'reihe' },
              gruppe.length > 1 ? h('span', { class: 'tag' }, `${gruppe.length} Niveaus`) : null,
              faellig ? h('span', { class: 'tag faellig-tag' }, `🔁 ${faellig} fällig`) : null));
        })) : h('p', { class: 'hinweis' }, 'Noch keine Pakete. Erstelle eines oder schau dir die Demo an.')));
  }

  /* ---------- Erstellen ---------- */
  const STUFEN = ['Primar (5./6. Klasse)', 'Sek I (7.–9. Klasse)', 'Sek II / Gymnasium', 'Berufsschule', 'Erwachsene / Weiterbildung'];

  function erstellenAnsicht() {
    kopf();
    let modus = LA.kiVerfuegbar() ? 'ki' : 'offline';
    const wurzel = h('div');
    const zeichne = () => {
      LA.setzen(wurzel, 
        h('div', { class: 'tabs', role: 'tablist' },
          h('button', { role: 'tab', class: 'tab' + (modus === 'ki' ? ' aktiv' : ''), 'aria-selected': modus === 'ki', onclick: () => { modus = 'ki'; zeichne(); } }, 'Mit KI (beliebiges Material)'),
          h('button', { role: 'tab', class: 'tab' + (modus === 'offline' ? ' aktiv' : ''), 'aria-selected': modus === 'offline', onclick: () => { modus = 'offline'; zeichne(); } }, 'Ohne KI (Begriffsliste)')),
        modus === 'ki' ? kiFormular() : offlineFormular());
    };
    zeichne();
    LA.setzen(main(), h('h1', null, 'Neues Lernpaket'), wurzel);
  }

  function stufenAuswahl(id) {
    return h('select', { id }, STUFEN.map((s) => h('option', { value: s, selected: s.startsWith('Sek I') }, s)));
  }

  function kiFormular() {
    if (!LA.kiVerfuegbar()) {
      return h('div', { class: 'kasten' }, h('p', null, LA.serverStatus && LA.serverStatus.serverKi ? 'Der Server verlangt einen Klassencode. Trag ihn in den Einstellungen ein.' : 'Für diesen Modus braucht es einen Claude-API-Schlüssel von Anthropic oder den Lernwerkstatt-Server.'),
        h('button', { class: 'knopf', onclick: einstellungenAnsicht }, 'Schlüssel hinterlegen'));
    }
    const dateien = [];
    const dateiListe = h('ul', { class: 'dateiliste' });
    const zeigeDateien = () => LA.setzen(dateiListe, ...dateien.map((d, i) => h('li', null, `${d.name} (${Math.round(d.groesse / 1024)} KB)`, h('button', { class: 'mini', 'aria-label': 'entfernen', onclick: () => { dateien.splice(i, 1); zeigeDateien(); } }, '✕'))));
    const dateiInput = h('input', { type: 'file', multiple: true, accept: '.txt,.md,.csv,.pdf,image/png,image/jpeg,image/webp,image/gif', onchange: async (e) => {
      for (const f of e.target.files) {
        if (f.size > 20 * 1024 * 1024) { LA.meldung(`${f.name} ist grösser als 20 MB.`, 'fehler'); continue; }
        if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) dateien.push({ art: 'pdf', name: f.name, groesse: f.size, base64: await LA.dateiZuBase64(f) });
        else if (f.type.startsWith('image/')) dateien.push({ art: 'bild', name: f.name, groesse: f.size, mime: f.type, base64: await LA.dateiZuBase64(f) });
        else if (/\.(txt|md|csv)$/i.test(f.name) || f.type.startsWith('text/')) dateien.push({ art: 'text', name: f.name, groesse: f.size, text: await f.text() });
        else LA.meldung(`${f.name}: Dateityp wird nicht unterstützt (Word bitte als PDF speichern).`, 'fehler');
      }
      e.target.value = ''; zeigeDateien();
    } });
    const material = h('textarea', { id: 'material', rows: 12, placeholder: 'Text hier einfügen: Lehrmitteltext, eigene Notizen, Stichworte, Glossar …' });
    const fach = h('input', { id: 'fach', type: 'text', placeholder: 'z. B. NuT, Deutsch, Sport, Geschichte' });
    const stufe = stufenAuswahl('stufe');
    const hinweis = h('input', { id: 'wunsch', type: 'text', placeholder: 'optional, z. B. «Fokus auf Fachbegriffe», «eher leicht», «mit Reihenfolge-Aufgabe»' });
    const status = h('div', { class: 'status', 'aria-live': 'polite' });
    const dreiNiveaus = h('input', { type: 'checkbox', id: 'dreiniveaus' });
    const knopf = h('button', { class: 'knopf', onclick: async () => {
      if (!material.value.trim() && !dateien.length) { status.textContent = 'Bitte Text einfügen oder eine Datei wählen.'; return; }
      // Über den Server (z. B. Vercel) ist die Grösse einer Anfrage begrenzt
      const max = LA.serverModus() && LA.serverStatus.maxAnfrage;
      const groesse = material.value.length + dateien.reduce((n, d) => n + (d.base64 || d.text || '').length, 0);
      if (max && groesse > max * 0.95) {
        LA.setzen(status, h('div', { class: 'rueckmeldung nein' }, `Das Material ist zu gross für den Server (etwa ${(groesse / 1e6).toFixed(1)} MB, höchstens ${(max / 1e6).toFixed(1)} MB). Tipp: PDF verkleinern, nur die nötigen Seiten nehmen oder Fotos mit geringerer Auflösung.`));
        return;
      }
      knopf.disabled = true;
      const start = Date.now();
      const tick = setInterval(() => { status.firstChild && (status.firstChild.textContent = `Die KI erstellt das Lernpaket … ${Math.round((Date.now() - start) / 1000)} s`); }, 1000);
      LA.setzen(status, h('span', null, 'Die KI erstellt das Lernpaket …'), h('span', { class: 'hinweis' }, ' (dauert meist 30–90 Sekunden)'), h('div', { class: 'balken laeuft' }, h('div')));
      try {
        const p = await LA.paketErzeugen({ text: material.value.trim(), dateien, fach: fach.value.trim(), stufe: stufe.value, hinweis: hinweis.value.trim(),
          beiFortschritt: (n) => { const s = status.querySelector('.hinweis'); if (s) s.textContent = ` (${n.toLocaleString('de-CH')} Zeichen empfangen)`; } });
        paketSpeichern(p);
        LA.meldung('Lernpaket erstellt.');
        if (dreiNiveaus.checked) { clearInterval(tick); await niveausErzeugen(p, status); }
        else paketAnsicht(p);
      } catch (e) {
        LA.setzen(status, h('div', { class: 'rueckmeldung nein' }, e.message));
      } finally { clearInterval(tick); knopf.disabled = false; }
    } }, 'Lernpaket erstellen');

    return h('div', { class: 'formular' },
      h('div', { class: 'zwei' }, h('label', null, 'Fach', fach), h('label', null, 'Stufe', stufe)),
      h('label', null, 'Material (Text)', material),
      h('label', null, 'oder/und Dateien: PDF, Fotos von Arbeitsblättern, Textdateien', dateiInput), dateiListe,
      h('label', null, 'Wunsch an die KI', hinweis),
      h('label', { class: 'schalter' }, dreiNiveaus, ' Gleich in drei Niveaus erstellen (●, ●●, ●●●) – dauert länger und kostet etwa dreimal so viel'),
      h('div', { class: 'reihe' }, knopf, h('span', { class: 'hinweis' }, 'Modell: ' + ((LA.MODELLE.find((m) => m.id === LA.aktuellesModell()) || {}).name || '') + (LA.serverModus() ? ' · über Server' : ''))),
      status);
  }

  function offlineFormular() {
    const titel = h('input', { id: 'otitel', type: 'text', placeholder: 'z. B. Muskeln des Beins' });
    const liste = h('textarea', { id: 'oliste', rows: 10, placeholder: 'Eine Zeile pro Begriff:\nBizeps: Muskel, der den Arm beugt\nTrizeps: Muskel, der den Arm streckt\n\nOptional mit Gruppe (für «Zuordnen»):\nOberarm > Bizeps: beugt den Arm' });
    const text = h('textarea', { id: 'otext', rows: 6, placeholder: 'Optional: Erklärtext. Absätze werden zu Lernschritten, die Begriffe darin werden zum Lückentext.' });
    const stufe = stufenAuswahl('ostufe');
    const status = h('div', { 'aria-live': 'polite' });
    return h('div', { class: 'formular' },
      h('p', { class: 'hinweis' }, 'Ohne KI kann die App nur mit klar strukturierten Begriffen arbeiten. Erklärungen, Denkfragen und Textkorrektur gibt es nur im KI-Modus.'),
      h('div', { class: 'zwei' }, h('label', null, 'Titel', titel), h('label', null, 'Stufe', stufe)),
      h('label', null, 'Begriffsliste', liste),
      h('label', null, 'Erklärtext', text),
      h('button', { class: 'knopf', onclick: () => {
        try { const p = LA.offlinePaket({ titel: titel.value.trim(), begriffsliste: liste.value, text: text.value, stufe: stufe.value }); paketSpeichern(p); paketAnsicht(p); }
        catch (e) { LA.setzen(status, h('div', { class: 'rueckmeldung nein' }, e.message)); }
      } }, 'Lernpaket erstellen'), status);
  }

  /* ---------- Paket-Übersicht ---------- */
  function paketAnsicht(p) {
    LA.vorlesenStoppen();
    zustand.paket = p; kopf();
    niveauMerken(p);
    const gruppe = gruppeVon(p);
    gruppe.forEach((x) => LA.statistikPaket(x, zustand.kurz || '')); // Antworten dieser Pakete dürfen anonym gezählt werden
    const empfohlen = LA.flowEmpfehlung(gruppe);
    const f = fortschritt(p.id);
    const verfuegbar = p.spiele.filter((s) => LA.SPIELE[s] && LA.SPIELE[s].moeglich(p));
    const lernpfad = verfuegbar.includes('lernpfad');
    const uebungen = verfuegbar.filter((s) => s !== 'lernpfad');
    const spielKarte = (s, gross) => {
      const sp = LA.SPIELE[s], st = f[s];
      const kiFehlt = sp.braucht_ki && !LA.kiVerfuegbar();
      return h('button', { class: 'spiel' + (gross ? ' gross' : '') + (kiFehlt ? ' gedimmt' : ''), onclick: () => spielAnsicht(s) },
        h('span', { class: 'spiel-symbol', 'aria-hidden': 'true' }, sp.symbol),
        h('span', { class: 'spiel-text' }, h('span', { class: 'spiel-name' }, sp.name), h('span', { class: 'hinweis' }, kiFehlt ? (LA.serverStatus && LA.serverStatus.serverKi ? 'braucht den Klassencode' : 'braucht KI-Schlüssel') : sp.info)),
        st ? h('span', { class: 'spiel-stand', title: `${st.versuche}× gespielt` }, `${st.best}/${st.max}`) : null);
    };
    const istGespeichert = pakete().some((x) => x.id === p.id);
    const ls = LA.lernstand(p);
    const wiederholenBereich = h('section', null, h('div', { class: 'label' }, ls.faellig.length ? 'Heute zuerst' : (lernpfad ? '3 · ' : '') + 'Wiederholen'),
      h('div', { class: 'spiele' },
        h('button', { class: 'spiel' + (ls.faellig.length ? ' gross faellig' : ''), onclick: () => spielAnsicht('wiederholen') },
          h('span', { class: 'spiel-symbol', 'aria-hidden': 'true' }, '🔁'),
          h('span', { class: 'spiel-text' }, h('span', { class: 'spiel-name' }, ls.faellig.length ? `Wiederholen: ${ls.faellig.length} Karte${ls.faellig.length === 1 ? '' : 'n'} fällig` : 'Wiederholen'),
            h('span', { class: 'hinweis' }, ls.faellig.length ? 'Was du falsch hattest oder länger nicht gesehen hast.' : 'Heute ist nichts fällig.'))),
        h('button', { class: 'spiel', onclick: () => spielAnsicht('fehlerheft') },
          h('span', { class: 'spiel-symbol', 'aria-hidden': 'true' }, '📒'),
          h('span', { class: 'spiel-text' }, h('span', { class: 'spiel-name' }, 'Fehlerheft'),
            h('span', { class: 'hinweis' }, `${ls.fehler.length} Karte${ls.fehler.length === 1 ? '' : 'n'} mit Fehlern · ${ls.faecher[5]} gelernt`)))));
    LA.setzen(main(), 
      h('div', { class: 'paket-kopf' },
        h('div', null,
          h('div', { class: 'label' }, [p.fach, p.stufe].filter(Boolean).join(' · ')),
          h('h1', null, p.titel),
          h('p', { class: 'intro' }, p.kurzbeschreibung),
          gruppe.length > 1 ? h('div', { class: 'niveaus', role: 'tablist', 'aria-label': 'Niveau wählen' }, gruppe.map((x) =>
            h('button', { role: 'tab', class: 'niveau-tab' + (x.id === p.id ? ' aktiv' : '') + (empfohlen && empfohlen.id === x.id ? ' empfohlen' : ''), 'aria-selected': x.id === p.id, title: empfohlen && empfohlen.id === x.id ? 'Passt laut Flow-Training gerade zu dir' : null, onclick: () => paketAnsicht(x) },
              h('span', { class: 'niveau-zeichen' }, LA.NIVEAUS[x.niveau].zeichen), ' ', zustand.schuelerModus ? LA.NIVEAUS[x.niveau].name : `${LA.NIVEAUS[x.niveau].name} · ${LA.NIVEAUS[x.niveau].lang}`))) : null),
        zustand.schuelerModus ? null : h('div', { class: 'reihe' },
          !istGespeichert ? h('button', { class: 'knopf sekundaer klein', onclick: () => { paketSpeichern(p); paketAnsicht(p); LA.meldung('In «Meine Pakete» gespeichert.'); } }, 'Speichern') : null,
          h('button', { class: 'knopf sekundaer klein', onclick: () => teilen(p) }, 'Teilen'),
          h('button', { class: 'knopf sekundaer klein', onclick: () => LA.druckDialog(p) }, '📄 Drucken / PDF'),
          h('button', { class: 'knopf sekundaer klein', onclick: () => LA.pruefungDialog(p) }, '📝 Probeprüfung'),
          gruppe.length < 2 && LA.kiVerfuegbar() ? h('button', { class: 'knopf sekundaer klein', onclick: () => {
            if (confirm('Die KI schreibt dieses Paket zusätzlich für Niveau 1 (grundlegend) und Niveau 3 (erweitert) um. Dieses Paket wird Niveau 2. Das kostet etwa doppelt so viel wie ein neues Paket. Weiter?')) niveausErzeugen(p);
          } }, 'Niveaus erzeugen') : null,
          h('button', { class: 'knopf sekundaer klein', onclick: () => gruppe.length > 1
            ? LA.download(dateiname(p).replace('.json', '-niveaus.json'), JSON.stringify(gruppe, null, 2))
            : LA.download(dateiname(p), JSON.stringify(p, null, 2)) }, 'Export'),
          h('button', { class: 'knopf sekundaer klein', onclick: () => bearbeitenAnsicht(p) }, 'Bearbeiten'),
          h('button', { class: 'knopf sekundaer klein', onclick: () => auswertungAnsicht(gruppe.map((x) => x.id), () => paketAnsicht(p)) }, 'Auswertung'),
          LA.plenumFragen(p).length ? h('button', { class: 'knopf sekundaer klein', onclick: () => plenumDialog(p) }, '🗳️ Plenum') : null)),
      // Fällige Wiederholungen zuerst: Abrufen vor Neuem
      ls.faellig.length ? wiederholenBereich : null,
      lernpfad ? h('section', null, h('div', { class: 'label' }, '1 · Zuerst lernen'), spielKarte('lernpfad', true)) : null,
      h('section', null, h('div', { class: 'label' }, (lernpfad ? '2 · ' : '') + 'Dann üben'),
        LA.flowVorrat(gruppe).length >= 4 ? h('button', { class: 'spiel gross flow-karte', onclick: () => spielAnsicht('flow') },
          h('span', { class: 'spiel-symbol', 'aria-hidden': 'true' }, '🎯'),
          h('span', { class: 'spiel-text' }, h('span', { class: 'spiel-name' }, 'Flow-Training'),
            h('span', { class: 'hinweis' }, 'Fragen aus allen Spielen' + (gruppe.length > 1 ? ' und allen Niveaus' : '') + ' – immer so schwer, dass du gefordert, aber nicht überfordert bist.')),
          LA.flowStufe(gruppe) ? h('span', { class: 'spiel-stand', title: 'Deine Stufe im Flow-Training' }, `Stufe ${LA.flowStufe(gruppe)}`) : null) : null,
        h('div', { class: 'spiele' }, uebungen.map((s) => spielKarte(s)))),
      !ls.faellig.length && ls.gesehen ? wiederholenBereich : null,
      LA.pruefungDigitalMoeglich(p) ? h('section', null, h('div', { class: 'label' }, 'Prüfung üben'),
        h('div', { class: 'spiele' }, h('button', { class: 'spiel', onclick: () => spielAnsicht('pruefung') },
          h('span', { class: 'spiel-symbol', 'aria-hidden': 'true' }, '📝'),
          h('span', { class: 'spiel-text' }, h('span', { class: 'spiel-name' }, 'Probeprüfung'), h('span', { class: 'hinweis' }, 'Wie eine echte Prüfung: ohne Hilfen, mit Note am Ende.')),
          f.pruefung ? h('span', { class: 'spiel-stand', title: 'Beste Probeprüfung' }, `${f.pruefung.best}/${f.pruefung.max}`) : null))) : null,
      p.spiele_begruendung && !zustand.schuelerModus ? h('p', { class: 'hinweis begruendung' }, h('strong', null, 'Warum diese Spiele? '), p.spiele_begruendung) : null);
  }
  LA.zurUebersicht = () => paketAnsicht(zustand.paket);
  LA.zustandPaketId = () => zustand.paket && zustand.paket.id;

  async function niveausErzeugen(p, statusZiel) {
    const status = statusZiel || h('div', { class: 'status', 'aria-live': 'polite' });
    if (!statusZiel) LA.setzen(main(), h('h1', null, p.titel), status);
    p.gruppe = p.gruppe || LA.id();
    p.niveau = 2;
    paketSpeichern(p);
    const zeichen = { 1: 0, 3: 0 };
    const zeige = () => LA.setzen(status, h('span', null, 'Die KI schreibt das Paket für die anderen Niveaus um …'),
      h('span', { class: 'hinweis' }, ` Niveau 1: ${zeichen[1].toLocaleString('de-CH')} Zeichen · Niveau 3: ${zeichen[3].toLocaleString('de-CH')} Zeichen (meist 1–2 Minuten)`),
      h('div', { class: 'balken laeuft' }, h('div')));
    zeige();
    const ergebnisse = await Promise.allSettled([1, 3].map((n) => LA.niveauErzeugen({ paket: p, niveau: n, beiFortschritt: (z) => { zeichen[n] = z; zeige(); } })
      .then((v) => { Object.assign(v, { gruppe: p.gruppe, niveau: n, titel: p.titel }); paketSpeichern(v); return v; })));
    const fehler = ergebnisse.filter((r) => r.status === 'rejected');
    if (fehler.length) LA.meldung(`${fehler.length} Niveau${fehler.length === 1 ? '' : 's'} konnte${fehler.length === 1 ? '' : 'n'} nicht erstellt werden: ${fehler[0].reason.message}`, 'fehler');
    else LA.meldung('Drei Niveaus erstellt. Bitte durchsehen, bevor die Klasse sie nutzt.');
    paketAnsicht(p);
  }

  const dateiname = (p) => (p.titel || 'lernpaket').toLowerCase().replace(/[^a-z0-9äöü]+/gi, '-').replace(/^-|-$/g, '') + '.json';

  async function teilen(p) {
    const gruppe = gruppeVon(p);
    const basis = location.href.split('#')[0];
    let auswahl = gruppe.length > 1 ? gruppe : p;

    /* Kurzlink mit QR-Code (empfohlen) */
    const kurz = h('div', { class: 'kurz-bereich' });
    let gewaehlt = null; // angezeigter Kurzlink (Code)
    const kurzZeigen = (e) => {
      const url = LA.kurzlinkUrl(e.code);
      return h('div', { class: 'kurz-ergebnis' },
        h('div', { class: 'qr-klein', html: LA.qrSvg(url) }),
        h('div', { class: 'kurz-text' },
          h('div', { class: 'label' }, 'Kurzlink · ' + LA.kurzlinkName(e)),
          h('input', { type: 'text', readonly: true, value: url, class: 'kurz-url', 'aria-label': 'Kurzlink', onclick: (ev) => ev.target.select() }),
          h('div', { class: 'reihe' },
            h('button', { class: 'knopf', onclick: async () => { try { await navigator.clipboard.writeText(url); LA.meldung('Link kopiert.'); } catch { LA.meldung('Bitte manuell kopieren (Ctrl+C).'); } } }, 'Link kopieren'),
            h('button', { class: 'knopf sekundaer', onclick: () => LA.qrVollbild(url, p.titel + (e.klasse ? ' · ' + e.klasse : '')) }, 'QR gross für Beamer')),
          h('p', { class: 'hinweis' }, 'Änderungen, die du später im Editor speicherst, kommen automatisch bei allen an, die diesen Link öffnen.')));
    };
    const neuFormular = (erster) => {
      const klasse = h('input', { type: 'text', class: 'kurz-klasse', maxlength: 60, placeholder: 'z. B. 2a oder «Gruppe Montag»', 'aria-label': 'Klasse' });
      const knopf = h('button', { class: 'knopf' + (erster ? '' : ' sekundaer'), onclick: async () => {
        knopf.disabled = true; knopf.textContent = 'Wird erstellt …';
        try { gewaehlt = await LA.kurzlinkErstellen(auswahl, klasse.value); kurzVorbereiten(); }
        catch (err) { LA.meldung(err.message, 'fehler'); knopf.disabled = false; knopf.textContent = 'Kurzlink mit QR-Code erstellen'; }
      } }, 'Kurzlink mit QR-Code erstellen');
      return h('div', { class: 'kurz-neu' },
        h('label', { class: 'ed-feld breit' }, h('span', null, erster ? 'Für welche Klasse? (optional)' : 'Weitere Klasse'), klasse),
        h('p', { class: 'hinweis' }, 'Mit einem eigenen Link pro Klasse zeigt die Auswertung jede Klasse getrennt.'),
        knopf);
    };
    const kurzVorbereiten = async () => {
      if (!LA.kurzlinkMoeglich()) {
        LA.setzen(kurz, h('p', { class: 'hinweis' }, location.protocol === 'file:' ? 'Kurzlinks gibt es nur, wenn die App über eine Webadresse läuft.' : 'Kurzlinks sind nicht eingerichtet.'));
        return;
      }
      const links = LA.kurzlinksFuer(auswahl);
      if (!links.length) {
        LA.setzen(kurz, neuFormular(true), h('p', { class: 'hinweis' }, 'Dafür wird das Paket in der Datenbank der Lernwerkstatt gespeichert. Wer den Link kennt, kann es öffnen. Nur für Unterrichtsmaterial ohne Namen oder Persönliches.'));
        return;
      }
      const aktiv = links.find((e) => e.code === gewaehlt) || links[0];
      LA.setzen(kurz,
        links.length > 1 ? h('div', { class: 'kurz-wahl reihe', role: 'group', 'aria-label': 'Kurzlinks dieses Pakets' },
          links.map((e) => h('button', { class: 'tab' + (e.code === aktiv.code ? ' aktiv' : ''), 'aria-pressed': e.code === aktiv.code, onclick: () => { gewaehlt = e.code; kurzVorbereiten(); } }, LA.kurzlinkName(e)))) : null,
        kurzZeigen(aktiv),
        h('details', { class: 'kurz-weitere' }, h('summary', null, '+ Kurzlink für eine weitere Klasse'), neuFormular(false)));
    };
    const kurzStillAktualisieren = () => { if (LA.kurzlinkMoeglich() && LA.kurzlinksFuer(auswahl).length) LA.kurzlinkAktualisieren(auswahl).catch(() => {}); };

    /* Langer Link (ohne Datenbank) */
    const feld = h('textarea', { rows: 3, readonly: true });
    const warnung = h('div');
    let link = '';
    const langBauen = async () => {
      link = basis + '#paket=' + await LA.paketZuLink(auswahl);
      feld.value = link;
      LA.setzen(warnung, link.length > 30000 ? h('p', { class: 'rueckmeldung nein' }, `Der Link ist sehr lang (${Math.round(link.length / 1000)}k Zeichen). Manche Programme kürzen ihn.`) : null);
    };

    const wahl = gruppe.length > 1 ? h('select', { 'aria-label': 'Was teilen?', onchange: (e) => {
      auswahl = e.target.value === 'alle' ? gruppe : gruppe.find((x) => x.id === e.target.value);
      gewaehlt = null; kurzVorbereiten(); kurzStillAktualisieren(); langBauen();
    } },
      h('option', { value: 'alle' }, 'Alle Niveaus – die Lernenden wählen selbst'),
      gruppe.map((x) => h('option', { value: x.id }, 'Nur ' + niveauText(x) + ' (' + LA.NIVEAUS[x.niveau].lang + ')'))) : null;

    await langBauen();
    kurzVorbereiten();
    kurzStillAktualisieren(); // Inhalt bestehender Links auf den neuesten Stand bringen
    dialog('Paket teilen', [
      wahl ? h('label', { class: 'ed-feld breit' }, h('span', null, 'Was teilen?'), wahl) : null,
      h('p', null, 'Die Lernenden öffnen den Link oder scannen den QR-Code und sehen nur die Lernansicht.'),
      kurz,
      h('details', { class: 'lang-link' }, h('summary', null, 'Langer Link ohne Datenbank'),
        h('p', { class: 'hinweis' }, 'Das ganze Paket steckt im Link selbst, es wird nichts gespeichert. Spätere Änderungen kommen nicht an.'),
        location.protocol === 'file:' ? h('p', { class: 'rueckmeldung nein' }, 'Die App läuft als lokale Datei: Der Link funktioniert nur, wenn die App im Internet liegt. Alternative: Export-Datei.') : null,
        warnung, feld,
        h('div', { class: 'reihe' }, h('button', { class: 'knopf sekundaer', onclick: async () => { try { await navigator.clipboard.writeText(link); LA.meldung('Link kopiert.'); } catch { feld.select(); LA.meldung('Bitte manuell kopieren (Ctrl+C).'); } } }, 'Langen Link kopieren'))),
      h('p', { class: 'hinweis' }, LA.serverStatus && LA.serverStatus.serverKi
        ? 'KI-Rückmeldungen bekommen die Lernenden' + (LA.serverStatus.codeNoetig ? ', sobald sie den Klassencode eingeben (oben rechts 🔑).' : ' ohne eigenen Schlüssel.')
        : 'Denkfragen und Textkorrektur mit KI-Rückmeldung funktionieren auf Schülergeräten nur mit dem Lernwerkstatt-Server. Sonst gibt es Musterantworten zur Selbsteinschätzung.'),
    ]);
  }

  function dialog(titel, inhalt) {
    const d = h('dialog', { class: 'dialog' }, h('div', { class: 'reihe zwischen' }, h('h2', null, titel), h('button', { class: 'mini', 'aria-label': 'schliessen', onclick: () => d.close() }, '✕')), inhalt);
    d.addEventListener('close', () => d.remove());
    document.body.append(d); d.showModal();
    return d;
  }

  function klassencodeDialog() {
    const feld = h('input', { type: 'text', value: LA.einstellungen().klassenCode, autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Klassencode' });
    const d = dialog('Klassencode', [
      h('p', null, 'Mit dem Klassencode deiner Lehrperson bekommst du Rückmeldungen der KI zu Denkfragen und Texten.'),
      feld,
      h('div', { class: 'reihe' }, h('button', { class: 'knopf', onclick: () => { LA.einstellungenSpeichern({ klassenCode: feld.value.trim() }); d.close(); LA.meldung('Gespeichert.'); paketAnsicht(zustand.paket); } }, 'Speichern')),
    ]);
    feld.focus();
  }

  /* ---------- Bearbeiten ---------- */
  function bearbeitenAnsicht(p) {
    LA.editor(main(), p, {
      speichern: (neu, zuordnung) => {
        Object.assign(neu, { id: p.id, gruppe: p.gruppe, niveau: p.niveau });
        const r = LA.lernstandUmschreiben(p.id, zuordnung);
        paketSpeichern(neu);
        LA.kurzlinksNachSpeichern(neu, gruppeVon(neu)).then((n) => { if (n) LA.meldung(n === 1 ? 'Kurzlink aktualisiert: Die Lernenden sehen die Änderungen.' : `${n} Kurzlinks aktualisiert.`); });
        LA.meldung('Gespeichert.' + (r.vorher > r.nachher ? ` ${r.vorher - r.nachher} Karte${r.vorher - r.nachher === 1 ? '' : 'n'} aus der Lernkartei entfernt (gelöscht oder neu erzeugt).` : ''));
        paketAnsicht(neu);
      },
      abbrechen: () => paketAnsicht(p),
      loeschen: () => {
        const gruppe = gruppeVon(p);
        if (!confirm(gruppe.length > 1 ? `«${p.titel}» mit allen ${gruppe.length} Niveaus löschen?` : `«${p.titel}» wirklich löschen?`)) return;
        gruppe.forEach((x) => paketLoeschen(x.id));
        startAnsicht();
      },
    });
    window.scrollTo({ top: 0 });
  }

  /* ---------- Auswertung (öffentlich, anonym) ---------- */
  function auswertungAnsicht(nurPakete, zurueck, nurKurz) {
    LA.vorlesenStoppen();
    zustand.paket = null; zustand.schuelerModus = false; zustand.kurz = ''; kopf();
    // Gesamtauswertung bekommt eine eigene Adresse, die man weitergeben kann
    try { history.replaceState(null, '', nurPakete ? location.pathname + location.search : '#auswertung'); } catch { /* egal */ }
    LA.auswertung(main(), { nurPakete, nurKurz, zurueck: zurueck || (() => { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* egal */ } startAnsicht(); }) });
    window.scrollTo({ top: 0 });
  }

  /* ---------- Plenum (Abstimmung im Klassenzimmer) ---------- */
  function plenumAnsicht(code) {
    LA.vorlesenStoppen();
    zustand.paket = null; zustand.plenum = null; zustand.schuelerModus = false; kopf();
    try { history.replaceState(null, '', '#plenum=' + code); } catch { /* egal */ }
    LA.plenumLehrperson(main(), code, { beenden: () => { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* egal */ } startAnsicht(); } });
    window.scrollTo({ top: 0 });
  }

  function plenumDialog(p) {
    const fragen = LA.plenumFragen(p);
    const boxen = fragen.map((f, i) => h('label', { class: 'schalter pl-wahl' }, h('input', { type: 'checkbox', value: i, checked: f.art === 'Multiple Choice' }), ' ', h('span', null, f.frage, h('span', { class: 'hinweis' }, ' · ' + f.art))));
    const knopf = h('button', { class: 'knopf', onclick: async () => {
      const auswahl = boxen.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => fragen[Number(i.value)]);
      if (!auswahl.length) { LA.meldung('Wähle mindestens eine Frage.', 'fehler'); return; }
      if (!LA.kurzlinkMoeglich()) { LA.meldung('Der Plenumsmodus geht nur, wenn die App über eine Webadresse läuft.', 'fehler'); return; }
      knopf.disabled = true; knopf.textContent = 'Wird gestartet …';
      try {
        const code = await LA.plenumErstellen(p.titel + (p.niveau ? ' · ' + niveauText(p) : ''), auswahl);
        d.close();
        plenumAnsicht(code);
      } catch (e) { LA.meldung(e.message, 'fehler'); knopf.disabled = false; knopf.textContent = 'Plenum starten'; }
    } }, 'Plenum starten');
    const d = dialog('Plenum: gemeinsam abstimmen', [
      h('p', null, 'Eine Frage nach der anderen am Beamer. Alle stimmen auf ihrem Gerät ab, die Verteilung erscheint erst nach dem Abstimmen. Bei geteilter Meinung diskutieren die Lernenden zu zweit und stimmen nochmals ab (Peer Instruction).'),
      h('div', { class: 'reihe' },
        h('button', { class: 'knopf sekundaer klein', type: 'button', onclick: () => boxen.forEach((b) => { b.querySelector('input').checked = true; }) }, 'Alle'),
        h('button', { class: 'knopf sekundaer klein', type: 'button', onclick: () => boxen.forEach((b) => { b.querySelector('input').checked = false; }) }, 'Keine')),
      h('fieldset', { class: 'pl-fragenwahl' }, h('legend', null, 'Welche Fragen?'), boxen),
      h('p', { class: 'hinweis' }, 'Die Stimmen sind anonym und werden nach zwei Tagen gelöscht. Sie zählen nicht in der Auswertung.'),
      knopf,
    ]);
  }

  /* ---------- Wiederholungsrunde für die Klasse ---------- */
  function rundeAnsicht(daten) {
    LA.vorlesenStoppen();
    zustand.runde = daten; zustand.paket = null; kopf();
    LA.rundeStarten(main(), daten, { kurz: zustand.kurz });
    window.scrollTo({ top: 0 });
  }

  function rundeDialog() {
    const liste = pakete();
    // pro Niveau-Gruppe ein Eintrag (bevorzugtes Niveau, sonst Niveau 2)
    const eintraege = liste.filter((p, i) => !p.gruppe || liste.findIndex((x) => x.gruppe === p.gruppe) === i).map((p0) => bevorzugtesNiveau(gruppeVon(p0)));
    const boxen = eintraege.map((p) => h('label', { class: 'schalter' }, h('input', { type: 'checkbox', value: p.id }), ' ', p.titel, p.niveau ? h('span', { class: 'hinweis' }, ' · ' + niveauText(p)) : null));
    const anzahl = h('select', { 'aria-label': 'Anzahl Fragen' }, [10, 15, 20, 30].map((n) => h('option', { value: n, selected: n === 15 }, `${n} Fragen`)));
    const schwierig = h('input', { type: 'checkbox', checked: true });
    const klasse = h('input', { type: 'text', maxlength: 60, placeholder: 'z. B. 2a', 'aria-label': 'Klasse' });
    const ergebnisFeld = h('div', { class: 'kurz-bereich' });
    const knopf = h('button', { class: 'knopf', onclick: async () => {
      const gewaehlt = boxen.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => eintraege.find((p) => p.id === i.value));
      if (!gewaehlt.length) { LA.meldung('Wähle mindestens ein Paket.', 'fehler'); return; }
      if (!LA.kurzlinkMoeglich()) { LA.meldung('Wiederholungsrunden werden als Kurzlink geteilt. Das geht nur, wenn die App über eine Webadresse läuft.', 'fehler'); return; }
      knopf.disabled = true; knopf.textContent = 'Wird erstellt …';
      try {
        let gewichte = new Map();
        if (schwierig.checked) { try { gewichte = LA.rundeGewichte(await LA.statistikLaden()); } catch { /* ohne Auswertung: gleich gewichtet */ } }
        const runde = LA.rundeBauen(gewaehlt, { anzahl: Number(anzahl.value), gewichte });
        const code = await LA.kurzlinkErstellen(runde, klasse.value);
        const url = LA.kurzlinkUrl(code);
        LA.setzen(ergebnisFeld, h('div', { class: 'kurz-ergebnis' },
          h('div', { class: 'qr-klein', html: LA.qrSvg(url) }),
          h('div', { class: 'kurz-text' },
            h('div', { class: 'label' }, `Wiederholungsrunde · ${runde.auswahl.length} Fragen` + (klasse.value.trim() ? ' · ' + klasse.value.trim() : '')),
            h('input', { type: 'text', readonly: true, value: url, class: 'kurz-url', 'aria-label': 'Kurzlink', onclick: (e) => e.target.select() }),
            h('div', { class: 'reihe' },
              h('button', { class: 'knopf', onclick: async () => { try { await navigator.clipboard.writeText(url); LA.meldung('Link kopiert.'); } catch { LA.meldung('Bitte manuell kopieren (Ctrl+C).'); } } }, 'Link kopieren'),
              h('button', { class: 'knopf sekundaer', onclick: () => LA.qrVollbild(url, 'Wiederholungsrunde' + (klasse.value.trim() ? ' · ' + klasse.value.trim() : '')) }, 'QR gross für Beamer')),
            h('p', { class: 'hinweis' }, 'Alle bekommen dieselben Fragen in eigener Reihenfolge. Die Antworten erscheinen in der Auswertung bei den jeweiligen Paketen. Die Runde ist eine feste Auswahl: Spätere Änderungen an den Paketen kommen hier nicht an.'))));
        knopf.textContent = 'Weitere Runde erstellen';
      } catch (e) { LA.meldung(e.message, 'fehler'); knopf.textContent = 'Kurzlink mit QR-Code erstellen'; }
      knopf.disabled = false;
    } }, 'Kurzlink mit QR-Code erstellen');
    dialog('Wiederholungsrunde für die Klasse', [
      h('p', null, 'Gemischte Fragen aus mehreren Paketen, z. B. als 10-Minuten-Einstieg in die Lektion. Wiederholen mit zeitlichem Abstand und gemischtes Üben festigen das Gelernte.'),
      h('fieldset', null, h('legend', null, 'Welche Pakete?'), h('div', { class: 'schalter-raster' }, boxen)),
      h('div', { class: 'reihe' }, anzahl, h('label', { class: 'ed-feld' }, h('span', null, 'Klasse (optional)'), klasse)),
      h('label', { class: 'schalter' }, schwierig, ' Fragen, die in der Auswertung oft falsch waren, häufiger nehmen'),
      knopf, ergebnisFeld,
    ]);
  }

  /* ---------- Meine Kurzlinks ---------- */
  function kurzlinksAnsicht() {
    LA.vorlesenStoppen();
    zustand.paket = null; zustand.schuelerModus = false; zustand.kurz = ''; kopf();
    const status = h('p', { class: 'hinweis', 'aria-live': 'polite' });
    const liste = h('div', { class: 'kl-liste' });
    let info = new Map();
    const datum = (x) => (x ? new Date(x).toLocaleDateString('de-CH') : '–');
    const zeichnen = () => {
      const alle = LA.kurzlinksAlle().sort((a, b) => String(b.erstellt).localeCompare(String(a.erstellt)));
      if (!alle.length) { LA.setzen(liste, h('p', { class: 'hinweis' }, 'Keine Kurzlinks in diesem Browser.')); return; }
      LA.setzen(liste, alle.map((e) => {
        const url = LA.kurzlinkUrl(e.code), i = info.get(e.code);
        const weg = info.size && !i; // in der Datenbank nicht (mehr) vorhanden
        return h('div', { class: 'kl-eintrag' + (weg ? ' gedimmt' : '') },
          h('div', { class: 'kl-kopf' },
            h('div', null, h('div', { class: 'karte-titel' }, e.titel || (i && i.titel) || 'Lernpaket'),
              h('div', { class: 'hinweis' }, `Klasse: ${LA.kurzlinkName(e)} · erstellt ${datum(e.erstellt)}` + (i ? ` · ${i.abrufe}× geöffnet · zuletzt geändert ${datum(i.aktualisiert)}` : weg ? ' · nicht mehr in der Datenbank' : ''))),
            h('code', { class: 'kl-code' }, '#p=' + e.code)),
          h('div', { class: 'reihe' },
            h('button', { class: 'knopf klein', onclick: () => LA.qrVollbild(url, (e.titel || 'Lernpaket') + (e.klasse ? ' · ' + e.klasse : '')) }, 'QR-Code'),
            h('button', { class: 'knopf sekundaer klein', onclick: async () => { try { await navigator.clipboard.writeText(url); LA.meldung('Link kopiert.'); } catch { prompt('Link kopieren:', url); } } }, 'Link kopieren'),
            h('button', { class: 'knopf sekundaer klein', onclick: () => auswertungAnsicht(null, kurzlinksAnsicht, e.code) }, 'Auswertung'),
            h('button', { class: 'knopf sekundaer klein', onclick: async () => {
              const neu = prompt('Klassenname für diesen Link:', e.klasse || '');
              if (neu === null) return;
              try { if (await LA.kurzlinkUmbenennen(e.code, neu)) { LA.meldung('Umbenannt.'); zeichnen(); } else LA.meldung('Umbenennen nicht möglich (Link gelöscht?).', 'fehler'); }
              catch (err) { LA.meldung(err.message, 'fehler'); }
            } }, 'Umbenennen'),
            h('button', { class: 'knopf sekundaer klein gefahr', onclick: async () => {
              if (!confirm(`Kurzlink «${LA.kurzlinkName(e)}» (${e.code}) löschen? Wer ihn öffnet, bekommt danach eine Fehlermeldung. Die gezählten Antworten bleiben in der Auswertung.`)) return;
              try { await LA.kurzlinkLoeschen(e.code); LA.meldung('Kurzlink gelöscht.'); zeichnen(); }
              catch (err) { LA.meldung(err.message + ' Nichts gelöscht.', 'fehler'); }
            } }, 'Löschen')));
      }));
    };
    const laden = async () => {
      status.textContent = 'Lädt Aufrufe …';
      try { info = await LA.kurzlinksInfo(LA.kurzlinksAlle().map((e) => e.code)); status.textContent = ''; }
      catch (err) { info = new Map(); status.textContent = err.message + ' Aufrufe werden nicht angezeigt.'; }
      zeichnen();
    };
    LA.setzen(main(),
      h('button', { class: 'zurueck', onclick: startAnsicht }, '← Zurück'),
      h('h1', null, 'Meine Kurzlinks'),
      h('p', { class: 'intro' }, 'Alle Kurzlinks, die in diesem Browser erstellt wurden. Ändern und löschen geht nur hier: Der Bearbeitungsschlüssel ist in diesem Browser gespeichert, auf anderen Geräten fehlt er.'),
      status, liste);
    zeichnen();
    laden();
    window.scrollTo({ top: 0 });
  }

  /* ---------- Spiel ---------- */
  function spielAnsicht(s) {
    LA.vorlesenStoppen();
    const p = zustand.paket;
    const flaeche = h('div', { class: 'spielflaeche' });
    LA.setzen(main(), h('button', { class: 'zurueck', onclick: () => paketAnsicht(p) }, '← ' + p.titel), flaeche);
    window.scrollTo({ top: 0 });
    if (s === 'wiederholen') return LA.wiederholenStarten(flaeche, p, () => {});
    if (s === 'fehlerheft') return LA.fehlerheft(flaeche, p);
    if (s === 'pruefung') return LA.pruefungDigital(flaeche, p, { fertig: (punkte, max) => fortschrittMerken(p.id, 'pruefung', punkte, max) });
    if (s === 'flow') return LA.flowStarten(flaeche, gruppeVon(p), { niveauWechseln: (x) => paketAnsicht(x), lernpfadOeffnen: p.kapitel.length ? () => spielAnsicht('lernpfad') : null });
    LA.SPIELE[s].start(flaeche, p, (punkte, max) => fortschrittMerken(p.id, s, punkte, max));
  }

  /* ---------- Einstellungen ---------- */
  function einstellungenAnsicht() {
    kopf();
    const e = LA.einstellungen();
    const st = LA.serverStatus;
    const key = h('input', { type: 'password', value: e.apiKey, placeholder: 'sk-ant-…', autocomplete: 'off', id: 'apikey' });
    const nurServer = st && st.serverKi && !e.apiKey;
    const liste = nurServer ? st.modelle.map((id) => LA.MODELLE.find((m) => m.id === id) || { id, name: id, preis: '' }) : LA.MODELLE;
    const modell = h('select', { id: 'modell' }, liste.map((m) => h('option', { value: m.id, selected: m.id === LA.aktuellesModell() }, m.preis ? `${m.name} (${m.preis})` : m.name)));
    const code = h('input', { type: 'text', value: e.klassenCode, autocomplete: 'off', id: 'klassencode', placeholder: 'vom Server vorgegeben' });
    const serverTeil = st ? h('div', { class: 'kasten' + (st.serverKi ? ' merksatz' : '') },
      h('div', { class: 'label' }, 'Lernwerkstatt-Server'),
      st.serverKi ? h('p', null, 'Die KI läuft über diesen Server. Der API-Schlüssel liegt dort, nicht im Browser. Lernende brauchen ' + (st.codeNoetig ? 'nur den Klassencode.' : 'nichts weiter.')) : h('p', null, 'Der Server läuft, aber ohne API-Schlüssel (ANTHROPIC_API_KEY fehlt).'),
      st.serverKi && st.codeNoetig ? h('label', null, 'Klassencode', code) : null,
      st.serverKi ? h('p', { class: 'hinweis' }, 'Ein eigener Schlüssel unten hat Vorrang vor dem Server. Für den Server-Modus das Feld leer lassen.') : null) : null;
    LA.setzen(main(), 
      h('h1', null, 'Einstellungen'),
      h('div', { class: 'formular' },
        serverTeil,
        h('label', null, st && st.serverKi ? 'Eigener Claude-API-Schlüssel (optional)' : 'Claude-API-Schlüssel', key),
        h('p', { class: 'hinweis' }, 'Den Schlüssel bekommst du auf console.anthropic.com (Konto, Guthaben laden, «API Keys»). Er wird nur in diesem Browser gespeichert und direkt an Anthropic gesendet. Wer Zugriff auf diesen Browser hat, kann ihn auslesen – darum nur auf dem eigenen Gerät eintragen, nicht auf Schülergeräten.'),
        h('label', null, 'Modell', modell),
        h('label', { class: 'schalter' }, h('input', { type: 'checkbox', id: 'statistik', checked: LA.statistikAktiv(), onchange: (ev) => { LA.statistikEinstellen(ev.target.checked); LA.meldung(ev.target.checked ? 'Antworten von diesem Gerät werden anonym gezählt.' : 'Dieses Gerät zählt nicht mehr mit.'); } }),
          ' Antworten von diesem Gerät anonym für die Auswertung zählen (ausschalten, damit eigene Tests nicht mitzählen)'),
        h('p', { class: 'hinweis' }, 'Preise sind grobe Schätzungen für ein mittelgrosses Material. Bewertungen und Korrekturen kosten pro Aufruf deutlich weniger.'),
        h('div', { class: 'reihe' },
          h('button', { class: 'knopf', onclick: () => { LA.einstellungenSpeichern({ apiKey: key.value.trim(), modell: modell.value, klassenCode: code.value.trim() }); LA.meldung('Gespeichert.'); startAnsicht(); } }, 'Speichern'),
          e.apiKey ? h('button', { class: 'knopf sekundaer', onclick: () => { LA.einstellungenSpeichern({ apiKey: '' }); LA.meldung('Schlüssel entfernt.'); einstellungenAnsicht(); } }, 'Schlüssel entfernen') : null)));
  }

  /* ---------- Start ---------- */
  async function init() {
    await LA.serverPruefen();
    if (location.hash === '#auswertung') return auswertungAnsicht();
    const plenumSus = location.hash.match(/^#l=([A-Za-z2-9]{6})$/);
    if (plenumSus) { zustand.schuelerModus = true; zustand.plenum = plenumSus[1].toLowerCase(); kopf(); return LA.plenumSchueler(main(), zustand.plenum); }
    const plenumLp = location.hash.match(/^#plenum=([a-z2-9]{6})$/);
    if (plenumLp && LA.plenumBekannt(plenumLp[1])) return plenumAnsicht(plenumLp[1]);
    const kurzcode = location.hash.match(/^#p=([A-Za-z2-9]{7})$/);
    if (kurzcode) {
      LA.setzen(main(), h('p', { class: 'hinweis' }, 'Lernpaket wird geladen …'));
      try {
        const daten = await LA.kurzlinkLaden(kurzcode[1]);
        zustand.schuelerModus = true;
        zustand.kurz = kurzcode[1].toLowerCase(); // Antworten zählen für diese Klasse
        if (LA.istRunde(daten)) { rundeAnsicht(daten); return; }
        if (Array.isArray(daten)) { zustand.gruppe = daten.map((x) => LA.paketPruefen(x)); paketAnsicht(bevorzugtesNiveau(zustand.gruppe)); }
        else paketAnsicht(LA.paketPruefen(daten));
        return;
      } catch (e) {
        LA.meldung(e.message, 'fehler');
        startAnsicht();
        LA.setzen(main(), h('div', { class: 'kasten' }, h('p', null, e.message)), ...main().children);
        return;
      }
    }
    const m = location.hash.match(/^#paket=(.+)$/);
    if (m) {
      try {
        const daten = await LA.linkZuPaket(m[1]);
        zustand.schuelerModus = true;
        // Fortschritt bleibt erhalten, wenn derselbe Link erneut geöffnet wird
        if (Array.isArray(daten)) { zustand.gruppe = daten.map((x) => LA.paketPruefen(x)); paketAnsicht(bevorzugtesNiveau(zustand.gruppe)); }
        else paketAnsicht(LA.paketPruefen(daten));
        return;
      } catch { LA.meldung('Der Link ist beschädigt oder unvollständig.', 'fehler'); }
    }
    startAnsicht();
  }
  document.addEventListener('DOMContentLoaded', init);
})(window.LA);
