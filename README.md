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

Die Spiele, die gar nicht zum Inhalt passen (z. B. Reihenfolge ohne Ablauf), erscheinen nicht. Unter «Bearbeiten» kannst du Spiele ein- und ausschalten und jede Frage im JSON ändern.

## Für alle Spiele

- **Vorlesen** 🔊: Erklärungen, Fragen, Aussagen und Aufträge können vorgelesen werden. Das macht der Browser selbst, gratis und ohne KI. Die Stimme hängt vom Gerät ab und ist nicht überall gut. Ein zweiter Klick stoppt.
- **Tippfehler**: Im Lückentext zählen kleine Tippfehler («Verdunstug») als richtig, die korrekte Schreibweise wird aber angezeigt. Kurze Wörter (unter 5 Buchstaben) werden streng geprüft, weil sonst «Mehr» für «Meer» durchginge. Umlaute dürfen als ae/oe/ue geschrieben werden.
- **Kreuzworträtsel**: Ä, Ö, Ü und ß normal tippen, sie werden automatisch auf zwei Felder verteilt (AE, OE, UE, SS).

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

- **Teilen**: erzeugt einen Link, in dem das ganze Paket steckt (Schüleransicht ohne Bearbeiten). Funktioniert nur, wenn die App über eine Webadresse läuft (Docker-Container, siehe unten, oder GitHub Pages), nicht als lokale Datei.
- **Export**: JSON-Datei; Lernende öffnen sie mit «Paket importieren».

## Wichtige Einschränkungen

- **API-Schlüssel ohne Server**: Wenn du die App als Datei öffnest, liegt der Schlüssel im Browser (localStorage) und lässt sich dort auslesen. Trag ihn deshalb nur auf dem eigenen Gerät ein. Für die Klasse ist der Docker-Container gedacht (siehe oben). Ohne KI funktionieren alle Spiele; Denkfragen zeigen dann eine Musterantwort zur Selbsteinschätzung, die Textkorrektur ist deaktiviert.
- **Klassencode** ist ein einfacher Schutz gegen Fremdnutzung, keine echte Anmeldung. Wer ihn kennt, kann die KI nutzen, bis das Stundenlimit erreicht ist. Bei Missbrauch: Code ändern und den Container neu starten.
- **Datenschutz**: Mit KI werden Material und Schülertexte an Anthropic (USA) gesendet. Keine Namen oder anderen Personendaten eingeben und die Vorgaben deiner Schule bzw. des Kantons prüfen.
- **Speicher**: Pakete und Fortschritt liegen nur im jeweiligen Browser. Browserdaten löschen = weg. Wichtige Pakete exportieren.
- **Word-Dateien** (.docx) werden nicht gelesen → als PDF speichern.
- Die KI kann Fehler machen. Pakete vor dem Einsatz durchsehen.

## Betrieb im Docker-Container (empfohlen für die Klasse)

Der Container liefert die App aus und verwahrt den API-Schlüssel. Lernende brauchen keinen eigenen Schlüssel, nur die Adresse und den Klassencode.

```bash
cd container
cp env.beispiel .env        # Schlüssel und Klassencode eintragen
docker compose up -d        # danach: http://localhost:8080
```

Läuft auf allem, was Docker kann: eigener PC, NAS (Synology, QNAP), Raspberry Pi oder ein Mietserver. Damit die Lernenden darauf zugreifen können, muss der Container für ihre Geräte erreichbar sein, z. B. im Schulnetz oder über das Internet mit HTTPS (z. B. über einen Reverse Proxy wie Caddy).

| Variable | Bedeutung |
|---|---|
| `ANTHROPIC_API_KEY` | Dein Schlüssel. Steht nur in `.env` auf dem Server (die Datei ist von Git ausgeschlossen). |
| `KLASSEN_CODE` | Code, den die Lernenden einmal eingeben (oben rechts, «🔑 Klassencode»). Leer = jede Person mit der Adresse kann die KI auf deine Kosten nutzen. |
| `LIMIT_PRO_STUNDE` | KI-Anfragen pro Gerät (IP-Adresse) und Stunde, Standard 60. Achtung: Im Schulnetz teilen sich oft alle Geräte eine IP. Dann für die ganze Klasse grosszügig setzen, z. B. 600. |
| `MODELLE` | Freigegebene Modelle. Das erste ist der Standard, also nimmt man am besten das günstigste zuerst. Die Lehrperson kann in den Einstellungen ein anderes freigegebenes Modell wählen. |

Was der Server erzwingt: nur `/v1/messages`, nur freigegebene Modelle, höchstens 32 000 Ausgabe-Tokens pro Anfrage, Klassencode und Stundenlimit. Der Server-Code selbst wird nicht ausgeliefert.

Ohne Docker geht es auch mit Node.js ab Version 20: `ANTHROPIC_API_KEY=… KLASSEN_CODE=… node server/server.js`.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt. `js/anthropic-sdk-1.5.0.min.js` ist die offizielle Anthropic-SDK (`@anthropic-ai/sdk@1.5.0`), gebündelt für den Browser.

- `js/ki.js` – Prompts, JSON-Schemas (strukturierte Ausgabe), Aufrufe
- `js/spiele.js` – alle Spieltypen
- `js/offline.js` – Generator ohne KI und Demo-Paket
- `js/druck.js` – Arbeitsblatt und Lösungsblatt
- `js/wiederholen.js` – Lernkartei, Wiederholungsrunde, Fehlerheft
- `js/app.js` – Ansichten, Speicher, Teilen
- `server/server.js` – Auslieferung und KI-Weiterleitung mit Schlüssel (ohne Abhängigkeiten)
- `Dockerfile`, `docker-compose.yml`, `env.beispiel`
