# Nicht-Avis-Korrektur vom 3. November 2026

Die bisher dokumentierten **46 Nicht-Avise mit unerwünschter Reviewentscheidung** werden fachlich korrigiert. Die Archivprüfung verlangt jetzt für jede unabhängig als Nicht-Avis erwartete Eingabe ein vollständig unberührtes Ergebnis. Konservative Fehlverschiebungen werden als echte Fehler gezählt.

Abschließend geprüfter Skriptstand, SHA-256: **`9fa9bd0d9d634f9debe6981aaef7fac1520f1bc849e34d562e92377a1324972f`**. Der Nachtrag betrifft ausschließlich den Hauptflow in `Gerinst/3`. `Gerinst/2` und die historischen Testeingaben bleiben unverändert; Plan B ist vollständig ausgeschlossen.

**Lokale Endprüfung bestanden:** 907 Hauptflow-/Parserprüfungen in zwölf Suiten, Typprüfung, 152 Office-Vergleiche und alle 2.920 Archivfälle. Alle 761 nach aktuellem Soll anderen Mails bleiben unberührt; es gibt keine aktiven fachlichen Findings, fehlenden Eingaben oder Ausführungsfehler. Drei ausdrücklich dokumentierte historische Sollkonflikte bleiben im Bericht sichtbar. Der zusätzlich entdeckte Verlust einer unklaren Marktplatzauszahlung ist korrigiert und durch dauerhafte Gegenproben abgesichert. Sechs vorbereitete Live-Mails bestanden außerdem ihre lokale Vorabprüfung.

<!-- LIVE-STATUS-START -->
**Live-Abnahme dieser Korrektur: NOT_EXECUTED.** Die Browserverbindung wurde während der Vorbereitung unterbrochen. Das neue Skript wurde noch nicht in Microsoft 365 bereitgestellt; dort läuft weiterhin der vorherige Stand. Es wurden keine der sechs neuen Testmails versendet. Die erneute Verbindung allein belegt weder Deployment noch Ausführung; eine spätere Wiederaufnahme wird gesondert dokumentiert.
<!-- LIVE-STATUS-END -->

## Fachliche Abgrenzung

Der Auftrag betrifft eingehende Kundenzahlungen. **Reine Steuererstattungen und Rückerstattungen eines Lieferanten wegen Doppelzahlung sind andere Mails und bleiben unberührt.** Der Nutzer hat diese Abgrenzung am 03.11.2026 ausdrücklich bestätigt. Eine bloße Frage, ob eine Rechnung bezahlt oder ein Zahlungseingang erhalten wurde, ist ohne zusätzliche Zahlungsbestätigung ebenfalls kein Avis.

Die Korrektur erkennt konkrete andere Geschäftsvorgänge: beispielsweise Rückfragen, noch nicht ausgeführte Zahlungsvorschläge, leere Musterformulare, Liefermitteilungen, Informationen zu künftigen Zahlungsläufen oder eindeutig eigene Zahlungsregister. Die Wörter „Avis“, „Zahlung“, „Erstattung“ oder „Gutschrift“ allein bestimmen die Entscheidung nicht.

Eindeutig ausgeführte Zahlungen bleiben geschützt, auch wenn eine Rechnungsreferenz „Self-billing“ oder einen früheren Zahlungsvorschlag nennt. Angaben wie `Payment status: Executed` werden von ausstehenden Statusangaben unterschieden. Eine eigenständige Zahlung neben Steuerinformationen, einem separaten Formularverweis oder einer Zahlungsempfangsfrage darf nicht als andere Mail verschwinden. Unklare oder widersprüchliche tatsächliche Avise bleiben Prüffälle. Das gilt auch bei beschädigten zusätzlichen Anlagen.

## Strenge Orakel und unveränderte Historie

Für ein unabhängiges Soll `other` verlangt [der Archivrunner](../tests/legacy-corpus.cjs) gleichzeitig:

| Ergebnisfeld | Erforderlicher Wert |
| --- | --- |
| `verdict` | `other` |
| `needsReview` | `false` |
| `category`, `patchCategory`, `subjectPrefix`, `newSubject`, `patchSubject` | jeweils die leere Zeichenfolge |

Diese Regel gilt für `truth.kind = other/non-avis`, manuell geprüfte Orakel, alte `expected.json`-Einträge mit `verdict = other` und die ausdrückliche alte Nur-Kategorie-Erwartung des fehlgeschlagenen Überweisungsfalls. Ein früheres `acceptable`-Feld, das Review zuließ, hebt die heutige Vorgabe nicht auf. Solche historischen Erlaubnisse bleiben in den Beobachtungen sichtbar.

