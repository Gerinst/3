# Avis-Flow Version 2 Schritt für Schritt

Diese Anleitung baut den Flow für ein **freigegebenes Postfach** (Exchange Shared Mailbox). Vom Trigger gelieferte und nicht ausgeschlossene Mails gehen als Ganzes an das Skript: PDF-Anlagen, Excel- und CSV-Dateien, SAP-Exporte und der Mailtext. Nur als **sicher (`confidence = high`)** eingestufte Avise bekommen zuerst den Betrag oder die Betragsliste vorne in den Betreff und danach die Kategorie **Avis**. Avis-Ergebnisse mit `confidence = medium` oder `low` und alle anderen Prüffälle sollen in den vorhandenen Ordner **Posteingang → Archive → Avisbetrag fehlt** verschoben werden. Andere Mails bleiben unberührt. Ein ausgebliebener Trigger oder eine fehlgeschlagene Verschiebeaktion muss im Betrieb gesondert erkannt werden.

Im Folgenden heißt dieser Zielordner kurz **Prüfordner**. `Archive` endet mit **e**; `Avisbetrag fehlt` besteht aus dem Wort **Avisbetrag**, einem Leerzeichen und **fehlt**. Gemeint ist der Unterordner im freigegebenen Postfach.

Die früheren Klickwege und Live-Tests vom 30./31.10.2026 beziehen sich auf den damaligen Stand. Die erste lokale Sicherheitsprüfung vom 02.11.2026 umfasst Parsertests und simulierte Flow-Abläufe; der Gesamtstand ist **noch nicht in Microsoft 365 abgenommen**. Umfang, gefundene Fehler und verbleibende Risiken stehen im [Testbericht](TESTBERICHT.md). **Plan B ist nicht für den Produktivbetrieb freigegeben.** Der aktuelle Nachbau mit Feldern, Einstellungen und Formeln steht in `dist/avis-flow.html` (herunterladen und im Browser öffnen). Ein GitHub-Update ändert einen bereits laufenden Power-Automate-Flow nicht automatisch.

Die ergänzende [Gegenprüfung mit dem alten Testarchiv](GEGENPRUEFUNG-ALTTESTS.md) verwendet die Eingaben aus `Gerinst/2testordner` und aus dessen Originalgeneratoren wiederhergestellte Dateien. Sie trennt verfügbare von fehlenden Eingaben, fachliche Fehler von geänderten früheren Kategorien und konservative Prüffälle von exakt übereinstimmenden Ergebnissen. Dazu kommt eine lokale Office-Script-Simulation. Auch diese Ergebnisse sind keine Live-Abnahme des angeschlossenen Postfachs.

Der [Zwischenstand der Liveabnahme vom 02.11.2026](LIVE-ABNAHME-2026-11-02.md) dokumentiert die **laufende Liveausführung ohne bisherige Abnahme**. Sicherungen und geprüfter Umzug sind abgeschlossen. Skript und Hauptflow sind aktualisiert und gespeichert; die 14 Aktionen und der Trigger sind geprüft, Status **Ein** ist bestätigt. Der erste Fall wurde einmal versendet, Ergebnis offen; 15 weitere Fälle sind noch nicht versendet. Kein Livefall ist bisher als bestanden oder fehlgeschlagen bewertet.

## Überblick

| Ergebnis des Skripts | Aktion an der Original-Mail | Betreff danach im normalen Flow |
| --- | --- | --- |
| Ein Avis, Betrag sicher (`high`) | Erst Betreff, danach Kategorie Avis | `2.601,35 Zahlungsavis` |
| Ein Avis, Betrag nur ziemlich sicher (`medium`) | In den Prüfordner verschieben; keine neue Kategorie | unverändert |
| Ein Avis, Betrag unsicher (`low`) | In den Prüfordner verschieben; keine neue Kategorie | unverändert |
| Mehrere sichere Avise (`high`) mit vollständiger Betragsliste | Erst Betreff, danach Kategorie Avis | `1.200,30 + 5.632,21 + 500,42 Zahlungsavis` |
| Unklar, kein lesbarer Betrag oder unvollständige/ungültige Betragsliste | In den Prüfordner verschieben; keine neue Kategorie | unverändert |
| Export-/Skriptfehler oder Zeitüberschreitung | In den Prüfordner verschieben; keine neue Kategorie | unverändert |
| Kein Avis (Rechnung, Reklamation, Bestellung, Info, Mahnung …) | keine Änderung | unverändert |

„Zahlungsavis“ steht für den ursprünglichen Betreff und wird nicht automatisch hinzugefügt. Beispiel: Aus `Abrechnung Oktober` wird bei einem sicheren Betrag von 5.500,05 Euro `5.500,05 Abrechnung Oktober`. Die Beträge stehen im deutschen Format ohne Währungskürzel vor dem vollständigen Originalbetreff. Ein Leerzeichen trennt beide Teile. **Bei `medium`, `low` oder einem anderen Prüffall bleibt der ursprüngliche Betreff vollständig unverändert.** Es werden weder Betrag noch Prüfzeichen ergänzt. Die Mail wird nur in den Prüfordner verschoben; auch in Plan B entsteht keine Kopie.

`high` ist die höchste vorhandene regelbasierte Stufe des Skripts, keine mathematische Garantie für einen fehlerfreien Betrag. Nur diese Stufe darf automatisch Betreff und Kategorie erhalten. Das Skript führt keine Buchung aus und gleicht keinen tatsächlichen Bankeingang ab; eine Kategorie ist kein Zahlungsnachweis.

Bei mehreren sicheren Avisen verbindet das Skript die einzelnen Zahlbeträge mit ` + `: `1.200,30 + 5.632,21 + 500,42 Abrechnung Oktober`. Es rechnet daraus keine Gesamtsumme. Eine Gesamtsumme im Begleittext, die nur die Zahlungen aus den Anlagen wiederholt, kommt nicht zusätzlich in die Liste. Eine ausdrücklich separat geleistete weitere Zahlung bleibt ein eigener Betrag, auch wenn sie gleich hoch ist. Jede einzelne Zahlung muss sicher belegt und zugeordnet sein; ist eine Zahlung nur `medium` oder `low`, geht die gesamte Mail ohne Betreffänderung und ohne neue Kategorie zur Prüfung. Gleiche Beträge allein beweisen keine Dublette. Widersprüchliche Zahlungsreferenzen oder eine unklare Zuordnung von Einzelavis und Mehrfachliste sperren die automatische Freigabe.

Der normale Flow in Kurzform:

```
Trigger: neue Mail im Posteingang
└─ Keine_Automatik → Wahr
   ├─ Export_email → Run_script
   └─ danach: Bearbeitung_noetig → Wahr
      ├─ Betreff_noetig
      │  ├─ Wahr: Nachricht_vor_Betreff_lesen
      │  │        └─ Betreff_unveraendert → Wahr: Betreff_setzen
      │  └─ Falsch: leer
      └─ danach: Pruefung_noetig
         ├─ Wahr: Avisbetrag_fehlt_verschieben
         └─ Falsch: Kategorie_erlaubt
                    ├─ Wahr: Nachricht_vor_Kategorie_lesen
                    │        └─ Kategorie_Betreff_passt → Wahr: Kategorie_setzen
                    └─ Falsch: leer
```

