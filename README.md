# Lernwerkstatt – aus Material wird eine Lern-App

Du gibst Unterrichtsmaterial hinein (Text, PDF, Foto eines Arbeitsblatts). Die KI (Claude von Anthropic) erstellt daraus ein **Lernpaket**:

1. **Lernpfad**: Erklärungen in 2–6 Schritten, mit Beispiel, Merksatz und einer Verständnisfrage pro Schritt. Wer etwas nicht versteht, kann der KI direkt eine Frage stellen.
2. **Übungen**: Die KI wählt passend zum Material 5–8 Spieltypen aus:

| Spiel | sinnvoll bei |
|---|---|
| Multiple Choice | fast immer |
| Lückentext | Fachtexte, Sprachfächer |
| Memory | viele Fachbegriffe |
| Kreuzworträtsel | Fachbegriffe aus einem Wort (wird automatisch gebaut) |
| Wahr oder falsch | Fakten, Fehlvorstellungen |
| Reihenfolge | Prozesse, Abläufe, Zeitfolgen |
| Zuordnen | Begriffe in Gruppen |
| Denkfragen | Begründen, Anwenden – die KI bewertet die Antwort (0–3 Punkte) |
| Schreiben & Korrektur | Schreibauftrag – die KI markiert Fehler und erklärt die Regel |

Die Spiele, die gar nicht zum Inhalt passen (z. B. Reihenfolge ohne Ablauf), erscheinen nicht. Unter «Bearbeiten» kannst du Spiele ein- und ausschalten und jede Frage ändern (siehe unten).

## Für alle Spiele

- **Vorlesen** 🔊: Erklärungen, Fragen, Aussagen und Aufträge können vorgelesen werden. Das macht der Browser selbst, gratis und ohne KI. Die Stimme hängt vom Gerät ab und ist nicht überall gut. Ein zweiter Klick stoppt.
- **Tippfehler**: Im Lückentext zählen kleine Tippfehler («Verdunstug») als richtig, die korrekte Schreibweise wird aber angezeigt. Kurze Wörter (unter 5 Buchstaben) werden streng geprüft, weil sonst «Mehr» für «Meer» durchginge. Umlaute dürfen als ae/oe/ue geschrieben werden.
- **Kreuzworträtsel**: Ä, Ö, Ü und ß normal tippen, sie werden automatisch auf zwei Felder verteilt (AE, OE, UE, SS).

## Bearbeiten

Unter **Bearbeiten** lässt sich jedes Element einzeln ändern, verschieben (▲▼), löschen oder hinzufügen: Lernschritte, Fachbegriffe, Multiple Choice, Lückentexte, Wahr/Falsch, Reihenfolgen, Denkfragen und Schreibauftrag.

- **Multiple Choice:** die richtige Antwort per Klick auf den Punkt davor wählen.
- **Lückentext:** Wort im Text markieren und «Markiertes Wort zur Lücke machen» drücken.
- **✨ Mit KI neu erzeugen:** ersetzt ein einzelnes Element, optional mit Wunsch («einfacher», «andere Falschantworten»). **✨ Mit KI hinzufügen** erstellt ein zusätzliches Element. Neu erzeugte Elemente sind grün umrandet. Erst «Speichern» übernimmt sie.
- **Unvollständige Einträge** (Frage ohne Text, Lückentext ohne Lücke …) werden beim Speichern nach Rückfrage entfernt.
- **Lernkartei:** Verschobene Fragen behalten ihren Lernstand. Gelöschte und neu erzeugte Fragen beginnen neu. Wird ein Lückentext verändert, beginnen seine Lücken neu.
- Für Fortgeschrittene gibt es weiterhin alles als JSON. Das Übernehmen setzt dort den Lernstand zurück.

## Niveaus

Ein Paket kann es in drei Fassungen geben: **Niveau 1 ●** (grundlegend: einfache Sprache, weniger Stoff, mehr Beispiele), **Niveau 2 ●●** (mittel) und **Niveau 3 ●●●** (erweitert: Fachsprache, Transfer- und Begründungsaufgaben). Thema und Kernbegriffe bleiben gleich, damit die Klasse gemeinsam am selben Thema arbeitet.