Bei **drei unveränderten Eingaben** widerspricht das historische Soll der bestätigten heutigen Fachregel. Ihre aktuellen Sollwerte stehen deshalb offen und getrennt in [current-business-oracles.json](../tests/current-business-oracles.json):

| Eingabe im Testarchiv | Historisches Soll | Aktuelle fachliche Entscheidung |
| --- | --- | --- |
| `test/bench/corpus4/payers/payers_02_finanzamt-ust-erstattung-verrechnung.pdf` | Avis | Steuerbehörde erstattet überschüssige Umsatzsteuer nach Verrechnung; keine Kundenzahlung: unberührt |
| `test/bench/corpus5/letters/letters_08_grosshandel_rueckerstattung_doppelzahlung.pdf` | Avis | Lieferant erstattet eine doppelte Zahlung seiner eigenen Rechnung: unberührt |
| `test/fixtures/v2_fix_a4_question_en.eml` | unklar, Review | Reine Rückfrage zur Bezahlung einer Rechnung ohne Zahlungsbehauptung: unberührt |

Die Entscheidung beruht auf unabhängig extrahierten Dokumentinhalten beziehungsweise dem ursprünglichen MIME-Body und der bestätigten Fachregel. Sie wurde nicht aus einem gewünschten Parserergebnis abgeleitet. Die alten Orakeldateien werden nicht umgeschrieben.

Der Runner aktiviert ein aktuelles Fachorakel nur bei **identischem vollständigem Pfad und SHA-256 der Eingabe**. Ein Hashfehler ist ein aktiver Testfehler; dann wird die neue Regel nicht angewendet. Die ursprünglichen `oracles` sowie alle `supersededEvaluations` und `historicalFindings` bleiben vollständig im Bericht. Nur die ausdrücklich ausgewählten `effectiveOracles` bestimmen die aktive fachliche Bewertung. Der Parser enthält keine Dateinamen- oder Hashausnahmeliste.

## Lokale Endprüfung

| Prüfung | Ergebnis |
| --- | --- |
| Hauptflow-/Parserregression, ohne Plan B | 907 Prüfungen in zwölf Suiten bestanden |
| Neue Nicht-Avis-/Orakel-Suite | 180 Prüfungen bestanden, in den 907 enthalten |
| TypeScript-Typprüfung | bestanden |
| Office-Emulation | 38 Eingaben in vier Modi, 152 Vergleiche bestanden |
| Vorabprüfung der sechs vorbereiteten Live-Mails | sechs lokale Fälle bestanden; kein Liveversand |
| Vollständiger Archivlauf | 2.920 Fälle bestanden nach aktuellen Fachorakeln; drei historische Sollkonflikte separat erhalten |

Die neuen portablen Tests prüfen andere Mails sowie echte und unsichere Kundenavise unabhängig von den Parserheuristiken. Sie enthalten auch 20 Prüfungen der aktuellen Orakelauswahl: unter anderem geänderte Bytes bei gleichem Namen, gleicher Hash unter anderem Pfad, fehlender Hash, doppelte Regeln und unerlaubte Schreibfelder trotz gültiger Regel.

Die Office-Prüfung vergleicht nicht nur synchrone und umgewandelte Ergebnisse: Für die neuen Grenzfälle prüft sie zusätzlich unabhängige fachliche Erwartungen. Eine zwischenzeitliche Fassung scheiterte am Aufruf eines Hilfsfunktionsnamens als Array-Callback im Office-Modell. Der endgültige Stand verwendet dafür eine explizite Schleife mit direkten Aufrufen. Der endgültige Lauf einschließlich Frage- und Marktplatz-Gegenproben bestand alle 152 Vergleiche in vier Modi sowie die Kalibrierung am früheren Lexer-Konstruktorfehler. Eine lokale Emulation ersetzt weiterhin keinen echten Office-Script-Lauf.

