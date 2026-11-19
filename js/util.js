/* Hilfsfunktionen: DOM, Speicher, Zufall, Text-Normalisierung */
window.LA = window.LA || {};

(function (LA) {
  // Element erzeugen: h('div', {class:'x', onclick: fn}, kind1, kind2 …)
  LA.h = function (tag, attrs, ...kinder) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kind of kinder.flat(Infinity)) {
      if (kind === null || kind === undefined || kind === false) continue;
      el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
    }
    return el;
  };

  LA.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Sehr kleines Markdown: **fett**, *kursiv*, Absätze, Aufzählungen
  LA.md = function (text) {
    const zeilen = LA.esc(text || '').split(/\n/);
    let html = '', liste = false;
    for (let z of zeilen) {
      z = z.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
      if (/^\s*[-•]\s+/.test(z)) {
        if (!liste) { html += '<ul>'; liste = true; }
        html += '<li>' + z.replace(/^\s*[-•]\s+/, '') + '</li>';
      } else {
        if (liste) { html += '</ul>'; liste = false; }
        if (z.trim()) html += '<p>' + z + '</p>';
      }
    }
    if (liste) html += '</ul>';
    return html;
  };

  LA.mischen = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  LA.id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Vergleich von Antworten: Gross/klein, Leerzeichen, ß/ss egal
  LA.norm = (s) => String(s ?? '').trim().toLowerCase().replace(/ß/g, 'ss').replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '');

  // Für Kreuzworträtsel: nur Grossbuchstaben A–Z
  LA.kreuzwortForm = (s) => String(s ?? '').toUpperCase()
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');

  // localStorage kann blockiert sein (privater Modus) → immer abfangen
  LA.speicher = {
    lesen(k, standard) {
      try { const v = localStorage.getItem(k); return v === null ? standard : JSON.parse(v); } catch { return standard; }
    },
    schreiben(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
    },
    loeschen(k) { try { localStorage.removeItem(k); } catch { /* egal */ } },
  };

  // Paket in URL-Hash verpacken (deflate + base64url)
  LA.paketZuLink = async function (paket) {
    const daten = new TextEncoder().encode(JSON.stringify(paket));
    const strom = new Blob([daten]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(strom).arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  LA.linkZuPaket = async function (code) {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const strom = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(strom).text());
  };

  LA.download = function (dateiname, inhalt, typ = 'application/json') {
    const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
    const a = LA.h('a', { href: url, download: dateiname });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  LA.dateiZuBase64 = (datei) => new Promise((ok, fehler) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => fehler(r.error);
    r.readAsDataURL(datei);
  });

  LA.meldung = function (text, art = 'info') {
    const box = LA.h('div', { class: 'toast toast-' + art, role: 'status' }, text);
    document.body.append(box);
    setTimeout(() => box.classList.add('weg'), 3200);
    setTimeout(() => box.remove(), 3700);
  };
})(window.LA);
