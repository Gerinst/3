# Avis-Flow Version 2

Erkennt Zahlungsavise in einem freigegebenen Postfach am Inhalt von PDF, Excel/CSV, SAP-Exporten oder Mailtext. Normale Avise bekommen zuerst den Zahlbetrag vor den ursprünglichen Betreff und danach die Kategorie **Avis**. Bei mehreren Avisen stehen alle erkannten einzelnen Zahlbeträge mit ` + ` getrennt davor: `1.200,30 + 5.632,21 + 500,42 Abrechnung Oktober`. Währungskürzel werden nicht ergänzt, die Beträge nicht zu einer Gesamtsumme addiert.

Alle Fälle, die bisher **Avis prüfen** bekommen hätten, werden stattdessen in den vorhandenen Ordner **Posteingang → Archive → Avisbetrag fehlt** des freigegebenen Postfachs verschoben. Dazu zählen fehlende oder unsichere Beträge, unvollständige Betragslisten und Fehler beim Export oder Skriptlauf. Der Flow setzt dafür keine neue Kategorie. Im normalen Flow wird ein vorhandener unsicherer Betrag zunächst ohne zusätzliches Fragezeichen vor den ursprünglichen Betreff geschrieben; in Plan B wird das Original unverändert und ohne neue Kopie verschoben. Ziemlich sichere Einzelbeträge mit `(prüfen)` bleiben normale Avise mit Kategorie **Avis**.

„Zahlungsavis“ ist in Beispielen nur ein möglicher Originalbetreff und wird nicht automatisch angehängt. Rechnungen, Reklamationen und andere Mails ohne Avis bleiben unverändert. Das Skript läuft als Office Script über Excel Online (Business), ohne AI-Builder-Credits oder Drittanbieter.

**Bestehenden Flow aktualisieren:** Skript, Flow-Aufbau und Formeln gemäß [Anleitung](docs/ANLEITUNG.md) aktualisieren. Das Skriptupdate allein baut die Verschiebeaktionen nicht ein. Den bereits vorhandenen Ordner über den Ordnerwähler auswählen, nachdem die Adresse des freigegebenen Postfachs eingetragen wurde. `Archive` endet mit **e**, `Avisbetrag fehlt` enthält genau ein Leerzeichen. Der Trigger bleibt auf den Posteingang begrenzt. Alte Mails und Kategorien werden nicht gesammelt nachträglich geändert.

## Diese Dateien brauchst du

| Datei | Wofür |
| --- | --- |
| [docs/ANLEITUNG.md](docs/ANLEITUNG.md) | Einrichtung, Migration, Testfälle, Fehlerhilfe und deutsche Erklärungen der Skriptergebnisse. |
| [dist/AvisV2.ts](dist/AvisV2.ts) | Office-Skript. Auf GitHub **Copy raw file**, anschließend den gesamten Inhalt des Skripts `AvisV2` in Excel ersetzen und speichern. |
| [formeln/](formeln) | Neun TXT-Formeln für den aktuellen Flow einschließlich Prüfung und Plan B. `Bearbeitung_noetig_links.txt` ersetzt `Kategorie_noetig_links.txt`. Die Zuordnung steht in Anhang A der Anleitung. |
| [dist/avis-flow.html](dist/avis-flow.html) | Klickbarer Nachbau mit Parametern, Einstellungen, Codeansicht und Formeln. **Download raw file**, dann im Browser öffnen. |

## Im Betrieb

- **Normale Avise:** Betrag oder Betragsliste vor dem Originalbetreff, Kategorie `Avis`. Bereits vollständig ergänzte Betreffzeilen bekommen keine zweite gleiche Liste.
- **Prüffälle:** Im Ordner **Posteingang → Archive → Avisbetrag fehlt** ansehen. Im Skriptergebnis kennzeichnet `needsReview = true` diese Fälle; `category` und `patchCategory` sind dann leer. Fehler beim Verschieben stehen im Ausführungsverlauf und setzen keine Ersatzkategorie.
- **Plan B:** Falls Microsoft Betreffänderungen an empfangenen Mails sperrt, bekommen nur normale Avise eine Kopie. Das normale Original wird erst nach erfolgreichem Versand und erfolgreicher Kategorisierung nach `Avis-Original` verschoben. Prüffälle gehen direkt in den Prüfordner; noch eintreffende ältere eigene Kopien mit `?` werden ebenfalls dorthin verschoben.
- **Eigene Tests:** Ein Avis nur im Mailtext von einer externen Adresse senden. Interne Mails aus derselben Domain können als eigene Zahlung erkannt werden. Avis-Dateien und weitergeleitete Kunden-Avise werden normal gelesen.
- **Gelesene Anlagen:** PDF, Excel (.xlsx/.xlsm), CSV, OpenDocument-Tabellen (.ods), RTF, Text, HTML, XML, JSON, angehängte Mails (.eml) und Outlook-Elemente (.msg). Reine Scans, verschlüsselte Dokumente und andere nicht lesbare Avis-Anlagen gehen zur Prüfung.
- **Voraussetzungen:** Freigegebenes Exchange-Postfach und Vollzugriff für das Verbindungskonto; für Plan B zusätzlich „Senden als“. Je Mail höchstens 30 Anlagen. Der Flow verarbeitet Mails nacheinander.
- **Ab 31.12.2026:** Microsoft hat eine Sperre für Betreffänderungen an empfangenen Mails angekündigt. Im Januar den Test aus der Anleitung wiederholen und bei Bedarf Plan B verwenden.

## Historische Tests

