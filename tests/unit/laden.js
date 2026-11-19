// Lädt die Browser-Skripte der App in Node.js (ohne Browser), mit Speicher-Attrappe.
const path = require('node:path');

function laden(...dateien) {
  for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}js${path.sep}`)) delete require.cache[k];
  const daten = new Map();
  globalThis.window = globalThis;
  globalThis.localStorage = {
    getItem: (k) => (daten.has(k) ? daten.get(k) : null),
    setItem: (k, v) => daten.set(k, String(v)),
    removeItem: (k) => daten.delete(k),
  };
  delete globalThis.LA;
  for (const d of dateien) require(path.join(__dirname, '..', '..', 'js', d));
  return globalThis.LA;
}
module.exports = { laden };
