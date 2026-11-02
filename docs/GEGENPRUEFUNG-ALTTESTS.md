# Gegenprüfung mit den alten Testdateien – 02.11.2026

Die aktuelle Version wurde gegen die verfügbaren Testeingaben aus **[Gerinst/2testordner](https://github.com/Gerinst/2testordner/tree/b9ada7d60cdb2ce76dfc06a90834cecce23ab422)** geprüft. Dabei wurden ein Office-Kompatibilitätsfehler, eine falsche Freigabe widersprüchlicher Avis-Versionen und zwei neue Fehlzuordnungen reiner Zahlungsankündigungen behoben.

Der abschließende Lauf umfasst **2.390 Dateifälle**. Die festgelegten Sicherheitsprüfungen melden danach **keine falsche sichere Freigabe, keinen verlorenen erwarteten Avis-Fall und keinen Ausführungsfehler**. Das bedeutet weder perfekte Erkennung aller denkbaren Dokumente noch vollständige Übereinstimmung mit sämtlichen historischen Erwartungen. **40 schwierige Nicht-Avis-Fälle landen weiterhin vorsichtshalber zur Prüfung. 530 erwartete Dateien fehlen.** Beides ist unten ausgewiesen.

**Keine Live-Abnahme:** In dieser Sitzung wurden weder der Microsoft-365-Flow noch das dort gespeicherte Office-Skript geändert und keine Testmails versendet. Die Chrome-Steuerung wurde dieser Unterhaltung auch nach erneutem Verbinden nicht bereitgestellt. Alle folgenden Ergebnisse sind lokale Prüfungen. Der Auftrag zur Live-Anpassung und Live-Prüfung bleibt deshalb offen.

## Quellen und Umfang

| Merkmal | Ergebnis |
| --- | ---: |
| Im Archiv identifizierte Dateifälle | 2.920 |
| Davon direkt hochgeladen und geprüft | 1.705 |
| Zusätzlich aus Originalrezepten wiederhergestellt und geprüft | 685 |
| Insgesamt geprüfte Dateifälle | **2.390** |
| Unterschiedliche Eingabe-/Parameterkombinationen | 2.305 |
| Unterschiedliche Datei-Inhalte nach SHA-256 | 2.287 |
| Ohne hinterlegte oder unabhängig ergänzte Erwartung | 0 |
| Noch fehlende Dateien | **530** |
| Ausführungsfehler im abschließenden Lauf | 0 |
| Verstöße gegen die Sicherheitsprüfungen im abschließenden Lauf | 0 |

Das Referenzarchiv hat den Commit `b9ada7d60cdb2ce76dfc06a90834cecce23ab422`. Es wurde nicht verändert. Der geprüfte aktuelle Skriptinhalt hat SHA-256:

```text
1a1c90b15217572d0b425726aa3897823b272fb4fdad09c11296266c365e9964
```

Die kompakte [maschinelle Auswertung](GEGENPRUEFUNG-ALTTESTS.json) enthält Zählwerte, fehlende Dateien, Abweichungen und ausgewählte Ergebnisse. Ihr `parserBaseCommit` bezeichnet den Git-Ausgangspunkt vor diesen Korrekturen; maßgeblich für den tatsächlich geprüften Inhalt ist `parserSha256`.

### Wiederhergestellte und fehlende Dateien

Von den 943 Einträgen der zentralen `expected.json` waren zunächst nur 253 Eingaben vorhanden. 685 weitere wurden in einem separaten Verzeichnis aus den mitgelieferten Generatoren rekonstruiert. Damit sind dort **938 von 943** verfügbar. Vorhandene Dateien und historische Sollwerte wurden dabei nicht überschrieben. Die Dateien wurden nach den Originalrezepten neu erzeugt; etwa Signaturen und PDF-Serialisierung müssen deshalb nicht die verlorenen Originalbytes reproduzieren.

Generatoren, Anpassungen für lokale Abhängigkeiten und SHA-256 der erzeugten Dateien stehen in [legacy-regeneration.json](../tests/legacy-regeneration.json). Für fünf Varianten wurde qpdf isoliert bereitgestellt. Beim alten RC4-Test musste die aktuelle qpdf-Version ausdrücklich schwache Testverschlüsselung erlauben. Es wurden keine echten Zugangsdaten oder produktiven Zertifikate verwendet.

Weiter fehlen:

- **525 separate Corpus-PDFs:** Ihre Manifeste enthalten Erwartungen, aber weder die Dateien noch ausreichende Generatorquellen oder Downloadadressen.
- **Fünf Haupt-Fixtures:** `bomb_deflate.pdf`, `rl_big_40pages.pdf`, `rl_nolabel_total.pdf`, `rl_two_totals.pdf`, `scan_image_only.pdf`.

Diese 530 Fälle wurden **nicht ausgeführt und nicht als bestanden gezählt**. In Maildateien enthaltene PDF-Anlagen konnten dagegen gelesen und getestet werden.

## Festgestellte und korrigierte Fehler

### Widersprüchliche Versionen desselben Avis

`sm_two_pdfs_conflict.p7m` enthält zweimal **Zahlungsavis Nr. 4711** mit denselben Rechnungszeilen. Nur der Gesamtbetrag der zweiten Version wurde von `3.454,00` auf `1.250,00` geändert. Das sind keine unabhängig belegten Zahlungen.

Das Leerzeichen in „Zahlungsavis Nr.“ verhinderte zuvor die Erkennung der gemeinsamen Avisnummer. Mit übergebenem Mailbetreff wurde deshalb fälschlich `3.454,00 + 1.250,00 Unterlagen` als sicher freigegeben. Die Referenzerkennung berücksichtigt diese Schreibweise jetzt. Beide Versionen führen gemeinsam zur Prüfung; Kategorie und sämtliche Betreff-Schreibfelder bleiben leer. Die alte Prüfpflicht dieses Falls wurde **beibehalten**, nicht als veraltete Mehrfachavis-Regel aus dem Test entfernt.

Vier dauerhafte Regressionen prüfen den Konflikt als PDF und Text, eine echte Kopie sowie zwei getrennte, gleich hohe Zahlungen mit verschiedenen Avisnummern.

### Zeitprüfung im Office-Script-Konstruktor

Der historische Office-Script-Simulator erzeugte für `checkRunDeadline()` im `Lexer`-Konstruktor einen ungültigen `await`-Aufruf. Normale Node.js-Tests und ein gewöhnlicher TypeScript-Typcheck hatten das nicht aufgedeckt. Die Zeitprüfung erfolgt jetzt vor dem ersten gelesenen Token und danach weiterhin alle 4.096 Token. Der Konstruktor enthält nur Initialisierungen.

Die dauerhafte Prüfung erkennt die fehlerhafte Variante weiterhin als Kontrollfall. Für den korrigierten Code stimmen in **vier Umwandlungsmodellen jeweils 15 vollständige Ergebnisse** mit der synchronen Ausführung überein: **60 Vergleiche**, keine gemeldeten Syntaxfehler oder unbehandelten Promise-Fehler. Das Werkzeug ist ein Modell der Office-Umwandlung, kein echter Microsoft-365-Lauf. Herkunft und Grenzen stehen unter [tests/office](../tests/office/README.md).

### Reine zukünftige Zahlungsankündigungen

`H033.eml` und `T203.eml` waren durch die strengere Ausführungsprüfung neu zu Prüffällen geworden. Sie beschreiben eine spätere Zahlung beziehungsweise einen noch nicht freigegebenen Vorschlag, dessen Avis erst nach Ausführung folgen soll.

Beide bleiben jetzt wieder unberührt. Die Ausnahmen gelten eng auf Ebene der gesamten Mail. Ein tatsächlicher oder unlesbarer Avis-Anhang sowie Storno- und Pending-Widersprüche müssen weiterhin zur Prüfung führen. Zehn zusätzliche Tests sichern diese Abgrenzung ab; die beiden Originalmails sind unverändert als [Regressionseingaben](../tests/legacy-regressions/README.md) enthalten.

## Was nicht mit „alles perfekt“ verwechselt werden darf

**781 Dateifälle wurden konservativ zur Prüfung eingeordnet.** Darunter sind ausdrücklich erwartete Prüffälle sowie Fälle, die der alte Test eigentlich automatisiert verarbeiten wollte. Nach der aktuellen Anforderung dürfen nur sichere Ergebnisse automatisch geändert werden.

**40 Fälle mit der historischen Erwartung „kein Avis“ gehen ebenfalls zur Prüfung.** Der Vergleich mit dem archivierten Skript bestätigt, dass diese Fälle bereits dort Prüffälle waren. Es handelt sich unter anderem um Zahlungsplanungen, offene Posten, Rückläufer, eigene Zahlungen und unlesbare Zusatzdaten. Sie werden nicht als sichere Zahlung freigegeben, entsprechen aber auch nicht vollständig dem Ideal „jede Nicht-Avis-Mail bleibt unberührt“. Die einzelnen Fälle und Gründe stehen in der maschinellen Auswertung.

Vier weitere historische Verhaltensabweichungen bleiben sichtbar: eine Mail mit 60 PDFs wird wegen der Lesegrenze vorsichtiger behandelt, eine widersprüchliche Teilzahlung im Body wird unklar, ein Scan hat eine geänderte Diagnose und eine XLSX-Mail mit zusätzlicher nicht lesbarer BIFF8-Datei wird zur Prüfung eingeordnet. Alte Kategorien, Währungskürzel und Prüfzeichen im Betreff wurden bewusst nicht als heutige Sollwerte übernommen.

Neun zuvor nicht ausreichend dokumentierte Erwartungen wurden anhand der tatsächlichen MIME-Inhalte, unabhängig gelesener PDF-Texte beziehungsweise Tabellen-XML ergänzt. Sie sind in [legacy-manual-oracles.json](../tests/legacy-manual-oracles.json) mit Datei-Hashes und Begründung gebunden. Frühere Parser-Ausgaben wurden nicht einfach zu neuen Sollwerten erklärt.

## Laufzeit

Der anspruchsvolle Fall **B02** enthält 27 Seiten, 1.103 Rechnungszeilen und 50 Filial-Zwischensummen. Er liefert korrekt **826.636,07**.

Im getrennten Vergleich mit gleichartiger Instrumentierung brauchte der archivierte Parser rund **35,9 Sekunden**, die korrigierte Version rund **28,6 Sekunden** unter Node.js. Beide führten **38 `try`-Blöcke** aus. Eine neue Flut von Fehlerbehandlungsblöcken wurde hier nicht festgestellt. Im abschließenden, parallel zu weiteren Prüfungen gestarteten Gesamtlauf lag dieser Einzelfall bei rund 37,7 Sekunden. Diese Einzelmessungen sind keine allgemeine Geschwindigkeitsgarantie und keine Excel-Online-Laufzeiten.

Das interne Budget bleibt bei kooperativ geprüften 90 Sekunden. Der lokale Archiv-Runner erlaubt pro Aufruf 110 Sekunden, damit nicht sein eigenes kürzeres Testlimit den Skriptabbruch vorwegnimmt. Die zuvor getesteten zehn lokalen Suiten bestehen auch nach den Korrekturen; sie enthalten jetzt **685 Prüffälle**, zusätzlich zur Archiv- und Office-Simulationsprüfung. Bestehende ausdrücklich dokumentierte Integrationsgrenzen werden dadurch nicht aufgehoben.

## Wiederholen und später live abnehmen

```sh
node tests/run-all.cjs
npm ci
npm run typecheck
npm run test:office
node tests/legacy-corpus.cjs /pfad/zu/2testordner /tmp/avis-legacy-report.json
```

Der letzte Aufruf prüft die tatsächlich im Archiv vorhandenen Dateien und weist fehlende aus. Um zusätzlich den separat rekonstruierten Baum zu prüfen:

```sh
node tests/legacy-corpus.cjs /pfad/zu/2testordner /tmp/avis-legacy-report.json '' /pfad/zu/legacy-generated
```

Der rekonstruierte Baum muss `test/fixtures/` mit den erzeugten Dateien enthalten. Die im aktuellen Arbeitsbereich verwendete Rekonstruktion ist durch das oben verlinkte Provenienzmanifest dokumentiert. Der Runner selbst führt keine historischen Generatoren aus und sendet keine Mails.

Für die spätere echte Hauptflow-Abnahme sind [15 repräsentative Fälle](../tests/live-main-cases.json) mit Erwartungen und Hinweisen zur Absender-/Postfachzuordnung vorbereitet. Sie wurden **nicht versendet**. B02 gehört zusätzlich in die Laufzeitabnahme. Erst mit tatsächlich verfügbarem Zugriff auf den geöffneten Flow können dessen vorhandener Aufbau gesichert, Skript und Hauptflow aktualisiert und die Ergebnisse im richtigen Postfach überprüft werden. Ein GitHub-Commit allein ändert diese Microsoft-365-Konfiguration nicht.
