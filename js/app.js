/* Ansichten und Ablauf der App */
(function (LA) {
  const { h } = LA;
  const PAKETE_KEY = 'lernapp.pakete';
  const main = () => document.getElementById('inhalt');

  const zustand = { paket: null, schuelerModus: false };

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
    k.replaceChildren(
      h('button', { class: 'marke', onclick: () => (zustand.schuelerModus && zustand.paket ? LA.zurUebersicht() : startAnsicht()) }, h('span', { class: 'marke-zeichen', 'aria-hidden': 'true' }, 'L'), 'Lernwerkstatt'),
      h('nav', null,
        zustand.schuelerModus ? h('span', { class: 'tag' }, 'Schüleransicht') : h('button', { class: 'knopf sekundaer klein', onclick: startAnsicht }, 'Meine Pakete'),
        zustand.schuelerModus && LA.serverStatus && LA.serverStatus.serverKi && LA.serverStatus.codeNoetig
          ? h('button', { class: 'knopf sekundaer klein', onclick: klassencodeDialog }, LA.kiVerfuegbar() ? '🔓 KI aktiv' : '🔑 Klassencode') : null,
        zustand.schuelerModus ? null : h('button', { class: 'knopf sekundaer klein', onclick: einstellungenAnsicht, 'aria-label': 'Einstellungen' }, LA.kiVerfuegbar() ? '⚙︎ KI aktiv' : '⚙︎ Einstellungen')));
  }

  /* ---------- Start: Paketliste ---------- */
  function startAnsicht() {
    zustand.paket = null; zustand.schuelerModus = false; kopf();
    const liste = pakete();
    const dateiInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
      try {
        const p = LA.paketPruefen(JSON.parse(await e.target.files[0].text()));
        paketSpeichern(p); LA.meldung('Paket importiert.'); paketAnsicht(p);
      } catch { LA.meldung('Diese Datei ist kein gültiges Lernpaket.', 'fehler'); }
    } });
    main().replaceChildren(
      h('section', { class: 'held' },
        h('h1', null, 'Aus deinem Material wird eine Lern-App'),
        h('p', { class: 'intro' }, 'Text, PDF oder Foto eines Arbeitsblatts hineingeben. Die KI baut daraus einen Lernpfad mit Erklärungen und wählt passende Übungen: Multiple Choice, Lückentext, Memory, Kreuzworträtsel, Reihenfolge, Zuordnen, Denkfragen und Textkorrektur.'),
        h('div', { class: 'reihe' },
          h('button', { class: 'knopf', onclick: erstellenAnsicht }, '+ Neues Lernpaket'),
          h('button', { class: 'knopf sekundaer', onclick: () => paketAnsicht(LA.paketPruefen(structuredClone(LA.DEMO))) }, 'Demo ansehen (Wasserkreislauf)'),
          h('button', { class: 'knopf sekundaer', onclick: () => dateiInput.click() }, 'Paket importieren'), dateiInput)),
      h('section', null,
        h('h2', null, 'Meine Lernpakete'),
        liste.length ? h('div', { class: 'karten' }, liste.map((p) => {
          const f = fortschritt(p.id);
          const erledigt = Object.keys(f).length;
          return h('button', { class: 'karte', onclick: () => paketAnsicht(p) },
            h('div', { class: 'label' }, [p.fach, p.stufe].filter(Boolean).join(' · ') || 'Lernpaket'),
            h('div', { class: 'karte-titel' }, p.titel),
            h('div', { class: 'hinweis' }, p.kurzbeschreibung),
            h('div', { class: 'hinweis' }, `${p.spiele.length} Spiele · ${erledigt} gespielt${p.quelle === 'offline' ? ' · ohne KI' : ''}`));
        })) : h('p', { class: 'hinweis' }, 'Noch keine Pakete. Erstelle eines oder schau dir die Demo an.')));
  }

  /* ---------- Erstellen ---------- */
  const STUFEN = ['Primar (5./6. Klasse)', 'Sek I (7.–9. Klasse)', 'Sek II / Gymnasium', 'Berufsschule', 'Erwachsene / Weiterbildung'];

  function erstellenAnsicht() {
    kopf();
    let modus = LA.kiVerfuegbar() ? 'ki' : 'offline';
    const wurzel = h('div');
    const zeichne = () => {
      wurzel.replaceChildren(
        h('div', { class: 'tabs', role: 'tablist' },
          h('button', { role: 'tab', class: 'tab' + (modus === 'ki' ? ' aktiv' : ''), 'aria-selected': modus === 'ki', onclick: () => { modus = 'ki'; zeichne(); } }, 'Mit KI (beliebiges Material)'),
          h('button', { role: 'tab', class: 'tab' + (modus === 'offline' ? ' aktiv' : ''), 'aria-selected': modus === 'offline', onclick: () => { modus = 'offline'; zeichne(); } }, 'Ohne KI (Begriffsliste)')),
        modus === 'ki' ? kiFormular() : offlineFormular());
    };
    zeichne();
    main().replaceChildren(h('h1', null, 'Neues Lernpaket'), wurzel);
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
    const zeigeDateien = () => dateiListe.replaceChildren(...dateien.map((d, i) => h('li', null, `${d.name} (${Math.round(d.groesse / 1024)} KB)`, h('button', { class: 'mini', 'aria-label': 'entfernen', onclick: () => { dateien.splice(i, 1); zeigeDateien(); } }, '✕'))));
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
    const knopf = h('button', { class: 'knopf', onclick: async () => {
      if (!material.value.trim() && !dateien.length) { status.textContent = 'Bitte Text einfügen oder eine Datei wählen.'; return; }
      knopf.disabled = true;
      const start = Date.now();
      const tick = setInterval(() => { status.firstChild && (status.firstChild.textContent = `Die KI erstellt das Lernpaket … ${Math.round((Date.now() - start) / 1000)} s`); }, 1000);
      status.replaceChildren(h('span', null, 'Die KI erstellt das Lernpaket …'), h('span', { class: 'hinweis' }, ' (dauert meist 30–90 Sekunden)'), h('div', { class: 'balken laeuft' }, h('div')));
      try {
        const p = await LA.paketErzeugen({ text: material.value.trim(), dateien, fach: fach.value.trim(), stufe: stufe.value, hinweis: hinweis.value.trim(),
          beiFortschritt: (n) => { const s = status.querySelector('.hinweis'); if (s) s.textContent = ` (${n.toLocaleString('de-CH')} Zeichen empfangen)`; } });
        paketSpeichern(p);
        LA.meldung('Lernpaket erstellt.');
        paketAnsicht(p);
      } catch (e) {
        status.replaceChildren(h('div', { class: 'rueckmeldung nein' }, e.message));
      } finally { clearInterval(tick); knopf.disabled = false; }
    } }, 'Lernpaket erstellen');

    return h('div', { class: 'formular' },
      h('div', { class: 'zwei' }, h('label', null, 'Fach', fach), h('label', null, 'Stufe', stufe)),
      h('label', null, 'Material (Text)', material),
      h('label', null, 'oder/und Dateien: PDF, Fotos von Arbeitsblättern, Textdateien', dateiInput), dateiListe,
      h('label', null, 'Wunsch an die KI', hinweis),
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
        catch (e) { status.replaceChildren(h('div', { class: 'rueckmeldung nein' }, e.message)); }
      } }, 'Lernpaket erstellen'), status);
  }

  /* ---------- Paket-Übersicht ---------- */
  function paketAnsicht(p) {
    zustand.paket = p; kopf();
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
    main().replaceChildren(
      h('div', { class: 'paket-kopf' },
        h('div', null,
          h('div', { class: 'label' }, [p.fach, p.stufe].filter(Boolean).join(' · ')),
          h('h1', null, p.titel),
          h('p', { class: 'intro' }, p.kurzbeschreibung)),
        zustand.schuelerModus ? null : h('div', { class: 'reihe' },
          !istGespeichert ? h('button', { class: 'knopf sekundaer klein', onclick: () => { paketSpeichern(p); paketAnsicht(p); LA.meldung('In «Meine Pakete» gespeichert.'); } }, 'Speichern') : null,
          h('button', { class: 'knopf sekundaer klein', onclick: () => teilen(p) }, 'Teilen'),
          h('button', { class: 'knopf sekundaer klein', onclick: () => LA.download(dateiname(p), JSON.stringify(p, null, 2)) }, 'Export'),
          h('button', { class: 'knopf sekundaer klein', onclick: () => bearbeitenAnsicht(p) }, 'Bearbeiten'))),
      lernpfad ? h('section', null, h('div', { class: 'label' }, '1 · Zuerst lernen'), spielKarte('lernpfad', true)) : null,
      h('section', null, h('div', { class: 'label' }, (lernpfad ? '2 · ' : '') + 'Dann üben'),
        h('div', { class: 'spiele' }, uebungen.map((s) => spielKarte(s)))),
      p.spiele_begruendung && !zustand.schuelerModus ? h('p', { class: 'hinweis begruendung' }, h('strong', null, 'Warum diese Spiele? '), p.spiele_begruendung) : null);
  }
  LA.zurUebersicht = () => paketAnsicht(zustand.paket);

  const dateiname = (p) => (p.titel || 'lernpaket').toLowerCase().replace(/[^a-z0-9äöü]+/gi, '-').replace(/^-|-$/g, '') + '.json';

  async function teilen(p) {
    const code = await LA.paketZuLink(p);
    const basis = location.href.split('#')[0];
    const link = basis + '#paket=' + code;
    const zuLang = link.length > 30000;
    const feld = h('textarea', { rows: 4, readonly: true }, link);
    dialog('Paket teilen', [
      h('p', null, 'Schülerinnen und Schüler öffnen diesen Link und sehen nur die Lernansicht. Das Paket steckt vollständig im Link – es wird nichts auf einen Server hochgeladen.'),
      location.protocol === 'file:' ? h('p', { class: 'rueckmeldung nein' }, 'Achtung: Die App läuft gerade als lokale Datei. Der Link funktioniert nur, wenn die App im Internet liegt (z. B. GitHub Pages). Alternative: Export-Datei weitergeben.') : null,
      zuLang ? h('p', { class: 'rueckmeldung nein' }, `Der Link ist sehr lang (${Math.round(link.length / 1000)}k Zeichen). Manche Programme kürzen ihn. Sicherer: Export-Datei weitergeben.`) : null,
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
    const kopie = structuredClone(p);
    const titel = h('input', { type: 'text', value: kopie.titel });
    const auswahl = LA.SPIELTYPEN.map((s) => {
      const moeglich = LA.SPIELE[s].moeglich(kopie);
      return h('label', { class: 'schalter' + (moeglich ? '' : ' gedimmt') }, h('input', { type: 'checkbox', value: s, checked: kopie.spiele.includes(s), disabled: !moeglich }), ` ${LA.SPIELE[s].symbol} ${LA.SPIELE[s].name}`, moeglich ? '' : ' (zu wenig Inhalt)');
    });
    const json = h('textarea', { rows: 18, class: 'mono', spellcheck: 'false' }, JSON.stringify(kopie, null, 2));
    const status = h('div', { 'aria-live': 'polite' });
    main().replaceChildren(
      h('h1', null, 'Paket bearbeiten'),
      h('div', { class: 'formular' },
        h('label', null, 'Titel', titel),
        h('fieldset', null, h('legend', null, 'Welche Spiele sollen erscheinen?'), h('div', { class: 'schalter-raster' }, auswahl)),
        h('div', { class: 'reihe' },
          h('button', { class: 'knopf', onclick: () => {
            kopie.titel = titel.value.trim() || kopie.titel;
            kopie.spiele = auswahl.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
            paketSpeichern(kopie); LA.meldung('Gespeichert.'); paketAnsicht(kopie);
          } }, 'Speichern'),
          h('button', { class: 'knopf sekundaer', onclick: () => paketAnsicht(p) }, 'Abbrechen'),
          h('button', { class: 'knopf gefahr', onclick: () => { if (confirm(`«${p.titel}» wirklich löschen?`)) { paketLoeschen(p.id); startAnsicht(); } } }, 'Löschen')),
        h('details', null, h('summary', null, 'Fortgeschritten: Inhalte direkt bearbeiten (JSON)'),
          h('p', { class: 'hinweis' }, 'Hier kannst du jede Frage, Erklärung und jeden Begriff ändern. Lücken im Lückentext stehen als {{Wort}}. Bei Multiple Choice ist «richtig» die Nummer der richtigen Option, beginnend bei 0.'),
          json,
          h('button', { class: 'knopf sekundaer', onclick: () => {
            try { const neu = LA.paketPruefen(JSON.parse(json.value)); neu.id = p.id; paketSpeichern(neu); LA.meldung('Inhalte übernommen.'); paketAnsicht(neu); }
            catch (e) { status.replaceChildren(h('div', { class: 'rueckmeldung nein' }, 'JSON-Fehler: ' + e.message)); }
          } }, 'JSON übernehmen'), status)));
  }

  /* ---------- Spiel ---------- */
  function spielAnsicht(s) {
    const p = zustand.paket;
    const flaeche = h('div', { class: 'spielflaeche' });
    main().replaceChildren(h('button', { class: 'zurueck', onclick: () => paketAnsicht(p) }, '← ' + p.titel), flaeche);
    window.scrollTo({ top: 0 });
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
    main().replaceChildren(
      h('h1', null, 'Einstellungen'),
      h('div', { class: 'formular' },
        serverTeil,
        h('label', null, st && st.serverKi ? 'Eigener Claude-API-Schlüssel (optional)' : 'Claude-API-Schlüssel', key),
        h('p', { class: 'hinweis' }, 'Den Schlüssel bekommst du auf console.anthropic.com (Konto, Guthaben laden, «API Keys»). Er wird nur in diesem Browser gespeichert und direkt an Anthropic gesendet. Wer Zugriff auf diesen Browser hat, kann ihn auslesen – darum nur auf dem eigenen Gerät eintragen, nicht auf Schülergeräten.'),
        h('label', null, 'Modell', modell),
        h('p', { class: 'hinweis' }, 'Preise sind grobe Schätzungen für ein mittelgrosses Material. Bewertungen und Korrekturen kosten pro Aufruf deutlich weniger.'),
        h('div', { class: 'reihe' },
          h('button', { class: 'knopf', onclick: () => { LA.einstellungenSpeichern({ apiKey: key.value.trim(), modell: modell.value, klassenCode: code.value.trim() }); LA.meldung('Gespeichert.'); startAnsicht(); } }, 'Speichern'),
          e.apiKey ? h('button', { class: 'knopf sekundaer', onclick: () => { LA.einstellungenSpeichern({ apiKey: '' }); LA.meldung('Schlüssel entfernt.'); einstellungenAnsicht(); } }, 'Schlüssel entfernen') : null)));
  }

  /* ---------- Start ---------- */
  async function init() {
    await LA.serverPruefen();
    const m = location.hash.match(/^#paket=(.+)$/);
    if (m) {
      try {
        const p = LA.paketPruefen(await LA.linkZuPaket(m[1]));
        zustand.schuelerModus = true;
        // Fortschritt bleibt erhalten, wenn derselbe Link erneut geöffnet wird
        paketAnsicht(p);
        return;
      } catch { LA.meldung('Der Link ist beschädigt oder unvollständig.', 'fehler'); }
    }
    startAnsicht();
  }
  document.addEventListener('DOMContentLoaded', init);
})(window.LA);
