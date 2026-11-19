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
  await kiAttrappe(page, (body) => {
    if (body.system.includes('korrigierst')) return { korrigierter_text: 'Das Wasser verdunstet.', fehler: [{ original: 'verdunsted', korrektur: 'verdunstet', art: 'Rechtschreibung', erklaerung: '3. Person: -t' }], staerken: 'Klar.', inhalt: 'Stimmt.', tipp: 'Endungen prüfen.' };
    if (body.system.includes('Bewerte')) return { punkte: 2, feedback: 'Gut erkannt.', tipp: 'Nenne die Energie.' };
    return { antwort: 'Die **Sonne** liefert die Energie.' };
  });
  await page.getByRole('button', { name: /Demo ansehen/ }).click();

  await spielOeffnen(page, 'Schreiben');
  await page.locator('textarea').fill('Das Wasser verdunsted im Meer und steigt dann auf.');
  await page.getByRole('button', { name: 'Korrigieren lassen' }).click();
  await expect(page.locator('.korr-text mark')).toHaveText(/verdunsted/);
  await expect(page.locator('.korr-liste')).toContainText('verdunstet');
  await zurueck(page);

  await spielOeffnen(page, 'Denkfragen');
  await page.locator('textarea').fill('Weil Wasser verdunstet.');
  await page.getByRole('button', { name: 'Rückmeldung holen' }).click();
  await expect(page.locator('.punkte')).toContainText('2 / 3');
  await zurueck(page);

  await spielOeffnen(page, 'Lernpfad');
  await page.getByText('Nicht ganz klar? Frag die KI').click();
  await page.locator('.nachfrage input').fill('Warum?');
  await page.locator('.nachfrage .knopf').click();
  await expect(page.locator('.nachfrage .ki-antwort strong')).toHaveText('Sonne');
});
