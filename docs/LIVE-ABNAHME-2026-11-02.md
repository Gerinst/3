# Liveprüfung des Hauptflows am 2 November 2026

**14 Livefälle bestanden, 2 Originalfälle nicht ausgeführt. Die vollständige Abnahme aller 16 Fälle bleibt offen.** Das Office-Skript und der Hauptflow sind auf Basis von `dc05933` aktualisiert, gespeichert und geprüft. Der Hauptflow ist aktiv; **Status Ein** wurde auch zum Abschluss bestätigt. Alle 16 vorbereiteten Eingaben bestanden zuvor die lokale Prüfung.

Dieser Bericht ergänzt die [Anleitung](ANLEITUNG.md), den [lokalen Testbericht](TESTBERICHT.md), die [Gegenprüfung des Testarchivs](GEGENPRUEFUNG-ALTTESTS.md) und die [15 vorbereiteten Livefälle](../tests/live-main-cases.json). Dazu kommt der große Laufzeitfall **B02**. `Gerinst/2` blieb unverändert.

## Sicherung und Aktualisierung

Der vorhandene Hauptflow wurde vollständig exportiert. Das bisherige Office-Skript wurde als private Kopie gesichert; zusätzlich wurde der veröffentlichte Quelltext lokal gespeichert und mit SHA-256 erfasst. Private Sicherungen und mandantenspezifische Daten sind nicht Bestandteil dieses Repositories. Ein zusätzlich angestoßener Download der Skriptdatei kam nicht an; die private Cloud-Kopie und die lokale Quelltextsicherung sind vorhanden.

Der Hauptflow wurde für die Migration deaktiviert. Die alte Konfiguration setzte die Kategorie vor dem Betreff, verwendete bei Skriptfehlern eine frühere Prüfkategorie statt der benötigten Verschiebung und enthielt weder den festen Parameter `mailboxAddress` noch die frischen Betreffprüfungen. Diese Abweichungen sind in der neuen gespeicherten Konfiguration korrigiert. Erfolgreiche Betreff-/Kategorieaktionen und die Verschiebung unsicherer Fälle wurden anschließend live geprüft; ein künstlich ausgelöster Skript- oder Betreff-PATCH-Fehler wurde nicht getestet.

Das Office-Skript **AvisV2** entspricht `dc05933`. AST, Tokens und Kommentare des gespeicherten Editorinhalts stimmen mit dem geprüften Kandidaten überein; ausschließlich die automatische Whitespace-Formatierung unterscheidet sich. Die Oberfläche bestätigte „Skript gespeichert“ ohne verwerfbare Änderungen.

Der erste Paketimport wurde mit `WorkflowOperationParametersExtraParameter` abgewiesen, weil die Connectoroperation `ScriptParameters/mailboxAddress` noch nicht kannte. Nach Aktualisierung der Skriptauswahl beziehungsweise des Parameterschemas war der **zweite Import erfolgreich**. Dies ist eine behobene Integrationsfrage, kein fehlgeschlagener Livefall.

Die aus dem frischen Server-Editor kopierten **14 Aktionen und der Trigger** stimmen nach dokumentierter Export-/UI-Normalisierung mit dem finalen Paket überein: Verzweigungen, Ausdrücke, `runAfter`, Connectorparameter, logische Verbindungen, Wiederholungen sowie Trigger- und Ordnerkonfiguration zeigen keine unerwarteten Unterschiede. Der Editor meldete **0 Fehler und 0 Warnungen**; die frühere erwartete Parallelitätswarnung der Detailseite ist davon getrennt. Der Vergleich allein liest keine vollständige physische Verbindungszuordnung aus. Aktivierung und erfolgreiche Connectorausführung wurden separat belegt.

Die frühere Browser-/Native-Unterbrechung und der Speicherengpass wurden durch erneute Chrome-Verbindung und den geprüften Umzug auf den externen Arbeitsdatenträger überwunden. Alle 16 Original-EMLs, 19 Anlagen und 24 Body-Dateien wurden dort erneut geprüft. Ihre Quelle ist `Gerinst/2testordner` auf `b9ada7d60cdb2ce76dfc06a90834cecce23ab422`; eine Rekonstruktion war nicht erforderlich.

## Liveergebnisse

**PASS** bedeutet hier: erwartetes Skriptergebnis mit erfolgreicher Skriptaktion, passende Einzelaktionsstatus und abgeglichener Endzustand der zugeordneten Nachricht. Ein lediglich grüner Flowlauf genügt nicht. „Prüfordner“ bezeichnet genau **Posteingang → Archive → Avisbetrag fehlt**.

