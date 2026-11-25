// Vercel-Funktion: GET /api/status – meldet der App, ob die KI über den Server läuft
import kern from '../server/kern.cjs';

export default {
  fetch(request) {
    if (request && request.method === 'OPTIONS') return kern.vorab(request, process.env);
    const r = kern.status(process.env);
    return request ? kern.mitCors(r, request, process.env) : r;
  },
};
