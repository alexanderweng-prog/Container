/* Lernpaket ohne KI: aus einer Begriffsliste + optionalem Text. Plus ein Demo-Paket. */
(function (LA) {
  // Zeilen wie "Begriff: Erklärung", "Begriff - Erklärung", "Begriff = Erklärung" oder "Kategorie > Begriff: Erklärung"
  LA.begriffslisteLesen = function (roh) {
    const liste = [];
    for (const zeile of String(roh || '').split(/\n/)) {
      const m = zeile.match(/^\s*(?:([^>:=–—]+?)\s*>\s*)?([^:=–—\t]+?)\s*(?::|=|\t|\s[-–—]\s)\s*(.+)$/);
      if (m && m[2].trim().length <= 40 && m[3].trim().length > 2) {
        liste.push({ begriff: m[2].trim(), erklaerung: m[3].trim(), kategorie: (m[1] || '').trim() });
      }
    }
    return liste;
  };

  LA.offlinePaket = function ({ titel, begriffsliste, text, stufe }) {
    const begriffe = LA.begriffslisteLesen(begriffsliste);
    if (begriffe.length < 4) throw new Error('Für den Modus ohne KI braucht es mindestens 4 Zeilen der Form "Begriff: Erklärung".');

    // Multiple Choice: zu welcher Erklärung gehört der Begriff?
    const multiple_choice = begriffe.map((b) => {
      const falsch = LA.mischen(begriffe.filter((x) => x !== b)).slice(0, 3).map((x) => x.begriff);
      const optionen = LA.mischen([b.begriff, ...falsch]);
      return { frage: `Welcher Begriff passt? «${b.erklaerung}»`, optionen, richtig: optionen.indexOf(b.begriff), erklaerung: `${b.begriff}: ${b.erklaerung}` };
    });

    // Wahr/Falsch: richtige und vertauschte Paare
    const wahr_falsch = LA.mischen(begriffe).slice(0, 8).map((b, i) => {
      if (i % 2 === 0) return { aussage: `${b.begriff} bedeutet: ${b.erklaerung}`, wahr: true, erklaerung: 'Stimmt.' };
      const anders = begriffe.find((x) => x !== b && x.erklaerung !== b.erklaerung) || b;
      return { aussage: `${b.begriff} bedeutet: ${anders.erklaerung}`, wahr: anders === b, erklaerung: `${b.begriff} bedeutet: ${b.erklaerung}` };
    });

    // Lückentext: im eigenen Text alle Begriffe ausblenden; sonst aus den Erklärungen
    const lueckentexte = [];
    if (text && text.trim()) {
      let t = text.trim(), anzahl = 0;
      for (const b of begriffe.slice().sort((a, c) => c.begriff.length - a.begriff.length)) {
        const re = new RegExp('(^|[^\\p{L}{])(' + b.begriff.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=[^\\p{L}}]|$)', 'u');
        if (re.test(t)) { t = t.replace(re, '$1{{$2}}'); anzahl++; }
      }
      if (anzahl >= 2) lueckentexte.push({ titel: titel || 'Lückentext', text: t });
    }
    if (!lueckentexte.length) {
      lueckentexte.push({ titel: 'Begriffe einsetzen', text: LA.mischen(begriffe).slice(0, 8).map((b) => `{{${b.begriff}}}: ${b.erklaerung}.`).join('\n') });
    }

    const kapitel = [];
    if (text && text.trim()) {
      const absaetze = text.trim().split(/\n\s*\n/).filter((a) => a.trim().length > 40);
      absaetze.slice(0, 6).forEach((a, i) => {
        const imText = begriffe.filter((b) => a.toLowerCase().includes(b.begriff.toLowerCase()));
        const b = imText[0] || begriffe[i % begriffe.length];
        const falsch = LA.mischen(begriffe.filter((x) => x !== b)).slice(0, 2).map((x) => x.erklaerung);
        const optionen = LA.mischen([b.erklaerung, ...falsch]);
        kapitel.push({
          titel: `Teil ${i + 1}`, erklaerung: a.trim(), beispiel: '', merksatz: `${b.begriff}: ${b.erklaerung}`,
          check: { frage: `Was bedeutet «${b.begriff}»?`, optionen, richtig: optionen.indexOf(b.erklaerung), erklaerung: `${b.begriff}: ${b.erklaerung}` },
        });
      });
    }
    if (!kapitel.length) {
      kapitel.push({ titel: 'Die Begriffe', erklaerung: begriffe.map((b) => `- **${b.begriff}**: ${b.erklaerung}`).join('\n'), beispiel: '', merksatz: 'Lies alle Begriffe zweimal, bevor du übst.', check: multiple_choice[0] });
    }

    const kategorien = new Set(begriffe.map((b) => b.kategorie).filter(Boolean));
    const spiele = ['lernpfad', 'multiple_choice', 'memory', 'lueckentext', 'wahr_falsch'];
    if (begriffe.filter((b) => LA.kreuzwortForm(b.begriff).length >= 3 && !/\s/.test(b.begriff.trim())).length >= 5) spiele.push('kreuzwort');
    if (kategorien.size >= 2) spiele.push('zuordnen');

    return LA.paketPruefen({
      id: LA.id(), quelle: 'offline', erstellt: new Date().toISOString(),
      titel: titel || 'Begriffe üben', fach: '', stufe: stufe || '', kurzbeschreibung: `${begriffe.length} Begriffe, ohne KI erstellt.`,
      spiele, spiele_begruendung: 'Automatisch aus der Begriffsliste erzeugt (ohne KI).',
      kapitel, begriffe, multiple_choice: LA.mischen(multiple_choice).slice(0, 10), lueckentexte, wahr_falsch,
      reihenfolgen: [], offene_fragen: [], schreibauftrag: { aufgabe: '', hinweise: '' },
    });
  };

  // Demo, damit man die App ohne Schlüssel ausprobieren kann
  LA.DEMO = {
    id: 'demo-wasserkreislauf', quelle: 'demo', erstellt: '2026-11-19T00:00:00Z',
    titel: 'Der Wasserkreislauf', fach: 'NuT', stufe: 'Sek I (7.–9. Klasse)',
    kurzbeschreibung: 'Wie Wasser zwischen Meer, Luft und Land zirkuliert – mit Aggregatzuständen und Energie.',
    spiele: ['lernpfad', 'multiple_choice', 'reihenfolge', 'kreuzwort', 'memory', 'zuordnen', 'lueckentext', 'wahr_falsch', 'offene_fragen', 'textkorrektur'],
    spiele_begruendung: 'Der Wasserkreislauf ist ein Prozess (Reihenfolge) mit vielen Fachbegriffen (Memory, Kreuzworträtsel), die sich nach Aggregatzustand-Übergang und Ort ordnen lassen (Zuordnen).',
    kapitel: [
      { titel: 'Wasser ist immer unterwegs', erklaerung: 'Das Wasser auf der Erde geht nicht verloren. Es bewegt sich in einem **Kreislauf** zwischen Meer, Luft und Land. Angetrieben wird dieser Kreislauf von der **Sonne**: Ihre Energie erwärmt das Wasser.\n- Rund 97 % des Wassers ist Salzwasser im Meer.\n- Nur ein kleiner Teil ist Süsswasser, und davon ist das meiste als Eis gebunden.', beispiel: 'Das Wasser, das du heute trinkst, war vielleicht vor 1000 Jahren in einem Gletscher.', merksatz: 'Die Sonne treibt den Wasserkreislauf an; das Wasser geht dabei nicht verloren.', check: { frage: 'Was treibt den Wasserkreislauf an?', optionen: ['Der Wind', 'Die Sonne', 'Der Mond', 'Die Erdanziehung allein'], richtig: 1, erklaerung: 'Die Sonnenenergie lässt Wasser verdunsten – ohne sie gäbe es keinen Kreislauf.' } },
      { titel: 'Verdunsten und Kondensieren', erklaerung: 'Wenn Wasser Energie aufnimmt, wird es zu unsichtbarem **Wasserdampf**: Es **verdunstet**. Der Dampf steigt mit warmer Luft auf. In der Höhe ist es kälter. Dort gibt der Dampf Energie ab und wird wieder zu winzigen Tröpfchen: Er **kondensiert**. Viele Tröpfchen zusammen sehen wir als **Wolke**.', beispiel: 'Eine kalte Flasche aus dem Kühlschrank wird aussen nass: Wasserdampf aus der Luft kondensiert an ihr.', merksatz: 'Verdunsten braucht Energie, Kondensieren gibt Energie ab.', check: { frage: 'Warum beschlägt eine kalte Flasche?', optionen: ['Wasser dringt durch das Glas', 'Wasserdampf aus der Luft kondensiert an der kalten Oberfläche', 'Die Flasche schwitzt wie ein Mensch', 'Das Wasser in der Flasche verdunstet'], richtig: 1, erklaerung: 'Die Luft kühlt an der Flasche ab, der Dampf wird wieder flüssig.' } },
      { titel: 'Niederschlag und Abfluss', erklaerung: 'Werden die Tröpfchen in der Wolke zu schwer, fallen sie als **Niederschlag** zur Erde: als Regen, Schnee oder Hagel. Ein Teil fliesst über Bäche und Flüsse zurück ins Meer (**Abfluss**). Ein anderer Teil **versickert** im Boden und wird zu **Grundwasser**. Pflanzen nehmen Wasser auf und geben es über die Blätter wieder ab.', beispiel: 'Das Thurgauer Trinkwasser stammt zu einem grossen Teil aus Grundwasser und dem Bodensee.', merksatz: 'Niederschlag fliesst ab, versickert oder verdunstet wieder.', check: { frage: 'Wie entsteht Grundwasser?', optionen: ['Meerwasser fliesst unter das Land', 'Regenwasser versickert im Boden', 'Wolken sinken auf den Boden', 'Gletscher schmelzen unterirdisch'], richtig: 1, erklaerung: 'Regen versickert durch den Boden und sammelt sich über undurchlässigen Schichten.' } },
    ],
    begriffe: [
      { begriff: 'Verdunstung', erklaerung: 'Flüssiges Wasser wird unter dem Siedepunkt zu Dampf', kategorie: 'Übergang' },
      { begriff: 'Kondensation', erklaerung: 'Dampf kühlt ab und wird wieder flüssig', kategorie: 'Übergang' },
      { begriff: 'Niederschlag', erklaerung: 'Regen, Schnee oder Hagel fällt zur Erde', kategorie: 'Übergang' },
      { begriff: 'Versickerung', erklaerung: 'Wasser dringt in den Boden ein', kategorie: 'Übergang' },
      { begriff: 'Grundwasser', erklaerung: 'Wasser, das sich im Boden sammelt', kategorie: 'Ort' },
      { begriff: 'Wolke', erklaerung: 'Sichtbare Ansammlung winziger Wassertröpfchen', kategorie: 'Ort' },
      { begriff: 'Gletscher', erklaerung: 'Langsam fliessende Masse aus Eis', kategorie: 'Ort' },
      { begriff: 'Meer', erklaerung: 'Grösster Wasserspeicher der Erde, salzig', kategorie: 'Ort' },
      { begriff: 'Wasserdampf', erklaerung: 'Unsichtbares, gasförmiges Wasser', kategorie: 'Zustand' },
      { begriff: 'Eis', erklaerung: 'Fester Zustand des Wassers', kategorie: 'Zustand' },
    ],
    multiple_choice: [
      { frage: 'Welcher Vorgang braucht Energie?', optionen: ['Kondensieren', 'Gefrieren', 'Verdunsten', 'Niederschlag'], richtig: 2, erklaerung: 'Beim Verdunsten nimmt Wasser Energie auf.' },
      { frage: 'Woraus bestehen Wolken?', optionen: ['Aus Wasserdampf', 'Aus winzigen Wassertröpfchen oder Eiskristallen', 'Aus Rauch', 'Aus warmer Luft'], richtig: 1, erklaerung: 'Wasserdampf ist unsichtbar – Wolken sind bereits kondensiertes Wasser.' },
      { frage: 'Wie viel Prozent des Wassers auf der Erde ist ungefähr Salzwasser?', optionen: ['50 %', '75 %', '97 %', '10 %'], richtig: 2, erklaerung: 'Rund 97 % ist Salzwasser im Meer.' },
      { frage: 'Was passiert mit Regen auf einer asphaltierten Strasse?', optionen: ['Er versickert sofort', 'Er fliesst grösstenteils ab', 'Er wird zu Grundwasser', 'Er gefriert'], richtig: 1, erklaerung: 'Asphalt ist undurchlässig, darum fliesst das Wasser ab.' },
      { frage: 'Warum kondensiert Wasserdampf in der Höhe?', optionen: ['Weil die Luft dort kälter ist', 'Weil dort mehr Sauerstoff ist', 'Weil die Sonne näher ist', 'Weil der Wind stärker ist'], richtig: 0, erklaerung: 'Kalte Luft kann weniger Wasserdampf halten.' },
      { frage: 'Was gibt Pflanzen Wasser an die Luft ab?', optionen: ['Die Wurzeln', 'Die Blätter', 'Der Stamm', 'Die Blüten nur nachts'], richtig: 1, erklaerung: 'Über kleine Öffnungen in den Blättern verdunstet Wasser.' },
    ],
    lueckentexte: [
      { titel: 'Der Weg eines Wassertropfens', text: 'Die {{Sonne}} erwärmt das Meer. Dabei {{verdunstet}} Wasser und steigt als unsichtbarer {{Wasserdampf}} auf. In der Höhe ist es kälter, deshalb {{kondensiert}} der Dampf zu winzigen Tröpfchen. Viele Tröpfchen bilden eine {{Wolke}}. Werden sie zu schwer, fallen sie als {{Niederschlag}} zur Erde. Ein Teil des Wassers {{versickert}} im Boden und wird zu {{Grundwasser}}.' },
    ],
    wahr_falsch: [
      { aussage: 'Wasserdampf kann man sehen.', wahr: false, erklaerung: 'Wasserdampf ist unsichtbar. Was man sieht (z. B. über dem Kochtopf), sind schon Tröpfchen.' },
      { aussage: 'Beim Kondensieren wird Energie abgegeben.', wahr: true, erklaerung: 'Darum sind Gewitterwolken so energiereich.' },
      { aussage: 'Die meisten Süsswasservorräte sind als Eis gebunden.', wahr: true, erklaerung: 'Gletscher und Polkappen speichern den Grossteil.' },
      { aussage: 'Wasser verdunstet erst bei 100 °C.', wahr: false, erklaerung: 'Verdunsten passiert bei jeder Temperatur, Sieden bei 100 °C.' },
      { aussage: 'Auch Pflanzen sind Teil des Wasserkreislaufs.', wahr: true, erklaerung: 'Sie nehmen Wasser auf und geben es über die Blätter ab.' },
      { aussage: 'Im Wasserkreislauf geht ständig Wasser verloren.', wahr: false, erklaerung: 'Die Wassermenge bleibt gleich, sie ändert nur Ort und Zustand.' },
    ],
    reihenfolgen: [
      { titel: 'Bring den Wasserkreislauf in die richtige Reihenfolge (Start: Meer).', schritte: ['Die Sonne erwärmt das Meer', 'Wasser verdunstet', 'Wasserdampf steigt auf und kühlt ab', 'Dampf kondensiert zu Wolken', 'Niederschlag fällt', 'Wasser fliesst über Flüsse zurück ins Meer'] },
    ],
    offene_fragen: [
      { frage: 'Warum ist es nach einem Sommergewitter oft kühler? Erkläre mit den Begriffen aus dem Lernpfad.', musterantwort: 'Regen kühlt die Oberflächen. Danach verdunstet Wasser vom Boden; Verdunsten braucht Energie, die der Umgebung entzogen wird – darum wird es kühler.', kriterien: ['Verdunstung wird genannt', 'Energiebedarf der Verdunstung wird erklärt', 'Zusammenhang zur Temperatur der Umgebung'] },
      { frage: 'Ein Parkplatz wird neu asphaltiert. Was ändert sich für das Grundwasser?', musterantwort: 'Es versickert weniger Wasser, mehr fliesst ab. Das Grundwasser wird weniger aufgefüllt, und bei Starkregen steigt die Überschwemmungsgefahr.', kriterien: ['Weniger Versickerung', 'Mehr Abfluss', 'Folge für Grundwasser oder Hochwasser'] },
    ],
    schreibauftrag: { aufgabe: 'Erkläre einer Primarschülerin in 5–8 Sätzen, wie aus Meerwasser Regen wird.', hinweise: 'Verwende mindestens drei Fachbegriffe und erkläre sie einfach.' },
  };
})(window.LA);
