# Avis-Flow Version 2

**Stand 03.11.2026:** Ein klarer Widerspruch zwischen einem Zahlungsbetrag im Betreff und dem sicher erkannten PDF-/Excel-Zahlbetrag führt unverändert und ohne neue Kategorie in den Prüfordner. Die [zusätzliche Abnahme](docs/BETREFFKONFLIKT-2026-11-03.md) dokumentiert die neue Regel, die Offlineprüfungen und 17 bestandene echte Mailfälle: zwei Konflikte und 15 unberührte Nicht-Avise.

Der vollständige lokale Archivlauf umfasst jetzt **alle 2.920 Dateifälle**, einschließlich der je 200 deutschen und englischen Mails. Keine Eingaben fehlen; der Sicherheitsrunner meldet keine Ausführungsfehler oder verletzten Freigabeinvarianten. **46 erwartete Nicht-Avise werden dennoch vorsichtshalber zur Prüfung eingestuft.** Diese offene Erkennungsgrenze und alle Zählwerte stehen in der [Archivbilanz](docs/BETREFFKONFLIKT-ALTTESTS.json).

**Gegenprüfung mit den alten Testdateien:** Der [ergänzende Prüfbericht](docs/GEGENPRUEFUNG-ALTTESTS.md) beschreibt die Prüfung gegen das Archiv `Gerinst/2testordner`, die aus Originalgeneratoren wiederhergestellten Eingaben und die zusätzliche Office-Script-Simulation. Fehlende Dateien, echte Abweichungen und vorsichtshalber zur Prüfung eingeordnete Fälle werden getrennt ausgewiesen. Diese Prüfung belegt keine Live-Ausführung im Microsoft-365-Postfach.

**Sicherheitsprüfung vom 02.11.2026:** Der [bisherige Testbericht](docs/TESTBERICHT.md) beschreibt die reproduzierbaren lokalen Tests, behobene Fehler und offene Betriebsrisiken. Die [erste Live-Abnahme](docs/LIVE-ABNAHME-2026-11-02.md) umfasst 14 bestandene Fälle einschließlich B02; zwei ursprüngliche MIME-Sonderfälle bleiben nicht ausgeführt. Die zusätzliche Abnahme vom 03.11.2026 ist separat ausgewiesen. Plan B ist wegen fehlender zuverlässiger Erkennung eigener Kopien und möglicher Doppelversendungen **nicht für den Produktivbetrieb freigegeben**. `high` ist eine regelbasierte Einstufung, kein Nachweis eines Zahlungseingangs und keine Grundlage für eine ungeprüfte Buchung.

Erkennt Zahlungsavise in einem freigegebenen Postfach am Inhalt von PDF, Excel/CSV, SAP-Exporten oder Mailtext. Nur als **sicher (`confidence = high`)** eingestufte Avise bekommen zuerst den Zahlbetrag vor den ursprünglichen Betreff und danach die Kategorie **Avis**. Bei mehreren sicheren Avisen stehen alle erkannten einzelnen Zahlbeträge mit ` + ` getrennt davor: `1.200,30 + 5.632,21 + 500,42 Abrechnung Oktober`. Währungskürzel werden nicht ergänzt, die Beträge nicht zu einer Gesamtsumme addiert.

Avis-Ergebnisse mit `confidence = medium` oder `low` und alle anderen Prüffälle werden in den vorhandenen Ordner **Posteingang → Archive → Avisbetrag fehlt** des freigegebenen Postfachs verschoben. Dazu zählen fehlende oder unsichere Beträge, unvollständige Betragslisten und Fehler beim Export oder Skriptlauf. Der Flow setzt dafür keine neue Kategorie. Bei einem solchen Prüffall bleibt der ursprüngliche Betreff vollständig unverändert, auch wenn das Skript einen möglichen Betrag erkannt hat. Das gilt im normalen Flow und in Plan B; es wird keine neue Kopie erzeugt. Die bisher mit `(prüfen)` gekennzeichnete Ergebnisstufe gehört bei neuen Verarbeitungen ebenfalls in diesen Prüfordner. `high` ist die höchste vorhandene regelbasierte Stufe, keine Garantie für einen fehlerfreien Betrag.

