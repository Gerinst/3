# Sicherheitsprüfung vom 02.11.2026

**Nachtrag 03.11.2026:** Die Betreffkonflikt-Regel bestand **727 Fälle aus 11 Hauptflow-Suiten**, die TypeScript-Typprüfung, **19 vorbereitete Mail-Fixtures** und **84 Office-Emulatorvergleiche**. Das Skript wurde in Office gespeichert. Anschließend bestanden **alle 17 gesonderten Livefälle fachlich**: zwei Betreffkonflikte unverändert und ohne Kategorie im Prüfordner, 15 Nicht-Avise unverändert hinsichtlich Betreff, Kategorien und Posteingangsordner. Die zusätzliche MIME-Prüfung bestand für 13 Fälle; bei vier Fällen blieb sie wegen gekürzter Erfassung unverifiziert. Belegumfang und Grenzen stehen im [Nachtrag](BETREFFKONFLIKT-2026-11-03.md). Zwei bekannte GET/PATCH-Konkurrenzrisiken bleiben bestehen. Dieser neue Hauptflow-Lauf lässt Plan B vollständig aus. Zusätzlich wurden **alle 2.920 Archivdateifälle** am finalen Quellstand ausgeführt: keine fehlenden Eingaben oder Sollwerte, keine Ausführungsfehler und keine verletzten Freigabeinvarianten. **46 erwartete Nicht-Avise wurden dennoch konservativ zur Prüfung eingestuft**; die allgemeine Vorgabe, andere Mails unberührt zu lassen, ist für diese Archiveingaben somit nicht erfüllt. Dies bleibt eine offene Erkennungsgrenze, trotz bestandenem Sicherheitsrunner. Die bisher fehlenden 530 Fälle und die beiden Sprachgruppen mit jeweils 200 Fällen sind tatsächlich enthalten; Einzelheiten und Herkunft stehen im verlinkten Nachtrag. Die folgenden Abschnitte bewahren die Ergebnisse der früheren Sicherheitsprüfung; der historische 16er-Livedurchlauf bleibt bei 14 PASS und 2 nicht ausgeführten Originalfällen.

Der aktuelle Stand wurde lokal mit **671 Prüffällen in zehn Suiten** geprüft. Alle erwarteten Ergebnisse wurden erreicht. Darin enthalten sind **vier ausdrücklich nachgewiesene Restprobleme** in der Flow-Simulation, keine vier behobenen Fehler. Zusätzlich bestanden der TypeScript-Typcheck und die Browserprüfung der HTML-Hilfe auf Desktop- und Mobilgröße.

**Das ist keine Zusicherung einer hundertprozentigen Erkennung und keine Microsoft-365-Live-Abnahme.** Der Parser wertet Regeln und Dokumentinhalte aus. Er kann weder den Wahrheitsgehalt einer Zahlungsmitteilung noch einen tatsächlichen Bankeingang bestätigen. Das Projekt ändert Betreff/Kategorie und verschiebt Nachrichten; es führt keine Buchung aus. Auch ein LLM würde diese Nachweise nicht ersetzen.

Die [Liveprüfung vom 02.11.2026](LIVE-ABNAHME-2026-11-02.md) dokumentiert **14 bestandene Livefälle einschließlich B02 und 2 nicht ausgeführte Originalfälle**. Sicherungen und Umzug sind abgeschlossen; Skript und Hauptflow sind aktualisiert, gespeichert, geprüft und aktiv. Die vollständige 16/16-Abnahme bleibt offen. Der Bericht benennt die beiden MIME-Sonderfälle, den separat ausgebliebenen ersten Triggerlauf und die Grenzen der Nachweise.

## Was genau getestet wurde