Die folgenden Berichte beschreiben den Stand vom 30./31.10.2026. Damalige Hinweise auf die Kategorie „Avis prüfen“ sind historische Testergebnisse. Die spätere Kategorie „Avis“, das kürzere Betreffformat, mehrere Beträge mit ` + `, die geänderte Reihenfolge und der aktuelle Prüfordner wurden lokal geprüft; der neue Gesamtstand ist noch nicht erneut live in Microsoft 365 getestet.

- **Live getestet** am 30.10.2026 in einem Microsoft-365-Testzugang mit freigegebenem Postfach, mit erfundenen Test-Mails:
  - **Lasttest:** 40 Mails in unter 2 Minuten, davon 15 Avise (eines mit 72 Seiten und 2,7 Mio. EUR, eines mit 27 Seiten und Zwischensummen je Filiale, Excel, Mailtext, Gutschriftsanzeige der Bank, Englisch, Französisch, Schweizer Franken, Weiterleitung, Scan, zwei Avise in einer Mail, ein anderer Betrag im Mailtext) und 25 Fallen (Rechnungen, Gutschriften, Mahnungen, Kontoauszug, Saldenbestätigung, Lastschrift-Ankündigung, Lieferavis, Bestellung, Reklamation …). Jede Mail wurde verarbeitet, 37 genau wie erwartet, 3 vertretbar (eine Quittung und eine englische Rechnung bekamen „Avis prüfen", eine Antwort auf ein Avis blieb unberührt), keine Falle bekam „Avis", kein Avis ging verloren.
  - **Viele Anlagen:** 20 Rechnungen ohne Avis bleiben unberührt; ein Avis als 20. Anlage wird gefunden.
  - Dazu zwei frühere Runden mit 32 Mails.
- **Live nachgetestet am 31.10.2026:** 41 weitere Mails (22 deutsch, 19 englisch), darunter 16 Excel/CSV-Avise und -Fallen und 20 Mails zu den neuen Regeln (englische Überweisungsbestätigung, SWIFT-Kopie, zwei Zahlungen in einer Mail, Teilzahlung, Excel mit zwei Zahlungsblöcken, nur erwähntes Avis, Portal-Hinweis, Antwort mit neuem Betrag). Jedes Ergebnis war live genau wie im lokalen Test, der Betrag steht vorne im Betreff.
- **Deutsch und Englisch gleich geprüft:** je 200 Test-Mails pro Sprache (Avise als PDF, Excel/CSV, im Mailtext, gescannt, signiert, mehrere Avise in einer Mail und je 100 Fallen wie Rechnungen, Mahnungen, Kontoauszüge, Bestellungen, Infoschreiben). Ergebnis: Deutsch 190, Englisch 192 genau richtig, der Rest landet in „Avis prüfen". In keiner Sprache ging ein Avis verloren, keine Falle bekam „Avis", kein Betrag war falsch. Dazu 52 öffentliche Beispiel-Dokumente aus dem Internet (deutsch und englisch): keine Falle mit „Avis".
- **Weitere Testrunden (Stand 31.10.2026 abends):** 18 Themen-Sätze mit je 40 Mails (u. a. Teilzahlungen, Gutschriften, Weiterleitungen, Kollegen-Mails, Drittzahlungen, Versicherer, Steuererstattungen, Zahlläufe, CSV/XML/JSON/RTF/ODS, Chat-Benachrichtigungen): 694 von 720 genau richtig, der Rest „Avis prüfen", kein Avis verloren, keine Falle mit „Avis". Dazu 11 gezielte Angriffs-Sätze mit 300 besonders kniffligen Mails (deutsch und englisch gleich viele: Auszahlungen von Treuhand, Zahlungsdiensten und Versicherern, Zahlungsankündigungen und Entwürfe, eigene Zahlungen in Kopie, Kollegen-Weiterleitungen, Bank-Gutschriften): 291 genau richtig, 8 „Avis prüfen", kein Avis verloren; eine eigene Zahlung in Blindkopie bekam „Avis" (bekannte Grenze, Anleitung Abschnitt „Grenzen"). Der damalige Stand wurde **live getestet am 31.10.2026 (abends)**: 20 Mails (10 deutsch, 10 englisch) aus diesen Testrunden im Testpostfach, darunter Teilzahlung, CSV-Export, Korrektur-Avis, Marktplatz-Auszahlung, verschachtelte Weiterleitung, zwei Avise in einer Mail und als JSON, ZIP-Anhang, eigenes Avis, Abwesenheitsnotiz, Rücksendung, Skonto-Zahlung, Avis einer Behörde, Steuererstattung, ODS-Liste, Verrechnung und Lieferavis. Jedes Ergebnis war live genau wie im lokalen Test, jede Mail wurde verarbeitet. Dazu 6 Mails mit Outlook-Elementen (.msg) als Anlage: Kunden-Avis als PDF darin (deutsch und englisch), Avis nur im Text des Elements, eingebettete Mail, zwei Rechnungen als Fallen – live genau wie lokal.

## Lokal prüfen

Mit Node.js 24 oder neuer: `node tests/multiple-advices.cjs` und `node tests/review-routing.cjs`. Die Tests verwenden erfundene Mail-, PDF- und CSV-Beispiele, prüfen mehrere Zahlungen, Betreff-Wiederholungen, unvollständige Betragslisten und den Ablauf zum Verschieben von Prüffällen. Es werden keine Mails versendet und keine Microsoft-365-Verbindungen benötigt.

Version 1 mit Ergebnis-Mails für PDFs: [Gerinst/1](https://github.com/Gerinst/1).