`Pruefung_noetig` wartet auf die gesamte Bedingung `Betreff_noetig`, auch bei deren Fehler oder Timeout. Prüffälle werden anschließend verschoben. Bei sicheren Avisen prüft **Kategorie_erlaubt**, ob die nötige Betreffänderung tatsächlich erfolgreich war. Vor jedem Schreibschritt wird der Betreff frisch gelesen und verglichen. Ein Lesefehler oder ein abweichender Betreff verhindert den folgenden Schreibschritt. Vor der Kategorie werden außerdem die aktuellen Kategorien gelesen und um `Avis` ergänzt. Bei einem nötigen Betreff-PATCH mit Fehler, Timeout oder übersprungener Aktion bleibt die Kategorie aus. Ist der Betreff schon vollständig richtig und kein PATCH nötig, darf `Avis` nach erneuter Prüfung gesetzt werden. Die Falsch-Zweige der zusätzlichen Vergleiche bleiben leer. Schlägt das Verschieben selbst fehl, wird keine Ersatzkategorie gesetzt; den Fehler im Ausführungsverlauf und den tatsächlichen Nachrichtenort prüfen.

GET, Vergleich und PATCH sind keine atomare Operation. Eine weitere Änderung genau zwischen Lesen und Schreiben kann weiterhin überschrieben werden. Auch ein grün beendeter Flow kann einen leeren Zweig durchlaufen haben; er beweist allein keine erfolgte Bearbeitung.

**Ab 31.12.2026** will Microsoft das Ändern des Betreffs empfangener Mails sperren. Im Januar testen; das weitere Vorgehen steht unter „Ab Januar 2027: Betreff-Sperre prüfen“.

## Was du brauchst

- Ein **freigegebenes Postfach** in Exchange (z. B. `avis@firma.de`). Ein Microsoft-365-Gruppenpostfach geht nicht: Dort kann der Flow weder Kategorie noch Betreff setzen.
- Ein Konto mit Microsoft-365-Business-Lizenz (Excel im Browser und Power Automate), unter dem der Flow läuft. Dieses Konto braucht **Vollzugriff** auf das Postfach.
- Die Datei `dist/AvisV2.ts` (das Skript) und die Formeln aus dem Ordner `formeln/`.
- Etwa eine Stunde Zeit.

Überall, wo `avis@firma.de` steht, die Adresse eures freigegebenen Postfachs einsetzen.

## Schritt 1: Rechte auf das freigegebene Postfach (IT, einmalig)

1. Microsoft 365 Admin Center → **Teams und Gruppen** → **Freigegebene Postfächer** → das Postfach anklicken → im Bereich **Mitglieder** auf **Bearbeiten** → **Mitglieder hinzufügen** → das Konto des Flows anhaken → **Hinzufügen**. Damit hat das Konto Vollzugriff und „Senden als". (Beim Anlegen eines neuen Postfachs bietet das Admin Center den Link „Hinzufügen von Mitgliedern zu Ihrem freigegebenen Postfach" direkt an.)
2. Prüfen (optional): Exchange Admin Center → **Empfänger** → **Postfächer** → das Postfach → Reiter **Delegierung**: Unter „Lesen und Verwalten (Vollzugriff)" steht das Konto.
3. Microsoft nennt bis zu 2 Stunden, bis neue Rechte wirken. Im Test ging es nach wenigen Minuten. Woran man es merkt: In Outlook im Web öffnet sich das Postfach unter `https://outlook.office.com/mail/avis@firma.de/`.

## Schritt 2: Kategorie und vorhandenen Prüfordner auswählen

1. Outlook im Web öffnen und das freigegebene Postfach aufrufen: `https://outlook.office.com/mail/avis@firma.de/`.
2. Für normale Avise unter **Kategorisieren → Kategorien verwalten** die Kategorie `Avis` verwenden; fehlt sie, **Neu erstellen → Avis → Farbe auswählen → Speichern**.
3. Im Ordnerbaum den vorhandenen Pfad **Posteingang → Archive → Avisbetrag fehlt** prüfen. Diesen bestehenden Ordner später in der Aktion **E-Mail verschieben (V2)** über den Ordnerwähler auswählen. Nicht einen gleichnamigen Ordner des eigenen Postfachs verwenden.

Die Kategorien `Avis prüfen` und `mehrere Avise` werden nicht mehr neu vergeben. Vorhandene Kategorien oder alte Mails müssen dafür nicht gelöscht werden. Ohne angelegte Kategorie erscheint `Avis` an normalen Avis-Mails nur grau; die Farbe ist für die Verarbeitung unerheblich.

**Bestehenden Flow aktualisieren:** Das Skript `AvisV2` ersetzen **und** den Parameter `mailboxAddress`, die Leseaktionen, Bedingungen, Verschiebeaktionen und Formeln einbauen. Ein Skriptupdate allein reicht nicht. Die genaue Migration steht nach Schritt 5.12. Die 14 aktuellen TXT-Dateien in `formeln/` ersetzen die bisherige Formelsammlung; `Kategorie_noetig_links.txt` heißt jetzt `Bearbeitung_noetig_links.txt`, `Kopie_pruefen_links.txt` entfällt. Historische Mails werden durch das Update nicht automatisch nachträglich verarbeitet.

## Schritt 3: Skript AvisV2 in Excel anlegen (einmalig)

1. Die Arbeitsmappe `AvisParser.xlsx` aus Version 1 in OneDrive öffnen. Gibt es sie noch nicht: OneDrive im Browser → **Erstellen oder hochladen** → **Excel-Arbeitsmappe** → oben auf den Namen „Mappe" klicken → `AvisParser` eintippen → Enter. Die Mappe bleibt leer.
2. Reiter **Automatisieren** → **Neues Skript** → **Im Code-Editor erstellen**. Erscheint rechts der Hinweis „Aktionen in Skripts umwandeln", auf **Skript schreiben** klicken.
3. Auf GitHub die Datei `dist/AvisV2.ts` öffnen und oben rechts auf **Copy raw file** klicken (Symbol mit den zwei Rechtecken).
4. In den Editor klicken, **Strg+A** (Mac: **⌘+A**), dann **Strg+V** (Mac: **⌘+V**). Das Einfügen dauert ein paar Sekunden. Excel rückt dabei manche Zeilen anders ein. Das ist normal und ändert nichts.
5. Auf das **Speichern-Symbol** (Diskette) klicken. Kommt der Hinweis „Zugeordnetes Skript", mit **OK** bestätigen.
6. Umbenennen: links oben auf **← Alle Skripts** → bei der Karte des neuen Skripts auf **Umbenennen** → im Feld **Name** `AvisV2` eintragen → Tab-Taste. Oben erscheint „Gespeichert ✓".

