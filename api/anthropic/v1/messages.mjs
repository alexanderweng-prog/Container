// Vercel-Funktion: POST /api/anthropic/v1/messages – leitet KI-Anfragen mit dem geheimen Schlüssel weiter.
// ANTHROPIC_API_KEY und KLASSEN_CODE werden im Vercel-Dashboard als Umgebungsvariablen gesetzt.
// Andere Lern-Apps (ERLAUBTE_URSPRUENGE, Standard: GitHub Pages) dürfen mit Klassencode mitbenutzen.
import kern from '../../../server/kern.cjs';

// Zählt nur innerhalb dieser Instanz; Vercel startet bei Bedarf mehrere. Grober Schutz, kein exaktes Limit.
const zaehler = kern.neuerZaehler();

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return kern.vorab(request, process.env);
    // Vercel setzt x-real-ip selbst auf die Adresse der anfragenden Person
    const ip = request.headers.get('x-real-ip') || 'unbekannt';
    return kern.mitCors(await kern.weiterleiten(request, process.env, { ip, zaehler, pfad: '/v1/messages' }), request, process.env);
  },
};
