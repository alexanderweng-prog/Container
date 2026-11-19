// Vercel-Funktion: POST /api/anthropic/v1/messages – leitet KI-Anfragen mit dem geheimen Schlüssel weiter.
// ANTHROPIC_API_KEY und KLASSEN_CODE werden im Vercel-Dashboard als Umgebungsvariablen gesetzt.
import kern from '../../../server/kern.cjs';

// Zählt nur innerhalb dieser Instanz; Vercel startet bei Bedarf mehrere. Grober Schutz, kein exaktes Limit.
const zaehler = kern.neuerZaehler();

export default {
  fetch(request) {
    // Vercel setzt x-real-ip selbst auf die Adresse der anfragenden Person
    const ip = request.headers.get('x-real-ip') || 'unbekannt';
    return kern.weiterleiten(request, process.env, { ip, zaehler, pfad: '/v1/messages' });
  },
};