| Suite unter `tests/` | Fälle | Gegenstand |
| --- | ---: | --- |
| `multiple-advices.cjs` | 89 | Bestehende Mehrfachbetrags-, Betreff- und Vertrauensregeln |
| `review-routing.cjs` | 116 | Beide Ablaufmodelle, Erfolgs-/Fehlerabhängigkeiten, Prüfordner und Übereinstimmung aller 14 Formeln |
| `runtime-budget.cjs` | 56 | Dekodierung, ungültige PDF-Parameter und kontrollierter Budgetablauf |
| `safety-semantics.cjs` | 119 | Zahlung oder Nichtzahlung, Storno, Freigabe, Teilzahlung, Gutschrift, Betragsschreibweisen, Widersprüche in Mail und Anlage |
| `safety-multiple.cjs` | 96 | Einzelne Zahlungsidentitäten, gleiche Beträge, Kopien, zusätzliche Zahlungen, beschädigte weitere Anlagen |
| `safety-formats.cjs` | 59 | Echte synthetische XLSX-/ODS-/MSG-/EML-/CMS-Dateien sowie XML, JSON, RTF und HTML; vollständige und beschädigte Varianten |
| `safety-runtime.cjs` | 69 | CMaps, Schriften, Objektströme, rekursive PDF-Strukturen, abgeschnittene Dateien und lange Tokenfolgen |
| `safety-envelope.cjs` | 16 | Tatsächliches Zielpostfach, eigene Blindkopien, irreführende Empfangsheader, fehlerhafte Konfiguration |
| `safety-flow.cjs` | 46 | Zustandsbehaftete Simulation von Änderungen, Fehlern, Wiederholungen und Nachrichten-IDs; einschließlich vier offener Restprobleme |
| `safety-volume.cjs` | 5 | 20/31 Anlagen, 72 PDF-Seiten, Gesamtsumme am Ende, abgeschnittenes großes Beispiel |

Die Parserprüfungen rufen das tatsächliche Office-Skript `main()` oder gezielt seine Decoder auf. Sie verwenden künstlich erzeugte Eingaben mit bekannten Sollbeträgen. Unsichere Fälle müssen `needsReview = true` und leere Schreibfelder liefern; normale andere Mails müssen unverändert bleiben. Positive Kontrollfälle verhindern, dass schlicht alle Nachrichten zur Prüfung geschickt werden. Bei komplizierten Lastfällen ist eine konservative Prüfung erlaubt; eine falsche automatische Freigabe nicht.

Die Flow-Prüfungen lesen die tatsächliche HTML-Definition und Formeln, führen sie jedoch in einem lokalen Modell aus. Verschieben, Nachrichten-ID-Wechsel, fehlgeschlagene HTTP-Antworten und ein trotz Timeout serverseitig erfolgter Versand werden **simuliert**. Sie beweisen keine Microsoft-Berechtigungen, Connector-Antwortformate oder Zustellgarantien.

Die Format-Fixtures sind im Repository reproduzierbar. ZIP-Prüfsummen und XML-Strukturen der Tabellen wurden zusätzlich mit unabhängigen Standardwerkzeugen geprüft; die MSG-Fixture wird als Outlook-CFB-Datei erkannt. Die CMS-Fälle prüfen das Lesen der Containerstruktur, **keine kryptografische Signaturvalidierung**. Die Beispieldateien ersetzen keinen repräsentativen Bestand echter Kundenbelege.

## Gefundene und behobene Fehler