Das alte Skript `AvisPdfAmount` bleibt, wie es ist. Excel speichert Skripte in OneDrive unter **Dokumente → Office-Skripts** (`AvisV2.osts`).

**Später ein neues Skript einspielen:** Excel → Automatisieren → **Alle Skripts** → **AvisV2** → **Bearbeiten** → Strg+A, Strg+V mit dem neuen Inhalt → Speichern. Der nächste Aufruf verwendet den neuen Skriptinhalt. Für neue Parameter wie `mailboxAddress` das Skript in der Flow-Aktion erneut auswählen und die Felder gemäß Schritt 5.4 belegen; das aktualisiert der Skriptinhalt nicht selbst.

**Nur sichere Avise automatisch bearbeiten:** Das aktuelle Skript `AvisV2` und die aktuellen Formeln einspielen. Ergebnisse mit `medium` oder `low` sind `needsReview = true` und liefern weder Betreffänderung noch Kategorie. **Kategorie_erlaubt** verhindert die Kategorisierung nach einer nicht erfolgreichen nötigen Betreffänderung. Zusätzlich die frischen Leseaktionen und Betreffvergleiche aus Schritt 5.7 und 5.11 einbauen. Ist der Prüfordner-Flow bereits eingerichtet, bleibt das Verschieben bestehen. Bei Prüffällen bleibt der ursprüngliche Betreff einschließlich vorhandener Fragezeichen oder älterer Betragspräfixe erhalten.

## Schritt 4: 5-Minuten-Test (empfohlen, bevor der echte Flow gebaut wird)

Damit prüfst du vorab, ob Vollzugriff und Betreffänderung im Postfach funktionieren.

1. Power Automate → **Erstellen** → **Automatisierter Cloud-Flow** → Name `PATCHTEST` → Trigger suchen: `freigegebenen Postfach` → **Wenn eine neue E-Mail in einem freigegebenen Postfach eingeht (V2)** → **Erstellen**.
2. Trigger anklicken: **Ursprüngliche Postfachadresse** = `avis@firma.de` eintippen und in der Liste **„avis@firma.de" verwenden** anklicken. **Erweiterte Parameter** → **Alle anzeigen** → **Filter für Betreff** = `PATCHTEST`.
3. **+** unter dem Trigger → Suche `HTTP-Anforderung senden Office 365 Outlook` → **HTTP-Anforderung senden** (Office 365 Outlook):
   - **URI**: ins Feld klicken → **fx** → Formel aus `formeln/URI_Kategorie_und_Betreff.txt` (mit eurer Adresse) → **Hinzufügen**
   - **Methode**: `PATCH`
   - **Erweiterte Parameter** → **Alle anzeigen** → **Text**: `{"subject":"2.601,35 PATCHTEST Zahlungsavis"}`
4. Zweite gleiche Aktion unter der ersten, nur **Text**: `{"categories":["Avis"]}`. Bei dieser zweiten Aktion unter **Einstellungen → Ausführen nach** für die erste Aktion ausschließlich **Ist erfolgreich** anhaken. So wird die Kategorie nur gesetzt, wenn die vorherige Betreffänderung erfolgreich war.
5. **Speichern**. Aus dem eigenen Postfach eine Mail mit Betreff `PATCHTEST Zahlungsavis` an `avis@firma.de` schicken und 1 bis 5 Minuten warten.
6. Richtig: In Outlook hat die Mail den neuen Betreff und die Kategorie „Avis", im Ausführungsverlauf sind beide Aktionen grün. Fehler: siehe Fehlertabelle (403, 404, 400).
7. Danach den Testflow ausschalten: Meine Flows → `PATCHTEST` → **⋯** → **Deaktivieren**.

## Schritt 5: Flow „Avis V2" bauen

Allgemeine Hinweise zum Designer:

- **Nachbau daneben öffnen:** `dist/avis-flow.html` herunterladen, im Browser öffnen und oben rechts bei „Postfach" die Adresse eintragen. Jede Karte dort zeigt die Felder genau wie im Designer, mit den fertigen Formeln zum Kopieren. Nach dem Speichern kann man im Reiter **Codeansicht** die Codeansicht des eigenen Flows einfügen und vergleichen lassen.
- **Umbenennen:** Aktion anklicken, oben im Bereich auf den Titel klicken, den neuen Namen eintippen, Enter. Auf der Fläche zeigt Power Automate statt `_` ein Leerzeichen („Run script"). Das ist normal; die Formeln brauchen den Namen mit `_`.
- **Formeln** immer über **fx** einfügen: ins Feld klicken → neben dem Feld auf **fx** (bei Bedingungen erscheinen Blitz und fx links am Feld) → Formel aus der passenden Datei in `formeln/` einfügen → **Hinzufügen**. Meldet der Editor „Der Ausdruck ist ungültig", die Formel prüfen; ist sie genau kopiert, hilft oft ein zweiter Klick auf **Hinzufügen**.
- **Werte aus dem Trigger** (Betreff, Nachrichten-ID): ins Feld klicken → **Blitz-Symbol** → im Suchfeld den Namen eintippen → den Eintrag unter der Überschrift **„Wenn eine neue E-Mail in einem freigegebenen Postfach eingeht (V2)"** anklicken. Für „Betreff" gibt es dort nur einen Eintrag („Der Betreff der Nachricht").
- Tippst du ein „/" in ein Feld, öffnet sich ein kleines Menü. Einfach weitertippen; wählst du dort etwas aus, verschwindet das „/".

### 5.1 Neuer Flow und Trigger

1. Power Automate → **Erstellen** → **Automatisierter Cloud-Flow** → Name `Avis V2`.
2. Trigger suchen: `freigegebenen Postfach` → **Wenn eine neue E-Mail in einem freigegebenen Postfach eingeht (V2)** → **Erstellen**.
3. Trigger anklicken:
   - **Ursprüngliche Postfachadresse**: `avis@firma.de` eintippen → **„avis@firma.de" verwenden** anklicken. Gemeint ist die Adresse des **freigegebenen Postfachs**, in dem die Avise ankommen, nicht die eigene Adresse und keine Microsoft-365-Gruppe (in Outlook im Web steht ein freigegebenes Postfach links als eigenes Postfach mit eigenem Posteingang; die Adresse steht beim Öffnen in der Adresszeile: `…/mail/avis@firma.de/`). Dieselbe Adresse kommt in Export_email und in die URI-Formeln.
   - **Erweiterte Parameter** → **Alle anzeigen**:
     - **Nur mit Anlagen**: **Nein** (auch Avise nur im Mailtext sollen ankommen)
     - **Anlagen einschließen**: **Nein** (die Anlagen holt Export_email)
     - **Ordner**: Ordnersymbol rechts im Feld → ausschließlich **Posteingang**; den Unterordner Archive/Avisbetrag fehlt nicht als Triggerordner wählen
     - alle anderen Felder leer lassen
4. Reiter **Einstellungen** des Triggers:
   - **Parallelitätssteuerung**: **Ein**
   - **Grad der Parallelität**: `1`
   - **Maximale Anzahl wartender Ausführungen**: `100`

   Grund: Excel lässt das Skript höchstens 3-mal in 10 Sekunden laufen. Mit Grad 1 arbeitet der Flow die Mails nacheinander ab. Die Flowprüfung zeigt dazu den Hinweis „Drosselung der Trigger-Parallelität erkannt". Den kann man ignorieren.

### 5.2 Bedingung Keine_Automatik

1. **+** unter dem Trigger → Suche `Bedingung` → **Bedingung** (Steuerung) → umbenennen in `Keine_Automatik`.
2. Verknüpfung oben links: **Und**.
3. Fünf Zeilen, jede so: links Blitz → **Betreff** (unter der Überschrift des Triggers), Mitte **enthält nicht**, rechts der Text:
   - `Automatische Antwort`
   - `Abwesend`
   - `Unzustellbar`
   - `Automatic reply`
   - `Undeliverable`
4. Der Designer hängt nach dem Ausfüllen oft eine leere Zeile an: rechts **⋯** → **Löschen**. Nach dem Speichern und Neuladen zeigt er trotzdem wieder eine leere Zeile an; die wird nicht gespeichert und stört nicht.

Alle folgenden Aktionen kommen in den Zweig **Wahr** von Keine_Automatik. Der Zweig **Falsch** bleibt leer.

### 5.3 Export_email

1. Im Zweig **Wahr**: **+** → Suche `E-Mail exportieren` → **E-Mail exportieren (V2)** (Office 365 Outlook) → umbenennen in `Export_email`.
2. **Nachrichten-ID**: Blitz → im Suchfeld `Nachrichten` → den Eintrag **Nachrichten-ID** („Der eindeutige Bezeichner der Nachricht") anklicken. Nicht **Internetnachrichten-ID**, die direkt darüber steht: Damit findet der Flow die Mail nicht.
3. **Erweiterte Parameter** → **Alle anzeigen** → **Ursprüngliche Postfachadresse**: `avis@firma.de` eintippen → **„avis@firma.de" verwenden**.

Die Aktion gibt die ganze Mail als Datei (.eml) weiter: Text, alle Anlagen, auch weitergeleitete Mails.

### 5.4 Run_script

1. **+** unter Export_email → Suche `Skript ausführen` → **Skript ausführen** (Excel Online (Business)) → umbenennen in `Run_script`.
2. Fragt Power Automate nach einer Anmeldung für Excel: **Anmelden** und im Microsoft-Fenster das Konto des Flows anklicken. (Öffnet sich kein Fenster, hat der Browser es blockiert: rechts in der Adressleiste Pop-ups für make.powerautomate.com erlauben.)
3. Felder:
   - **Speicherort**: **OneDrive for Business**
   - **Dokumentbibliothek**: **Dokumente** (englische Oberfläche: OneDrive)
   - **Datei**: Ordnersymbol → **AvisParser.xlsx**
   - **Skript**: **AvisV2**
   - **pdfBase64**: **fx** → Formel aus `formeln/Run_script_pdfBase64.txt`: `base64(body('Export_email'))`
   - **Erweiterte Parameter** → **Alle anzeigen** → **mailSubject**: Blitz → **Betreff** (Trigger)
   - **mailboxAddress**: die tatsächliche Adresse des freigegebenen Postfachs als festen Konfigurationswert eintragen, z. B. `avis@firma.de`. Nicht **An**, **Cc** oder einen anderen Wert aus der Mail verwenden. Bei Blindkopien kann dort eine fremde Adresse stehen. Fehlt das Feld, `AvisV2` in der Aktion nach dem Speichern des Skripts erneut auswählen.
   - **extraKeywords**: leer lassen
4. Reiter **Einstellungen** → **Wiederholungsrichtlinie**: **Festes Intervall**, **Anzahl** `3`, **Intervall** `PT1M`. Das sind höchstens drei Wiederholungen mit je einer Minute Abstand, zusätzlich zum ersten Aufruf: maximal vier Anläufe von Run_script.

`mailboxAddress` ist im Skript aus Kompatibilitätsgründen optional, im aktuellen Flow aber auszufüllen. Ohne diesen Wert verwendet die Erkennung wieder die Mailkopf-Angaben; eine eigene ausgehende Zahlung in Blindkopie kann dann fälschlich wie ein Kunden-Avis aussehen. Ein ungültiger Konfigurationswert führt zur Prüfung.

Im historischen Lasttest vom 30./31.10.2026 mit 40 Mails brauchte ein Lauf meist 8 bis 20 Sekunden, auch für ein Avis mit 72 Seiten oder eine Mail mit 20 PDF-Anlagen; das meiste davon ist der Start von Excel. Das ist kein Laufzeitnachweis für den aktuellen Stand.

### 5.5 Bedingung Bearbeitung_noetig

1. **+** unter Run_script → **Bedingung** → umbenennen in `Bearbeitung_noetig`.
2. Eine Zeile: links **fx** → `formeln/Bearbeitung_noetig_links.txt`, Mitte **ist gleich**, rechts **fx** → `true`. Leere Zeile löschen.
3. **Einstellungen → Ausführen nach → Run script**: **Ist erfolgreich**, **Timeout**, **Ist fehlgeschlagen** und **Wurde übersprungen** anhaken.

Die Bedingung lässt normale Avise, Prüffälle und Fehlerfälle weiterlaufen. „Wurde übersprungen“ ist nötig, weil nach einem Fehler in Export_email das Skript nicht startet. Ist dagegen bereits der gesamte Wahr-Zweig von Keine_Automatik ausgeschlossen, bleibt auch Bearbeitung_noetig darin übersprungen. Automatische Antworten werden dadurch nicht nachträglich verarbeitet.

### 5.6 Bedingung Betreff_noetig

1. Als erste Karte im Zweig **Wahr** von Bearbeitung_noetig: **+ → Bedingung** → Name `Betreff_noetig`.
2. Links **fx** → `formeln/Betreff_noetig_links.txt`, Mitte **ist gleich**, rechts **fx** → `true`.
3. Der **Falsch**-Zweig bleibt leer. Als erster Schritt in diesem Zweig hat die Bedingung keinen Vorgänger bei **Ausführen nach** (`"runAfter": {}`).

Nur bei sicheren Avisen (`confidence = high`) wird ein neuer Betrag oder eine neue vollständige Betragsliste vor den Betreff gesetzt. Bei `needsReview = true` gibt es keinen Betreff-PATCH; auch ein möglicherweise erkannter Betrag aus `medium` oder `low` wird nicht ergänzt. Der ursprüngliche Betreff bleibt erhalten und die Mail wird verschoben. Für Plan B die inhaltlich gleiche Formel `Betreff_noetig_Plan_B_links.txt` verwenden, damit Prüffälle keine Kopie erzeugen.

### 5.7 Betreff frisch lesen, vergleichen und setzen

1. Als erste Aktion im Zweig **Wahr** von Betreff_noetig: **+ → HTTP-Anforderung senden** (Office 365 Outlook) → Name `Nachricht_vor_Betreff_lesen`.
2. **URI** über **fx**: `formeln/Nachricht_lesen_URI.txt`, mit der Adresse des freigegebenen Postfachs. **Methode**: **GET**. Keinen Text/Body eintragen. Die Antwort enthält den aktuellen Betreff und die aktuellen Kategorien.
3. Darunter eine **Bedingung** namens `Betreff_unveraendert` anlegen. Links **fx** → `formeln/Betreff_unveraendert_links.txt`, Mitte **ist gleich**, rechts **fx** → `true`. **Ausführen nach → Nachricht vor Betreff lesen**: nur **Ist erfolgreich**.
4. Der **Falsch**-Zweig bleibt leer. In den **Wahr**-Zweig die HTTP-Aktion `Betreff_setzen` setzen. **URI** über **fx**: `formeln/URI_Kategorie_und_Betreff.txt`, mit derselben Postfachadresse.
5. **Methode**: **PATCH**. **Erweiterte Parameter → Alle anzeigen → Text** über **fx**: `formeln/Betreff_setzen_Text.txt`. **Content-Type**: `application/json`. Als erste Aktion dieses Wahr-Zweigs hat Betreff_setzen keinen eigenen Vorgänger bei **Ausführen nach**.

Der frisch gelesene Betreff muss exakt dem Betreff aus dem Trigger entsprechen. Hat inzwischen jemand die Mail umbenannt, bleibt die Betreff-Aktion aus; damit erlaubt auch Kategorie_erlaubt keine anschließende Kategorie. Einen Lesefehler oder abweichenden Betreff im Verlauf prüfen. Eine Änderung nach dem Vergleich und vor dem PATCH kann ohne atomare Versionsprüfung weiterhin passieren.

### 5.8 Bedingung Pruefung_noetig

1. Auf das **+ unter der gesamten Bedingung Betreff_noetig** klicken, noch im Wahr-Zweig von Bearbeitung_noetig. Die neue Bedingung liegt auf derselben Ebene wie Betreff_noetig, außerhalb beider Zweige.
2. **Bedingung** erstellen, Name `Pruefung_noetig`. Links **fx** → `formeln/Pruefung_noetig_links.txt`, Mitte **ist gleich**, rechts **fx** → `true`.
3. **Einstellungen → Ausführen nach → Betreff noetig**: **Ist erfolgreich**, **Timeout** und **Ist fehlgeschlagen** anhaken. **Wurde übersprungen** bleibt aus.

Die Formel erkennt `needsReview = true`, einen fehlgeschlagenen/übersprungenen Skriptlauf und als Übergangsschutz auch ein älteres Skriptergebnis mit `category = Avis prüfen`. **Wahr** verschiebt das Original in den Prüfordner. **Falsch** führt zu **Kategorie_erlaubt**. Diese weitere Bedingung lässt die Kategorie `Avis` erst zu, wenn eine nötige Betreffänderung erfolgreich war oder kein neuer Betreff benötigt wurde. Die alte Ersatzformel für die Kategorie „Avis prüfen“ wird nicht mehr verwendet.

### 5.9 Avisbetrag_fehlt_verschieben

1. Im Zweig **Wahr** von Pruefung_noetig: **+** → Suche `E-Mail verschieben` → **E-Mail verschieben (V2)** (Office 365 Outlook) → Name `Avisbetrag_fehlt_verschieben`.
2. **Nachrichten-ID**: Blitz → **Nachrichten-ID** des Triggers, nicht Internetnachrichten-ID.
3. **Erweiterte Parameter → Alle anzeigen → Ursprüngliche Postfachadresse**: zuerst die Adresse des **freigegebenen Postfachs** eintragen und bestätigen.
4. Erst danach bei **Ordner** den Ordnerwähler öffnen und **Posteingang → Archive → Avisbetrag fehlt** auswählen. Der Designer hinterlegt die ID des vorhandenen Ordners. Ein bloß eingetippter Pfad ersetzt diese Auswahl nicht.
5. Die Aktion ist die erste und einzige Aktion in diesem Wahr-Zweig; keine Abhängigkeit von Kategorie_setzen eintragen. Danach kommt keine Kategorie-Aktion.

Das Original wird mitsamt seinen vorhandenen Kategorien verschoben. Der Flow vergibt für diesen Fall keine neue Kategorie. Bei einem Verschiebefehler den Ausführungsverlauf und die Ordner-/Postfachauswahl prüfen; es gibt keine Ersatzkategorisierung.

### 5.10 Bedingung Kategorie_erlaubt

1. Als erste Karte im Zweig **Falsch** von Pruefung_noetig: **+ → Bedingung** → Name `Kategorie_erlaubt`.
2. Links **fx** → `formeln/Kategorie_erlaubt_links.txt`, Mitte **ist gleich**, rechts **fx** → `true`. In Plan B stattdessen `formeln/Kategorie_erlaubt_Plan_B_links.txt` verwenden.
3. Der **Falsch**-Zweig bleibt leer. Als erste Karte in diesem Zweig hat die Bedingung keinen Vorgänger bei **Ausführen nach** (`"runAfter": {}`).

Die Formel lässt die Kategorie nur zu, wenn `patchSubject` leer ist (der Betreff ist bereits richtig) oder **Betreff_setzen** tatsächlich erfolgreich war. In Plan B muss stattdessen **Kopie_senden** erfolgreich sein, wenn eine Kopie nötig war. Eine fehlgeschlagene, abgelaufene oder übersprungene nötige Aktion erlaubt keine Kategorie.

### 5.11 Nachricht erneut lesen, Betreff prüfen und Kategorie setzen

1. Als erste Aktion im Zweig **Wahr** von Kategorie_erlaubt: **+ → HTTP-Anforderung senden** (Office 365 Outlook) → Name `Nachricht_vor_Kategorie_lesen`.
2. **URI** über **fx**: `formeln/Nachricht_lesen_URI.txt`, mit der Adresse des freigegebenen Postfachs. **Methode**: **GET**, kein Text/Body.
3. Darunter eine **Bedingung** namens `Kategorie_Betreff_passt` anlegen. Links **fx** → `formeln/Kategorie_Betreff_passt_links.txt`, Mitte **ist gleich**, rechts **fx** → `true`. **Ausführen nach → Nachricht vor Kategorie lesen**: nur **Ist erfolgreich**. Der Falsch-Zweig bleibt leer.
4. Im **Wahr**-Zweig HTTP-Aktion `Kategorie_setzen` anlegen. **URI** über **fx**: `formeln/URI_Kategorie_und_Betreff.txt`. **Methode**: **PATCH**. **Text** über **fx**: die aktuelle `formeln/Kategorie_setzen_Text.txt`. **Content-Type**: `application/json`.
5. Als erste Aktion in diesem Wahr-Zweig hat Kategorie_setzen keinen Vorgänger bei **Ausführen nach** (`"runAfter": {}`). Alte direkte Abhängigkeiten entfernen.

Der Betreff muss jetzt dem erfolgreich geschriebenen neuen Betreff entsprechen; war kein PATCH nötig, muss er noch dem Trigger entsprechen. Die neue Textformel übernimmt die **frisch per Graph gelesenen Kategorien** und ergänzt `Avis`, statt die beim Export gelesene Kategorienliste zurückzuschreiben. Auch alte Avis-Kategorien bleiben als vorhandene Kategorien erhalten. Prüffälle, Lesefehler, abweichende Betreffzeilen und fehlgeschlagene nötige Betreffänderungen erreichen diese Aktion nicht. Gleichzeitige Kategorieänderungen nach dem GET können weiterhin überschrieben werden.

### 5.12 Speichern

Oben **Speichern**. Der Flow bearbeitet neue Mails im ausgewählten **Posteingang**, nicht alte Mails. Im Trigger ausdrücklich den Posteingang auswählen und bei den Tests prüfen, dass Mails im Unterordner **Archive → Avisbetrag fehlt** keinen neuen Lauf auslösen.

### Bestehenden Flow auf den Prüfordner umstellen

1. Das Skript `AvisV2` durch den aktuellen Inhalt von `dist/AvisV2.ts` ersetzen und speichern. `Run_script` erneut auf dieses Skript einstellen und den neuen Parameter **mailboxAddress** mit der tatsächlichen Postfachadresse belegen (Schritt 5.4).
2. Die bisherige Bedingung **Kategorie_noetig** in **Bearbeitung_noetig** umbenennen, ihre Formel durch `Bearbeitung_noetig_links.txt` ersetzen und für Run_script alle vier Statuswerte aus Schritt 5.5 aktivieren.
3. **Betreff_noetig** als ersten Schritt im Wahr-Zweig lassen oder dorthin verschieben. Alte Abhängigkeiten von Kategorie_setzen entfernen. Die aktuelle `Betreff_noetig_links.txt` verwenden. In ihren Wahr-Zweig **Nachricht_vor_Betreff_lesen → Betreff_unveraendert** einbauen und **Betreff_setzen** in den Wahr-Zweig dieses Vergleichs verschieben (Schritt 5.7).
4. **Pruefung_noetig** unter der gesamten Betreff-Bedingung einbauen, aktuelle Formel und drei Statuswerte gemäß Schritt 5.8 setzen.
5. **Avisbetrag_fehlt_verschieben** in deren Wahr-Zweig einbauen und über den Ordnerwähler des freigegebenen Postfachs den vorhandenen Pfad **Posteingang → Archive → Avisbetrag fehlt** auswählen.
6. **Kategorie_erlaubt** als erste Bedingung in den Falsch-Zweig von Pruefung_noetig einbauen, mit der passenden Hauptflow- oder Plan-B-Formel (Schritt 5.10). Ihr Falsch-Zweig bleibt leer.
7. In den Wahr-Zweig von Kategorie_erlaubt **Nachricht_vor_Kategorie_lesen → Kategorie_Betreff_passt** einbauen. **Kategorie_setzen** in den Wahr-Zweig dieses Vergleichs verschieben. Das Textfeld durch die aktuelle `Kategorie_setzen_Text.txt` ersetzen; alte Fehler-Ersatzformeln oder der direkte Verweis auf `patchCategory` werden dort nicht mehr verwendet (Schritt 5.11).
8. **Plan B nicht produktiv aktivieren.** Im Prüfentwurf bleibt der Wahr-Zweig von Eigene_Kopie leer. Alte Aktionen **Kopie_pruefen**, **Kopie_Pruefordner_verschieben** und **Kategorie_Kopie** entfernen; sie konnten eigene Nachrichten allein wegen des Absenders als sichere Avise behandeln. Weitere Grenzen stehen im Plan-B-Abschnitt.
9. Speichern, mit `dist/avis-flow.html` vergleichen und Schritt 6 zunächst in einem Testpostfach durchführen. Vorhandene alte Kategorien oder alte Mails werden dabei nicht gesammelt gelöscht, verschoben oder neu verarbeitet. Erst eine erfolgreiche lokale Prüfung plus Live-Abnahme belegen den geprüften Aufbau.

## Schritt 6: Testen

Zuerst lokal mit Node.js 24 oder neuer `node tests/run-all.cjs` ausführen. Die lokalen Testsuiten prüfen künstlich erzeugte Mail- und Dateiinhalte sowie simulierte Flow-Abläufe; sie benötigen keine Paketinstallation. Für die zusätzlich mitgelieferte Office-Simulation und den Typcheck:

```sh
npm ci
npm run typecheck
npm run test:office
```

Damit wird TypeScript 5.9.3 aus der festgelegten Paketversion verwendet. Die Office-Simulation prüft vier Umwandlungsmodelle und vollständige Ergebnisse verschiedener Dateitypen. Weder sie noch ein bestandener Typcheck ersetzen eine Live-Abnahme der eingerichteten Verbindungen, Rechte, Ordner und Laufzeiten. Der [bisherige Testbericht](TESTBERICHT.md) und die [Gegenprüfung der alten Testdateien](GEGENPRUEFUNG-ALTTESTS.md) trennen den lokal geprüften Umfang von offenen Integrationsrisiken. Das separat ausgecheckte Archiv kann mit `node tests/legacy-corpus.cjs /pfad/zu/2testordner /tmp/avis-legacy-report.json` erneut geprüft werden; die Wiederherstellung fehlender Eingaben ist im ergänzenden Bericht dokumentiert.

1. Eine sichere Avis-Mail (`high`) mit Datei und eine Mail ohne Avis an das freigegebene Postfach senden. Die Avis-Mail bekommt erst den Betrag, danach `Avis`; die andere bleibt unverändert.
2. Einen Prüffall senden, zum Beispiel ein Avis als Scan ohne Text. Er muss im vorhandenen Ordner **Posteingang → Archive → Avisbetrag fehlt** ankommen und darf keine neue Kategorie `Avis prüfen` erhalten.
3. Im Ausführungsverlauf **Keine_Automatik → Run_script → Ausgaben** ansehen: `result.needsReview`, `result.category`, `result.newSubject`, `result.verdictWhy` und `result.documents`. Bei Export-/Skriptfehlern die jeweilige rote Aktion prüfen.

Ein Avis nur im Mailtext von e…30847 tokens truncated…destens drei Namen in der Spalte „Remitter"/„Auftraggeber" oder „DEBTOR:"), z. B. nicht zugeordnete Eingänge auf dem eigenen Konto. Kein Avis. Steht ein Auszahlungsbetrag darin („Total remitted"), gilt der Grund nicht |
| `refund of a supplier ('…') - not a customer payment?` | Ein Lieferant zahlt uns Geld zurück (Guthaben aus seiner Gutschrift, doppelte oder zu hohe Zahlung: „Refund of overpayment", „haben wir Ihnen … zurückgezahlt"). Es kommt Geld, aber keine Kundenzahlung: Prüfordner; an die Kreditorenbuchhaltung geben. Nicht, wenn der Schreiber zugleich eine Rechnung von uns bezahlt oder die Erstattung nur erbittet, verrechnet oder verneint. Auch die Rückzahlung einer Anzahlung, Vorauszahlung oder Vorkasse durch einen Lieferanten, z. B. nach einer stornierten Bestellung. Geld kommt herein, ist aber keine Kundenzahlung: zur Prüfung |
| `refund request ('…') - not a payment advice` | Der Mailtext bittet um Rückzahlung oder Erstattung („please refund the duplicate amount", „bitte erstatten Sie uns …"). Das Geld soll an den Schreiber gehen: kein Avis. Nennt der Schreiber daneben eine heute erfolgte Zahlung, bleibt die Mail zur Prüfung (`…, but refund request ('…')`) |
| `refund requested after a duplicate payment ('…')` | Der Kunde hat eine Rechnung doppelt oder zu viel bezahlt und bittet um Erstattung oder Verrechnung („was paid twice … please refund", „doppelt überwiesen … bitte erstatten Sie"). Das ist eine Rückforderung, kein Avis. Keine Kategorie |
| `remittance slip to return with a payment ('…') - statement or invoice?` | Das Dokument hat einen Abschnitt, den man mit der Zahlung zurückschicken soll („detach and return this portion with your payment", „amount enclosed"). So enden Kontoauszüge und Rechnungen des Lieferanten; ein Avis des Zahlers ist das nicht. Keine Kategorie |
| `reply without an amount` | Eine Antwort (AW:/RE:) ohne eigenen Betrag und ohne eigene Zahlungserklärung: kein Avis |
| `sample ('…') - not a payment advice` | Das Dokument ist ein Muster mit Beispieldaten („Muster: neues Zahlungsavis (Beispieldaten)", „for illustration only", Wasserzeichen „M U S T E R"), z. B. ein Infoschreiben zum neuen Avis-Layout. Kein echtes Avis, auch wenn Sätze über Zahlungen darin stehen. Keine Kategorie |
| `scan without text, the mail text says what it is (…)` | Die Anlage ist ein Scan ohne Text, der Mailtext sagt, was sie ist (Lieferschein, Reklamation, Rechnung), und nirgends steht ein Avis- oder Zahlungswort. Keine Kategorie |
| `settlement of a claim against the recipient ('…') - not a payment to the recipient?` | Der Versicherer reguliert den Anspruch eines Dritten gegen uns („the claimant's claim against you“, „Ihres Haftpflichtschadens“). Neu reicht auch: Die Selbstbeteiligung wird uns gesondert berechnet oder mit dem nächsten Beitrag verrechnet („Die Selbstbeteiligung … verrechnen wir mit der nächsten Beitragsrechnung“, „The policy excess … will be collected with your next premium instalment“). Das Geld ging an den Anspruchsteller, nicht an uns: keine Kategorie |
| `tax refund ('…') - not a customer payment?` | Das Finanzamt oder eine andere Steuerbehörde erstattet Steuern (Erstattung, Guthaben, Überschuss aus der Steuererklärung, „VAT refund", auch über den Steuerberater gemeldet). Das gilt auch, wenn nur der Auftraggeber einer Gutschrift ein Finanzamt, eine Finanzkasse oder ein Zollamt ist (in der Klammer steht dann dessen Name). Es kommt Geld, aber keine Kundenzahlung: Prüfordner; nicht auf ein Debitorenkonto buchen |
| `the advice went to the payee ('…') - not a payment to the recipient?` | Der Text sagt, das Avis sei an den Zahlungsempfänger gegangen („Das Zahlungsavis wurde an den Lieferanten versandt“, „A remittance advice has been sent to the supplier's remittance e-mail address“, „Das Avis ging direkt an deren Buchhaltung“). Zusätzlich nennt ein Feld uns als zahlende Firma („Firma:“, „Company:“, „Auftraggeber:“), oder der Schreiber nennt seine eigene Zahlung an diesen Empfänger. Das ist eine Mitteilung an die Zahlerseite (eigenes Kreditorenportal, eigene Treasury), kein Avis an uns: keine Kategorie. Gilt nicht, wenn der Text uns als Empfänger nennt („an Sie“, „to your account“) |
| `…, the amount of the quoted mail` / `…, the amount of the quoted mail less N %` | Eine Antwort auf unsere Rechnungs- oder Mahnmail nennt einen Betrag (auch als Kurznotiz „ist beglichen, 4.508,00 €"), der genau dem Rechnungsbetrag der zitierten Mail entspricht oder ihm abzüglich des in der Antwort genannten Prozentsatzes (Skonto). Damit ist der Betrag bestätigt: Prüfordner bei unverändertem Betreff (`medium`). Gebühren- und Zinszeilen der Mahnung und Beträge, die die Antwort ablehnt oder verschiebt, zählen nicht |
| `the bank's own credit ('…') - not a customer payment?` | Die eigene Bank schreibt Geld aus einem eigenen Produkt gut (Zinsen, Fest- oder Termingeld, erstattete Kontoführungsentgelte, „Refund of charges") ohne Auftraggeber eines Kunden, oder die Bank ist selbst der Auftraggeber, z. B. bei einer Rückvergütung von Entgelten nach einer Reklamation oder einer Kulanzgutschrift (in der Klammer steht dann der Name der Bank). Kein Kundenzahlungseingang: keine Kategorie |
| `the reader is the payer ('…') - not a payment advice?` | Der Absender ist der Verkäufer: Er dankt für Ihre Bestellung oder Ihren Einkauf („vielen Dank für Ihre Bestellung", „Thank you for your order") oder schreibt, ob Sie noch zahlen müssen („bitte nicht erneut überweisen"). Eine genannte Zahlung (z. B. Vorkasse) ist Ihre eigene. Gilt nicht, wenn das Dokument von Ihrer Firma stammt oder der Absender selbst eine Zahlung nennt („wir haben überwiesen"). Keine Kategorie |
| `the recipient is the buyer ('…') - not a payment to it?` | Rechnung oder Quittung, in der Ihre Firma als Käufer steht („Billed to: …", „Bill to", „Rechnungsempfänger"): Sie haben selbst bezahlt (z. B. per Karte). Keine Kategorie |
| `the recipient is the payer ('…') - not a payment to it?` | Im Formular steht die eigene Firma als Auftraggeber oder Zahler, also eine eigene ausgehende Zahlung (z. B. ein eigenes Avis in Kopie). Neu ist ein weiterer Fall: Ein Zahlungsdienst schreibt uns als Kontoinhaber („Hallo Nordwerk Antriebstechnik GmbH, Sie haben 2.340,00 EUR an Brenner Werkzeughandel gesendet“, „Hi …, You sent €2,340.00 to …“), und der Empfänger sind nicht wir: keine Kategorie. Sonst wie bisher: Steht ein anderer Empfänger daneben, keine Kategorie, sonst Prüfordner |
| `the recipient's own advice to '…' - not a payment to it?` | Das Dokument stammt von uns: unser Name steht im Briefkopf oder in der Absenderzeile über dem Anschriftfeld, im Anschriftfeld steht eine andere Firma, dazu ein Avis-Titel oder eine Zahlungsaussage („Zahlungsavis … überweisen wir“). Unser eigenes Avis an einen Lieferanten, z. B. von einem Zahlungsdienstleister mit uns in Cc verschickt: keine Kategorie (wegen ihres Begleittexts kann die Mail in den Prüfordner gelangen). Gilt nicht für eine eigene Rechnung mit Bezahlt-Stempel des Kunden |
| `…, total computed from the payment column` | Eine Zahlungsliste ohne Summenzeile: Das Skript hat die Zahlbetrag-Spalte addiert (`uncertain: total computed from …`), Prüfordner bei unverändertem Betreff. Nennt der Mailtext genau diesen Betrag, „Avis" (`…, the mail text states the same amount`) |
| `transfer to the recipient confirmed ('…')` | Die Bank oder der Zahlungsdienst des Zahlers bestätigt eine Überweisung an uns als ausgeführt („Your payment has been executed", „Ihre Überweisung ist unterwegs", „Deine Zahlung an … war erfolgreich"), auch weitergeleitet oder in den Mailtext kopiert. Wir stehen als Empfänger darin, nie als Auftraggeber: „Avis"; nach einer Umrechnung zählt der Betrag, den wir erhalten. Nicht bei fehlgeschlagen, zurückgegeben, geplant, wartet auf Freigabe oder neben einer Bitte um Erstattung |

**Aus dem Flow selbst (nicht vom Skript)**

| Was du siehst | Bedeutung |
| --- | --- |
| Mail im Prüfordner, im Ausführungsverlauf ist **Run script** rot | Das Skript ist auch nach höchstens drei Wiederholungen (vier Anläufen insgesamt) gescheitert; die Meldung von Microsoft steht im Verlauf bei Run script. Mail von Hand bearbeiten |
| Mail im Prüfordner, Run script mit **Zeitüberschreitung** | Die externe Laufzeitgrenze des Office-Script-Aufrufs wurde erreicht; aufwendige oder beschädigte Eingaben können die Verarbeitung verlängern. Mail von Hand bearbeiten |
| Leseaktion rot oder Betreffvergleich Falsch | Der folgende Schreibschritt wurde nicht ausgeführt. Aktuelle Nachricht und Verlauf prüfen; ein erfolgreicher Gesamtstatus beweist keine erfolgte Kategorisierung |
| Nachricht im Posteingang ohne zugehörigen Lauf | Der Trigger kann sie übersprungen haben. Posteingang und Verarbeitung abgleichen; ohne Lauf kann das Skript keinen Prüfordner erreichen |
| Keine Kategorie, Lauf endet bei **Keine Automatik** | Der Betreff enthielt einen der Texte aus Keine_Automatik (Abwesenheitsnotiz, Zustellmeldung) |

**Weitere Hinweise (Feld `warnings`)**

| Hinweis (englisch) | Bedeutung |
| --- | --- |
| leer | Alles normal |
| `subject unavailable - no automatic category` | Der MIME-Betreff ist beschädigt/unlesbar oder beim direkten Dateiaufruf fehlt ein verfügbarer Betreff. Auch bei `high` gibt es keinen Betreff-PATCH und keine neue Kategorie; die Mail bleibt unverändert im Posteingang. Eine echte leere EML-Betreffzeile ist davon nicht betroffen: Sie erhält bei einem sicheren Avis weiterhin nur den Betrag oder die Betragsliste |
| `from signed mail: …` | Der Betrag stammt aus dieser PDF in der signierten Mail (`from mail: …` bei einer weitergeleiteten Mail-Datei) |
| `… PDFs checked (…)` / `only … of … PDFs checked` | Historischer Diagnosetext: Der aktuelle Mailpfad prüft bis zu 30 Anlagen, bevorzugt Avis-Dateinamen. Weitere nicht lesbare oder nicht geprüfte mögliche Zahlungsquellen dürfen eine automatische Freigabe verhindern; alle genannten Quellen ansehen |
| `only the first 50 of … PDFs read` | Historischer Diagnosetext aus älteren Lesepfaden. Im aktuellen Mailpfad gilt die Grenze von 30 Anlagen; eine Begrenzung ist kein Nachweis einer vollständigen Prüfung |
| `PDF arrived as text instead of Base64` | Power Automate hat die PDF als Text übergeben, sie ließ sich aber vollständig zurückwandeln. Das besagt nur, dass die Rückwandlung keinen erkannten Byteverlust hatte; die fachliche Betragsprüfung bleibt erforderlich. Das Feld pdfBase64 in Run_script auf fx `base64(body('Export_email'))` umstellen (Schritt 5.4), sonst gehen bei anderen PDFs Teile verloren. Mit `(… characters lost)` gingen Zeichen verloren; dann steht im Grund `uncertain: PDF arrived as text instead of Base64 - parts may be damaged` oder `PDF arrived as text instead of Base64 - content damaged (…)` |
| `decrypted (permissions-only encryption)` | Die PDF war nur gegen Kopieren oder Drucken geschützt und wurde normal gelesen |
| `OCR text layer (… % of the text)` | Text aus Texterkennung. Solche Avise gehen in den Prüfordner und bekommen weder Betreffänderung noch neue Kategorie |
| `incomplete: …` | PDF teilweise gelesen. Erkannte Unvollständigkeit sperrt die automatische Freigabe; Originaldatei prüfen |
| andere Texte (z. B. `page 2: …`) | Technische Details zum Lesen der PDF, für die Person, die das Skript pflegt |
| `no currency in … - … assumed from the mail` | Das Dokument nennt keine Währung; sie stammt aus dem Mailtext oder aus einem anderen Dokument der Mail mit demselben Betrag. Ein bloßes „$" wird zur Währung des Landes, die das Dokument nennt („All amounts in Australian dollars", ABN, „Pty Ltd" → AUD). Der Betrag bleibt nur im Skriptergebnis; bei `medium` bleibt der Betreff unverändert und die Mail geht in den Prüfordner. Währung prüfen |
| `…, currency … from body` | Das Dokument nennt keine Währung; sie stammt aus dem Mailtext, der denselben Betrag mit Währung nennt |
