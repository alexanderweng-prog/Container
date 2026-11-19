/* Ansichten und Ablauf der App */
(function (LA) {
  const { h } = LA;
  const PAKETE_KEY = 'lernapp.pakete';
  const main = () => document.getElementById('inhalt');

  const zustand = { paket: null, schuelerModus: false, gruppe: null };

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
      h('button', { class: 'marke', onclick: () => (zustand.schuelerModus && zustand.paket ? LA.zurUebersicht() : startAnsicht()) }, h('span', { class: 'marke-zeichen', 'aria-hidden': 'true' }, 'L'), 'Lernwerkstatt'),
      h('nav', null,
        zustand.schuelerModus ? h('span', { class: 'tag' }, 'Schüleransicht') : h('button', { class: 'knopf sekundaer klein', onclick: startAnsicht }, 'Meine Pakete'),
        zustand.schuelerModus && LA.serverStatus && LA.serverStatus.serverKi && LA.serverStatus.codeNoetig
          ? h('button', { class: 'knopf sekundaer klein', onclick: klassencodeDialog }, LA.kiVerfuegbar() ? '🔓 KI aktiv' : '🔑 Klassencode') : null,
        zustand.schuelerModus ? null : h('button', { class: 'knopf sekundaer klein', onclick: einstellungenAnsicht, 'aria-label': 'Einstellungen' }, LA.kiVerfuegbar() ? '⚙︎ KI aktiv' : '⚙︎ Einstellungen')));
  }

  /* ---------- Start: Paketliste ---------- */
  function startAnsicht() {
    zustand.paket = null; zustand.schuelerModus = false; zustand.gruppe = null; kopf();
    const liste = pakete();
    const dateiInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
      try {
        const daten = JSON.parse(await e.target.files[0].text());
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
          h('button', { class: 'knopf sekundaer', onclick: () => dateiInput.click() }, 'Paket importieren'), dateiInput,
          h('button', { class: 'knopf sekundaer', onclick: () => auswertungAnsicht() }, '📊 Auswertung'))),
      h('section', null,
        h('h2', null, 'Meine Lernpakete'),
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
    gruppe.forEach(LA.statistikPaket); // Antworten dieser Pakete dürfen anonym gezählt werden
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
          h('button', { class: 'knopf sekundaer klein', onclick: () => LA.druckDialog(p) }, 'Drucken'),
          gruppe.length < 2 && LA.kiVerfuegbar() ? h('button', { class: 'knopf sekundaer klein', onclick: () => {
            if (confirm('Die KI schreibt dieses Paket zusätzlich für Niveau 1 (grundlegend) und Niveau 3 (erweitert) um. Dieses Paket wird Niveau 2. Das kostet etwa doppelt so viel wie ein neues Paket. Weiter?')) niveausErzeugen(p);
          } }, 'Niveaus erzeugen') : null,
          h('button', { class: 'knopf sekundaer klein', onclick: () => gruppe.length > 1
            ? LA.download(dateiname(p).replace('.json', '-niveaus.json'), JSON.stringify(gruppe, null, 2))
            : LA.download(dateiname(p), JSON.stringify(p, null, 2)) }, 'Export'),
          h('button', { class: 'knopf sekundaer klein', onclick: () => bearbeitenAnsicht(p) }, 'Bearbeiten'),
          h('button', { class: 'knopf sekundaer klein', onclick: () => auswertungAnsicht(gruppe.map((x) => x.id), () => paketAnsicht(p)) }, 'Auswertung'))),
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
    const feld = h('textarea', { rows: 4, readonly: true });
    const warnung = h('div');
    let link = '';
    const bauen = async (inhalt) => {
      link = basis + '#paket=' + await LA.paketZuLink(inhalt);
      feld.value = link;
      LA.setzen(warnung, link.length > 30000 ? h('p', { class: 'rueckmeldung nein' }, `Der Link ist sehr lang (${Math.round(link.length / 1000)}k Zeichen). Manche Programme kürzen ihn. Sicherer: Export-Datei weitergeben.`) : null);
    };
    const wahl = gruppe.length > 1 ? h('select', { 'aria-label': 'Was teilen?', onchange: (e) => bauen(e.target.value === 'alle' ? gruppe : gruppe.find((x) => x.id === e.target.value)) },
      h('option', { value: 'alle' }, 'Alle Niveaus – die Lernenden wählen selbst'),
      gruppe.map((x) => h('option', { value: x.id }, 'Nur ' + niveauText(x) + ' (' + LA.NIVEAUS[x.niveau].lang + ')'))) : null;
    await bauen(gruppe.length > 1 ? gruppe : p);
    dialog('Paket teilen', [
      wahl ? h('label', { class: 'ed-feld breit' }, h('span', null, 'Was teilen?'), wahl) : null,
      h('p', null, 'Schülerinnen und Schüler öffnen diesen Link und sehen nur die Lernansicht. Das Paket steckt vollständig im Link – es wird nichts auf einen Server hochgeladen.'),
      location.protocol === 'file:' ? h('p', { class: 'rueckmeldung nein' }, 'Achtung: Die App läuft gerade als lokale Datei. Der Link funktioniert nur, wenn die App im Internet liegt (z. B. GitHub Pages). Alternative: Export-Datei weitergeben.') : null,
      warnung,
      feld,
      h('div', { class: 'reihe' }, h('button', { class: 'knopf', onclick: async () => { try { await navigator.clipboard.writeText(link); LA.meldung('Link kopiert.'); } catch { feld.select(); LA.meldung('Bitte manuell kopieren (Ctrl+C).'); } } }, 'Link kopieren')),
      h('p', { class: 'hinweis' }, LA.serverStatus && LA.serverStatus.serverKi
        ? 'Die App läuft über den Lernwerkstatt-Server: Lernende bekommen KI-Rückmeldungen' + (LA.serverStatus.codeNoetig ? ', sobald sie den Klassencode eingeben.' : ' ohne eigenen Schlüssel.')
        : 'Denkfragen und Textkorrektur mit KI-Rückmeldung funktionieren auf Schülergeräten nur mit dem Lernwerkstatt-Server oder einem dort hinterlegten Schlüssel. Sonst gibt es Musterantworten zur Selbsteinschätzung.'),
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
  function auswertungAnsicht(nurPakete, zurueck) {
    LA.vorlesenStoppen();
    zustand.paket = null; zustand.schuelerModus = false; kopf();
    // Gesamtauswertung bekommt eine eigene Adresse, die man weitergeben kann
    try { history.replaceState(null, '', nurPakete ? location.pathname + location.search : '#auswertung'); } catch { /* egal */ }
    LA.auswertung(main(), { nurPakete, zurueck: zurueck || (() => { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* egal */ } startAnsicht(); }) });
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
