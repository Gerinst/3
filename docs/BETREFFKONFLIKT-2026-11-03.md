# Nachtrag: widersprüchliche Betreffbeträge am 3. November 2026

**Historischer Bericht der Betreffkonflikt-Fassung:** Die nachfolgenden 17 Livefälle, Archivzahlen und 46 damals offenen Nicht-Avis-Reviews bleiben als ursprünglicher Nachweis erhalten. Die spätere [Nicht-Avis-Korrektur vom selben Tag](NICHT-AVIS-KORREKTUR-2026-11-03.md) wird getrennt geprüft und dokumentiert; ihre lokalen Ergebnisse und ihre Live-Abnahme dürfen nicht mit diesem Durchlauf gleichgesetzt werden.

**Alle 17 Livefälle dieses Nachtrags sind fachlich bestanden: zwei Betreffkonflikte und 15 Nicht-Avise.** Die Offlineprüfungen bestanden ebenfalls; das neue Skript ist in Office gespeichert. Die zusätzliche Prüfung der zugestellten MIME-Inhalte ist für 13 Fälle bestanden und für vier Fälle nicht vollständig verifiziert. Diese Beleggrenze ist unten getrennt ausgewiesen.

**Vollarchivabgleich abgeschlossen:** Der finale Quellstand wurde zusätzlich gegen alle **2.920 Archivdateifälle** ausgeführt. Es fehlen keine Eingaben oder unabhängigen Sollwerte. Der Sicherheitsrunner meldet keine Ausführungsfehler oder verletzten Freigabeinvarianten. Er erlaubt jedoch konservative Reviews: **46 erwartete Nicht-Avise werden zur Prüfung eingestuft**, statt unberührt zu bleiben. Diese Erkennungsgrenze bleibt ausdrücklich offen und ist keine vollständige fachliche Abnahme des Archivbestands.

Der [Bericht vom 02.11.2026](LIVE-ABNAHME-2026-11-02.md) bleibt der historische Nachweis des früheren Durchlaufs. Seine 14 bestandenen Livefälle und zwei nicht ausgeführten Originalfälle gelten nicht als Prüfung dieser neuen Regel. Der Nachtrag betrifft ausschließlich den Hauptflow in `Gerinst/3`; `Gerinst/2` bleibt unverändert.

## Neue Regel

Ein klarer Geldbetragswiderspruch zwischen dem Eingangsbetreff und einem sicher erkannten Zahlbetrag aus einer PDF- oder Excel-Anlage sperrt die automatische Freigabe. Die Nachricht behält ihren vollständigen Betreff und ihre vorhandenen Kategorien. Sie erhält keine neue Kategorie `Avis` und wird nach **Posteingang → Archive → Avisbetrag fehlt** verschoben.

Beispiel: Das PDF belegt **3.454,00 EUR**, der Betreff nennt ausdrücklich **4.454,00 EUR**. Der sichere Anlagenbetrag darf diesen Widerspruch nicht überstimmen. Auch ein bereits vorhandenes Betragspräfix oder ein Antwortpräfix wie `AW:` darf die Prüfung nicht umgehen.

Stimmt der Betreffbetrag mit dem sicher erkannten Zahlungsbetrag überein, bleibt die normale sichere Verarbeitung zulässig. Ein bereits passender vollständiger Präfix wird nicht nochmals ergänzt. Wenn eine Betreffänderung erforderlich ist, muss sie weiterhin erfolgreich abgeschlossen sein, bevor die Kategorie `Avis` gesetzt werden darf. Als andere Mails (`verdict = other`) erkannte Nachrichten bleiben unverändert im Posteingang; die unten dokumentierten 46 vorsichtigen Fehlzuordnungen bleiben offen.

## Grenzen und erwartete Abgrenzung

