# Zwischenstand der Liveabnahme am 2 November 2026

**Liveausführung läuft; noch keine Liveabnahme.** Die 15 vorbereiteten Fälle und der zusätzliche Laufzeitfall **B02** stimmen lokal mit dem Parserstand `dc05933` überein. Der aktualisierte Hauptflow ist aktiv. Der erste Fall `single-body-pdf` wurde einmal versendet, das Ergebnis ist offen. Die übrigen 15 Fälle wurden noch nicht versendet; kein Livefall ist bisher als bestanden oder fehlgeschlagen bewertet.

Dieser Zwischenstand ergänzt die [Anleitung](ANLEITUNG.md), den [lokalen Testbericht](TESTBERICHT.md), die [Gegenprüfung des Testarchivs](GEGENPRUEFUNG-ALTTESTS.md) und die [vorbereiteten 15 Livefälle](../tests/live-main-cases.json). Er ist keine Freigabe des laufenden Microsoft-365-Aufbaus.

## Gesicherter Stand und gespeichertes Skript

Der vorhandene Hauptflow wurde vollständig exportiert. Das bisherige Office-Skript wurde als private Kopie gesichert; zusätzlich wurde der veröffentlichte Quelltext lokal gespeichert und mit SHA-256 erfasst. Private Sicherungen und mandantenspezifische Daten sind nicht Bestandteil dieses Repositories.

Der Hauptflow wurde für die Migration **deaktiviert**. Nach einer ersten Importablehnung war der zweite Paketimport erfolgreich; der neue gespeicherte Aufbau ist verifiziert. Die Flowdetailseite bestätigt inzwischen **Status Ein**. Die Sicherung des früheren Aufbaus dokumentiert vier inzwischen in der Konfiguration behobene Abweichungen:

- Die Kategorieaktion läuft vor der Betreffänderung.
- Bei Skriptfehlern wird die frühere Prüfkategorie gesetzt; die benötigte Verschiebung in den Prüfordner fehlt.
- Der Skriptaktion fehlt der feste Parameter `mailboxAddress`.
- Frische Nachrichtenleseaktionen und Betreffvergleiche vor den Schreibaktionen fehlen.

Das Office-Skript **AvisV2** wurde inzwischen vollständig auf den Quellstand `dc05933` aktualisiert und gespeichert. AST, Tokens und Kommentare des Editorinhalts stimmen mit dem geprüften Kandidaten überein; ausschließlich die automatische Whitespace-Formatierung unterscheidet sich. Die Oberfläche bestätigt „Skript gespeichert“ und zeigt keine verwerfbaren Änderungen. Dies belegt die Speicherung, noch keinen ausgeführten Skript- oder Hauptflow-Lauf.

**Chrome ist wieder verbunden; die Umsetzung läuft weiter.** Die frühere Unterbrechung durch Browser-/Native-Fehler ist überwunden. Die Arbeitsdateien liegen nach den Speicherproblemen auf einem geprüften externen Arbeitsdatenträger. Der Hauptflow ist inzwischen importiert und seine gespeicherte Konfiguration geprüft. Die Aktivierung ist bestätigt. Eine kontrollierte externe Testadresse ist verfügbar; die erste Testmail wurde versendet. Die Verarbeitung und die übrigen Livefälle sind noch offen.

## Importverlauf und verifizierte Konfiguration

Der erste Import des vorbereiteten Hauptflowpakets wurde nach Auswahl bestehender Verbindungen mit `WorkflowOperationParametersExtraParameter` abgewiesen: Die API-Operation enthielt keine Definition für `ScriptParameters/mailboxAddress`. Das neue Office-Skript war bereits gespeichert. Dieser erste Versuch aktualisierte den Hauptflow nicht.

Nach Aktualisierung der Skriptauswahl beziehungsweise des Parameterschemas war der **zweite Import erfolgreich**. Die Integrationsfrage ist damit behoben und zählt nicht als fehlgeschlagener Live-Testfall.

Die aus dem frisch geöffneten Server-Editor kopierten **14 Aktionen und der Trigger** stimmen nach dokumentierten Export-/UI-Darstellungsnormalisierungen mit dem finalen Paket überein. Verzweigungen, Ausdrücke, `runAfter`-Status, Connectorparameter, logische Verbindungen, Wiederholungen und Trigger-/Ordnerkonfiguration zeigen keine unerwarteten Unterschiede. Der Editor meldet **0 Fehler und 0 Warnungen**; die frühere erwartete Parallelitätswarnung der Detailseite ist davon getrennt.

Dieser Vergleich bestätigt die gespeicherte Konfiguration. Er belegt keine vollständige physische Verbindungszuordnung, Aktivierung, Connectorausführung oder erfolgreiche Mailverarbeitung. Die Aktivierung wurde anschließend separat durch **Status Ein** nachgewiesen.

## Beginn der Liveausführung

Der erste Fall **single-body-pdf** wurde einmal versendet; die Oberfläche bestätigte „Nachricht gesendet“. Trotz Timeout der Klickantwort wurde der Versand nicht wiederholt. Bei der ersten Kontrolle nach ungefähr einer Minute war noch kein neuer Flowlauf sichtbar. Das Verarbeitungsergebnis bleibt offen; daraus wird weder ein Bestehen noch ein Fehlschlag abgeleitet.

Erwarteter Betreff ist `3.454,00 Zahlung 4711`, danach die Kategorie `Avis`. Die übrigen 15 Fälle sind noch nicht versendet.

## Lokale Fallprüfung und ausstehende Liveprüfung