| Nr. | Fall | Live | Geprüftes Ergebnis |
| --- | --- | --- | --- |
| 01 | single-body-pdf | PASS, zweiter Versuch | `3.454,00 Zahlung 4711`; Avis, Posteingang |
| 02 | two-safe-pdfs | PASS | `22.326,96 + 2.359,12 Zahlungsavise`; Avis, Posteingang |
| 03 | two-pdfs-plus-invoice | PASS | Präfix `32.960,47 + 148,94`; Avis, Posteingang |
| 04 | paid-partial-installment | PASS | `4.880,00 Instalment payment`; Avis, Posteingang |
| 05 | swiss-advice | PASS | Präfix `28.044,65`; Avis, Posteingang |
| 06 | spreadsheet-uncertain | PASS | Originalbetreff, keine Kategorie; Prüfordner |
| 07 | multiple-medium | PASS | Originalbetreff, keine Kategorie; Prüfordner |
| 08 | image-only-scan | PASS | Originalbetreff, keine Kategorie; Prüfordner |
| 09 | encrypted-mail | NOT_EXECUTED | Originale S/MIME-Nachrichtenstruktur nicht zugestellt |
| 10 | unclear-payment-hint | PASS | `Überweisung` unverändert, keine Kategorie; Prüfordner |
| 11 | complaint-not-payment | PASS | Betreff, Kategorien und Ordner unverändert |
| 12 | delivery-not-payment | PASS | Betreff, Kategorien und Ordner unverändert |
| 13 | own-outgoing-bcc | PASS | Eigener Absender, externe An-Adresse, Testpostfach in BCC; unberührt |
| 14 | already-prefixed | PASS | Vollständiger historischer Betreff unverändert; nur Avis ergänzt |
| 15 | recoverable-header-existing-categories | NOT_EXECUTED | Fehlerhafter Originalheader und echte Ausgangskategorien nicht gemeinsam live geprüft |
| 16 | B02 | PASS | `826.636,07 Ihre Rechnungen Oktober [B02]`; Avis, Posteingang |

Damit bestanden **7 sichere Avise, 4 Prüffälle und 3 andere Mails**. Die sicheren neu präfixierten Betreffzeilen enthalten Beträge ohne `EUR`, mehrere mit ` + ` verbunden, danach den vollständigen Originalbetreff. Die gespeicherten Abhängigkeiten und tatsächlichen Aktionsstatus bestätigen die erforderliche erfolgreiche Betreffänderung vor der Kategorie. Bei den vier unsicheren Fällen blieben Betreff und Kategorien unverändert; alle vier liegen im korrekt verschachtelten Prüfordner.

Bei **already-prefixed** blieb `AW: 12.347,80 EUR - Zahlungsavis vom 29.10.2026` exakt erhalten. Der Betreff-PATCH wurde übersprungen; der Kategorie-PATCH lieferte HTTP 200 und den unveränderten vollständigen Betreff. Die Outlook-Liste blendet `AW:` visuell aus, die Graph-Antwort bestätigt ihn.

**B02** enthält 27 Seiten und wurde mit Betrag `826636.07` und `confidence = high` erkannt. Die tatsächliche Skriptaktion dauerte laut Start-/Endzeit **85 Sekunden** (23:39:00–23:40:25 Uhr, Europe/Berlin). Der gesamte Lauf dauerte laut abschließender Laufliste **168 Sekunden einschließlich Wartezeit**. Die tatsächliche Zahl von Power-Automate-Wiederholungen ist nicht belegt; der Header `x-servicefabric: NoRetry` beweist sie nicht. Die frühere lokale Dauer von 19,210 Sekunden war eine Node.js-Messung, keine Office-Laufzeit.

## Versandverlauf und Grenzen der Belege

Es gab **15 bestätigte Sendungen für 14 unterschiedliche Fälle**. Für die erste Zustellung von **single-body-pdf** wurde kein zugehöriger Triggerlauf gefunden. Die Oberfläche hatte den Versand trotz Timeout der Klickantwort bestätigt; der Klick wurde deshalb nicht blind wiederholt. Eine spätere, separat protokollierte zweite Zustellung bestand. Der erste ausbleibende Lauf bleibt ein eigener Integrationsbefund; ein Zusammenhang mit dem ersten Polling nach Aktivierung ist nur eine Hypothese. Es erfolgte keine Triggerreparatur.

Beim BCC-Fall scheiterte zunächst das Speichern beziehungsweise Anhängen im Entwurf des freigegebenen Postfachs. Dieser Entwurf wurde ungesendet verworfen. Der tatsächliche Test wurde anschließend vom kontrollierten persönlichen Microsoft-Konto derselben eigenen Domain an eine externe Testadresse gesendet, das Testpostfach ausschließlich in BCC. Die zugestellte Nachricht enthielt keinen BCC-Header und blieb unverändert. Der verworfene Entwurf zählt nicht als Sendung oder Livefall.