- Verglichen werden erkennbare Zahlungsbeträge. Rechnungsnummern, Daten, Uhrzeiten, Prozente und Mengen sind nicht allein wegen enthaltener Zahlen Zahlungsbeträge.
- Ein ausdrücklich als Rechnungsbetrag, Skonto oder bloßer Umrechnungsgegenwert bezeichneter Wert ist nicht automatisch ein abweichender Zahlbetrag. Betragsbedeutung und Währung müssen berücksichtigt werden.
- Bei mehreren Zahlungen müssen die Beträge und ihre Zuordnung geprüft werden. Ein bereits präfixierter Mehrfachbetreff darf weder eine zusätzliche widersprüchliche Zahl verbergen noch eine doppelte Präfixierung verursachen.
- Ein nicht sicherer Anlageninhalt wird durch einen passenden Betreff nicht sicher. Die bisherigen Regeln für unklare Avise, beschädigte Inhalte und andere Mails bleiben maßgeblich.
- Der Konfliktvergleich ersetzt keinen Zahlungsnachweis und keine allgemeine Prüfung der inhaltlichen Wahrheit einer Mail. Die vorhandene Trennung von Lesen, Vergleichen und Schreiben bleibt eine Grenze bei konkurrierenden Änderungen.

Die zugehörigen Regressionstests bestanden am unten bezeichneten finalen Quellstand. Die genannten Grenzen bleiben bestehen; bestandene Tests sind keine Garantie für jede mögliche Formulierung oder konkurrierende Änderung.

## Geprüfte Livefälle

Die Auswahl umfasst **genau zwei Konfliktmails und 15 unterschiedliche Nicht-Avise**. Die beiden Konfliktfälle verwenden unveränderte, zuvor bytegeprüfte Originalanlagen mit unabhängig belegten Zahlbeträgen: PDF **3.454,00 EUR**, Excel **12.347,80 EUR**. Ihre Eingangsbetreffe werden für den Konflikttest bewusst gegenüber dem Archiv verändert.

Die Nicht-Avise stammen aus vorhandenen synthetischen Archivnachrichten in `Gerinst/2testordner` auf `b9ada7d60cdb2ce76dfc06a90834cecce23ab422`. Ihre Sollwerte beruhen auf dem Quellmanifest und einer inhaltlichen Prüfung, nicht auf einer Auswahl erfolgreicher Parserausgaben. Ihre ursprünglichen Betreffe, Bodytexte und Anlagen werden beibehalten.

In der Tabelle bedeutet **Prüfordner**: unveränderter Betreff, keine neue Kategorie, Ziel **Posteingang → Archive → Avisbetrag fehlt**. **Unberührt** bedeutet hier: ursprünglicher Betreff und Kategorien unverändert, weiterhin **Posteingang**, keine zusätzliche Kategorie. Alle 17 Testnachrichten waren anfangs ohne Kategorie; die Erhaltung bereits vorhandener Benutzerkategorien wurde in diesem Durchlauf nicht gesondert getestet.

