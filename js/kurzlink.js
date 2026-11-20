/* Kurzlinks mit QR-Code: ein Paket wird in Supabase (Tabelle lw_pakete) unter einem 7-stelligen Code gespeichert.
   Link: …/#p=<code>. Nur mit Code abrufbar (keine Liste). Ändern nur mit dem Bearbeitungsschlüssel,
   der beim Erstellen in diesem Browser entsteht und in der Datenbank nur als Prüfsumme liegt. */
(function (LA) {
  const { h } = LA;
  const KEY = 'lernapp.kurzlinks';

  LA.kurzlinkMoeglich = () => !!(LA.STATISTIK && LA.STATISTIK.url && LA.STATISTIK.schluessel) && location.protocol !== 'file:';

  async function rpc(name, body) {
    const r = await fetch(`${LA.STATISTIK.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: LA.STATISTIK.schluessel },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      let text = ''; try { text = (await r.json()).message || ''; } catch { /* egal */ }
      throw new Error(/zu gross/i.test(text) ? 'Das Paket ist zu gross für einen Kurzlink.' : `Der Kurzlink-Dienst antwortet nicht (${r.status}).`);
    }
    return r.status === 204 ? null : r.json();
  }

  function zufallsSchluessel() {
    const b = new Uint8Array(24);
    crypto.getRandomValues(b);
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* Gespeichert in diesem Browser: Liste [{ code, token, auswahl, titel, klasse, erstellt }].
     «auswahl» sagt, was geteilt wurde: 'gruppe:<id>' (alle Niveaus) oder 'paket:<id>'. */
  function alle() {
    const roh = LA.speicher.lesen(KEY, []);
    if (Array.isArray(roh)) return roh;
    // ältere Fassung: ein Objekt { auswahl: { code, token, erstellt } }
    return Object.entries(roh || {}).map(([auswahl, e]) => ({ titel: '', klasse: '', ...e, auswahl }));
  }
  const schreiben = (liste) => LA.speicher.schreiben(KEY, liste);
  LA.kurzlinksAlle = alle;
  // Aus einer Sicherung übernehmen (nach Code zusammenführen). Gibt die Anzahl neuer Einträge zurück.
  LA.kurzlinksUebernehmen = function (liste) {
    const jetzt = alle(), bekannt = new Set(jetzt.map((e) => e.code));
    const neu = (Array.isArray(liste) ? liste : []).filter((e) => e && /^[a-z2-9]{7}$/.test(e.code) && typeof e.token === 'string' && !bekannt.has(e.code));
    if (neu.length) schreiben([...jetzt, ...neu.map((e) => ({ code: e.code, token: e.token, auswahl: String(e.auswahl || ''), titel: String(e.titel || ''), klasse: String(e.klasse || ''), erstellt: e.erstellt || '' }))]);
    return neu.length;
  };

  LA.kurzlinkSchluessel = (inhalt) => (Array.isArray(inhalt) ? 'gruppe:' + inhalt[0].gruppe : 'paket:' + inhalt.id);
  // Alle Kurzlinks einer Auswahl, neueste zuerst
  LA.kurzlinksFuer = (inhalt) => alle().filter((e) => e.auswahl === LA.kurzlinkSchluessel(inhalt)).sort((a, b) => String(b.erstellt).localeCompare(String(a.erstellt)));
  LA.kurzlinkVorhanden = (inhalt) => LA.kurzlinksFuer(inhalt)[0] || null;
  LA.kurzlinkUrl = (code) => location.origin + location.pathname + '#p=' + code;
  LA.kurzlinkName = (e) => (e && e.klasse ? e.klasse : 'ohne Klassenname');
  const titelVon = (inhalt) => (Array.isArray(inhalt) ? inhalt[0].titel : inhalt.titel) || 'Lernpaket';

  LA.kurzlinkErstellen = async function (inhalt, klasse = '') {
    const token = zufallsSchluessel();
    klasse = String(klasse || '').trim().slice(0, 60);
    const code = await rpc('lw_paket_teilen', { p_daten: inhalt, p_titel: titelVon(inhalt), p_token: token, p_klasse: klasse });
    if (!/^[a-z2-9]{7}$/.test(code)) throw new Error('Unerwartete Antwort vom Kurzlink-Dienst.');
    schreiben([...alle(), { code, token, auswahl: LA.kurzlinkSchluessel(inhalt), titel: titelVon(inhalt), klasse, erstellt: new Date().toISOString() }]);
    return code;
  };

  // Inhalt hinter allen Kurzlinks dieser Auswahl ersetzen (z. B. nach Korrekturen im Editor). Gibt die Anzahl zurück.
  LA.kurzlinkAktualisieren = async function (inhalt) {
    let n = 0;
    for (const e of LA.kurzlinksFuer(inhalt)) {
      if (await rpc('lw_paket_aktualisieren', { p_code: e.code, p_daten: inhalt, p_titel: titelVon(inhalt), p_token: e.token })) n++;
    }
    if (n) schreiben(alle().map((e) => (e.auswahl === LA.kurzlinkSchluessel(inhalt) ? { ...e, titel: titelVon(inhalt) } : e)));
    return n;
  };

  // Nach dem Speichern: alle Kurzlinks aktualisieren, in denen dieses Paket steckt
  LA.kurzlinksNachSpeichern = async function (p, gruppe) {
    if (!LA.kurzlinkMoeglich()) return 0;
    const kandidaten = [p];
    if (gruppe && gruppe.length > 1) kandidaten.push(gruppe);
    let n = 0;
    for (const inhalt of kandidaten) {
      try { n += await LA.kurzlinkAktualisieren(inhalt); } catch { /* offline: beim nächsten Teilen */ }
    }
    return n;
  };

  LA.kurzlinkUmbenennen = async function (code, klasse) {
    const e = alle().find((x) => x.code === code);
    if (!e) return false;
    klasse = String(klasse || '').trim().slice(0, 60);
    const ok = await rpc('lw_paket_aktualisieren', { p_code: code, p_daten: null, p_titel: null, p_token: e.token, p_klasse: klasse });
    if (ok) schreiben(alle().map((x) => (x.code === code ? { ...x, klasse } : x)));
    return !!ok;
  };

  // Löschen: Link funktioniert danach nicht mehr. Gezählte Antworten bleiben in der Auswertung.
  LA.kurzlinkLoeschen = async function (code) {
    const e = alle().find((x) => x.code === code);
    if (!e) return false;
    const ok = await rpc('lw_paket_loeschen', { p_code: code, p_token: e.token });
    // Auch wenn es den Link in der Datenbank schon nicht mehr gibt: aus der eigenen Liste entfernen
    schreiben(alle().filter((x) => x.code !== code));
    return !!ok;
  };

  // Aufrufe und Klassennamen aus der Datenbank (nur für bekannte Codes)
  LA.kurzlinksInfo = async function (codes) {
    if (!codes.length || !LA.kurzlinkMoeglich()) return new Map();
    const zeilen = await rpc('lw_kurzlinks_info', { p_codes: codes.slice(0, 300) });
    return new Map((zeilen || []).map((z) => [z.code, z]));
  };

  // Laden für Lernende; letzte Fassung wird gemerkt, damit es auch offline öffnet
  LA.kurzlinkLaden = async function (code) {
    code = String(code).toLowerCase();
    if (!/^[a-z2-9]{7}$/.test(code)) throw new Error('Dieser Kurzlink ist ungültig.');
    try {
      const daten = await rpc('lw_paket_laden', { p_code: code });
      if (!daten) throw Object.assign(new Error('Diesen Kurzlink gibt es nicht (mehr). Bitte die Lehrperson nach dem aktuellen Link fragen.'), { endgueltig: true });
      LA.speicher.schreiben('lernapp.kurz.' + code, daten);
      return daten;
    } catch (e) {
      const gemerkt = !e.endgueltig && LA.speicher.lesen('lernapp.kurz.' + code, null);
      if (gemerkt) { LA.meldung('Offline: letzte gespeicherte Fassung geöffnet.'); return gemerkt; }
      throw e;
    }
  };

  // QR-Code als SVG (Bibliothek: QR Code Generator, Kazuhiko Arase, MIT)
  LA.qrSvg = function (text) {
    const q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount(), rand = 2, groesse = n + rand * 2;
    let pfad = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) pfad += `M${x + rand} ${y + rand}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${groesse} ${groesse}" shape-rendering="crispEdges" role="img" aria-label="QR-Code"><rect width="100%" height="100%" fill="#fff"/><path d="${pfad}" fill="#000"/></svg>`;
  };

  // Grosse Ansicht für den Beamer
  LA.qrVollbild = function (url, titel) {
    const d = h('dialog', { class: 'qr-vollbild', onclick: (e) => { if (e.target === d) d.close(); } },
      h('div', { class: 'qr-vollbild-inhalt' },
        h('div', { class: 'qr-titel' }, titel),
        h('div', { class: 'qr-gross', html: LA.qrSvg(url) }),
        h('div', { class: 'qr-url' }, url.replace(/^https?:\/\//, '')),
        h('button', { class: 'knopf sekundaer', onclick: () => d.close() }, 'Schliessen')));
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    try { d.requestFullscreen && d.requestFullscreen().catch(() => {}); } catch { /* egal */ }
  };
})(window.LA);