Der erste vollständige Endlauf des Zwischenkandidaten `2fbf6b169…` erreichte **10 von zwölf Hauptsuiten**: `runtime-budget` und `safety-envelope` überschritten lokale VM-Grenzen von einer beziehungsweise zwei Sekunden. Im gleichzeitig laufenden Archivtest überschritten `B02` und `v2_burst_section_subtotals.eml` das lokale Limit von 110 Sekunden; damit bestanden dort zwei Ausführungsfehler. Die übrigen ausgewerteten Fälle lieferten keine aktiven semantischen Findings, einschließlich aller 761 nach aktuellem Soll unberührten Nicht-Avise. Der Lauf dauerte lokal 416,6 Sekunden. Währenddessen hing auch die Browserverbindung. Die genaue Ursache der Zeitüberschreitungen wird daraus nicht abgeleitet. Die fehlgeschlagenen Zwischenberichte bleiben erhalten. Im anschließenden seriellen Lauf ohne parallele Browseraktionen bestanden alle zwölf Hauptsuiten und alle 2.920 Archivfälle; das Archiv lief lokal in 75,1 Sekunden ohne Ausführungsfehler. Nach der anschließenden Marktplatzkorrektur wurden Hauptsuite, Office-Prüfung, Typprüfung, sechs lokale Vorabfälle und Archiv erneut seriell ausgeführt. Am endgültigen Stand `9fa9bd0d9…` bestanden alle Prüfungen; der Archivlauf dauerte 69,2 Sekunden ohne Ausführungsfehler. Diese lokalen Laufzeiten sind keine Garantie für Office oder andere Eingaben.

## Vollständiger Archivvergleich

Der [öffentliche Einzel- und Summenbericht](NICHT-AVIS-ALTTESTS.json) enthält alle 46 korrigierten Fehlroutings, die drei ausdrücklich aktualisierten Fachorakel, die zusätzlichen Ergebnisänderungen und die beiden Sprachgruppen. Er enthält keine Postfachadressen, Nachrichten-IDs, privaten absoluten Pfade oder Mailbodys.

Alle **2.920 Eingaben und ihre ursprünglichen Orakel sind hash- beziehungsweise inhaltsgleich zum bisherigen vollständigen Archivlauf**. Es fehlen keine Eingaben oder Sollwerte. Die 2.920 Datensätze entsprechen 2.834 eindeutigen Ausführungen und 2.816 unterschiedlichen Eingabehashes. Es wurden keine neu erzeugten Ersatzdateien verwendet.

Nach den aktuellen Fachregeln gibt es **761 erwartete Nicht-Avise: alle 761 liefern `other`, `needsReview = false` und fünf leere Schreibfelder**. Darin sind sämtliche bisherigen 46 Fehlroutings und die drei offen dokumentierten Fachentscheidungen enthalten. Die strikte Prüfung findet keine aktive Abweichung. Drei historische Findings werden separat erhalten; sie werden nicht gelöscht. Weiterhin führen 792 unsichere Ergebnisse zur Prüfung. Die fünf bereits früher dokumentierten Abweichungen von historischen Verhaltenserwartungen bleiben erhalten.

Der Vergleich von `verdict`, `confidence`, `needsReview`, `amount`, `amountNumber`, `currency` und `paymentAmounts` findet **59 geänderte und 2.861 unveränderte Fälle** gegenüber dem bisherigen vollständigen Stand `7c6f90c2…`: die 46 Korrekturen, die drei Fachorakel-Fälle und zehn weitere Steuer-/Verrechnungsbelege. Bei diesen zehn ändert sich ausschließlich `unclear` mit Review zu `other` ohne Review; Betrag, Währung und Vertrauensstufe bleiben identisch. Die unabhängig aus den Original-PDFs gelesenen Belege betreffen Steuererstattung, Steuerfestsetzung oder Verrechnung beziehungsweise Umbuchung auf Steuerkonten, ohne eigenständige Kundenzahlung. Sie fallen unter dieselbe bestätigte fachliche Abgrenzung. Ihre alten reinen Betrags-/Prüforakel bleiben unverändert. Außerhalb der 46 Korrekturen und drei Fachorakel-Fälle wird kein zuvor sicherer Avis zu Review oder `other` herabgestuft.

Der zusätzliche Inhaltsvergleich hat den Zwischenkandidaten trotz grünem Archivrunner beanstandet: `r4b_r11_guthaben_wird_am_ausgezahlt.pdf` kündigt eine konkrete Marktplatzauszahlung an und hat keine unabhängige Nicht-Avis-Begründung. Die bloße Zukunftsform rechtfertigt kein Verwerfen. Das historische `{check: true}` prüfte diesen fachlichen Verlust nicht und wurde nicht als `other`-Soll umgedeutet. Der endgültige Stand erhält den Fall wieder als Review mit fünf leeren Schreibfeldern; eine portable Gegenprobe und dieselbe Eingabe in allen vier Office-Modi sichern dies ab. Gegenüber dem Zwischenkandidaten `2fbf6b169…` ist dies **die einzige Änderung in den sieben verglichenen Ergebnisfeldern**.