„Zahlungsavis“ ist in Beispielen nur ein möglicher Originalbetreff und wird nicht automatisch angehängt. Rechnungen, Reklamationen und andere Mails ohne Avis bleiben unverändert. Das Skript läuft als Office Script über Excel Online (Business), ohne AI-Builder-Credits oder Drittanbieter.

**Bestehenden Flow aktualisieren:** Skript, Flow-Aufbau und Formeln gemäß [Anleitung](docs/ANLEITUNG.md) aktualisieren. Das Skriptupdate allein baut keine Flow-Aktionen ein. In **Run_script** die tatsächliche Postfachadresse als **mailboxAddress** setzen. Vor Betreff- und Kategorieänderungen kommen frische Leseaktionen und Betreffvergleiche hinzu; die Kategorieformel übernimmt die aktuell gelesenen Kategorien. **Kategorie_erlaubt** verlangt weiterhin den Erfolg einer nötigen Betreffänderung. Den vorhandenen Prüfordner über den Ordnerwähler auswählen, nachdem die Adresse des freigegebenen Postfachs eingetragen wurde. `Archive` endet mit **e**, `Avisbetrag fehlt` enthält genau ein Leerzeichen. Der Trigger bleibt auf den Posteingang begrenzt. Alte Mails und Kategorien werden nicht gesammelt nachträglich geändert.

## Diese Dateien brauchst du

| Datei | Wofür |
| --- | --- |
| [docs/ANLEITUNG.md](docs/ANLEITUNG.md) | Einrichtung, Migration, Testfälle, Fehlerhilfe und deutsche Erklärungen der Skriptergebnisse. |
| [dist/AvisV2.ts](dist/AvisV2.ts) | Office-Skript. Auf GitHub **Copy raw file**, anschließend den gesamten Inhalt des Skripts `AvisV2` in Excel ersetzen und speichern. |
| [formeln/](formeln) | TXT-Formeln für den aktuellen Flow einschließlich Prüfung und den Plan-B-Entwurf. Die Zuordnung steht in Anhang A der Anleitung. |
| [dist/avis-flow.html](dist/avis-flow.html) | Klickbarer Nachbau mit Parametern, Einstellungen, Codeansicht und Formeln. **Download raw file**, dann im Browser öffnen. |

## Im Betrieb

- **Sichere Avise (`high`):** Betrag oder Betragsliste vor dem Originalbetreff, danach Kategorie `Avis`. Schlägt eine nötige Betreffänderung fehl, wird keine Kategorie gesetzt. Bereits vollständig ergänzte Betreffzeilen bekommen keine zweite gleiche Liste und dürfen `Avis` erhalten.
- **Prüffälle (`medium`, `low` und andere unklare Ergebnisse):** Im Ordner **Posteingang → Archive → Avisbetrag fehlt** ansehen. Im Skriptergebnis kennzeichnet `needsReview = true` diese Fälle; `category`, `patchCategory`, `subjectPrefix`, `newSubject` und `patchSubject` sind dann leer. Fehler beim Verschieben stehen im Ausführungsverlauf und setzen keine Ersatzkategorie.
- **Plan B:** Nur ein lokal simulierter Entwurf, nicht produktiv freigegeben. Nachrichten vom eigenen Postfach werden ohne Änderung übersprungen; der Absender allein beweist keine automatisch erzeugte Kopie. Fehlende Versandkorrelation kann bei Wiederholung weiterhin doppelte Kopien verursachen.
- **Eigene Tests:** Ein Avis nur im Mailtext von einer externen Adresse senden. Interne Mails aus derselben Domain können als eigene Zahlung erkannt werden. Avis-Dateien und weitergeleitete Kunden-Avise werden normal gelesen.
- **Gelesene Anlagen:** PDF, Excel (.xlsx/.xlsm), CSV, OpenDocument-Tabellen (.ods), RTF, Text, HTML, XML, JSON, angehängte Mails (.eml) und Outlook-Elemente (.msg). Unlesbare mögliche Avis-Anlagen sperren auch neben einem lesbaren Avis die automatische Freigabe. Das setzt voraus, dass der Mailtrigger die Nachricht überhaupt liefert.
- **Laufzeit:** Das Skript prüft regelmäßig sein internes 90-Sekunden-Budget; das ist kein garantierter Abbruch genau nach 90 Sekunden. Für einen Office-Script-Aufruf gilt zusätzlich die externe 120-Sekunden-Grenze. `Run_script` hat höchstens drei Wiederholungen mit je einer Minute Abstand, also vier Anläufe insgesamt. Die gebündelten `try/catch`-Blöcke im Parser sind Fehlerbehandlung, keine weiteren Flow-Wiederholungen.
- **Voraussetzungen:** Freigegebenes Exchange-Postfach und Vollzugriff für das Verbindungskonto; für Plan B zusätzlich „Senden als“. Je Mail höchstens 30 Anlagen. Der Flow verarbeitet Mails nacheinander.
- **Posteingang kontrollieren:** Der Microsoft-Trigger kann etwa geschützte, zu große oder beschädigte Nachrichten überspringen. Auch fehlgeschlagene Verschiebungen bleiben ein Betriebsfall. Posteingang, Prüfordner und fehlgeschlagene/ausgebliebene Flow-Läufe müssen deshalb abgeglichen werden.
- **Bei gesperrter Betreffänderung:** Keine Kategorie als Ersatz setzen. Den Fehler prüfen; Plan B erst nach Behebung der offenen Punkte und einer Live-Abnahme einsetzen.