- **Erzeugen:** beim Erstellen «Gleich in drei Niveaus erstellen» ankreuzen, oder bei einem bestehenden Paket «Niveaus erzeugen». Dieses wird dann Niveau 2, die KI schreibt es für 1 und 3 um. Das kostet etwa doppelt so viel wie ein neues Paket.
- **Umschalten** in der Paketübersicht. In «Meine Pakete» erscheint die Gruppe als eine Karte.
- **Teilen:** «Alle Niveaus» (die Lernenden wählen selbst, die App merkt sich die Wahl) oder gezielt ein einzelnes Niveau.
- Jedes Niveau ist ein eigenes Paket mit eigener Lernkartei, eigenem Bearbeiten und eigenem Druck (das Niveau steht im Kopf des Arbeitsblatts).
- In der Schüleransicht stehen nur «Niveau 1 / 2 / 3», ohne «grundlegend» oder «erweitert».
- Die KI-Fassungen bitte durchsehen. Ob die Niveaus für deine Klasse passend abgestuft sind, kann nur der Einsatz zeigen.

## Flow-Training (passt sich an)

**🎯 Flow-Training** mischt Fragen aus allen Spielen und wählt jede nächste Frage so, dass sie mit etwa 80 % Wahrscheinlichkeit gelöst wird. Das ist dasselbe Modell wie im Flow-Trainer (Elo/Rasch):

- Die lernende Person hat ein **Können** (Stufe 1–10), jede Frage eine **Schwierigkeit**. Nach jeder Antwort rücken beide nach: Wer richtig antwortet, steigt, und eine Frage, die oft falsch beantwortet wird, gilt danach als schwerer.
- Wie im Flow-Trainer gilt: Nach zwei Fehlern kommt eine leichtere Frage, nach fünf richtigen eine schwerere, und jede siebte Frage ist eine **⚡ Herausforderung**. Die Anzeige zeigt die Flow-Zone (70–90 % richtig in den letzten 10 Antworten).
- **Die Schwierigkeit einer Frage schätzt die App zu Beginn** aus dem Aufgabentyp (Wahr/Falsch leicht, Begriff selbst eintippen schwer), aus der Einschätzung der KI (1–5, im Editor änderbar) und aus dem Niveau des Pakets.
- **Mit Niveaus** zieht das Flow-Training Fragen aus allen drei Niveaus. Die Lernenden wandern so automatisch dorthin, wo es für sie passt. Nach mindestens 10 Antworten zeigt die Übersicht mit ★ an, welches Niveau gerade passt.
- Die Antworten fliessen auch in die Lernkartei.
- Eine Runde hat 12 Fragen. Wer unter 50 % bleibt, bekommt den Hinweis, zuerst den Lernpfad nochmals anzuschauen.

Grenzen: Die App kann keine leichteren oder schwereren Fragen erfinden, als im Paket stehen. Ganz schwache oder ganz starke Lernende stossen deshalb an den Rand des Fragenvorrats. Pakete mit drei Niveaus haben dafür die grösste Spannweite. Die Schätzung des Könnens gilt pro Gerät und pro Paket bzw. Niveau-Gruppe. In einer Simulation mit virtuellen Lernenden (siehe `tests/unit/flow.test.js`) lag die Schätzung im Schnitt 3–4 Punkte neben dem wahren Können (Skala 0–100), die Erfolgsquote bei 75–80 %. Wie gut das mit echten Klassen funktioniert, ist nicht geprüft.

## Gezielt wiederholen (Lernkartei)

Jede Antwort aus Lernpfad, Multiple Choice, Wahr/Falsch, Lückentext, Kreuzworträtsel und Zuordnen landet in einer Lernkartei mit 5 Fächern (Leitner-System):

| Fach | wieder fällig nach |
|---|---|
| 1 (falsch beantwortet) | sofort, noch in derselben Runde |
| 2 | 1 Tag |
| 3 | 3 Tagen |
| 4 | 7 Tagen |
| 5 (gelernt) | 16 Tagen |