Die Eingaben stammen aus `Gerinst/2testordner` auf `b9ada7d60cdb2ce76dfc06a90834cecce23ab422`. Alle 16 Original-EMLs waren vorhanden; keine Rekonstruktion war erforderlich. Nach dem Arbeitsverzeichniswechsel wurden alle 16 Originale und die 43 extrahierten Anlagen- und Body-Dateien erneut gegen Hashes beziehungsweise den decodierten MIME-Inhalt geprüft.

| Fall | Erwartetes Verhalten | Lokal | Live |
| --- | --- | --- | --- |
| single-body-pdf | Avis; Präfix 3.454,00 | Bestanden | Versendet, Ergebnis offen |
| two-safe-pdfs | Avis; Präfix 22.326,96 + 2.359,12 | Bestanden | Noch nicht versendet |
| two-pdfs-plus-invoice | Avis; Präfix 32.960,47 + 148,94 | Bestanden | Noch nicht versendet |
| paid-partial-installment | Avis; Präfix 4.880,00 | Bestanden | Noch nicht versendet |
| swiss-advice | Avis; Präfix 28.044,65 | Bestanden | Noch nicht versendet |
| spreadsheet-uncertain | Unverändert in den Prüfordner, keine neue Kategorie | Bestanden | Noch nicht versendet |
| multiple-medium | Unverändert in den Prüfordner, keine neue Kategorie | Bestanden | Noch nicht versendet |
| image-only-scan | Unverändert in den Prüfordner, keine neue Kategorie | Bestanden | Noch nicht versendet |
| encrypted-mail | Unverändert in den Prüfordner, keine neue Kategorie | Bestanden | Noch nicht versendet |
| unclear-payment-hint | Unverändert in den Prüfordner, keine neue Kategorie | Bestanden | Noch nicht versendet |
| complaint-not-payment | Vollständig unverändert | Bestanden | Noch nicht versendet |
| delivery-not-payment | Vollständig unverändert | Bestanden | Noch nicht versendet |
| own-outgoing-bcc | Vollständig unverändert | Bestanden | Noch nicht versendet |
| already-prefixed | Avis; Betreff unverändert | Bestanden | Noch nicht versendet |
| recoverable-header-existing-categories | Avis; Präfix 3.454,00 | Bestanden | Noch nicht versendet |
| B02 | Avis; Präfix 826.636,07 | Bestanden | Noch nicht versendet |

Damit sind acht sichere Fälle, fünf Prüffälle und drei andere, unverändert zu lassende Mails lokal abgedeckt. Zusätzlich stimmen die 15 regulären Fälle bei lokal simulierter passender Absenderrichtung und explizitem Zielpostfach mit ihren Erwartungen überein. Die lokalen Prüfungen belegen keine Zustellung, Connector-Berechtigung, Aktionsreihenfolge oder Office-Laufzeit.

**B02** lieferte unter Node.js 24.16.0 nach **19,210 Sekunden** korrekt `826.636,07` mit `high`. Erwarteter Betreff: `826.636,07 Ihre Rechnungen Oktober [B02]`. Die echte Office-Script-Dauer einschließlich Wiederholungen ist weiterhin offen.

## Anforderungen an die Fortsetzung

Skript und Hauptflow sind gespeichert und geprüft; die Aktivierung ist bestätigt. Als Nächstes den Flowverlauf und Nachrichtenstand des einmal versendeten ersten Falls weiter prüfen und das Ergebnis erst nach vollständigem Nachweis bewerten. Die übrigen Fälle anschließend kontrolliert ausführen.

Sichere Avise benötigen zuerst Beträge ohne Währungskürzel, mehrere mit ` + ` verbunden, vor dem vollständigen Originalbetreff. Die Kategorie `Avis` darf erst nach erfolgreicher erforderlicher Betreffänderung und den frischen Betreffprüfungen gesetzt werden. Unsichere Fälle behalten Betreff und vorhandene Kategorien und werden ohne neue Kategorie nach **Posteingang → Archive → Avisbetrag fehlt** verschoben. Andere Mails bleiben unberührt.

Besondere Voraussetzungen der Fallauswahl:

- **own-outgoing-bcc:** Eigener Domain-Absender, kontrollierte externe An-Adresse und Testpostfach ausschließlich als BCC. Eine externe Weiterleitung ersetzt diesen Test nicht.
- **encrypted-mail:** Die vollständige ursprüngliche S/MIME-Struktur als Nachricht erhalten. Versand als gewöhnliche Anlage ist nur ein Ersatztest. Ein fehlender Triggerlauf bestätigt die Reviewroute nicht.
- **recoverable-header-existing-categories:** Den fehlerhaften Originalheader erhalten und die echten Ausgangskategorien `Wichtig` und `Kunde A` vor der Verarbeitung setzen. MIME-Keywords belegen keine Outlook-Kategorien.
- **already-prefixed:** Den vorbereiteten historischen Betreff mit vorhandenem `EUR -` unverändert lassen und ausschließlich `Avis` ergänzen; keine doppelte Präfixierung.
- **unclear-payment-hint:** Den in der Fallauswahl vorgegebenen Eingangsbetreff `Überweisung` verwenden.

Jeder Livefall benötigt die tatsächlichen vorherigen und nachherigen Betreff-, Ordner- und Kategorienwerte, eine Zuordnung zum Flow-Lauf sowie das Skriptergebnis und die relevanten Aktionsstatus. Bei B02 die Skriptdauer und Wiederholungen erfassen. Ausgebliebene Trigger, fehlgeschlagene ausgeführte Tests und wegen fehlender Voraussetzungen nicht ausgeführte Fälle getrennt dokumentieren.

**Bilanz dieses Zwischenstands: 16 lokal bestanden; 1 Testmail versendet und Ergebnis offen, 15 Fälle noch nicht versendet. 0 Livefälle bewertet, 0 live bestanden, 0 live fehlgeschlagen.**