| Fall | Originalbetreff beim Eingang | Typ | Soll und beobachteter Endzustand | Live |
| --- | --- | --- | --- | --- |
| SC-PDF-CONFLICT | `4.454,00 EUR - Zahlung 4711 [SC-PDF-FALSCH]` | Sicheres PDF-Avis mit falschem Betreffbetrag | Prüfordner | PASS |
| SC-XLSX-CONFLICT | `AW: 22.347,80 EUR - Zahlungsavis vom 29.10.2026 [SC-XLSX-FALSCH]` | Sicheres Excel-Avis mit falschem Betreffbetrag | Prüfordner | PASS |
| NA01 | `Your invoice RE-2026010` | Rechnung mit Preisreklamation, PDF | Unberührt | PASS |
| NA02 | `Please cancel invoice RE-2026364` | Stornoanforderung zu einer Rechnung, PDF | Unberührt | PASS |
| NA03 | `Overdue invoice INV-44537` | Zahlungserinnerung im Mailtext | Unberührt | PASS |
| NA04 | `Your shipment is on its way` | Versandmitteilung mit Sendungsverfolgung | Unberührt | PASS |
| NA05 | `Quotation Q-48648` | Angebot, PDF | Unberührt | PASS |
| NA06 | `Purchase Order 4500180264` | Bestellung, PDF | Unberührt | PASS |
| NA07 | `Order Acknowledgment SO-58119` | Auftragsbestätigung, PDF | Unberührt | PASS |
| NA08 | `Second Notice - Past Due Balance (Customer ID 10567)` | Zweite Mahnung, PDF | Unberührt | PASS |
| NA09 | `2027 Price Increase Notification` | Preiserhöhungsmitteilung, PDF | Unberührt | PASS |
| NA10 | `Christmas & New Year opening hours 2026/27` | Öffnungszeiten und Versandtermine, PDF | Unberührt | PASS |
| NA11 | `ISO 9001:2015 certificate` | Zertifikatsmitteilung, PDF | Unberührt | PASS |
| NA12 | `Change in Bank Account Details - w.e.f. 1st November 2026` | Neue Bankdaten für künftige Zahlungen | Unberührt | PASS |
| NA13 | `Price list 2027` | Preisliste, XLSX | Unberührt | PASS |
| NA14 | `Request for quotation` | Angebotsanfrage, XLSX | Unberührt | PASS |
| NA15 | `Complaint - damaged goods` | Warenreklamation mit zurückgehaltener Zahlung | Unberührt | PASS |

Zusätzlich sind passende PDF- und Excel-Betreffe als **zwei lokale Positivkontrollen** vorbereitet. Sie gehören nicht zu den 17 vorgesehenen Liveversandfällen und werden für diesen Nachtrag nicht live versendet.

## Bestandene Offlineprüfungen

Alle folgenden Prüfungen beziehen sich auf den Quelltext mit SHA-256 **`7c6f90c2b9275d7fea063ff8059e903782066a5b2f58f637ae13d2c712587448`**.

| Prüfung am finalen Quellstand | Status | Ergebnis |
| --- | --- | --- |
| Vollständige Regression des Hauptflows | PASS | 727 Fälle in 11 von 11 Suiten bestanden |
| TypeScript-Typprüfung | PASS | Ohne Typfehler abgeschlossen |
| 19 vorbereitete Fälle: zwei passende Kontrollen, zwei Konflikte, 15 Nicht-Avise | PASS | 19 von 19 entsprechen den unabhängigen Sollwerten |
| Office-Emulator in vier vorhandenen Modi | PASS | 21 Fixtures je Modus, 84 vollständige Vergleiche bestanden; Konstruktorregression erkannt |
| Vollständiger Archivbestand einschließlich wiedergefundener Originaldateien | Ausgeführt | 2.920 von 2.920 Dateifällen, 0 Ausführungsfehler und 0 verletzte Freigabeinvarianten; 46 erwartete Nicht-Avise gehen konservativ zur Prüfung |

Die Hauptflow-Simulation enthält weiterhin zwei ausdrücklich reproduzierte Grenzen: Eine Betreffänderung zwischen abschließendem GET und PATCH kann überschrieben werden; eine dazwischen hinzugefügte Kategorie kann verloren gehen. Diese bestandenen Nachweistests bedeuten nicht, dass die Risiken behoben wurden.

Die Office-Emulator-Fixtures enthalten passende und widersprüchliche Betreffe für echte generierte PDF- und XLSX-Anlagen sowie einen passenden und einen falschen Mehrfachpräfix. Unabhängige fachliche Assertions prüfen die Reviewentscheidung und fehlende Schreibfreigaben beziehungsweise die sichere Verarbeitung ohne Doppelpräfix. Ein bloßer Gleichstand zwischen synchronem und umgewandeltem Code genügt nicht. Die Emulatorprüfung ist eine lokale Modellprüfung und keine Ausführung in Microsofts Office-Laufzeit.