- **Falsche Sicherheit trotz Nichtzahlung:** Explizit nicht ausgeführte, nicht freigegebene, ausstehende, fehlgeschlagene oder stornierte Zahlungen konnten zuvor durch einen starken Avis-Titel überstimmt werden. Widersprüche in der Mail sperren jetzt auch ein für sich starkes PDF. Eine negierte Aussage wie „No payment was executed“ hebt einen Widerruf nicht mehr auf.
- **Widersprüchliche Angaben:** Unterschiedliche ausdrücklich genannte Zahlungswährungen sowie nicht dem Postfach zuordenbare Begünstigte verhindern automatische Verarbeitung. Kaufmännische Gutschriften zur Verrechnung werden nicht als Zahlung freigegeben.
- **Verlorene oder doppelt verstandene Zahlungen:** Verschiedene Zahlungsreferenzen mit gleichem Betrag bleiben getrennt. Dieselbe Referenz mit unterschiedlichen Beträgen und unklare Beziehungen zwischen Einzel- und Mehrfachlisten führen zur Prüfung. Nur das gemeinsame Vorkommen einer Referenz und eines Betrags in einer Liste genügt nicht als Zuordnungsnachweis.
- **Unbemerkte unlesbare Quellen:** Eine beschädigte zusätzliche Anlage kann weitere Zahlungen enthalten, auch bei neutralem Dateinamen. Sie sperrt die automatische Freigabe eines ansonsten lesbaren Avis. Leere oder beschädigte angehängte Mails und CMS-Inhalte verschwinden nicht mehr als normale Nicht-Avise.
- **Unvollständige Dateiauswertung:** Fehlende Excel-Formelwerte, beschädigte XML-/RTF-Strukturen, verkürzte/zyklische MSG-Datenketten und fehlerhafte verwendete PDF-Strukturen dürfen keinen sicher erscheinenden Teilbetrag freigeben.
- **Laufzeit und Rekursion:** Weitere aufwendige Schleifen prüfen das Budget. Ungültige Schriftbereiche und lange Folgen ungültiger PDF-Trennzeichen können nicht mehr auf den nachgewiesenen Wegen endlos laufen oder den Aufrufstapel überfüllen. Die frühere Bündelung der `try/catch`-Blöcke bleibt erhalten; es wurde keine Fehlerbehandlung pro PDF-Token eingeführt.
- **Eigene Zahlungen in Blindkopie:** Der Flow übergibt die tatsächlich konfigurierte Empfangsadresse als `mailboxAddress`. Damit muss das Skript den Postfachinhaber nicht aus fremden An-/Cc-Adressen ableiten. Der Parameter ist für den aktualisierten Flow erforderlich; ältere Aufrufe ohne ihn behalten die bisherigen Grenzen.
- **Veraltete Nachrichtenstände:** Vor Betreff- und Kategorieänderungen wird die Nachricht erneut gelesen. Abweichende Betreffzeilen blockieren die jeweilige Änderung; Kategorien werden aus dem gerade gelesenen Graph-Ergebnis übernommen. Die Kategorie bleibt vom Erfolg einer erforderlichen Betreffänderung abhängig.
- **Unbelegte eigene Kopien:** Eine Mail wird in Plan B nicht mehr allein wegen ihres eigenen Absenders als sicheres Avis kategorisiert. Dieser Zweig bleibt ohne Änderungen.

## Last- und Laufzeitergebnisse

Im abschließenden lokalen Lauf unter Node.js 24 ergaben sich folgende Werte. Die Zeiten schwanken; sie umfassen **keinen** Excel-/Connector-Start.

| Eingabe | Ergebnis | Lokale Zeit |
| --- | --- | ---: |
| 20 Rechnungs-PDFs | Keine Änderungen | 254 ms |
| Avis als 20. Anlage mit neutralem Namen | `1.200,30` korrekt, `high` | 53 ms |
| 31 Anlagen, Avis jenseits der Lesegrenze | Prüfung, keine Schreibfelder | 43 ms |
| 72 Seiten, 720 Rechnungszeilen, Summe auf letzter Seite | `7.200,00` korrekt, `high` | 140 ms |
| Dasselbe PDF am Ende abgeschnitten | Prüfung, keine Schreibfelder | 104 ms |

Das größte dieser synthetischen Mailbeispiele umfasst etwa 77 KB. Es ist kein Benchmark für bildreiche, mehrmegabytegroße oder ungewöhnlich kodierte Kunden-PDFs. Decoder-/Parsertests haben eigene VM-Zeitgrenzen, um einen hängenden lokalen Test abzubrechen. Das Skript selbst behält das **kooperativ geprüfte 90-Sekunden-Budget**; es garantiert keinen harten Abbruch exakt nach 90 Sekunden. Die externe Office-Script-Grenze beträgt 120 Sekunden. Drei konfigurierte Wiederholungen bedeuten höchstens vier Aufrufe insgesamt, jeweils eine Minute Abstand zwischen Wiederholungen. Die Laufzeiten müssen im echten Office-Script-Runtime erneut gemessen werden.

## Offene Grenzen vor produktiver Freigabe