- Richtig, wenn die Karte fällig ist → ein Fach weiter. Falsch → zurück in Fach 1.
- Richtige Antworten vor dem Fälligkeitstag schieben eine Karte nicht weiter. Wer am selben Tag fünfmal dasselbe übt, hat sie deshalb nicht «gelernt».
- In der Paketübersicht steht **«Heute zuerst: Wiederholen»**, sobald Karten fällig sind, und auf der Startseite erscheint «🔁 fällig».
- In der Wiederholung wird abgefragt, nicht wiedererkannt, wo es geht: zum Beispiel «Welcher Fachbegriff ist gemeint?» mit Eingabefeld, mit Tipp-Knopf (Anfangsbuchstabe).
- Das **Fehlerheft** zeigt alles, was einmal falsch war, mit Lösung und Fach.
- Nicht in der Kartei: Memory (dort geht es um Kartenpositionen), Reihenfolge (eine Aufgabe als Ganzes) und Denkfragen.
- Der Lernstand liegt im Browser des Geräts. Wer das Gerät wechselt, fängt neu an.

## Arbeitsblatt drucken

In der Paketübersicht auf **Drucken**: Teile auswählen, dann im Druckdialog drucken oder «Als PDF speichern». Es entsteht ein A4-Blatt mit Namensfeld und ein Lösungsblatt auf einer neuen Seite. Memory wird auf Papier zu «Begriffe verbinden». Die Reihenfolge der Antworten wird bei jedem Druck neu gemischt, das Lösungsblatt passt immer zum Blatt aus demselben Druckvorgang.

## Starten

- `index.html` doppelklicken. Es braucht keinen Server und keine Installation.
- Ohne Schlüssel: **Demo** (Wasserkreislauf) ansehen oder im Modus **«Ohne KI»** eine Begriffsliste (`Begriff: Erklärung`) eingeben.
- Mit KI: unter **Einstellungen** einen Claude-API-Schlüssel eintragen (console.anthropic.com → Guthaben laden → API Keys).

## Kosten (Schätzung, nicht gemessen)

| Modell | ein Lernpaket |
|---|---|
| Claude Opus 5.5 (Standard) | ca. 0.20–0.40 USD |
| Claude Sonnet 5.5 | ca. 0.10–0.20 USD |
| Claude Haiku 5.5 | unter 0.01 USD |

Eine Bewertung oder Textkorrektur kostet einen Bruchteil davon. Die echten Kosten siehst du in der Anthropic-Konsole.

## An die Klasse weitergeben

**Kurzlink mit QR-Code (empfohlen):** In der Paketübersicht «Teilen» → «Kurzlink mit QR-Code erstellen». Du bekommst einen kurzen Link wie `…/#p=k7m2xq9` und einen QR-Code. «QR gross für Beamer» zeigt ihn bildschirmfüllend, die Klasse scannt ihn mit dem Handy oder Tablet.

- Bei Paketen mit Niveaus: «Alle Niveaus» (die Lernenden wählen selbst) oder je Niveau ein eigener Kurzlink.
- **Korrekturen kommen an:** Speicherst du das Paket später im Editor, wird der Inhalt hinter dem Kurzlink automatisch ersetzt. Das klappt nur aus dem Browser, in dem du den Kurzlink erstellt hast (dort liegt der Bearbeitungsschlüssel).
- Die Lernenden sollten den Link als Lesezeichen speichern. Lernkartei und Flow-Stufe bleiben auf ihrem Gerät erhalten.
- Gespeichert wird das Paket in Supabase (Tabelle `lw_pakete`, gleiches Projekt wie die Auswertung). Abrufen kann es nur, wer den Code kennt. Eine Liste aller Pakete gibt es nicht. Der Bearbeitungsschlüssel liegt dort nur als Prüfsumme. **Nur für Unterrichtsmaterial ohne Namen oder Persönliches.**
- Ohne Internet öffnet ein bereits einmal geladener Kurzlink die zuletzt gespeicherte Fassung.

**Langer Link (ohne Datenbank):** im selben Dialog unter «Langer Link ohne Datenbank». Das ganze Paket steckt im Link, nichts wird gespeichert, spätere Änderungen kommen nicht an. Lange Links können von manchen Programmen abgeschnitten werden.

**Export:** JSON-Datei, die Lernenden öffnen sie mit «Paket importieren».

## Wichtige Einschränkungen