Die erste neue Excel-Positivfixture war ungeeignet: Ihr Betrag musste aus Tabellenzeilen berechnet werden und war bereits ohne Betreffwiderspruch unsicher. Für den gezielten Vergleich wurde sie durch eine echte XLSX-Datei mit ausdrücklich ausgewiesenem Zahlbetrag ersetzt. Danach bestanden PDF, Excel und Mehrfachpräfix in allen vier Emulator-Modi mit den erwarteten sicheren beziehungsweise gesperrten Schreibaktionen. Diese Korrektur betraf die Testfixture, nicht den Parser.

## Vollständiger Archivabgleich

Der unveränderte Runner `tests/legacy-corpus.cjs` führte den finalen Quellstand am Codecommit **`7e8d510953741a8589b312d7a2be899f3a7cad26`** gegen **2.920 Dateifälle** aus. Daraus ergeben sich 2.834 unterschiedliche Ausführungen bei 2.816 unterschiedlichen Datei-Hashes; gleiche Bytes können mit anderem Betreff oder Postfachkontext gesondert ausgeführt werden. Der Lauf dauerte lokal 65,8 Sekunden. Das ist keine Messung der Office-/Connector-Laufzeit.

Der historische Referenzbestand auf `b9ada7d60cdb2ce76dfc06a90834cecce23ab422` wurde in einen getrennten Prüfbaum kopiert und um **1.215 wiedergefundene Originaldateien aus dem vom Nutzer benannten lokalen Archiv** ergänzt. Darunter sind alle 685 zuvor rekonstruierten Fälle und die damals fehlenden 530 Fälle: 525 Korpus-PDFs sowie fünf Format-/Lastfixtures. Die Originalquellen blieben unverändert; jede Kopie wurde per SHA-256 geprüft. Neu erzeugte Ersatzdateien wurden in diesem abschließenden Lauf nicht verwendet.

Die ursprünglichen unabhängigen Sollwerte wurden unverändert übernommen. Die zentrale `expected.json` ist mit der historischen Fassung byteidentisch. Bei den 685 ehemals rekonstruierten Dateien stimmen 634 der jetzt vorliegenden Originaldateien mit den dokumentierten Rekonstruktionshashes überein; 51 unterscheiden sich. Diese Bytes werden nicht als identisch ausgegeben. Da der vereinigte Prüfbaum kein Git-Checkout ist, meldet der Runner seine `sourceCommit` als `unknown`; ein gesondertes Kopier- und Hashmanifest belegt Herkunft und Referenzstand. Der Parser selbst ist durch Commit und SHA-256 eindeutig bestimmt.

| Kennzahl | Historischer Lauf | Finaler vollständiger Lauf |
| --- | ---: | ---: |
| Ausgeführte Dateifälle mit unabhängigem Soll | 2.390 | 2.920 |
| Fehlende Dateifälle | 530 | 0 |
| Ausführungsfehler / verletzte Freigabeinvarianten | 0 / 0 | 0 / 0 |
| Konservative Reviews insgesamt | 781 | 851 |
| Darunter erwartete Nicht-Avise zur Prüfung | 40 | 46 |
| Beobachtete Abweichungen von alten exakten Parsererwartungen | 4 | 5 |

**Die 46 Nicht-Avis-Reviews bleiben eine fachliche Erkennungsgrenze.** Der historische Runner wertet eine solche vorsichtige Sperre als Beobachtung, solange weder `Avis` noch ein Betreff-PATCH freigegeben werden. Im Hauptflow würde `needsReview = true` die Nachricht jedoch in den Prüfordner verschieben. Somit ist die allgemeine Vorgabe „andere Mails unberührt lassen“ für diese Archiveingaben nicht erfüllt. Ein erfolgreicher Sicherheitsrunner darf deshalb nicht als fehlerfreie Erkennung aller 2.920 Fälle gelesen werden.