1. **Vier Restprobleme sind weiterhin reproduzierbar.** Eine Änderung des Betreffs oder der Kategorien *nach* dem letzten GET und *vor* dem PATCH kann überschrieben werden. Die Leseprüfung ist keine atomare Versionsprüfung. In Plan B kann ein erneuter Lauf nach erfolgreichem Versand und fehlgeschlagenem Verschieben eine zweite Kopie erzeugen. Dasselbe gilt, wenn der Versand serverseitig erfolgreich war, die Antwort aber in einen Timeout lief. Diese Fälle werden im Test ausdrücklich als `KNOWN LIMITATION` ausgegeben. Plan B bleibt bis zu einer verlässlichen Versandkorrelation und Live-Abnahme **nicht produktiv freigegeben**.
2. **Nicht jede eingehende Mail löst einen Flow aus.** Laut Microsoft kann der Shared-Mailbox-Trigger unter anderem geschützte, zu große oder Nachrichten mit ungültigem Inhalt/Anlagen überspringen. Ohne Triggerlauf kann das Skript die Mail auch nicht in den Prüfordner bewegen. Ein erfolgreicher Flow-Verlauf allein beweist daher keine vollständige Verarbeitung des Posteingangs.
3. **Erkannte Fehler garantieren keine erfolgreiche Verschiebung.** Ein nicht erreichbarer Prüfordner, fehlende Berechtigung oder inzwischen geänderte Nachrichten-ID kann das Verschieben verhindern. Die Mail bleibt dann zur Kontrolle im bisherigen Ordner. Sie bekommt keine Ersatzkategorie.
4. **Regeln können unbekannte Formulierungen und Layouts falsch verstehen.** `high` ist keine mathematische Sicherheit. Die neue Postfachangabe löst auch nicht automatisch alle Alias-, Konzern-Domain- oder unklaren Begünstigtenbeziehungen. Ein ausgeschriebener Avisbetrag ist kein Beweis eines Bankeingangs.
5. **Der aktuelle Gesamtstand ist nicht live abgenommen.** Microsoft-365-Connectoren, tatsächliche Rechte, Ordner-IDs, Antwortformate, Wiederholungen und Office-Laufzeiten konnten hier nicht getestet werden. Historische Live-Berichte in README/Anleitung betreffen frühere Versionen und sind kein aktueller Nachweis.

Für eine belastbare Betriebsabnahme müssen diese Punkte mit einer Testkopie des Flows im tatsächlichen Mandanten geprüft werden. Posteingang, Prüfordner und fehlgeschlagene beziehungsweise ausgebliebene Läufe müssen regelmäßig abgeglichen werden. Gerade beim ersten Einsatz sind auch automatisch als `Avis` markierte Nachrichten gegen die Originalunterlagen zu kontrollieren. Buchungen benötigen weiterhin den jeweiligen fachlichen Nachweis.

Quellen für die Integrationsgrenzen:

- [Microsoft: Office-365-Outlook-Connector, Shared-Mailbox-Trigger](https://learn.microsoft.com/en-us/connectors/office365/#when-a-new-email-arrives-in-a-shared-mailbox-(v2))
- [Microsoft: Trigger-/Nachrichten-Antwortschema](https://learn.microsoft.com/en-us/connectors/office365/#graphclientreceivemessage)
- [Microsoft Graph: Nachricht lesen](https://learn.microsoft.com/en-us/graph/api/message-get?view=graph-rest-1.0)
- [Microsoft Graph: Nachricht aktualisieren](https://learn.microsoft.com/en-us/graph/api/message-update?view=graph-rest-1.0)
- [Microsoft Graph: Weiterleitungsentwurf](https://learn.microsoft.com/en-us/graph/api/message-createforward?view=graph-rest-1.0)

## Prüfung wiederholen

Im Repository mit Node.js 24 oder neuer:

```sh
node tests/run-all.cjs
npx --yes --package typescript tsc --noEmit --target es2020 --skipLibCheck tests/excel-script-stub.d.ts dist/AvisV2.ts
```

Die Browserprüfung ist zusätzlich mit installiertem Playwright und Chromium ausführbar:

```sh
CHROMIUM_PATH=/usr/bin/chromium node tests/browser-smoke.cjs
```

Keine dieser Prüfungen verschickt Mails oder ändert ein Microsoft-365-Postfach. Aktualisiert wird ausschließlich `Gerinst/3`; `Gerinst/2` bleibt unangetastet.