Die **200 deutschen und 200 englischen Mailfälle sind Teil der 2.920**, keine zusätzlichen Livefälle. Je Sprache bleiben alle 100 erwarteten anderen Mails unberührt; 68 sichere Avise werden freigegeben und 32 Fälle bleiben zur Prüfung. Keine der beiden Gruppen hat aktive Findings; die oben verglichenen Entscheidungs- und Betragsfelder sind gegenüber dem bisherigen vollständigen Archivlauf unverändert. Interne Begründungs- und Dokumentdetails können sich unterscheiden.

## Neue Livefälle

<!-- LIVE-CASES-START -->
Alle sechs Fälle sind vorbereitet und lokal vorgeprüft; **keiner wurde bisher versendet oder live abgenommen**. Die Verbindungsunterbrechung während der Vorbereitung ist der dokumentierte Grund für `NOT_EXECUTED`.

| Fall | Inhalt | Fachliches Soll | Live |
| --- | --- | --- | --- |
| `NAFIX-SCHEDULED` | Angekündigter künftiger Zahlungslauf mit XLS-Anlage | Unverändert im Posteingang, keine Kategorie | NOT_EXECUTED |
| `NAFIX-RETURNED` | Rückläufer mit Bitte um neue Bankverbindung | Unverändert im Posteingang, keine Kategorie | NOT_EXECUTED |
| `NAFIX-BANKDETAILS` | Information über neue Bankdaten mit DOCX-Anlage | Unverändert im Posteingang, keine Kategorie | NOT_EXECUTED |
| `NAFIX-PDF-SAFE` | Sicheres PDF-Avis über 3.454,00 EUR | Betrag ohne Währung vor Originalbetreff, danach Kategorie Avis | NOT_EXECUTED |
| `NAFIX-XLSX-MATCH` | Sicheres Excel-Avis über 12.347,80 EUR mit bereits passendem Betreff | Originalbetreff einschließlich `AW:` erhalten, Kategorie Avis | NOT_EXECUTED |
| `NAFIX-PDF-CONFLICT` | PDF-Zahlbetrag 3.454,00 EUR, Betreffbetrag 4.454,00 EUR | Unverändert und ohne neue Kategorie in den Prüfordner | NOT_EXECUTED |

Für die spätere fachliche Bewertung werden tatsächlicher gespeicherter Skriptstand, Skriptergebnis, ausgeführte beziehungsweise übersprungene Änderungsaktionen und Outlook-Endzustand gemeinsam benötigt. Ein erfolgreicher Flowlauf allein ist kein Nachweis des richtigen Ergebnisses.
<!-- LIVE-CASES-END -->

## Fortbestehende Grenzen

Die Korrektur beseitigt keine konkurrierenden Änderungen zwischen dem letzten GET und dem anschließenden PATCH. Betreffänderungen in diesem Zeitfenster können weiterhin überschrieben und zwischenzeitlich ergänzte Kategorien verloren gehen. Diese beiden Grenzen werden in der lokalen Hauptflow-Simulation ausdrücklich reproduziert.

Die erste [Live-Abnahme](LIVE-ABNAHME-2026-11-02.md) bleibt bei 14 PASS und zwei nicht ausgeführten Original-MIME-Fällen. Die frühere [Betreffkonflikt-Abnahme](BETREFFKONFLIKT-2026-11-03.md) bleibt bei 17 fachlichen PASS sowie 13 bestandenen und vier unverifizierten zusätzlichen MIME-Hashprüfungen. Diese Lücken werden durch lokale Regressionen oder die vorgesehenen sechs neuen Nachrichten nicht automatisch geschlossen.

Auch bestandene Tests über den vollständigen verfügbaren Archivbestand sind keine Zusicherung für jede mögliche Nachricht. Das Skript bestätigt weder den Wahrheitsgehalt einer Zahlungsmitteilung noch einen tatsächlichen Bankeingang. Ausgebliebene Trigger, fehlgeschlagene Verschiebungen und verbleibende unsichere Avise müssen weiterhin im Betrieb geprüft werden.