Die bisherigen 40 Fälle sind nach Dateipfad und Hash unverändert. Die sechs zusätzlichen Fälle stammen ausschließlich aus den erstmals verfügbaren 530 Dateien:

| Archivdatei | Unabhängiges Soll | Aktuelles Ergebnis |
| --- | --- | --- |
| `smallbiz_29_rueckfrage-statt-zahlung.pdf` | Andere Nachricht | Prüfung, keine Schreibfreigaben |
| `traps2_26_zahlungsavis-formular-leer.pdf` | Andere Nachricht | Prüfung, keine Schreibfreigaben |
| `traps2_27_avis-d-echeance.pdf` | Andere Nachricht | Prüfung, keine Schreibfreigaben |
| `traps2_28_dokumenteninkasso-avis.pdf` | Andere Nachricht | Prüfung, keine Schreibfreigaben |
| `netting_11_verrechnung_saldo_negativ.pdf` | Andere Nachricht | Prüfung, keine Schreibfreigaben |
| `nonadvice_11_ratenzahlungsvorschlag.pdf` | Andere Nachricht | Prüfung, keine Schreibfreigaben |

Im bereits historisch verfügbaren Anteil stehen jetzt 784 Reviews gegenüber früher 781; der neu verfügbare Anteil trägt 67 weitere bei. Eine ausdrücklich belegte neue Abweichung ist beabsichtigt: `v2_subject_reply_new_amount.eml` nennt **2.601,35 EUR** im Betreff bei sicherem Excel-Zahlbetrag **12.347,80 EUR**. Der neue Konfliktschutz sperrt nun Betreff- und Kategorieänderung. Die gesamte Differenz von drei Reviews im älteren Anteil wird nicht allein dem Code zugeschrieben: 51 Originaldateien unterscheiden sich von den damals rekonstruierten Bytes, und der historische Bericht enthält keinen vollständigen Ergebnisdump für einen Vergleich jedes Einzelfelds. Die 1.705 unveränderten Originaldateifälle liefern im vorgezogenen und im vollständigen Lauf exakt dieselben Ergebnisfelder.

Auch die beiden Sprachgruppen **`mailF` und `mailFE` mit jeweils 200 Fällen** sind im vollständigen Lauf enthalten. Je Gruppe bleiben alle 100 erwarteten Nicht-Avise ohne Review oder Schreibfreigabe; 68 Avise werden sicher verarbeitet und 32 Avisfälle konservativ geprüft. Diese Gruppen haben keine verletzten Freigabeinvarianten. Die 400 Sprachfälle sind Teil der 2.920 und werden nicht zusätzlich gezählt.

Die [kuratierte Archivbilanz](BETREFFKONFLIKT-ALTTESTS.json) enthält die vollständigen Kennzahlen, alle 46 Nicht-Avis-Reviews mit Datei-Hashes und Gründen sowie die Herkunftsnachweise.

Der Vollarchivabgleich ist eine lokale Ausführung des tatsächlichen Skripts, keine weitere Liveversendung. Die 17 realen Nachtragsmails und die historischen 16 Livefälle sind getrennte Prüfungen; ihre Ergebnisse werden durch diesen Archivlauf nicht ersetzt.

## Bestätigte Bereitstellung

Vor der Aktualisierung wurden der vorhandene Hauptflow als Paket und der veröffentlichte Office-Skriptquelltext privat gesichert. Sicherungen, Speichernachweise und technische Einzelbelege liegen außerhalb des Repositories; sie enthalten mandantenspezifische Daten.

Der geprüfte neue Skriptstand wurde vollständig in Office eingefügt und tatsächlich gespeichert. Die Oberfläche bestätigte **„Skript gespeichert“** und deaktivierte **„Änderungen verwerfen“**. Der gespeicherte Editorinhalt hat SHA-256 **`882b95ef1f199b9beb2b86920fa398d653cb0234fe83442d67a18d2256e8eb38`**. AST sowie die Folge von Tokens und Kommentaren stimmen mit dem geprüften Quelltext überein; nur die automatische Formatierung unterscheidet sich. Die Syntaxprüfung des Editorinhalts ergab keine Fehler.