## Historische Tests

Die folgenden Berichte beschreiben den Stand vom 30./31.10.2026. Damalige Hinweise auf die Kategorie „Avis prüfen“ sind historische Testergebnisse. Die späteren Prüfungen mit Kategorie „Avis“, kürzerem Betreffformat, mehreren Beträgen mit ` + `, geänderter Reihenfolge und dem aktuellen Prüfordner stehen in den oben verlinkten Berichten vom 02./03.11.2026. Die historischen Ergebnisse ersetzen deren ausdrücklich begrenzten Prüfumfang nicht.

- **Live getestet** am 30.10.2026 in einem Microsoft-365-Testzugang mit freigegebenem Postfach, mit erfundenen Test-Mails:
  - **Lasttest:** 40 Mails in unter 2 Minuten, davon 15 Avise (eines mit 72 Seiten und 2,7 Mio. EUR, eines mit 27 Seiten und Zwischensummen je Filiale, Excel, Mailtext, Gutschriftsanzeige der Bank, Englisch, Französisch, Schweizer Franken, Weiterleitung, Scan, zwei Avise in einer Mail, ein anderer Betrag im Mailtext) und 25 Fallen (Rechnungen, Gutschriften, Mahnungen, Kontoauszug, Saldenbestätigung, Lastschrift-Ankündigung, Lieferavis, Bestellung, Reklamation …). Jede Mail wurde verarbeitet, 37 genau wie erwartet, 3 vertretbar (eine Quittung und eine englische Rechnung bekamen „Avis prüfen", eine Antwort auf ein Avis blieb unberührt), keine Falle bekam „Avis", kein Avis ging verloren.
  - **Viele Anlagen:** 20 Rechnungen ohne Avis bleiben unberührt; ein Avis als 20. Anlage wird gefunden.
  - Dazu zwei frühere Runden mit 32 Mails.
- **Live nachgetestet am 31.10.2026:** 41 weitere Mails (22 deutsch, 19 englisch), darunter 16 Excel/CSV-Avise und -Fallen und 20 Mails zu den neuen Regeln (englische Überweisungsbestätigung, SWIFT-Kopie, zwei Zahlungen in einer Mail, Teilzahlung, Excel mit zwei Zahlungsblöcken, nur erwähntes Avis, Portal-Hinweis, Antwort mit neuem Betrag). Jedes Ergebnis war live genau wie im lokalen Test, der Betrag steht vorne im Betreff.
- **Deutsch und Englisch gleich geprüft:** je 200 Test-Mails pro Sprache (Avise als PDF, Excel/CSV, im Mailtext, gescannt, signiert, mehrere Avise in einer Mail und je 100 Fallen wie Rechnungen, Mahnungen, Kontoauszüge, Bestellungen, Infoschreiben). Ergebnis: Deutsch 190, Englisch 192 genau richtig, der Rest landet in „Avis prüfen". In keiner Sprache ging ein Avis verloren, keine Falle bekam „Avis", kein Betrag war falsch. Dazu 52 öffentliche Beispiel-Dokumente aus dem Internet (deutsch und englisch): keine Falle mit „Avis".
- **Weitere Testrunden (Stand 31.10.2026 abends):** 18 Themen-Sätze mit je 40 Mails (u. a. Teilzahlungen, Gutschriften, Weiterleitungen, Kollegen-Mails, Drittzahlungen, Versicherer, Steuererstattungen, Zahlläufe, CSV/XML/JSON/RTF/ODS, Chat-Benachrichtigungen): 694 von 720 genau richtig, der Rest „Avis prüfen", kein Avis verloren, keine Falle mit „Avis". Dazu 11 gezielte Angriffs-Sätze mit 300 besonders kniffligen Mails (deutsch und englisch gleich viele: Auszahlungen von Treuhand, Zahlungsdiensten und Versicherern, Zahlungsankündigungen und Entwürfe, eigene Zahlungen in Kopie, Kollegen-Weiterleitungen, Bank-Gutschriften): 291 genau richtig, 8 „Avis prüfen", kein Avis verloren; eine eigene Zahlung in Blindkopie bekam „Avis" (bekannte Grenze, Anleitung Abschnitt „Grenzen"). Der damalige Stand wurde **live getestet am 31.10.2026 (abends)**: 20 Mails (10 deutsch, 10 englisch) aus diesen Testrunden im Testpostfach, darunter Teilzahlung, CSV-Export, Korrektur-Avis, Marktplatz-Auszahlung, verschachtelte Weiterleitung, zwei Avise in einer Mail und als JSON, ZIP-Anhang, eigenes Avis, Abwesenheitsnotiz, Rücksendung, Skonto-Zahlung, Avis einer Behörde, Steuererstattung, ODS-Liste, Verrechnung und Lieferavis. Jedes Ergebnis war live genau wie im lokalen Test, jede Mail wurde verarbeitet. Dazu 6 Mails mit Outlook-Elementen (.msg) als Anlage: Kunden-Avis als PDF darin (deutsch und englisch), Avis nur im Text des Elements, eingebettete Mail, zwei Rechnungen als Fallen – live genau wie lokal.

## Lokal prüfen

Mit Node.js 24 oder neuer: `node tests/run-all.cjs`. Die lokalen Suiten prüfen echte, künstlich erzeugte Mail- und Dateiinhalte sowie ein ausdrücklich simuliertes Flow-Modell; dafür ist keine Paketinstallation nötig.

Für den Typcheck und die zusätzliche Office-Kompatibilitätsprüfung die festgelegte TypeScript-Version 5.9.3 installieren:

```sh
npm ci
npm run typecheck
npm run test:office
```

Die Office-Simulation vergleicht vollständige Ergebnisse in vier Umwandlungsmodellen und prüft auch, dass der frühere Fehler eines Funktionsaufrufs im Lexer-Konstruktor erkannt wird. Sie ersetzt keinen Lauf in Excel Online. Der Zeitcheck erfolgt jetzt vor dem ersten gelesenen Token und danach weiterhin in Abständen, ohne einen neuen Fehlerbehandlungsblock je Token.

Das separat ausgecheckte Testarchiv lässt sich mit `node tests/legacy-corpus.cjs /pfad/zu/2testordner /tmp/avis-legacy-report.json` gegen den aktuellen Parser prüfen. Quellenstand, Wiederherstellung fehlender Eingaben und Ergebniseinordnung stehen im [ergänzenden Prüfbericht](docs/GEGENPRUEFUNG-ALTTESTS.md); die frühere lokale Testreihe bleibt im [bisherigen Testbericht](docs/TESTBERICHT.md) dokumentiert. Es werden keine Mails versendet und keine Microsoft-365-Verbindungen benötigt. Node.js-Laufzeiten sind keine Office-Script-Laufzeiten.

Version 1 mit Ergebnis-Mails für PDFs: [Gerinst/1](https://github.com/Gerinst/1).
