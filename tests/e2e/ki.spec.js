// KI-Funktionen mit simulierter Anthropic-API
const { test, expect } = require('@playwright/test');
const { fehlerSammeln, kiAttrappe, spielOeffnen, zurueck } = require('./hilfen');

let fehler;
test.beforeEach(async ({ page }) => {
  fehler = fehlerSammeln(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Einstellungen/ }).click();
  await page.locator('#apikey').fill('sk-ant-test');
  await page.getByRole('button', { name: 'Speichern' }).click();
});
test.afterEach(() => expect(fehler, 'Fehler im Browser').toEqual([]));

test('Lernpaket aus Material: Anfrage korrekt aufgebaut, Paket erscheint', async ({ page }) => {
  const anfragen = await kiAttrappe(page, async () => {
    const d = await page.evaluate(() => structuredClone(LA.DEMO));
    delete d.id; d.titel = 'KI-Testpaket';
    return d;
  });
  await page.getByRole('button', { name: '+ Neues Lernpaket' }).click();
  await page.locator('#fach').fill('NuT');
  await page.locator('#material').fill('Der Wasserkreislauf wird von der Sonne angetrieben …');
  await page.getByRole('button', { name: 'Lernpaket erstellen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'KI-Testpaket' })).toBeVisible();

  const { body, headers } = anfragen[0];
  // Die SDK 1.x schickt den Schlüssel als Bearer-Token (ältere Versionen als x-api-key)
  expect(headers.authorization || headers['x-api-key']).toMatch(/^(Bearer )?sk-ant-test$/);
  expect(body.model).toBe('claude-opus-5-5');
  expect(body.output_config.format.type).toBe('json_schema');
  expect(body.output_config.effort).toBe('medium');
  expect(body.fallbacks).toBe('default');
  expect(body.system).toContain('Schweizer Hochdeutsch');
  expect(JSON.stringify(body.messages)).toContain('Der Wasserkreislauf wird von der Sonne');
  // Das Schema verlangt alle Teile, die die App braucht
  expect(Object.keys(body.output_config.format.schema.properties)).toEqual(expect.arrayContaining(['kapitel', 'begriffe', 'multiple_choice', 'lueckentexte', 'spiele']));
  // Paket ist in «Meine Pakete»
  await page.getByRole('button', { name: 'Meine Pakete' }).click();
  await expect(page.locator('.karte')).toContainText('KI-Testpaket');
});

test('KI-Fehler werden verständlich angezeigt', async ({ page }) => {
  await page.route('https://api.anthropic.com/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) }));
  await page.getByRole('button', { name: '+ Neues Lernpaket' }).click();
  await page.locator('#material').fill('Text');
  await page.getByRole('button', { name: 'Lernpaket erstellen' }).click();
  await expect(page.locator('.status')).toContainText('API-Schlüssel ungültig');
  // Die absichtlich ausgelöste 401-Antwort meldet der Browser in der Konsole – das ist hier erwartet
  expect(fehler.every((f) => f.includes('status of 401'))).toBe(true);
  fehler.length = 0;
});

test('Textkorrektur, Denkfrage-Bewertung und Nachfrage im Lernpfad', async ({ page }) => {
  const anfragen = await kiAttrappe(page, (body) => {
    const text = body.messages[0].content[0].text;
    if (body.system.includes('korrigierst')) return text.includes('verdunsted')
      ? { korrigierter_text: 'Das Wasser verdunstet.', fehler: [{ original: 'verdunsted', korrektur: 'verdunstet', art: 'Rechtschreibung', erklaerung: 'Verb in der 3. Person' }], staerken: 'Klar.', inhalt: 'Stimmt.', tipp: 'Endungen prüfen.' }
      : { korrigierter_text: 'ok', fehler: [], staerken: 'Klar.', inhalt: 'Stimmt.', tipp: 'Weiter so.' };
    if (body.system.includes('Bewerte')) return text.includes('<ueberarbeitete_fassung>')
      ? { punkte: 3, feedback: 'Jetzt vollständig.', tipp: 'Gut so.', verbesserung: 'Du nennst jetzt die Energiequelle.' }
      : { punkte: 2, feedback: 'Gut erkannt.', tipp: 'Woher kommt die Energie?', verbesserung: '' };
    return { antwort: 'Die **Sonne** liefert die Energie.' };
  });
  await page.getByRole('button', { name: /Demo ansehen/ }).click();

  // Textkorrektur: zuerst nur markiert (ohne Lösung), selbst verbessern, dann mit Lösung
  await spielOeffnen(page, 'Schreiben');
  await page.locator('textarea').fill('Das Wasser verdunsted im Meer und steigt dann auf.');
  await page.getByRole('button', { name: 'Korrigieren lassen' }).click();
  await expect(page.locator('.korr-text mark')).toHaveText(/verdunsted/);
  await expect(page.locator('.korr-liste')).toContainText('Verb in der 3. Person');
  await expect(page.locator('.korr-liste')).not.toContainText('verdunstet');
  await expect(page.getByText('Korrigierte Fassung anzeigen')).toHaveCount(0);
  await page.getByRole('button', { name: 'Überarbeiteten Text prüfen' }).click(); // unverändert: keine neue Anfrage
  await expect(page.locator('.toast').last()).toContainText('Verbessere zuerst');
  expect(anfragen.filter((a) => a.body.system.includes('korrigierst')).length).toBe(1);
  await page.locator('textarea').fill('Das Wasser verdunstet im Meer und steigt dann auf.');
  await page.getByRole('button', { name: 'Überarbeiteten Text prüfen' }).click();
  await expect(page.getByText('Vorher 1 Hinweis, jetzt 0.')).toBeVisible();
  await zurueck(page);

  // Denkfrage: Hinweis ohne Musterantwort → überarbeiten → zweite Bewertung
  await spielOeffnen(page, 'Denkfragen');
  await page.locator('textarea').fill('Weil Wasser verdunstet.');
  await page.getByRole('button', { name: 'Rückmeldung holen' }).click();
  await expect(page.locator('.punkte')).toContainText('2 / 3');
  await expect(page.locator('.ki-antwort')).toContainText('Woher kommt die Energie?');
  await expect(page.locator('.ki-antwort')).not.toContainText('Musterantwort');
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeDisabled();
  await page.locator('textarea').fill('Weil die Sonne das Wasser erwärmt und es verdunstet.');
  await page.getByRole('button', { name: 'Überarbeitete Antwort abgeben' }).click();
  await expect(page.locator('.ki-antwort')).toContainText('1. Fassung: 2 / 3 → überarbeitet: 3 / 3');
  await expect(page.locator('.ki-antwort')).toContainText('Das hast du verbessert: Du nennst jetzt die Energiequelle.');
  await expect(page.locator('.ki-antwort')).toContainText('Musterantwort');
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeEnabled();
  const zweite = anfragen.filter((a) => a.body.system.includes('Bewerte')).at(-1).body.messages[0].content[0].text;
  expect(zweite).toContain('<erste_fassung>\nWeil Wasser verdunstet.');
  await zurueck(page);

  await spielOeffnen(page, 'Lernpfad');
  await page.getByText('Nicht ganz klar? Frag die KI').click();
  await page.locator('.nachfrage input').fill('Warum?');
  await page.locator('.nachfrage .knopf').click();
  await expect(page.locator('.nachfrage .ki-antwort strong')).toHaveText('Sonne');
});
