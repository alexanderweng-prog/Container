// Vercel-Funktion: GET /api/status – meldet der App, ob die KI über den Server läuft
import kern from '../server/kern.cjs';

export default {
  fetch() {
    return kern.status(process.env);
  },
};