Für alle 14 bewerteten Fälle wurden der Originalbetreff im zugestellten MIME und sämtliche Anlagen anhand von Namen und SHA-256 abgeglichen. Der Wortlaut des Plaintext-Bodys stimmt nach reiner Whitespace-Normalisierung überein. Die normale Neukomposition erhält nicht die vollständigen MIME-/HTML-Bytes. Die finale Laufliste zeigt nur die neuesten zehn Läufe; die vier älteren erfolgreichen Läufe sind durch ihre Einzelbelege abgesichert. Skriptergebnis-JSONs sichern sichtbare UI-Felder und sind keine rohen API-Antworten.

## Zusätzliche lokale Prüfung: Beträge in Betreff und Dateiname

Auf Nachfrage wurden vier zusätzliche Beispiele mit einem eindeutig erkannten PDF-Zahlbetrag von `3.454,00` lokal geprüft. Diese Beispiele sind keine weiteren Microsoft-365-Livefälle und verändern die Bilanz der 16 vorbereiteten Fälle nicht.

| Eingabe | Aktuelles Verhalten bei sicherem PDF-Ergebnis |
| --- | --- |
| Betreff `3.454,00 Zahlungsavis` | Betreff bleibt; Kategorie Avis |
| Betreff `9.999,00 Zahlungsavis` | Neuer Betreff `3.454,00 9.999,00 Zahlungsavis`; danach Avis |
| Betreff `Zahlungsavis 3.454,00` | Neuer Betreff `3.454,00 Zahlungsavis 3.454,00`; danach Avis |
| Datei `Zahlungsavis_9999,00.pdf`, Betreff `Zahlungsavis` | Neuer Betreff `3.454,00 Zahlungsavis`; danach Avis |

Ein passender Betrag wird nur in den unterstützten Präfix-/Altformaten als bereits vorhanden erkannt. Ein abweichender Betrag im Originalbetreff löst derzeit keine eigene Widerspruchssperre aus; bei sicherem Dokumentergebnis wird der erkannte Betrag vor den unveränderten Originalbetreff gesetzt. Auch der abweichende PDF-Dateiname löste im geprüften Beispiel keinen Prüffall aus. Eine zusätzliche Regel, solche Abweichungen grundsätzlich manuell prüfen zu lassen, ist nicht implementiert. Unsichere Parserergebnisse gehen weiterhin unverändert in den Prüfordner. Ein Bankabgleich findet nicht statt.

## Nicht ausgeführte Originalfälle und Nacharbeit

- **09 – encrypted-mail:** Die Archivdatei hat S/MIME als obersten MIME-Typ. Ihr Generator verwendet einen synthetischen 82-Byte-CMS-Payload, keine vollständige reale verschlüsselte Nachricht mit verfügbaren Schlüsseln. Normale Neukomposition oder Versand als `.p7m`-/`.eml`-Anlage verändert den Fall. Für den Originaltest fehlt eine geeignete Zustellung mit überprüfbar erhaltener MIME-Struktur. Ein bestandener synthetischer Test würde außerdem keine allgemeine Freigabe echter geschützter Mails ersetzen.
- **15 – recoverable-header-existing-categories:** Der absichtlich fehlerhafte Header `broken folded line without colon` wird beim gewöhnlichen Schreiben einer Mail nicht erhalten. Zusätzlich müssen die echten Outlook-Ausgangskategorien `Wichtig` und `Kunde A` vor Verarbeitung vorhanden sein; MIME-`Keywords` belegen das nicht. Eine Zustellung mit kontrollierter Headererhaltung und Kategorienvorbelegung steht aus.

Beide Fälle sind **nicht ausgeführt**, keine fehlgeschlagenen Tests und keine bestandenen Ersatztests. Die Erhaltung bereits vorhandener Outlook-Kategorien ist dadurch live noch nicht abgedeckt. Ebenso fehlt ein bewusst provozierter Betreff-PATCH-Fehler: Die Erfolgsvoraussetzung vor der Kategorie ist über die gespeicherte Definition und erfolgreiche Läufe geprüft, ihr Fehlerpfad wurde nicht künstlich ausgelöst. GET, Vergleich und PATCH bleiben getrennte Operationen; das im lokalen Testbericht dokumentierte Konkurrenzrisiko ist nicht aufgehoben.

Für eine vollständige Abnahme müssen die beiden Originalfälle unter passenden Voraussetzungen nachgeholt und der ausgebliebene erste Triggerlauf gesondert geklärt werden. Die abgeschlossene Auswertung dieses Durchlaufs lautet **14 PASS, 2 NOT_EXECUTED, 0 fachlich fehlgeschlagene ausgeführte Fälle**; sie ist keine vollständige 16/16-Freigabe.