- **API-Schlüssel ohne Server**: Wenn du die App als Datei öffnest, liegt der Schlüssel im Browser (localStorage) und lässt sich dort auslesen. Trag ihn deshalb nur auf dem eigenen Gerät ein. Für die Klasse ist der Docker-Container gedacht (siehe oben). Ohne KI funktionieren alle Spiele; Denkfragen zeigen dann eine Musterantwort zur Selbsteinschätzung, die Textkorrektur ist deaktiviert.
- **Klassencode** ist ein einfacher Schutz gegen Fremdnutzung, keine echte Anmeldung. Wer ihn kennt, kann die KI nutzen, bis das Stundenlimit erreicht ist. Bei Missbrauch: Code ändern und den Container neu starten.
- **Datenschutz**: Mit KI werden Material und Schülertexte an Anthropic (USA) gesendet. Keine Namen oder anderen Personendaten eingeben und die Vorgaben deiner Schule bzw. des Kantons prüfen.
- **Speicher**: Pakete und Fortschritt liegen nur im jeweiligen Browser (die Auswertung zählt zusätzlich anonym, siehe oben). Browserdaten löschen = weg. Wichtige Pakete exportieren.
- **Word-Dateien** (.docx) werden nicht gelesen → als PDF speichern.
- Die KI kann Fehler machen. Pakete vor dem Einsatz durchsehen.

## Betrieb im Docker-Container (empfohlen für die Klasse)

Der Container liefert die App aus und verwahrt den API-Schlüssel. Lernende brauchen keinen eigenen Schlüssel, nur die Adresse und den Klassencode.

```bash
cd container
cp env.beispiel .env        # Schlüssel und Klassencode eintragen
docker compose up -d        # danach: http://localhost:8080
```

Läuft auf allem, was Docker kann: eigener PC, NAS (Synology, QNAP), Raspberry Pi oder ein Mietserver. So gestartet ist die App nur über `http://` erreichbar. Das reicht zum Ausprobieren und im eigenen Netz. Für den Zugriff über das Internet siehe «Über das Internet erreichbar machen (HTTPS)».

| Variable | Bedeutung |
|---|---|
| `ANTHROPIC_API_KEY` | Dein Schlüssel. Steht nur in `.env` auf dem Server (die Datei ist von Git ausgeschlossen). |
| `KLASSEN_CODE` | Code, den die Lernenden einmal eingeben (oben rechts, «🔑 Klassencode»). Leer = jede Person mit der Adresse kann die KI auf deine Kosten nutzen. |
| `LIMIT_PRO_STUNDE` | KI-Anfragen pro Gerät (IP-Adresse) und Stunde, Standard 60. Achtung: Im Schulnetz teilen sich oft alle Geräte eine IP. Dann für die ganze Klasse grosszügig setzen, z. B. 600. |
| `MODELLE` | Freigegebene Modelle. Das erste ist der Standard, also nimmt man am besten das günstigste zuerst. Die Lehrperson kann in den Einstellungen ein anderes freigegebenes Modell wählen. |

Was der Server erzwingt: nur `/v1/messages`, nur freigegebene Modelle, höchstens 32 000 Ausgabe-Tokens pro Anfrage, Klassencode und Stundenlimit. Der Server-Code selbst wird nicht ausgeliefert.

Ohne Docker geht es auch mit Node.js ab Version 20: `ANTHROPIC_API_KEY=… KLASSEN_CODE=… node server/server.js`.

## Auswertung für Lehrpersonen (anonym)

Unter **📊 Auswertung** auf der Startseite (oder direkt `…/#auswertung`) steht pro Paket eine Tabelle: jede Frage mit der Anzahl **richtig**, **falsch**, dem **Anteil falsch** und wie oft sie in der **Wiederholung** (Lernkartei) dran war. Die schwierigsten Fragen stehen oben. Filter nach Paket, Suche, Mindestanzahl Antworten und Export als CSV (Excel). In der Paketübersicht zeigt «Auswertung» nur dieses Paket (mit allen Niveaus).

