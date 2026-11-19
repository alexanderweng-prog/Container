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

  const alle = () => LA.speicher.lesen(KEY, {});
  // Welche Auswahl geteilt wurde: ganze Niveau-Gruppe oder einzelnes Paket
  LA.kurzlinkSchluessel = (inhalt) => (Array.isArray(inhalt) ? 'gruppe:' + inhalt[0].gruppe : 'paket:' + inhalt.id);
  LA.kurzlinkVorhanden = (inhalt) => alle()[LA.kurzlinkSchluessel(inhalt)] || null;
  LA.kurzlinkUrl = (code) => location.origin + location.pathname + '#p=' + code;
  const titelVon = (inhalt) => (Array.isArray(inhalt) ? inhalt[0].titel : inhalt.titel) || 'Lernpaket';

  LA.kurzlinkErstellen = async function (inhalt) {
    const token = zufallsSchluessel();
    const code = await rpc('lw_paket_teilen', { p_daten: inhalt, p_titel: titelVon(inhalt), p_token: token });
    if (!/^[a-z2-9]{7}$/.test(code)) throw new Error('Unerwartete Antwort vom Kurzlink-Dienst.');
    const a = alle();
    a[LA.kurzlinkSchluessel(inhalt)] = { code, token, erstellt: new Date().toISOString() };
    LA.speicher.schreiben(KEY, a);
    return code;
  };

  // Inhalt hinter einem bestehenden Kurzlink ersetzen (z. B. nach Korrekturen im Editor)
  LA.kurzlinkAktualisieren = async function (inhalt) {
    const eintrag = LA.kurzlinkVorhanden(inhalt);
    if (!eintrag) return false;
    return !!(await rpc('lw_paket_aktualisieren', { p_code: eintrag.code, p_daten: inhalt, p_titel: titelVon(inhalt), p_token: eintrag.token }));
  };

  // Nach dem Speichern: alle Kurzlinks aktualisieren, in denen dieses Paket steckt
  LA.kurzlinksNachSpeichern = async function (p, gruppe) {
    if (!LA.kurzlinkMoeglich()) return 0;
    const kandidaten = [p];
    if (gruppe && gruppe.length > 1) kandidaten.push(gruppe);
    let n = 0;
    for (const inhalt of kandidaten) {
      try { if (LA.kurzlinkVorhanden(inhalt) && await LA.kurzlinkAktualisieren(inhalt)) n++; } catch { /* offline: beim nächsten Teilen */ }
    }
    return n;
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