Der bestehende Hauptflow wurde für diesen Nachtrag **nicht verändert**. Sein bereits geprüfter `needsReview`-Zweig führt die neue Konfliktentscheidung ohne Betreffänderung und ohne neue Kategorie in den vorhandenen Prüfordner. Die Anpassung liegt im Skript; eine erneute Flowmigration war dafür nicht erforderlich.

## Abgeschlossene fachliche Livebewertung

Genau **17 Nachrichten** wurden kontrolliert versendet und ihren tatsächlichen Flowläufen zugeordnet. Die Bewertung verbindet Versand-/Compose-Belege, Skriptergebnisse, Aktionsstatus und Outlook-Endzustände; ein grüner Flowlauf allein wurde nicht als fachliches Bestehen gewertet.

Bei beiden **Konfliktmails** lieferte das Skript die erwartete Reviewentscheidung ohne Schreibfreigabe für Betreff oder Kategorie. Die Verschiebeaktion war erfolgreich. Beide Nachrichten liegen mit ihrem ursprünglichen Betreff und ohne Kategorie im korrekt verschachtelten Prüfordner. Beim Excel-Fall bestätigt die Verschiebeantwort den vollständigen Betreff einschließlich `AW:`, das die Outlook-Liste visuell ausblendet.

Alle **15 Nicht-Avise** lieferten `verdict = other` und `needsReview = false`. Die ändernden Aktionen wurden übersprungen. Die Outlook-Belege bestätigen alle 15 Originalbetreffe ohne Kategorie im Posteingang. Gelesen-/Ungelesen-Markierungen gehören nicht zu dieser Abnahme; Outlook wurde während der Prüfung parallel geöffnet.

Für zwölf Läufe wurden die Einzelaktionsstatus direkt gesichert. Bei den übrigen fünf belegt die übergeordnete Bedingung `false`, dass sämtliche darunterliegenden Änderungsaktionen übersprungen wurden; ihre Positionen sind durch die bereits geprüfte Flowstruktur bekannt. Nach Ausfall der Erweiterungssteuerung wurde die Belegerfassung über die ältere Flowansicht und die native Oberfläche fortgesetzt.

## Zusätzliche MIME-Prüfung und verbleibende Grenzen

Die zusätzliche Integritätsprüfung der zugestellten MIME-Inhalte bestand für **13 Fälle**. Bei **NA12 bis NA15** ist diese Zusatzprüfung **NOT_VERIFIED**: Die native Accessibility-Ausgabe kürzte den MIME-Wert auf 10.000 Base64-Zeichen, nachdem die Browserverbindung verloren gegangen war. Daraus lässt sich kein vollständiger Hashvergleich des zugestellten Inhalts ableiten. Es wurde kein tatsächlicher Integritätswiderspruch festgestellt.

Diese vier fehlenden Zusatzprüfungen sind keine fehlgeschlagenen Livefälle. Ihre fachlichen Ergebnisse sind durch die vorbereiteten und bestätigten Versanddaten, die echten Skript-/Flowläufe und die Outlook-Endzustände belegt. Eine vollständige MIME-/HTML-Bytegleichheit zwischen Archivoriginal und normal neu verfasster Nachricht wird für keinen Fall behauptet. Die tatsächliche Zahl von Power-Automate-Wiederholungen wurde nicht gemessen.

**Abschluss dieses Nachtrags: 17 von 17 Livefällen fachlich PASS, 0 fachliche Fehlschläge.** Die ergänzende MIME-Prüfung steht bei 13 PASS und 4 NOT_VERIFIED. Die zwei nicht ausgeführten Original-MIME-Fälle des historischen 16er-Durchlaufs bleiben offen; dieser Nachtrag ersetzt oder schließt sie nicht.