- **Anonym:** Gezählt werden nur Summen pro Frage. Es werden keine Namen, keine Geräte-Kennung und keine Zeitpunkte pro Person gespeichert. Supabase protokolliert wie jeder Webdienst technische Zugriffe (z. B. IP-Adressen) in seinen Server-Logs. Die App selbst speichert sie nicht.
- **Öffentlich:** Jede Person mit der Adresse kann die Auswertung ansehen.
- **Speicher:** Supabase-Projekt «Leistungs App», Tabelle `lw_statistik` (getrennt von den Naturalia-Tabellen). Lesen ist für alle erlaubt, Schreiben nur über die Datenbank-Funktion `lw_statistik_melden`, die ausschliesslich hochzählt.
- **Was zählt:** Lernpfad, Multiple Choice, Wahr/Falsch, Lückentext, Kreuzworträtsel, Zuordnen, Wiederholen und Flow-Training. Nicht gezählt werden die Demo, Memory, Reihenfolge, Denkfragen und Schreibaufträge.
- **Eigene Tests:** In den Einstellungen lässt sich das Zählen pro Gerät ausschalten. Auf `localhost` ist es standardmässig aus.
- **Bearbeitete Fragen:** Die Statistik erkennt eine Frage an ihrem Text. Verschieben ändert nichts, eine umformulierte Frage beginnt mit einer neuen Zeile.
- **Grenze:** Da das Melden ohne Anmeldung funktionieren muss, könnte jemand mit Absicht falsche Zähler einschicken. Für eine Übersicht im Unterricht reicht das, für Noten ist die Auswertung nicht gedacht.
- **Abschalten:** in `js/statistik.js` bei `LA.STATISTIK` die Werte leeren. **Zurücksetzen** (z. B. zum Schuljahresbeginn): in Supabase im SQL Editor `delete from public.lw_statistik;`

## Online mit Vercel (ohne eigenen Server, Schlüssel bleibt geheim)

Vercel liefert die App aus und führt die kleine Weiterleitung als Server-Funktion aus (`api/`). Der API-Schlüssel liegt als geschützte Umgebungsvariable bei Vercel, nicht im Browser. HTTPS ist automatisch dabei.

1. Bei vercel.com das GitHub-Repository `Container` als Projekt importieren. Einstellungen: «Framework Preset: Other», sonst nichts ändern.
2. Unter **Settings → Environment Variables** eintragen:
   - `ANTHROPIC_API_KEY`: ein eigener Schlüssel nur für diese App (als «Sensitive» markieren)
   - `KLASSEN_CODE`: Pflicht. Ohne Code schaltet die App die KI auf Vercel ab, weil die Adresse öffentlich ist.
   - optional `MODELLE` (z. B. `claude-haiku-5-5,claude-opus-5-5`, das erste ist der Standard) und `LIMIT_PRO_STUNDE`
3. Danach einmal neu veröffentlichen (Deployments → «Redeploy»), damit die Variablen gelten.

Jeder Push auf `main` aktualisiert die Seite automatisch. Pushes auf andere Branches erzeugen Vorschau-Adressen.

Grenzen auf Vercel:
- **Material höchstens ca. 4 MB pro Anfrage** (grosse PDFs verkleinern oder nur die nötigen Seiten nehmen). Die App warnt vorher.
- **Das Stundenlimit ist nur ein grober Schutz.** Vercel startet bei Bedarf mehrere Instanzen, und jede zählt für sich. Wirklich begrenzen lassen sich die Kosten mit einem **Ausgabenlimit in der Anthropic-Konsole** für den verwendeten Schlüssel bzw. Workspace. Das unbedingt einrichten.
- Die Funktion darf bis zu 300 Sekunden laufen (`vercel.json`). Falls dein Vercel-Plan weniger erlaubt, zeigt Vercel das beim Veröffentlichen an.
- Der Gratis-Plan von Vercel ist laut Vercel für persönliche, nicht kommerzielle Nutzung gedacht. Ob das für deinen Einsatz passt, bitte selbst prüfen.

Container und Vercel nutzen dieselbe Prüflogik (`server/kern.cjs`): Klassencode, freigegebene Modelle, Token-Grenze und Limit.

## Über das Internet erreichbar machen (HTTPS)

Ohne HTTPS gehen Klassencode und Schülertexte unverschlüsselt durchs Netz. Für den Zugriff von ausserhalb des eigenen Netzes deshalb immer die HTTPS-Variante nehmen:

```bash
cp env.beispiel .env      # Schlüssel, Klassencode und DOMAIN eintragen
docker compose -f docker-compose.https.yml up -d
```

Davor steht dann **Caddy**: Es holt das Zertifikat bei Let's Encrypt automatisch, erneuert es selbst und leitet `http://` auf `https://` um. Die App selbst ist dabei nicht mehr direkt erreichbar, nur noch über Caddy.

Was du brauchst:

1. **Eine Domain oder Subdomain**, die auf den Rechner zeigt (DNS-Eintrag Typ A auf seine öffentliche IP), z. B. `lernen.deine-domain.ch`. Bei einem Mietserver bekommst du die IP vom Anbieter.
2. **Offene Ports 80 und 443.** Zu Hause oder in der Schule muss der Router sie an den Rechner weiterleiten. Im Schulnetz entscheidet das die Informatik der Schule, nicht du.
3. Beim ersten Start einige Sekunden Geduld, bis das Zertifikat da ist. Falls es nicht klappt: `docker compose -f docker-compose.https.yml logs caddy` zeigt den Grund (meist DNS noch nicht aktiv oder Port 80 zu).

Ausprobieren ohne Domain: `DOMAIN=localhost` erzeugt ein lokales Zertifikat. Der Browser warnt dann, das ist dort normal.

Hinter Caddy liest der Server die echte Absender-Adresse aus dem Header `X-Forwarded-For` (Variable `PROXY_VERTRAUEN=1`, in der HTTPS-Datei schon gesetzt). Ohne Proxy davor bleibt das aus. Sonst könnte jemand den Header fälschen und so das Stundenlimit umgehen.

## Tests

```bash
npm install                          # einmalig
npx playwright install chromium      # einmalig, lädt den Test-Browser
npm test                             # alles
npm run test:logik                   # nur die schnellen Tests (ohne Browser, ca. 1 s)
npm run test:browser                 # nur die Browser-Tests (ca. 10 s)
```

- **Logik und Server** (`tests/unit/`): Tippfehler-Erkennung, Kreuzworträtsel-Bau (keine ungewollten Buchstabenreihen), Begriffsliste, Lernkartei (Fächer, Fälligkeit, kein Befördern durch Pauken), Paketprüfung sowie der Schlüssel-Server (Klassencode, Modelle, Token-Grenze, Stundenlimit, kein Zugriff auf fremde Dateien, Schlüssel aus dem Browser wird nicht weitergegeben).
- **Browser** (`tests/e2e/`): alle Spiele, Paket ohne KI, Teilen-Link, Bearbeiten, Lernkartei, Druckversion, Handyansicht. Die KI wird dabei simuliert. Die Tests kosten also nichts und brauchen keinen Schlüssel.
- Auf GitHub laufen die Tests bei jedem Push automatisch (Reiter «Actions»), zusätzlich wird das Docker-Image gebaut und gestartet.
- Nicht getestet wird die echte KI: ob ihre Pakete inhaltlich gut sind, lässt sich nur von Hand beurteilen.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt. `js/anthropic-sdk-1.5.0.min.js` ist die offizielle Anthropic-SDK (`@anthropic-ai/sdk@1.5.0`), gebündelt für den Browser.

- `js/ki.js` – Prompts, JSON-Schemas (strukturierte Ausgabe), Aufrufe
- `js/spiele.js` – alle Spieltypen
- `js/offline.js` – Generator ohne KI und Demo-Paket
- `js/druck.js` – Arbeitsblatt und Lösungsblatt
- `js/wiederholen.js` – Lernkartei, Wiederholungsrunde, Fehlerheft
- `js/editor.js` – Bearbeiten ohne JSON, Elemente mit KI neu erzeugen
- `js/flow.js` – Flow-Training (adaptives Modell)
- `js/statistik.js` – anonyme Zählung und Auswertung für Lehrpersonen
- `js/kurzlink.js`, `js/vendor/qrcode.js` – Kurzlinks und QR-Code (QR Code Generator von Kazuhiko Arase, MIT-Lizenz)
- `js/app.js` – Ansichten, Speicher, Teilen
- `server/server.js` – Auslieferung und KI-Weiterleitung mit Schlüssel (ohne Abhängigkeiten)
- `Dockerfile`, `docker-compose.yml`, `env.beispiel`
- `docker-compose.https.yml`, `Caddyfile` – Variante mit HTTPS
- `api/`, `vercel.json` – Variante für Vercel
- `server/kern.cjs` – gemeinsame Prüf- und Weiterleitungslogik (Container und Vercel)
