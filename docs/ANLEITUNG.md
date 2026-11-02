# Avis-Flow Version 2 Schritt für Schritt

Diese Anleitung baut den Flow für ein **freigegebenes Postfach** (Exchange Shared Mailbox). Jede neue Mail geht als Ganzes an das Skript: PDF-Anlagen, Excel- und CSV-Dateien, SAP-Exporte und der Mailtext. Bei einem Zahlungsavis mit neuem Betreff bekommt die **Original-Mail** zuerst den Betrag vorne in den Betreff und danach die Kategorie. Fälle ohne neuen Betreff erhalten nur ihre Kategorie. Andere Mails bleiben unberührt. Es kommen keine zusätzlichen Mails.

Alle Klickwege in dieser Anleitung sind am 30.10.2026 in einem Microsoft-365-Testzugang mit dem damaligen Stand von Skript und Flow nachgegangen worden (12 Test-Mails, 12 richtige Ergebnisse). Die neue Reihenfolge „erst Betreff, dann Kategorie“ und die Anzeige mehrerer Beträge mit ` + ` und Kategorie „Avis“ wurden danach lokal geprüft und sind noch nicht erneut live in Microsoft 365 getestet. Einen klickbaren Nachbau des aktuellen Flows mit allen Feldern, Einstellungen und Formeln zum Kopieren gibt es in `dist/avis-flow.html` (herunterladen und im Browser öffnen).

## Überblick

| Ergebnis des Skripts | Kategorie | Betreff danach |
| --- | --- | --- |
| Ein Avis, Betrag sicher | Avis | `2.601,35 Zahlungsavis` |
| Ein Avis, Betrag ziemlich sicher | Avis | `2.601,35 (prüfen) Zahlungsavis` |
| Ein Avis, Betrag unsicher | Avis prüfen | `2.601,35 ? Zahlungsavis` |
| Mehrere Avise in einer Mail | Avis | `1.200,30 + 5.632,21 + 500,42 Zahlungsavis` |
| Unklar: Avis-Hinweis, aber nicht lesbar (Scan, verschlüsselt, altes .xls) oder nicht sicher erkennbar | Avis prüfen | unverändert |
| Skript-Fehler oder Zeitüberschreitung | Avis prüfen | unverändert |
| Kein Avis (Rechnung, Reklamation, Bestellung, Info, Mahnung …) | keine | unverändert |

„Zahlungsavis" steht hier für den Betreff, den der Absender geschrieben hat. Er bleibt vollständig erhalten; der Betrag steht immer davor, im deutschen Format und mit einem Leerzeichen als Trenner. Eine Währung oder ein Bindestrich wird dabei nicht ergänzt.

„Zahlungsavis“ wird nicht automatisch hinzugefügt. Beispiel mit einem anderen Originalbetreff: Aus `Abrechnung Oktober` wird bei einem sicheren Betrag von 5.500,05 Euro `5.500,05 Abrechnung Oktober`. Bei einem einzelnen unsicheren Ergebnis steht weiterhin `(prüfen)` oder `?` hinter dem Betrag.

Bei mehreren Avisen werden die einzelnen erkannten Zahlbeträge mit Leerzeichen, Pluszeichen und Leerzeichen (` + `) verbunden. Danach folgen ein Leerzeichen und der vollständige ursprüngliche Betreff: `1.200,30 + 5.632,21 + 500,42 Abrechnung Oktober`. Das Skript rechnet daraus keine Gesamtsumme. Die Kategorie ist ebenfalls `Avis`. Kann die vollständige Betragsliste nicht verlässlich ausgegeben werden, bleibt der Betreff unverändert und die Mail bekommt `Avis prüfen`.

Eine Gesamtsumme im Begleittext, die nur die einzelnen Zahlungen aus den Anlagen wiederholt, kommt nicht zusätzlich in die Liste. Eine ausdrücklich separat geleistete weitere Zahlung bleibt ein eigener Betrag.

Der Flow in Kurzform:

```
Wenn eine neue E-Mail in einem freigegebenen Postfach eingeht (V2)
└─ Keine_Automatik (Abwesenheitsnotizen und Zustellmeldungen raus)
   └─ Wahr: Export_email → Run_script → Kategorie_noetig
            └─ Wahr:
               ├─ Betreff_noetig
               │  ├─ Wahr: Betreff_setzen
               │  └─ Falsch: leer
               └─ danach: Kategorie_setzen
```

`Kategorie_setzen` wartet auf die gesamte Bedingung `Betreff_noetig`. Die Kategorie wird auch dann gesetzt, wenn keine Betreffänderung nötig ist oder die Betreffänderung fehlschlägt bzw. ihr Zeitlimit erreicht. Bei einem Skriptfehler bleibt der Betreff unverändert und die Kategorie wird „Avis prüfen“.

**Ab 31.12.2026** will Microsoft das Ändern des Betreffs empfangener Mails sperren. Dann schlägt nur `Betreff_setzen` fehl, die Kategorie wird anschließend weiter gesetzt. Im Januar testen; was dann zu tun ist, steht unter „Ab Januar 2027: Betreff-Sperre prüfen".

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

## Schritt 2: Kategorien im Postfach anlegen (einmalig)

1. Outlook im Web öffnen und das Postfach aufrufen: `https://outlook.office.com/mail/avis@firma.de/`.
2. Eine beliebige Mail anklicken, oben auf das **Etikett-Symbol** (Kategorisieren) → **Kategorien verwalten**.
3. **Neu erstellen** → Name `Avis` → eine Farbe (z. B. Grün) → **Speichern**.
4. Genauso `Avis prüfen` (z. B. Orange) anlegen. Der Name muss genau so geschrieben sein, mit Leerzeichen und „ü". Die frühere Kategorie `mehrere Avise` wird nicht mehr benötigt.

Ohne diesen Schritt erscheinen die Kategorien trotzdem an den Mails, nur grau. Die Farben gelten für alle, die das Postfach öffnen.

**Bei einem bestehenden Flow:** Die bisherige Kategorie `Avise` in Outlook unter **Kategorien verwalten** in `Avis` umbenennen und das Skript `AvisV2` wie in Schritt 3 beschrieben aktualisieren. Wird **Plan B** verwendet, zusätzlich in `Kategorie_Kopie` das Feld **Text** durch die aktuelle Formel aus `dist/avis-flow.html` ersetzen (Plan B einschalten → Karte **Kategorie Kopie**). Sie verwendet die Kategorie `Avis` und erkennt das `?` im neuen Betreffformat. Die sechs TXT-Formeln in `formeln/` bleiben für diese Umstellung unverändert.

**Mehrere Beträge im Betreff aktivieren:** Das Skript `AvisV2` durch die aktuelle Fassung ersetzen. Es liefert dann auch bei mehreren Avisen einen neuen Betreff und die Kategorie `Avis`. Die sechs TXT-Formeln bleiben unverändert. Bei erneut verarbeiteten Mails mit mehreren Avisen ersetzt es die bisherige Kategorie `mehrere Avise` durch `Avis`; andere Kategorien bleiben erhalten. Bereits vorhandene Mails werden durch das Skriptupdate nicht automatisch nachträglich geändert.

Die Reihenfolge „erst Betreff, dann Kategorie“ erfordert einen Umbau des Flows, falls sie noch nicht eingerichtet ist. Die Schritte stehen unter „Bestehenden Flow auf die neue Reihenfolge umstellen“ nach Schritt 5.9. Ist die Reihenfolge bereits umgestellt, ist für mehrere Beträge kein weiterer Flow-Umbau nötig.

## Schritt 3: Skript AvisV2 in Excel anlegen (einmalig)

1. Die Arbeitsmappe `AvisParser.xlsx` aus Version 1 in OneDrive öffnen. Gibt es sie noch nicht: OneDrive im Browser → **Erstellen oder hochladen** → **Excel-Arbeitsmappe** → oben auf den Namen „Mappe" klicken → `AvisParser` eintippen → Enter. Die Mappe bleibt leer.
2. Reiter **Automatisieren** → **Neues Skript** → **Im Code-Editor erstellen**. Erscheint rechts der Hinweis „Aktionen in Skripts umwandeln", auf **Skript schreiben** klicken.
3. Auf GitHub die Datei `dist/AvisV2.ts` öffnen und oben rechts auf **Copy raw file** klicken (Symbol mit den zwei Rechtecken).
4. In den Editor klicken, **Strg+A** (Mac: **⌘+A**), dann **Strg+V** (Mac: **⌘+V**). Das Skript hat etwa 9.700 Zeilen; das Einfügen dauert ein paar Sekunden. Excel rückt dabei manche Zeilen anders ein. Das ist normal und ändert nichts.
5. Auf das **Speichern-Symbol** (Diskette) klicken. Kommt der Hinweis „Zugeordnetes Skript", mit **OK** bestätigen.
6. Umbenennen: links oben auf **← Alle Skripts** → bei der Karte des neuen Skripts auf **Umbenennen** → im Feld **Name** `AvisV2` eintragen → Tab-Taste. Oben erscheint „Gespeichert ✓".

Das alte Skript `AvisPdfAmount` bleibt, wie es ist. Excel speichert Skripte in OneDrive unter **Dokumente → Office-Skripts** (`AvisV2.osts`).

**Später ein neues Skript einspielen:** Excel → Automatisieren → **Alle Skripts** → **AvisV2** → **Bearbeiten** → Strg+A, Strg+V mit dem neuen Inhalt → Speichern. Der Flow nimmt ab dem nächsten Lauf automatisch das neue Skript.

## Schritt 4: 5-Minuten-Test (empfohlen, bevor der echte Flow gebaut wird)

Damit prüfst du vorab, ob Vollzugriff und Betreffänderung im Postfach funktionieren.

1. Power Automate → **Erstellen** → **Automatisierter Cloud-Flow** → Name `PATCHTEST` → Trigger suchen: `freigegebenen Postfach` → **Wenn eine neue E-Mail in einem freigegebenen Postfach eingeht (V2)** → **Erstellen**.
2. Trigger anklicken: **Ursprüngliche Postfachadresse** = `avis@firma.de` eintippen und in der Liste **„avis@firma.de" verwenden** anklicken. **Erweiterte Parameter** → **Alle anzeigen** → **Filter für Betreff** = `PATCHTEST`.
3. **+** unter dem Trigger → Suche `HTTP-Anforderung senden Office 365 Outlook` → **HTTP-Anforderung senden** (Office 365 Outlook):
   - **URI**: ins Feld klicken → **fx** → Formel aus `formeln/URI_Kategorie_und_Betreff.txt` (mit eurer Adresse) → **Hinzufügen**
   - **Methode**: `PATCH`
   - **Erweiterte Parameter** → **Alle anzeigen** → **Text**: `{"subject":"2.601,35 PATCHTEST Zahlungsavis"}`
4. Zweite gleiche Aktion unter der ersten, nur **Text**: `{"categories":["Avis"]}`. Bei dieser zweiten Aktion unter **Einstellungen → Ausführen nach** für die erste Aktion **Ist erfolgreich**, **Timeout** und **Ist fehlgeschlagen** anhaken. So wird zuerst der Betreff geändert und danach die Kategorie gesetzt, auch wenn die Betreffänderung nicht erlaubt ist.
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
     - **Ordner**: Ordnersymbol rechts im Feld → **Posteingang**
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
   - **extraKeywords**: leer lassen
4. Reiter **Einstellungen** → **Wiederholungsrichtlinie**: **Festes Intervall**, **Anzahl** `3`, **Intervall** `PT1M`.

Im Lasttest mit 40 Mails brauchte ein Lauf meist 8 bis 20 Sekunden, auch für ein Avis mit 72 Seiten oder eine Mail mit 20 PDF-Anlagen; das meiste davon ist der Start von Excel.

### 5.5 Bedingung Kategorie_noetig

1. **+** unter Run_script → **Bedingung** → umbenennen in `Kategorie_noetig`.
2. Eine Zeile:
   - links: **fx** → Formel aus `formeln/Kategorie_noetig_links.txt`
   - Mitte: **ist gleich**
   - rechts: **fx** → `true` → **Hinzufügen** (nicht als Text eintippen, sonst ist es das Wort „true")
3. Eine angehängte leere Zeile löschen (⋯ → Löschen).
4. Reiter **Einstellungen** → **Ausführen nach** → **Run script** aufklappen → **Ist erfolgreich**, **Timeout** und **Ist fehlgeschlagen** anhaken. So bekommt auch eine Mail, bei der das Skript nicht laufen konnte, die Kategorie „Avis prüfen".

### 5.6 Bedingung Betreff_noetig

1. Als erste Karte im Zweig **Wahr** von Kategorie_noetig: **+** → **Bedingung** → umbenennen in `Betreff_noetig`.
2. Eine Zeile: links **fx** → Formel aus `formeln/Betreff_noetig_links.txt`, Mitte **ist gleich**, rechts **fx** → `true`. Leere Zeile löschen.
3. Der Zweig **Falsch** bleibt leer. Als erste Karte im Wahr-Zweig von Kategorie_noetig hat Betreff_noetig keinen Vorgänger unter **Ausführen nach** (Codeansicht: `"runAfter": {}`).

Bei einem Avis oder mehreren erkannten Avisen liefert das Skript einen neuen Betreff: ein Betrag oder eine Liste mit ` + `. In unklaren Fällen, bei bereits vollständig ergänztem Betreff und bei einem Skriptfehler bleibt der Betreff unverändert. Dann wird der leere Falsch-Zweig durchlaufen; danach folgt trotzdem Kategorie_setzen.

### 5.7 Betreff_setzen

1. Im Zweig **Wahr** von Betreff_noetig: **+** → **HTTP-Anforderung senden** (Office 365 Outlook) → umbenennen in `Betreff_setzen`.
2. Felder:
   - **URI**: **fx** → Formel aus `formeln/URI_Kategorie_und_Betreff.txt`, mit eurer Postfachadresse statt `avis@firma.de`
   - **Methode**: **PATCH**
   - **Text**: **fx** → Formel aus `formeln/Betreff_setzen_Text.txt`
   - **Content-Type**: `application/json`

### 5.8 Kategorie_setzen

1. Auf das **+ unter der gesamten Bedingung Betreff_noetig** klicken, noch innerhalb des Zweigs **Wahr** von Kategorie_noetig. Kategorie_setzen gehört auf dieselbe Ebene wie Betreff_noetig, außerhalb ihrer Wahr-/Falsch-Zweige.
2. Suche `HTTP-Anforderung senden Office 365 Outlook` → **HTTP-Anforderung senden** (Office 365 Outlook) → umbenennen in `Kategorie_setzen`.
3. Felder:
   - **URI**: **fx** → Formel aus `formeln/URI_Kategorie_und_Betreff.txt`, mit eurer Postfachadresse statt `avis@firma.de`
   - **Methode**: **PATCH**
   - **Erweiterte Parameter** → **Alle anzeigen** → **Text**: **fx** → Formel aus `formeln/Kategorie_setzen_Text.txt`
   - **Content-Type**: `application/json` (steht schon da)
4. **Einstellungen → Ausführen nach → Betreff noetig**: **Ist erfolgreich**, **Timeout** und **Ist fehlgeschlagen** anhaken. Die Abhängigkeit muss auf die ganze Bedingung zeigen, nicht auf die darin liegende Aktion Betreff_setzen. In der Codeansicht steht `"runAfter": {"Betreff_noetig": ["Succeeded", "TimedOut", "Failed"]}`.

Die Aktion setzt erst nach der Betreff-Bedingung die Kategorie, die das Skript liefert, z. B. `{"categories":["Avis"]}`. Kategorien, die das Skript an der Mail gelesen hat, bleiben erhalten; bei mehreren Avisen wird nur die frühere Kategorie „mehrere Avise" durch „Avis" ersetzt. Ist das Skript gescheitert, setzt die Ersatzformel „Avis prüfen". Ein Fehler oder Timeout beim Ändern des Betreffs verhindert die Kategorisierung nicht; das Skriptergebnis bestimmt weiterhin die Kategorie.

### 5.9 Speichern

Oben **Speichern**. Die Meldung „Ihr Flow ist fertiggestellt" erscheint. Der Flow ist sofort eingeschaltet und bearbeitet jede neue Mail im Posteingang des Postfachs (ältere Mails nicht).

### Bestehenden Flow auf die neue Reihenfolge umstellen

1. Den Flow bearbeiten und im Wahr-Zweig von **Kategorie_noetig** die Karten **Kategorie_setzen** und **Betreff_noetig** öffnen.
2. Bei **Betreff_noetig → Einstellungen → Ausführen nach** die bisherige Abhängigkeit von **Kategorie_setzen** entfernen. Die ganze Bedingung einschließlich Betreff_setzen an die erste Position im Wahr-Zweig von Kategorie_noetig verschieben. Danach hat Betreff_noetig dort keinen Vorgänger (`"runAfter": {}`). Falls der Designer die Reihenfolge nur gemeinsam mit dem Verschieben ändert, die Abhängigkeit direkt danach kontrollieren; sie darf nicht mehr auf Kategorie_setzen zeigen.
3. **Kategorie_setzen** unter die gesamte Bedingung **Betreff_noetig** verschieben, auf dieselbe Ebene. Unter **Ausführen nach** alle bisherigen Abhängigkeiten entfernen und **Betreff noetig** mit **Ist erfolgreich**, **Timeout** und **Ist fehlgeschlagen** setzen. Kategorie_setzen darf weder in einem Zweig von Betreff_noetig liegen noch direkt von Betreff_setzen abhängen.
4. Die äußere Bedingung **Kategorie_noetig** und ihre Abhängigkeit von Run_script bleiben wie in Schritt 5.5. Auch alle sechs TXT-Formeln und das Office-Skript bleiben für diesen Umbau unverändert.
5. Bei **Plan B** bleiben Kopie_anlegen, Kopie_anpassen und Kopie_senden im Wahr-Zweig von Betreff_noetig. Original_verschieben dort herausnehmen und seine bisherige Abhängigkeit von Kopie_senden entfernen. Nach Kategorie_setzen die neue Bedingung **Original_verschieben_noetig** einfügen und Original_verschieben in deren Wahr-Zweig verschieben. Die Einstellungen stehen im Abschnitt „Plan B: Reihenfolge und Verschieben“.
6. Speichern, den Aufbau mit `dist/avis-flow.html` vergleichen und die Fälle aus Schritt 6 prüfen. Ein Skriptupdate allein ändert diese Reihenfolge im Flow nicht.

## Schritt 6: Testen

1. Aus dem eigenen Postfach eine Mail mit einem Zahlungsavis-PDF an `avis@firma.de` schicken, eine zweite ohne Avis (z. B. eine Rechnung).
2. 1 bis 5 Minuten warten. Power Automate fragt das Postfach nur alle paar Minuten ab.
3. In Outlook im Web das Postfach öffnen: Die Avis-Mail hat die Kategorie „Avis" und den Betrag im Betreff, die andere Mail ist unverändert.

   Wichtig für eigene Tests: Eine Mail aus dem eigenen Postfach kommt aus derselben Domain wie `avis@firma.de` und gilt als interne Mail einer Kollegin oder eines Kollegen. Ein Avis als PDF-Anhang wird trotzdem erkannt. Steht das Avis aber nur im Mailtext („wir haben heute 2.601,35 EUR überwiesen"), bekommt eine interne Mail keine Kategorie, weil das Skript dann eine eigene Zahlung der Firma annimmt. Avise im Mailtext deshalb von einer externen Adresse aus testen (z. B. einem privaten Postfach).
4. Ausführungsverlauf: Power Automate → **Meine Flows** → **Avis V2** → unten die Läufe. Einen Lauf anklicken → **Keine Automatik** aufklappen → **Run script** anklicken → unter **Ausgaben** stehen `result.verdict`, `result.category`, `result.newSubject`, `result.verdictWhy` und je Dokument `result.documents`.

Für die neue Reihenfolge und mehrere Beträge zusätzlich diese Fälle prüfen. Fehlerfälle nur in einer Testkopie des Flows mit Testmails auslösen, z. B. durch einen absichtlich ungültigen Text im Betreff-PATCH. Danach die korrekte Formel wieder einsetzen.

| Testfall | Erwarteter Ablauf |
| --- | --- |
| Ein Avis, dessen Betrag noch nicht im Betreff steht | Erst Betreff_setzen, danach Kategorie_setzen. Im Ausführungsverlauf beginnt die Kategorie-Aktion erst nach Abschluss von Betreff_noetig. |
| Ein Avis mit bereits ergänztem, gleichem Betrag | Betreff_noetig ist Falsch; der Betreff bleibt erhalten, Kategorie_setzen läuft trotzdem. |
| Zwei oder drei Avise mit verschiedenen Beträgen | Erst z. B. `1.200,30 + 5.632,21 + 500,42 Originalbetreff`, danach Kategorie „Avis“. Keine Währung, keine errechnete Gesamtsumme. |
| Mehrere Avise mit bereits vollständig ergänzter Betragsliste | Kein weiterer Betreff-PATCH, keine doppelte Betragsliste; Kategorie „Avis“ wird trotzdem gesetzt. |
| Mehrere Avise auf einer Mail mit Kategorie „mehrere Avise“ und weiterer eigener Kategorie | Betragsliste im Betreff; „mehrere Avise“ wird durch „Avis“ ersetzt, die eigene Kategorie bleibt. |
| Unlesbares Avis oder unvollständig erkannte Betragsliste | Kein Betreff-PATCH; Kategorie „Avis prüfen“. |
| Skript fehlgeschlagen oder mit Timeout | Kategorie_noetig läuft, Betreff_noetig ist Falsch, danach setzt Kategorie_setzen „Avis prüfen“. |
| Betreff-PATCH fehlgeschlagen oder mit Timeout | Erst nach Abschluss der fehlgeschlagenen Betreff-Bedingung läuft Kategorie_setzen; die vom Skript bestimmte Kategorie wird weiterhin gesetzt. |
| Kein Avis | Kategorie_noetig ist Falsch; weder Betreff noch Kategorie ändern sich. |
| Plan B: Ein oder mehrere Avise, Kopie erfolgreich versandt und Kategorie gesetzt | Erst Kopie_anlegen → Kopie_anpassen → Kopie_senden, danach Kategorie_setzen, anschließend Original_verschieben_noetig = Wahr und Original_verschieben. |
| Plan B: Versand fehlgeschlagen oder ohne nötige Kopie | Kategorie_setzen läuft nach Betreff_noetig; Original_verschieben_noetig ist Falsch, das Original bleibt im Posteingang. |
| Plan B: Kategorie_setzen fehlgeschlagen | Original_verschieben_noetig wird übersprungen; das Original bleibt im Posteingang, auch wenn die Kopie bereits versandt wurde. |

Was das Skript zurückgibt:

| Feld | Inhalt |
| --- | --- |
| `verdict` | `advice` (ein Avis), `several` (mehrere), `unclear`, `other` (kein Avis) |
| `verdictWhy` | Kurzer Grund auf Englisch, z. B. `advice title 'Zahlungsavis' in Zahlung_4711.pdf` (Anhang B) |
| `category` | `Avis`, `Avis prüfen` oder leer |
| `subjectPrefix` / `newSubject` | Ein Betrag oder mit ` + ` getrennte Beträge vor dem Betreff / der fertige neue Betreff (leer = keine Änderung) |
| `paymentAmounts` | Bei `several`: einzelne Zahlbeträge mit Währung, z. B. `["1.200,30 EUR", "5.632,21 EUR"]`; sonst leer. `amountNumber` ist bei mehreren Avisen keine errechnete Gesamtsumme. |
| `patchCategory` / `patchSubject` | Fertiger Text für Kategorie_setzen und Betreff_setzen (leer = nichts tun) |
| `documents` | Je geprüftem Dokument eine Zeile: Name, Art, Urteil, Betrag, Sicherheit, Grund |
| `amount`, `amountNumber`, `currency`, `confidence`, `line`, `method`, `candidates`, `pages`, `text`, `textLength`, `warnings`, `error` | Wie in Version 1, zur Fehlersuche (Gründe und Hinweise: Anhang B) |

## Schritt 7: Vom alten Flow umstellen

- Nie zwei Flows gleichzeitig auf dasselbe Postfach loslassen. Lief der alte Flow (Version 1) auf demselben Postfach: dort **⋯** → **Deaktivieren**, dann den neuen einschalten.
- Lief der alte Flow auf einem persönlichen Postfach, kann er weiterlaufen, bis der neue sich bewährt hat.
- Mails, die vor dem Einschalten eingegangen sind, bearbeitet der neue Flow nicht.

## Im Alltag

- **Avis:** Betrag vorne im Betreff. Steht dahinter „(prüfen)", ist sich das Skript nur ziemlich sicher (z. B. Avis nur im Mailtext). In den ersten Wochen jede Avis-Mail kurz gegen das Dokument halten.
- **Avis prüfen:** Steht ein Betrag mit „?" im Betreff, ist er ein Vorschlag. Ohne Betrag: Mail öffnen und von Hand buchen. Den Grund zeigt der Ausführungsverlauf bei Run script (`result.error`, `result.verdictWhy`, Anhang B).
- **Mehrere Avise:** Die Mail enthält mehrere erkannte Zahlungen. Alle einzelnen Beträge stehen mit ` + ` getrennt vor dem Originalbetreff, die Kategorie ist „Avis“. Eine Wiederholung desselben Betrags mit derselben Währung, etwa im PDF und im Mailtext, wird wie bisher nur einmal gezählt. Eindeutig als getrennte Zahlungen erkannte gleich hohe Teilbeträge bleiben einzeln erhalten.
- **Keine Kategorie:** kein Avis, oder der Flow ist an dieser Mail nicht gelaufen (Ausführungsverlauf prüfen).
- **Suchen:** Den Betrag ins Outlook-Suchfeld eintippen, z. B. `2.601,35`.
- **Antworten und Weiterleitungen:** Kommt ein Avis als Antwort oder Weiterleitung, steht der Betrag ganz vorne, vor „AW:" oder „WG:" („2.601,35 AW: Ihre Zahlungserinnerung"). Wer auf eine schon bearbeitete Mail antwortet, schickt den Betrag im Betreff mit („AW: 2.601,35 Zahlungsavis"). Kommt in so einem Verlauf ein neues Avis mit einem anderen Betrag, steht der neue Betrag ganz vorne („12.347,80 AW: 2.601,35 Zahlungsavis").
- Ein Betreff, der schon mit demselben Betrag beginnt (auch nach „AW:" oder „WG:") oder mit ihm endet (so haben ältere Versionen geschrieben), wird kein zweites Mal ergänzt. Das gilt auch für bisherige Ergänzungen mit Währung und Bindestrich wie `2.601,35 EUR - Zahlungsavis`: Bei demselben einzelnen Betrag bleibt der vorhandene Betreff erhalten. Bei mehreren Avisen muss die vollständige Betragsliste bereits vorhanden sein; derselbe erste Betrag allein reicht nicht aus. Ändert sich ein Betrag oder kommt ein weiterer hinzu, wird die neue vollständige Liste vor den bisherigen Betreff gesetzt.
- **Mails von Kolleginnen und Kollegen:** Haben Absender und alle Empfänger dieselbe Domain und ist die Mail keine Weiterleitung („WG:"), gilt eine Zahlung im Mailtext als eigene Zahlung der Firma: keine Kategorie. Gibt jemand den Anruf eines Kunden weiter („hat gerade angerufen: hat heute 2.601,35 EUR überwiesen"), kommt „Avis prüfen". Weitergeleitete Kunden-Avise und Avise als Datei werden normal erkannt.
- **Nur erwähnt:** Eine Mail, die ein Avis nur erwähnt, ohne Betrag und ohne Datei oder Foto, bekommt keine Kategorie. Beispiele: die Frage „kann ich euch das Avis per Mail schicken?", „wir schicken das Avis nächste Woche", ein Hinweis in einer Bestellung, ein Lieferavis einer Spedition, „anbei unser Avis" mit vergessenem Anhang. Ein Hinweis auf ein Avis im Kundenportal bleibt „Avis prüfen".
- Eine Mail ohne Betreff bekommt nur den Betrag oder die Betragsliste als Betreff („2.601,35" bzw. „1.200,30 + 5.632,21"; Outlook zeigt leere Betreffzeilen sonst als „(Kein Betreff)"). Sehr lange Betreffzeilen werden ebenfalls ergänzt (live getestet mit 250 Zeichen).
- **Zwei Läufe für eine Mail:** Bei vielen gleichzeitig eintreffenden Mails startet Power Automate manchmal zwei Läufe für dieselbe Mail (im Lasttest bei 20 von 40 Mails). Das schadet nicht: Der zweite Lauf setzt dieselbe Kategorie und denselben Betreff, der Betrag steht nie doppelt im Betreff.

## Fehler finden

| Was du siehst | Ursache | Was tun |
| --- | --- | --- |
| Flow startet nicht | Flow aus, falsche Postfachadresse oder falscher Ordner im Trigger, Mail ging in einen anderen Ordner | Trigger prüfen; Ausführungsverlauf ansehen |
| Kategorie_setzen oder Betreff_setzen: **403** | Kein Vollzugriff, falsches Konto in der Verbindung oder neue Rechte noch nicht aktiv | Schritt 1; bis zu 2 Stunden warten; Verbindung unten in der Aktion prüfen |
| **404** | URI falsch (Postfachadresse) oder die Mail wurde verschoben oder gelöscht, bevor der Flow lief | Formel in URI prüfen; Kolleginnen und Kollegen bitten, neue Mails ein paar Minuten liegen zu lassen |
| **400** | Text (Body) falsch | Formel aus `formeln/` neu einfügen, über **fx** |
| Run_script: „We couldn't find the script" oder „BadGateway" | Skript nicht gespeichert, anders benannt oder andere Datei gewählt | In Excel prüfen, dass das Skript **AvisV2** heißt und gespeichert ist; in Run_script Datei und Skript neu wählen |
| Run_script: Zeitüberschreitung | Sehr große Mail | Die Mail bekommt „Avis prüfen"; von Hand bearbeiten |
| Kategorie grau statt farbig | Kategorie nicht im Postfach angelegt | Schritt 2 |
| Betreff_setzen rot, Kategorie anschließend gesetzt, ab Januar 2027 | Microsofts Betreff-Sperre ist aktiv | Abschnitt „Ab Januar 2027" |
| Betreff_setzen rot und Kategorie_setzen übersprungen | Fehlerpfad nach dem Umbau fehlt | Kategorie_setzen → Ausführen nach → Betreff noetig: Ist erfolgreich, Timeout und Ist fehlgeschlagen anhaken (Schritt 5.8) |
| Abwesenheitsnotiz bekommt eine Kategorie | Text der Notiz nicht in Keine_Automatik | Zeile in Keine_Automatik ergänzen; das Skript erkennt die meisten automatischen Antworten auch selbst |

## Ab Januar 2027: Betreff-Sperre prüfen

Microsoft hat angekündigt, ab dem 31.12.2026 Änderungen an Betreff und Text empfangener Mails über die Graph-Schnittstelle zu sperren. Kategorien sind nicht betroffen.

1. In der ersten Januarwoche den 5-Minuten-Test (Schritt 4) wiederholen.
2. Sind beide Aktionen grün: nichts tun.
3. Ist die Betreff-Aktion rot (meist 403) und die anschließende Kategorie-Aktion grün: Die Sperre greift. Dann auf Plan B umstellen. Plan B legt statt der Betreffänderung eine Weiterleitung als Entwurf an, setzt dort den Betreff und schickt sie an das Postfach. Danach wird das Original kategorisiert und erst dann in einen Ordner „Avis-Original" verschoben. Alle Aktionen und Formeln dazu stehen in `dist/avis-flow.html` (oben auf „Plan B" umschalten). Plan B braucht zusätzlich „Senden als" (Schritt 1 gibt das schon).

### Plan B: Reihenfolge und Verschieben

Plan B ist noch nicht live im Testzugang gebaut; der aktuelle Aufbau wurde lokal geprüft. Er erzeugt auch bei mehreren Avisen eine Kopie mit der vollständigen Betragsliste im Betreff und der Kategorie „Avis“. Die Reihenfolge im Wahr-Zweig von Kategorie_noetig lautet:

```
Betreff_noetig
├─ Wahr: Kopie_anlegen → Kopie_anpassen → Kopie_senden
└─ Falsch: leer
danach: Kategorie_setzen
danach: Original_verschieben_noetig
        ├─ Wahr: Original_verschieben
        └─ Falsch: leer
```

1. **Betreff_setzen** durch **Kopie_anlegen → Kopie_anpassen → Kopie_senden** ersetzen, alle innerhalb des Wahr-Zweigs von Betreff_noetig. Die Parameter stehen in der HTML. Kopie_anpassen läuft nur nach erfolgreichem Kopie_anlegen, Kopie_senden nur nach erfolgreichem Kopie_anpassen.
2. **Kategorie_setzen** bleibt unter der gesamten Bedingung Betreff_noetig. Unter **Ausführen nach** weiterhin **Ist erfolgreich**, **Timeout** und **Ist fehlgeschlagen** für Betreff noetig auswählen. So wird das Original auch nach einem Fehler beim Anlegen, Anpassen oder Senden kategorisiert.
3. Auf das **+ unter Kategorie_setzen** klicken, noch im Wahr-Zweig von Kategorie_noetig: **Bedingung** erstellen und **Original_verschieben_noetig** nennen. Links über **fx** `equals(actions('Kopie_senden')?['status'], 'Succeeded')`, Mitte **ist gleich**, rechts über **fx** `true`. Unter **Einstellungen → Ausführen nach → Kategorie setzen** ausschließlich **Ist erfolgreich** auswählen.
4. **Original_verschieben** in den Wahr-Zweig dieser neuen Bedingung setzen. Es ist dort die erste Aktion und hat innerhalb des Zweigs keinen Vorgänger (`"runAfter": {}`); eine alte Abhängigkeit von Kopie_senden entfernen. Nachrichten-ID und ursprüngliche Postfachadresse bleiben die des Originals, Zielordner ist **Avis-Original**. Der Falsch-Zweig bleibt leer.
5. Die Erkennung **Eigene_Kopie** mit **Kategorie_Kopie** am Anfang des Flows bleibt bestehen. Eine beim Versand entstandene Kopie wird in ihrem eigenen Lauf nur kategorisiert.

Das Original wird damit nur verschoben, wenn die Kopie erfolgreich versandt und das Original erfolgreich kategorisiert wurde. Schlägt Kategorie_setzen fehl, wird die Verschiebe-Bedingung übersprungen. Ohne erfolgreiche Kopie ist sie Falsch. In beiden Fällen bleibt das Original im Posteingang.

## Grenzen

- Etwa 150 Avise und 150 andere Mails am Tag ergeben rund 300 Skript-Aufrufe (Limit 1.600 pro Nutzer und Tag) und rund 1.500 Power-Automate-Anfragen (Limit bei Microsoft-365-Lizenz offiziell 6.000 in 24 Stunden).
- Das Skript darf höchstens 3-mal in 10 Sekunden laufen (daher Grad 1 und Wiederholungsrichtlinie) und höchstens 120 Sekunden. Es hört nach 90 Sekunden selbst auf und meldet, was es nicht mehr geschafft hat.
- Sehr große Mails (über etwa 4 MB) können am Größenlimit scheitern und bekommen dann „Avis prüfen".
- Nicht lesbar: reine Scans ohne Text (keine Texterkennung), verschlüsselte Mails und PDFs mit Kennwort, altes Excel-Format .xls, Word-Dateien (.doc, .docx), mit Microsoft Purview geschützte Mails. Sie bekommen „Avis prüfen", wenn ein Hinweis auf ein Avis da ist. Gelesen werden PDF, Excel (.xlsx, .xlsm), CSV, OpenDocument-Tabellen (.ods), RTF, Text, HTML, XML, JSON, angehängte Mails (.eml) und Outlook-Elemente (.msg, mit ihren Anhängen und eingebetteten Mails).
- Bilder als Anlage (Foto, Fax als TIFF/JPG) werden nicht gelesen.
- Eigene Zahlungsavise: Schickt eure Kreditorenbuchhaltung ihre Avise an Lieferanten in Kopie (CC oder BCC) an das Avis-Postfach, erkennt das Skript die eigene Mail an der Absender-Domain und an den Empfängerangaben im Mailkopf und vergibt keine Kategorie. Fehlen diese Angaben im Mailkopf, sieht die Kopie aus wie ein Kunden-Avis und bekommt „Avis". Sicher ist: die Kopie abstellen oder in Keine_Automatik eine sechste Zeile ergänzen: links Blitz → **Von**, Mitte **enthält nicht**, rechts die Absenderadresse der Kreditorenbuchhaltung.
- Je Mail liest das Skript höchstens 30 Anlagen (Dateien mit „Avis" oder „Zahlungsavis" im Namen zuerst). Hat eine Mail mehr, bekommt sie „Avis prüfen", wenn unter den gelesenen kein Avis war.

## Anhang A: Alle Formeln zum Kopieren

Die Formeln liegen auch einzeln in `formeln/` (Datei öffnen, **Copy raw file**, im Feld über **fx** einfügen).

| Wo | Formel | Datei |
| --- | --- | --- |
| Run_script, pdfBase64 | `base64(body('Export_email'))` | `Run_script_pdfBase64.txt` |
| Kategorie_noetig, links (rechts: fx `true`) | `or(not(equals(actions('Run_script')?['status'], 'Succeeded')), not(empty(outputs('Run_script')?['body/result/patchCategory'])))` | `Kategorie_noetig_links.txt` |
| Kategorie_setzen und Betreff_setzen, URI | `concat('https://graph.microsoft.com/v1.0/users/avis@firma.de/messages/', triggerOutputs()?['body/id'])` | `URI_Kategorie_und_Betreff.txt` |
| Kategorie_setzen, Text | `if(equals(actions('Run_script')?['status'], 'Succeeded'), outputs('Run_script')?['body/result/patchCategory'], '{"categories":["Avis prüfen"]}')` | `Kategorie_setzen_Text.txt` |
| Betreff_noetig, links (rechts: fx `true`) | `and(equals(actions('Run_script')?['status'], 'Succeeded'), not(empty(outputs('Run_script')?['body/result/patchSubject'])))` | `Betreff_noetig_links.txt` |
| Betreff_setzen, Text | `outputs('Run_script')?['body/result/patchSubject']` | `Betreff_setzen_Text.txt` |

## Anhang B: Gründe und Hinweise auf Deutsch

Das Skript schreibt Gründe und Hinweise auf Englisch, damit sie überall gleich lesbar sind. Du findest sie im Ausführungsverlauf: Lauf anklicken → **Keine Automatik** aufklappen → **Run script** → **Ausgaben**: `result.error` (Grund), `result.warnings` (Hinweise), `result.verdictWhy` (Urteil über die Mail) und `result.documents` (je Dokument). In der Tabelle steht der Anfang des englischen Textes. Wo `…` steht, folgen Zahlen oder Details aus dem Dokument.

**Kein Betrag gefunden (ok = false)**

| Grund (englisch) | Bedeutung | Was tun |
| --- | --- | --- |
| `no PDF content passed` | Das Skript hat keine Datei bekommen | In Run_script das Feld pdfBase64 prüfen: fx `base64(body('Export_email'))` (Schritt 5.4) |
| `not a PDF (header missing, …)` | Die Anlage ist keine PDF oder beschädigt, auch wenn sie so heißt. In der Klammer stehen die Größe und die ersten Zeichen dessen, was beim Skript ankam: `starts 'JVBER…'` ist eine Base64-PDF, `starts '%PDF…'` eine PDF als Text | Anlage von Hand öffnen; Betrag von Hand. Kommt das bei jeder Mail: Feld pdfBase64 in Run_script prüfen (Schritt 5.4) |
| `PDF arrived as text instead of Base64 - content damaged (…)` | Power Automate hat die PDF als Text statt als Base64 übergeben, dabei sind Teile verloren gegangen. In der Klammer steht, woran das Lesen gescheitert ist | Betrag von Hand. In Run_script das Feld pdfBase64 auf fx `base64(body('Export_email'))` umstellen (Schritt 5.4) |
| `PDF is password protected - cannot be read` | Die PDF hat ein Kennwort zum Öffnen | Betrag von Hand (Kennwort beim Absender erfragen). PDFs, die nur gegen Kopieren oder Drucken geschützt sind, liest das Skript dagegen normal |
| `PDF is encrypted with a certificate - cannot be read` | Die PDF ist mit einem Zertifikat verschlüsselt | Betrag von Hand |
| `PDF is encrypted with an unsupported method (…) - cannot be read` | Die PDF ist mit einem Verfahren verschlüsselt, das das Skript nicht kennt | Betrag von Hand |
| `no pages found` | In der Datei wurden keine Seiten gefunden (Datei kaputt oder abgeschnitten) | PDF von Hand öffnen; ggf. beim Absender neu anfordern |
| `no text layer found (scanned PDF?)` | Reiner Scan: Die PDF ist nur ein Bild, ohne Text | Betrag von Hand |
| `PDF read incompletely (time budget exhausted)` | Die PDF war so groß oder aufwendig, dass das Zeitlimit von 90 Sekunden erreicht wurde, bevor Text gelesen war | Betrag von Hand |
| `no amount pattern found` | Text gelesen, aber kein Betrag erkannt (z. B. Beträge ohne Nachkommastellen wie „3.454 EUR") | Betrag von Hand |
| `exception: …` | Interner Fehler im Skript | Betrag von Hand; PDF aufheben und an die Person geben, die das Skript pflegt |

**Signierte, verschlüsselte und geschützte Mails und PDFs**

| Grund (englisch) | Bedeutung | Was tun |
| --- | --- | --- |
| `S/MIME encrypted mail - cannot be read` | Die Mail ist mit S/MIME verschlüsselt. Nur dein Outlook mit deinem Zertifikat kann sie öffnen | Original-Mail in Outlook öffnen, Betrag von Hand |
| `protected mail (Microsoft Purview) - cannot be read` | Die Mail ist mit Microsoft Purview geschützt (Anlage `message.rpmsg`, z. B. „Verschlüsseln" oder „Nicht weiterleiten" in Outlook) | Original-Mail in Outlook öffnen, Betrag von Hand |
| `signed mail contains no PDF` | Die signierte Mail enthält keine PDF (das Avis steht vielleicht im Mailtext oder ist eine andere Datei) | Original-Mail öffnen, Betrag von Hand |
| `protected PDF - cannot be read` | Geschützte PDF (z. B. mit Microsoft Purview / Vertraulichkeitsbezeichnung), nur mit Berechtigung zu öffnen | In Outlook oder Acrobat öffnen, Betrag von Hand |

**Unsicher (ok = true, Grund beginnt mit `uncertain:`)**

Nach `uncertain:` folgen ein oder mehrere dieser Gründe, getrennt durch `;`. Den Vorschlag des Skripts siehst du im Betreff (mit „?") und im Ausführungsverlauf unter `result.candidates`.

| Grund (englisch) | Bedeutung |
| --- | --- |
| `OCR text layer` | Der Text stammt aus einer Texterkennung (OCR) über einem Scan. Ziffern können falsch erkannt sein |
| `uncertain: PDF arrived as text instead of Base64 - parts may be damaged` | Power Automate hat die PDF als Text statt als Base64 übergeben. Ein Teil ließ sich lesen, andere Teile sind verloren. Den Vorschlag mit der PDF vergleichen und das Feld pdfBase64 in Run_script auf fx `base64(body('Export_email'))` umstellen (Schritt 5.4) |
| `PDF read incompletely (…)` | Die PDF konnte nur teilweise gelesen werden (beschädigt, abgeschnitten, Zeichen ohne Zuordnung). Der richtige Betrag kann fehlen |
| `PDF read incompletely (time budget exhausted)` | Die PDF war so groß oder aufwendig, dass das Zeitlimit von 90 Sekunden erreicht wurde |
| `uncertain: PDF changed after signing` | Die PDF selbst ist digital signiert und wurde nach der letzten Signatur noch verändert. Der gelesene Betrag ist vielleicht nicht der signierte. Im Zweifel beim Absender nachfragen |
| `uncertain: several PDFs in the mail with different amounts (…)` | Neben dem gewählten Avis enthält die Mail eine weitere Anlage mit einem anderen sicheren Betrag, die weder ein Avis noch ein anderer Dokumenttyp ist (in der Klammer: Dateiname und Betrag; trotz des Wortlauts muss die Anlage keine PDF sein). Welcher Betrag gezahlt wurde, ist unklar: Betreff mit dem Betrag des Avis und „?", Kategorie „Avis prüfen". Beide Anlagen ansehen |
| `'…' - not a payment advice?` | Im Dokument steht ein Wort wie „Mahnung", „Lieferschein", „Lastschrift", „Angebot", „Auftragsbestätigung" oder „Abschlagsrechnung" (oder ein fremdsprachiger Titel wie „Estratto conto", „Bulletin de paie"), aber keine Überschrift wie „Zahlungsavis". Auch eine Zahlungsbitte („Wir bitten Sie, den Restbetrag … zu überweisen") oder ein Bankeinzug („… wird von Ihrem Konto abgebucht") steht hier. Wahrscheinlich kein Zahlungsavis. Wörter in Bezugsfeldern („Ihr Zeichen: Mahnung vom …"), in der Empfängeradresse („Personalabteilung / Entgeltabrechnung") und in einer reinen Abteilungszeile („z. Hd. Lohn- und Gehaltsabrechnung") zählen nicht als Titel, ebenso wenig eine Abschnittsüberschrift über einer Tabelle („Invoice details:"). „Ihre Mahnung" oder „bezugnehmend auf Ihre Zahlungserinnerung" im Text zählt nur dann nicht, wenn das Schreiben eine erfolgte Zahlung nennt („haben wir heute überwiesen", „dass wir heute … an Sie angewiesen haben", „heute überweisen wir"); ein Schreiben, das die Zahlung verweigert oder erst ankündigt, geht in die Prüfung. Das gilt genauso für einen genannten Lieferschein („Ihr Lieferschein LS-55871", „Bezug: Lieferschein 80012345"). Ein genannter Lieferschein zählt aber nur dann nicht, wenn der gewählte Betrag als Zahlung beschriftet ist; sonst bleibt der Grund. Ein verneinter Satz („haben wir noch nicht überwiesen") ist keine erfolgte Zahlung. Auch eine Gutschriftsanzeige der Bank über eine Rücküberweisung, eine Rückbuchung, eine Wiedergutschrift oder Rückgabe einer Lastschrift, eine Dividende oder Ertragsgutschrift, erstattete Bankentgelte oder eigene Zinsen der Bank („Zinsgutschrift"), eine Gutschriftsanzeige, deren Auftraggeber die Bank selbst ist, und eine „Ratenzahlungsvereinbarung" stehen hier. Der Hinweis „Eine Rückbuchung bleibt vorbehalten" und „Rechnungsabschluss" in den Bankbedingungen zählen nicht. Ebenso: eine fehlgeschlagene Auszahlung („Payout failed", „Status: Reversed by your bank"), eine „Belastungsanzeige" oder „Debit advice" ohne Empfänger (nicht, wenn sie als Minuszeile neben den bezahlten Rechnungen verrechnet ist), eine „Umsatzübersicht", „Auszahlungsvorschau", „Vorläufige Abrechnung" oder ein „Zahlungsvorschlag", Zahlungsbedingungen für den Leser, wenn das Schreiben keine eigene Zahlung nennt („Wenn Sie bis zum … überweisen, können Sie 2 % Skonto abziehen", „Bei Überweisung bis … gewähren wir 2 % Skonto", „Zahlungsbedingungen", „is still outstanding", „… ist noch offen", „die Skontofrist war bereits abgelaufen") und „Den offenen Restbetrag von … erwarten wir" (nicht, wenn eine Gutschrift erwartet wird). Außerdem: eine Verrechnung ohne Geldfluss („no funds will be transferred", „eine Zahlung von uns erfolgt nicht", „es ist nichts zu zahlen"), eine von einer Bank zurückgewiesene Überweisung („wire was returned", „payment was rejected", „wurde von der Empfängerbank zurückgewiesen"; nicht, wenn erneut überwiesen wurde), „bisher ist keine Zahlung erfolgt", eine Zahlungsaufforderung („Bitte veranlassen Sie die Zahlung", „kindly arrange to remit", „ignore this mail if the payment has already been made"), eine Steuerbescheinigung („Withholding Tax Certificate") und ein Ratenplan oder Antrag auf Ratenzahlung oder Stundung. In Version 2 ist so ein Dokument kein Avis (keine Kategorie, außer ein Avis-Wort im Betreff oder Dateinamen macht die Mail zu „Avis prüfen"); nennt der Text daneben eine eigene Zahlung, „Avis prüfen" (`payer statement, but '…' - not a payment advice?`) |
| `asks for a payment advice - not an advice itself` | Das Schreiben bittet um ein Zahlungsavis (z. B. eine Mahnung mit „senden Sie uns ein Zahlungsavis" oder ein Schreiben mit dem Titel „Bitte um Zahlungsavis", „Anforderung Zahlungsavis", „Zahlungsavis fehlt", „Zahlungsavis angefordert", „Request for remittance advice", „… but no remittance advice"). Es ist selbst kein Avis. Antwortet der Zahler auf so eine Bitte („Ihrer Bitte um Zusendung des Zahlungsavis kommen wir nach", Betreff „AW:", „Antwort:" oder „WG: Zahlungsavis fehlt"), bleibt es ein Avis. Das gilt nur, wenn zwischen „Ihre Bitte / Anfrage / Anforderung" und dem Wort „Zahlungsavis" nichts anderes steht als Wörter wie „um Zusendung des". „Ihre Anfrage haben wir erhalten, das Zahlungsavis fehlt uns aber noch" oder „… liegt uns aber nicht vor" bleibt eine Bitte. Auch „share the remittance details with us" und die Frage im Team, ob jemand das Avis hat („Hat jemand von euch schon ein Avis von …?", „Has anyone received a remittance advice …?"), stehen hier. Sätze, dass man den Kunden noch nach dem Avis fragt („I'll ask them for the remittance advice", „frage den Kunden nach dem Avis"), zählen nicht als Avis-Titel oder Avis-Wort, außer das Avis folgt gleich danach („here it is", „anbei", „nachstehend") |
| `payee's letter about a received payment - not a payment advice?` | Der Absender hat das Geld selbst bekommen (z. B. „auf unserem Konto ist ein Betrag von … eingegangen", „können wir keiner Rechnung zuordnen", „we are unable to match it"). Das ist ein Schreiben des Zahlungsempfängers, kein Avis. Auch „Ihre Teilzahlung über 2.500,00 € ist heute eingegangen" ist die Sicht des Empfängers. Nennt der Zahler etwas, das bei ihm eingegangen ist (die Rechnung, eine Rückzahlung), oder schreibt er „If you cannot allocate this payment, please contact us", bleibt es ein Avis. Auch diese Sätze sind die Sicht des Empfängers: „Sie haben uns … überwiesen", „Sie haben unsere Rechnung … mit 1.960,00 EUR beglichen", „dass Sie die Rechnung … beglichen haben", „wir bestätigen den Eingang Ihrer Zahlung", „Ihre Überweisung … haben wir dankend erhalten", „… wurde unserem Konto … gutgeschrieben", „vielen Dank für Ihre Teilzahlung", „thank you for your payment", „we confirm receipt of your payment", „you paid EUR …", „PAYMENT RECEIVED – THANK YOU", „Zahlungseingang – vielen Dank", der Dank für eine Spende. „Your payment reminder … was received. We have today paid …" und „thank you for your payment reminder" bleiben ein Avis des Zahlers |
| `credit note title - not a payment advice?` | Das Dokument ist als Gutschrift überschrieben (z. B. Gutschrift eines Lieferanten), nicht als Zahlungsavis |
| `debit note title - not a payment advice?` | Das Dokument ist als Belastung des Kunden überschrieben („Debit Note", „Debit Memo"): Der Kunde belastet den Lieferanten, das ist kein Zahlungsavis |
| `amount due with VAT - invoice?` | Ein fälliger Betrag zusammen mit einer Mehrwertsteuerzeile. Sieht nach einer Rechnung aus |
| `payroll words - not a payment advice?` | Wörter einer Lohn- oder Gehaltsabrechnung. Wahrscheinlich kein Zahlungsavis |
| `travel expense words - not a payment advice?` | Wörter einer Reisekostenabrechnung. Wahrscheinlich kein Zahlungsavis |
| `shipping words - not a payment advice?` | Wörter einer Versand- oder Lieferbestätigung. Wahrscheinlich kein Zahlungsavis |
| `no payment wording - not a payment advice?` | Im Dokument kommt kein Wort wie Zahlung, überwiesen, Gutschrift oder (englisch) payout, paid out, amount transferred vor. Bei fremdsprachigen Dokumenten fehlt ein Satz wie „nous avons payé" / „wij hebben betaald" / „przelaliśmy", oder es steht ein offener Betrag oder eine Lastschrift darin. Ein offener Rest nach einer Teilzahlung („Pozostało do zapłaty", „Do zapłaty pozostało", „reste à payer") zählt nicht als offener Betrag, wenn der Zahler die Zahlung nennt. „Next payout", „since last payout", „expected payout" oder „available for payout" zählen nicht als Zahlungswort. Wahrscheinlich kein Zahlungsavis |
| `amount from the quoted e-mail` | Der Betrag steht nur im zitierten Teil einer beantworteten oder weitergeleiteten Mail, nicht im eigenen Text |
| `credit note not netted in the total` | Eine Gutschrift steht in einem eigenen Block und ist in der Summe nicht verrechnet |
| `total … below includes the payment` | Weiter unten steht eine Summe, die den gewählten Betrag und weitere Beträge enthält |
| `payment amount without decimals` | In einem Satz zur Zahlung steht ein Betrag ohne Nachkommastellen (z. B. „3.454 EUR"), den das Skript nicht liest |
| `deduction near the total` | Neben der Summe steht ein Abzug (Skonto, Gebühr, Gutschrift). Unklar, ob vor oder nach Abzug gezahlt wurde |
| `deduction below the total` | Unter der Summe steht noch ein Abzug oder eine Gutschrift, die nicht verrechnet ist |
| `amount looks like a deduction` | Der gewählte Betrag sieht selbst wie ein Abzug aus |
| `close runner-up …` | Ein zweiter Betrag ist fast genauso wahrscheinlich (steht dahinter) |
| `second payment amount …` | Es gibt zwei Zahlbeträge (der zweite steht dahinter). Das kommt auch, wenn unter einer Summe Abzüge und dann eine kleinere Zahlzeile stehen, die nicht aufgeht (z. B. „Zahlbetrag 10.000,00", „abzüglich Delkredere 150,00", „Gutschrift auf Ihr Konto 9.800,00"). Geht die Rechnung auf, nimmt das Skript die untere Zeile und dieser Grund kommt nicht |
| `transfer amount … differs from …` | Ein ausdrücklich genannter Überweisungsbetrag (z. B. „Überweisungsbetrag", „Auszahlungsbetrag", „Gutschriftsbetrag", oft im Kopf oder auf der letzten Seite) weicht vom gewählten Betrag ab, meist von der Tabellensumme. Die Differenz ergibt sich nicht aus den Abzugszeilen im Dokument (Gebühr, USt auf die Gebühr, Delkredere, Bonus, Skonto). Welcher Betrag überwiesen wurde, ist unklar. Steht der genannte Betrag als Zwischenschritt über weiteren Abzügen („Zahlbetrag lt. Ihrer Rechnung", darunter „abzüglich Skonto" und „Überweisung"), erklären die Abzüge dazwischen die Differenz, und dieser Grund kommt nicht |
| `payment sentences with different amounts` | Im Text stehen mehrere Sätze wie „wir haben … überwiesen" mit verschiedenen Beträgen. Keiner ist als frühere Zahlung („bereits", „schon", „zuvor") oder als heutige Zahlung („heute", „Restbetrag") erkennbar, und keiner ist die Summe der anderen. Eine erst angekündigte Zahlung („überweisen wir nach Klärung", „nächste Woche", „im November", „am 15.12.2026") oder eine noch nicht geleistete („haben wir noch nicht überwiesen") zählt dabei nicht mit |
| `several amounts in the payment sentence` | Ein Satz zur Zahlung nennt einen Abzug (Skonto, Rabatt, Gutschrift) und mehrere Beträge, und die Rechnung geht nicht auf. Beispiel: „über 1.190,00 EUR abzüglich 2 % Skonto, also 1.160,00 EUR" (2 % von 1.190,00 ergeben 1.166,20) oder „abzüglich Skonto, also 1.166,20 EUR" ohne Prozentsatz und ohne Skontobetrag. Auch eine Summe, die nicht aufgeht („… zusammen 1.450,00 EUR"), oder eine Summe, von der nur ein Teil bezahlt ist („insgesamt 3.000,00 EUR, haben wir heute nur die Rechnung … bezahlt"), steht hier. Vorgeschlagen wird der Betrag nach „also" / „=". Ein Betrag nach „statt" / „instead of" / „nicht" zählt in einem Zahlungssatz nicht als Zahlbetrag („den vollen Betrag von 2.000,00 EUR statt 1.960,00 EUR"). Eine Rate von einer errechneten offenen Summe („ergibt 4.000,00 EUR. Hiervon haben wir heute eine erste Rate von 2.000,00 EUR überwiesen") ist kein Widerspruch |
| `payment announced for later` | Der gewählte Betrag wird nur angekündigt: „überweisen wir im Dezember", „werden wir am 15.11.2026 überweisen", „sobald die Mängel behoben sind", „haben wir noch nicht überwiesen", oder er heißt „Pending payout", „Estimated payout", „Expected payout", „Voraussichtlicher Auszahlungsbetrag", „Auszahlungsbetrag (vorläufig)", „Payout on hold". Auch: „Die Überweisung wird am 20.11.2026 ausgeführt", „Die Auszahlung erfolgt am …", „ist für den 30.11.2026 vorgesehen", „haben die Zahlung zur Ausführung am 20.11.2026 freigegeben", „überweisen wir am 15. Dezember", „in der 46. KW", „nach Abnahme / Wareneingang", „hiermit teilen wir Ihnen mit, dass wir … überweisen werden", „… werden wir erst nach Erhalt … begleichen. Der Betrag wird Ihnen dann überwiesen". Nennt das Schreiben daneben eine heutige oder erfolgte Zahlung, nimmt das Skript diese, und der Grund kommt nicht. „Der Betrag wird Ihrem Konto mit Valuta … gutgeschrieben" ist keine Ankündigung, ebenso wenig der Monat der Lieferung oder Leistung („für die im Oktober gelieferte Ware"), ein Fälligkeitsdatum („fällig am …") oder ein Zeitraum („Leistungszeitraum 01.11.2026 bis 30.11.2026"). In Version 2 entscheidet der Rest der Mail über die Kategorie: Spricht sonst nichts für ein Avis, bekommt die Mail keine Kategorie (Urteil `payment announced for later ('…')` oder `payment not made yet ('…')`); mit Avis-Titel oder Zahlbetrag-Zeile „Avis prüfen" mit Betrag und „?" im Betreff; mit einem Avis-Wort im Betreff oder wenn der Schreiber seine Zahlung an eine eigene Prüfung knüpft („überweisen wir, sobald die Mängel behoben sind") „Avis prüfen" ohne Betrag |
| `negative amount - not a received payment?` | Der gewählte Betrag ist negativ (z. B. „-120,00" in einer Umsatzliste), und das Dokument hat keine Überschrift wie „Zahlungsavis". Das ist eher Geld, das abgeflossen ist, kein Zahlungseingang. Ein Avis mit Überschrift, das seine Summe mit nachgestelltem Minus druckt („Gesamt 3.454,00- EUR"), bekommt diesen Grund nicht |
| `payment line says …, total says …` / `payment line says …` | Die Zahlbetragszeile und die Summe (oder der gewählte Betrag) widersprechen sich |
| `several unlabelled sums` | Mehrere Summen ohne Beschriftung, z. B. „bezahlt" und „offen" |
| `no label, amount chosen by size` | Kein Wort wie „Zahlbetrag" gefunden, nur der größte Betrag |
| `amount only backed by a sum check` | Nur über eine Rechenprobe gefunden (Netto + Steuer = Brutto) |
| `only a weak label (Betrag/Zahlung)` | Nur ein schwaches Wort wie „Betrag" vor dem Betrag |
| `amount from an attached invoice copy` | Der Betrag stammt aus einer angehängten Rechnungskopie, nicht aus dem Avis |
| `total follows a VAT line - invoice?` | Die Summe steht direkt nach einer Mehrwertsteuerzeile. Das sieht eher nach einer Rechnung aus |
| `Skonto/Rest column on the right of the table` | Die Tabelle hat ganz rechts eine Skonto- oder Restbetragsspalte |
| `payment label without readable amount` | „Zahlbetrag" o. ä. steht da, aber der Betrag daneben ist nicht lesbar |
| `gross column chosen, payment column empty` | Betrag aus der Bruttospalte, die Zahlbetragsspalte ist leer oder unlesbar |
| `amount is zero` | Der gefundene Betrag ist 0,00 |
| `several currencies (…)` | Im Dokument kommen mehrere Währungen vor |
| `weak signals` | Allgemein zu wenige Hinweise für einen sicheren Betrag |
| `uncertain: part payment, the rest of the invoice is still open` | Eine Teilzahlung, deren offener Rest an eine Bedingung, Prüfung oder Reklamation gebunden ist („über den Restbetrag sprechen wir nach Prüfung", „we will settle the balance of EUR 3,520.00 once …"). Der Betreff bekommt die Teilzahlung mit „?". Teilzahlung buchen, den Rest klären |
| `uncertain: no currency in the document, payer in the US (USD or EUR?)` | Das Avis nennt keine Währung (nur Beträge oder „$" ohne Zusatz), der Zahler hat eine US-Adresse. Meist ist es USD, manchmal EUR. Betreff mit „?". Währung am Zahlungseingang prüfen |
| `uncertain: the mail text says only … was paid, the attached advice shows …` | Das angehängte Avis zeigt einen Betrag, der Mailtext sagt aber, dass nur ein Teil davon überwiesen wurde („only EUR 10,000.00 was released and transferred today", „nur 10.000,00 EUR überwiesen"). Der Betreff bekommt den Betrag aus dem Mailtext mit „?"; im `verdictWhy` steht `…, part payment named in the mail text`. Zahlungseingang prüfen |
| `amounts without decimals` | Im Dokument steht kein Betrag mit Nachkommastellen; das Skript hat ganze Beträge neben einem Währungszeichen gelesen („Amount: $4,397", „zusammen 5.133 €") und traut ihnen nicht. Betreff mit „?". Betrag am Zahlungseingang prüfen |
| `uncertain: transfer with charges, the payee is not confirmed as the recipient` | Bankformular mit Betrag, Entgelt und „Belastung gesamt", ohne OUR oder SEPA, und der Empfänger ist nicht als wir erkennbar: Die Überweisung kann an jemand anderen gegangen sein, oder die Empfängerbank zieht Spesen ab. Betrag mit „?". Empfänger prüfen, Zahlungseingang abgleichen |

**Version 2: ganze Mail (.eml), Mailtext, Tabellen und andere Anlagen**

Mit der ganzen Mail prüft das Skript jede PDF, jede andere lesbare Anlage und den Mailtext. Die Felder `verdict` (advice / several / unclear / other) und `verdictWhy` sagen, wie die Mail eingeordnet wurde; `documents` hat je geprüftem Dokument eine Zeile `Name | Typ | Urteil | Betrag | Konfidenz | Grund`.

| Grund (englisch) | Bedeutung | Was tun |
| --- | --- | --- |
| `several PDFs in the mail with different amounts (…)` / `several advices in the mail with different amounts (…)` | Die Mail enthält zwei oder mehr Avise (PDF, Tabelle oder Mailtext) mit verschiedenen Beträgen. In der Klammer stehen Name und Betrag je Avis. Kategorie „Avis“, die einzelnen Beträge stehen mit ` + ` vor dem Originalbetreff | Einzelne Zahlungen wie üblich zuordnen |
| `uncertain: the mail text names another payment amount (…) than the attached advice` | Im Mailtext steht „wir haben … überwiesen" mit einem anderen Betrag als im angehängten Avis, und dieser Betrag kommt in keiner Anlage vor (Tippfehler, Teilzahlung, falsches Avis). In der Klammer steht der Betrag aus dem Mailtext. Der Betreff bekommt den Betrag aus dem Avis mit „?", Kategorie „Avis prüfen" | Avis und Zahlungseingang vergleichen, Betrag von Hand prüfen |
| `uncertain: the mail text names another payment amount (…, actually paid) than the attached advice (…)` | Der Mailtext nennt ausdrücklich den tatsächlich gezahlten Betrag („the BACS payment actually sent today is GBP 5,702.45", „tatsächlich überwiesen"), und der weicht vom angehängten Avis ab (zweite Klammer: Betrag des Avis). Der Betreff bekommt den Betrag aus dem Mailtext mit „?", Kategorie „Avis prüfen"; im `verdictWhy` steht `…, the amount actually paid named in the mail text`. Liegt die genannte Zahlung mehr als 5 Tage vor der Mail, ist sie eine frühere Zahlung und kein Widerspruch | Avis, Mailtext und Zahlungseingang vergleichen |
| `mail text with another amount than the attached advice (…)` (in `documents`) | Der Mailtext nennt einen anderen Betrag als das angehängte Avis; gezählt wird das Avis. Steht im Mailtext „zusätzlich", „separat", „gesondert", „außerdem" oder „weitere Zahlung", ist der Mailtext eine eigene zweite Zahlung: Beide Beträge kommen mit ` + ` in den Betreff, Kategorie „Avis“ | – |
| `several payments in one document (…)` | Eine Tabelle enthält mehrere getrennte Zahlungen (z. B. zwei Zahlungsblöcke). Die Beträge stehen mit ` + ` im Betreff, Kategorie „Avis“ | Einzelne Zahlungen wie üblich zuordnen |
| `separate payment amounts incomplete (…)` / `separate payment amounts incomplete or out of range (…)` / `separate payments in the document, but not all amounts readable` | Eine erkannte Mehrfachzahlung hat keine vollständige gültige Betragsliste. Kategorie „Avis prüfen“, Betreff unverändert | Fehlende Beträge in den Originalunterlagen prüfen |
| `mail text repeats the total of the separate payments` (in `documents`) | Der Begleittext nennt die Summe der einzelnen Zahlungen aus den Anlagen. Diese Summe wird nicht als weitere Zahlung in den Betreff übernommen | – |
| `mail contains no PDF` | Die Mail hat keine PDF, und weder Mailtext noch andere Anlagen enthalten einen Betrag | Nur bei Kategorie „Avis prüfen" etwas tun: Mail öffnen |
| `file named PDF without a PDF header - cannot be read` | Eine Anlage heißt `.pdf` oder ist als PDF gekennzeichnet, ist aber keine PDF (beschädigt oder etwas anderes) | Anlage von Hand öffnen |
| `Office file (old .xls/.doc, encrypted or .msg) - cannot be read` | Altes Excel- oder Word-Format, eine verschlüsselte Office-Datei oder eine beschädigte Outlook-Nachricht (.msg). Lesbare Outlook-Nachrichten (.msg) werden wie angehängte Mails gelesen: Betreff, Absender, Text, Anhänge und eingebettete Mails | Anlage von Hand öffnen, Betrag von Hand |
| `Word document - cannot be read` | Word-Dokument (.docx); das Skript liest keine Word-Dateien | Anlage von Hand öffnen |
| `ZIP file - cannot be read` | ZIP-Archiv oder unbekannte Office-Datei | Anlage von Hand öffnen |
| `spreadsheet could not be read` (auch `spreadsheet could not be read (…)`) | Tabellendatei (z. B. .xlsx), die das Skript nicht lesen konnte | Anlage von Hand öffnen |
| `not checked (limit of 30 documents or time budget)` | Die Mail hat mehr als 30 Anlagen, oder die 90 Sekunden waren um; die übrigen Anlagen wurden nicht geprüft | Mail von Hand prüfen, wenn kein Avis erkannt wurde |
| `not a PDF (header missing, …) - read as …: …` | Statt einer PDF kam eine Tabelle, eine HTML- oder Textdatei (auch RTF, JSON, XML oder eine SWIFT-Nachricht); nach dem Doppelpunkt steht, warum darin kein Betrag gefunden wurde | Datei von Hand öffnen |
| `no text` | Ein Mailtext oder eine Textdatei ist leer | – |
| `uncertain: total computed from … rows of column '…'` | Eine Zahlungsliste ohne Summenzeile: Das Skript hat die Zahlbetrag-Spalte selbst addiert (Zahl der Zeilen und Spaltenname in der Meldung). Das kommt auch, wenn das Skript sonst nur eine einzelne Zeile der Liste gefunden hätte | Summe mit der Liste vergleichen |
| `…, the mail text states the same amount` (in `result.verdictWhy`) | Die Tabelle hat keine Summenzeile, das Skript hat die Zahlbetrag-Spalte selbst addiert, und der Mailtext nennt genau diesen Betrag. Damit gilt der Betrag als sicher (Kategorie „Avis" ohne Zusatz) | – |
| `uncertain: list read in part - total not computed` | Eine Zahlungsliste ohne Summenzeile ist länger als 5000 Zeilen (oder das Zeitlimit war erreicht). Eine selbst addierte Summe wäre unvollständig, daher kein Betrag im Betreff; die Mail wird „Avis prüfen" | Summe in der Liste von Hand bilden |
| `uncertain: data file read in part` | Sehr große JSON- oder XML-Datei (mehr als 3000 Zeilen, wie das Skript sie darstellt): nur der Anfang wurde gelesen, Zeilen und Summen können fehlen (dazu der Hinweis `data file read in part (first … lines)`). Betrag mit „?", die Mail wird „Avis prüfen" | Betrag in der Datei prüfen |
| `uncertain: total row differs from the sum of column '…' (…, … rows)` | Die Summenzeile einer Tabelle passt nicht zur Summe der Zahlbetrag-Spalte (in der Klammer: die nachgerechnete Summe und die Zahl der Zeilen). Nennt ein anderes Avis der Mail genau diese Spaltensumme, nimmt das Skript sie (im `verdictWhy`: `… (sum of the payment column, as in …)`) | Summe mit der Liste vergleichen |
| `old Excel .xls format (…) cannot be read - save it as .xlsx` | Altes Excel-Format (Excel 97-2003, 5.0/95 oder 2-4). Die Mail wird „Avis prüfen" | Anlage von Hand öffnen, Betrag von Hand. Absender bitten, künftig .xlsx, CSV oder PDF zu schicken |
| `password-protected old Excel .xls file cannot be read` / `password-protected (encrypted) Office file cannot be read` / `password-protected ZIP archive cannot be read` / `password-protected OpenDocument spreadsheet (.ods) cannot be read` | Die Tabelle hat ein Kennwort zum Öffnen. Die Mail wird „Avis prüfen" | Anlage von Hand öffnen (Kennwort beim Absender erfragen) |
| `rights-protected Office file (IRM) cannot be read` | Die Tabelle ist mit Microsoft Purview / IRM geschützt | Anlage in Excel öffnen |
| `Excel binary workbook (.xlsb) cannot be read - save it as .xlsx` | Excel-Binärformat; das Skript liest .xlsx/.xlsm, LibreOffice-Tabellen (.ods), CSV und die Text-/HTML-Exporte | Anlage von Hand öffnen |
| `OpenDocument spreadsheet (.ods) without a readable table` | LibreOffice-Tabelle, die gelesen wurde, aber keine Tabelle enthält (z. B. ein leeres Formular oder nur Text). Keine Kategorie, außer Betreff oder Dateiname enthalten ein Avis-Wort: dann „Avis prüfen" | Nur bei „Avis prüfen": Anlage von Hand öffnen |
| `Outlook message (.msg) cannot be read` / `old Word .doc format cannot be read` / `old PowerPoint .ppt format cannot be read` | Beschädigte Outlook-Nachricht (lesbare .msg-Dateien werden wie angehängte Mails gelesen), altes Word- oder PowerPoint-Format | Anlage von Hand öffnen |
| `Office binary file of unknown kind cannot be read` / `damaged Office binary file cannot be read` | Unbekannte oder beschädigte Office-Datei | Anlage von Hand öffnen |
| `damaged Excel file: …` / `damaged spreadsheet cannot be read (…)` / `damaged OpenDocument spreadsheet (.ods): content.xml cannot be read` | Die Excel- oder LibreOffice-Datei ist beschädigt oder unvollständig (z. B. abgeschnitten). Die Mail wird „Avis prüfen" | Anlage von Hand öffnen; ggf. beim Absender neu anfordern |
| `uncertain: total row '…' is not the payment; sum of column '…' (… rows) used` | Die Summenzeile einer Tabelle (in einer Anlage oder im Mailtext) addiert die Rechnungsbeträge („Summe Rechnungen", „brutto"), nicht die Zahlungen. Das Skript nimmt die Summe der Zahlbetrag-Spalte | Summe mit der Liste vergleichen |
| `uncertain: no payment list (…) - total not computed` | Die Tabelle hat eine Zahlbetrag-Spalte, ist aber ein Zahlungsplan, eine Offene-Posten- oder Abstimmungsliste (in der Klammer: `due-date column '…'` = Fälligkeitsspalte, `instalment rows` = mindestens zwei Ratenzeilen wie „1. Rate", oder `name '…'` = Datei- oder Blattname wie Zahlungsplan, OP-Liste, Abstimmung). Kein Betrag im Betreff, die Mail wird „Avis prüfen" | Liste von Hand ansehen |
| `uncertain: column sum out of range - total not computed` | Die Summe der Zahlbetrag-Spalte ist unsinnig groß (Überlauf in der Datei). Im `verdictWhy` steht `column '…': sum out of range` | Liste von Hand ansehen |
| `amount out of range (…)` | Der gefundene Betrag ist unsinnig groß (eine Billion oder mehr, z. B. eine falsch gelesene Zahl). Er kommt nie in den Betreff, die Mail wird „Avis prüfen" | Dokument von Hand öffnen |
| `uncertain: sum of … amounts in the payer's sentence (…), no total stated` | Im Mailtext nennt der Zahler mehrere Beträge je Rechnung („980,00 EUR für RE-1 und 2.474,00 EUR für RE-2 überwiesen"), aber keine Summe. Das Skript addiert sie | Summe nachrechnen |
| `uncertain: the mail text refers to an attachment that cannot be read (…)` | Der Betrag stammt nur aus dem Begleittext („anbei unser Zahlungsavis über …"), die Anlage selbst ist unlesbar (Scan, Kennwort, altes .xls). In der Klammer: Name der Anlage und Grund | Anlage von Hand öffnen und Betrag vergleichen |
| `uncertain: … attachments not checked, one named like an advice ('…')` | Die Mail hat mehr als 30 Anlagen; unter den nicht geprüften ist eine, die wie ein Avis heißt | Übrige Anlagen von Hand prüfen |
| `empty attachment (0 bytes) - cannot be read` | Eine Anlage (PDF oder mit Avis-Wort im Namen) ist leer; vermutlich ist beim Absender das Anhängen schiefgegangen | Avis beim Absender neu anfordern |
| `mail parts not read (nested too deep, too many parts or a missing boundary)` | Teile der Mail konnten nicht gelesen werden: sehr oft als Anlage weitergeleitet (über etwa 14 Ebenen), mehr als 5000 Teile oder eine kaputte MIME-Struktur. Die Mail wird „Avis prüfen" | Mail von Hand öffnen |
| `mail could not be parsed` | Die Eingabe beginnt wie eine Mail, ihr Kopf ließ sich aber nicht lesen | Mail von Hand öffnen |
| `e-invoice XML` | Eine XRechnung oder ZUGFeRD-/Factur-X-Datei (XML). Sie ist eine Rechnung, kein Avis, und zählt nicht | – |
| `HTML file with a sign-in form - possible phishing` | Eine angehängte HTML-Datei enthält ein Passwortfeld (gefälschte Anmeldeseite, typisch für Phishing mit „Remittance Advice"). Die Mail wird „Avis prüfen", nie „Avis" | Mail nicht anklicken, Absender prüfen; im Zweifel an die IT melden |
| `…, but … is a sign-in page (possible phishing)` | Mailtext oder ein Dokument sieht wie ein Avis aus, aber eine Anlage ist eine Anmeldeseite. Deshalb zählt nichts als Avis | Wie oben |

| Hinweis (englisch) | Bedeutung |
| --- | --- |
| `from mail: …` / `from signed mail: …` | Aus welchem Dokument der Mail das Ergebnis stammt (`body` = Mailtext) |
| `… PDFs checked (…)` | Welche PDFs der Mail geprüft wurden |
| `not read: …` | Anlagen, die nie gelesen werden: Bilder, Signaturen (`smime.p7s`), Visitenkarten (.vcf), Termine (.ics), `winmail.dat`. Steht ein Avis-Wort im Betreff oder Dateinamen und gibt es sonst kein Avis, wird die Mail „Avis prüfen" |
| `sheet '…': … hidden row(s) skipped` / `… hidden column(s) skipped` / `… cell(s) in hidden columns skipped` | Ausgeblendete Zeilen und Spalten einer Tabelle wurden nicht gelesen (sie zählen auch nicht in die Summe) |
| `sheet '…' is hidden` | Ein ausgeblendetes Tabellenblatt. Es wird nur gelesen, wenn die Datei kein sichtbares Blatt hat |
| `… formula cell(s) without a saved value (file not recalculated)` | Die Datei wurde von einem Programm erzeugt, das Formeln nicht ausrechnet; eine Summenzeile kann leer sein. Das Skript addiert dann selbst (`total computed from …`) |
| `only the first 5000 rows were read` / `only the first 5000 rows of a table were read` / `only the first 64 sheets were read` | Sehr große Tabelle, nur der Anfang wurde gelesen. Eine selbst addierte Summe ist dann unvollständig |
| `data file read in part (first … lines)` | Sehr große JSON- oder XML-Datei, nur die ersten Zeilen wurden gelesen (siehe `uncertain: data file read in part`) |
| `time budget exhausted …` (`sheet read in part`, `while reading the workbook`, `while reading the HTML tables`, `while reading the XML spreadsheet`, `while reading the OpenDocument spreadsheet`) | Das Zeitlimit von 90 Sekunden war erreicht, die Tabelle wurde nur teilweise gelesen |
| `sheet '…': part not found or damaged` / `zip entry '…' is damaged` (auch `is encrypted`, `is too large (…)`, `uses the unsupported compression method …`, `is truncated or damaged (read in part)`, `could not be decompressed: …`) | Ein Teil der Excel-Datei fehlt oder ist beschädigt; die übrigen Blätter wurden gelesen |
| `spreadsheet reader stopped: …` | Interner Fehler beim Lesen der Tabelle, für die Person, die das Skript pflegt |
| `automatic reply` / `read receipt` / `delivery report` | Die Mail ist eine automatische Antwort (Abwesenheitsnotiz, „Automatische Antwort:", Kopf `Auto-Submitted: auto-replied`), eine Lesebestätigung („Gelesen:") oder eine Unzustellbarkeitsmeldung. Sie ist kein Avis und bekommt keine Kategorie, auch wenn „Zahlungsavis" im Betreff steht |
| `mailing list` | Newsletter oder Verteiler (Kopf `List-Unsubscribe`, `List-Id` oder `Precedence: bulk`). Nur ein Dokument mit Avis-Titel oder Bankformular zählt dann noch als Avis |
| `chat notification` | Die Mail ist die Benachrichtigung eines Chat- oder Aufgaben-Tools (jemand hat das Postfach erwähnt, in einem Kanal geschrieben, eine Direktnachricht oder Aufgabe geschickt). Sie gibt Gespräche von Kollegen wieder: keine Kategorie, auch wenn ein Avis-Wort darin steht (siehe Urteil `chat notification (…)`) |
| `… mail parts not read` | Teile der Mail wurden nicht gelesen (siehe `mail parts not read` oben) |

Die Tabelle ist alphabetisch nach dem englischen Grund sortiert. `no advice: …` vor einem Grund heißt: keine Kategorie.

| Urteil (`verdictWhy`, englisch) | Bedeutung |
| --- | --- |
| `'payment has been disputed' - not a payment advice?` | Eine Kreditkarten-Reklamation oder Rückbuchung (Chargeback): keine Kategorie |
| `'…' - not a payment advice` (z. B. `'Dies ist keine Zahlungsbestätigung'`) | Der Text sagt selbst, dass er kein Avis ist („Dies ist keine Zahlungsbestätigung", „This is not a remittance advice"), etwa ein Portal-Status „zur Zahlung freigegeben". Keine Kategorie |
| `'…' - the document says it is no advice` | Der Text sagt selbst, dass er kein Avis ist („This is not a remittance advice"): keine Kategorie |
| `account statement (columns …) - not a payment advice?` | Eine Tabelle mit Spalten wie „Paid out / Paid in / Balance" oder „Soll / Haben / Saldo" (Kontoauszug, Kontenblatt), ohne Zahlungserklärung des Absenders. Kein Avis. Schreibt der Absender dazu „wir haben … überwiesen", bleibt es ein Avis |
| `account statement (opening and closing balance) - not a payment advice?` | Kontoauszug ohne Spaltenkopf „Soll / Haben", aber mit Zeitraum sowie Anfangs- und Endsaldo („Beginning balance … Ending balance", „Alter … Neuer Kontostand"). Kein Avis. Schreibt der Absender „wir haben … überwiesen", bleibt es ein Avis |
| `advice document` | Ein Dokument mit dem Aufbau eines Avis, ohne eigenen Titel |
| `advice title 'PAID stamp'` | Unsere zurückgeschickte Rechnung mit einem Bezahlt-Stempel des Kunden („PAID", Datum, Scheck-, ACH- oder Belegnummer, „Amount paid"): ein Avis |
| `advice title '…'` | Das Dokument nennt sich selbst Avis („Zahlungsavis", „Remittance Advice", „Payment Notification", „Zahlungsanzeige", „Gutschriftsanzeige" der Bank). Stärkster Hinweis: „Avis" |
| `advice word '…', but no amount` / `…, but no amount found` | Ein Avis-Wort im Betreff, im Dateinamen oder im Text, oder ein Avis-Titel, eine Zahlungserklärung oder ein Zahlbetrag-Feld (z. B. `advice title '…', but no amount found`), aber kein lesbarer Betrag: „Avis prüfen". Ohne Datei und ohne Betrag gilt die Mail als nur erwähnt (`only mentioned, …`, keine Kategorie) |
| `advice word in the file name '…'` / `advice word '…' in the subject` / `advice word '…' in the mail text` (mit `, but no advice found`) | Ein Avis-Wort im Dateinamen („Zahlungsavis_4711.pdf"), im Betreff oder im Mailtext, aber kein erkanntes Avis. Das hebt „kein Avis" auf „Avis prüfen", nie auf „Avis". Nicht bei automatischen Antworten, Newslettern, Chat-Benachrichtigungen, Termineinladungen, eigenen Mails und Mails, die ein Avis nur erwähnen |
| `aged open items ('…') - not a payment advice?` | Offene-Posten-Liste nach Alter („Current │ 1-30 │ 31-60 │ 61-90 │ Over 90"): zeigt, was offen ist, nicht was bezahlt wurde. Keine Kategorie |
| `…, amount stated in the mail text (… shows …, rounding)` | Der Mailtext nennt die eigene Zahlung („our payment of EUR 5,976.23"), die Summe im angehängten Avis weicht nur um Rundungscent ab (höchstens 5 Cent), und das Avis rechnet den Betrag des Mailtexts selbst vor (z. B. „6,098.19 x 2% = 121.96"). Der Betrag aus dem Mailtext kommt in den Betreff: „Avis" mit „(prüfen)" |
| `amount without payment wording` | Ein Betrag, aber kein Wort wie Zahlung, überwiesen, bezahlt oder paid (z. B. Angebot, Bestellung, Preisliste): kein Avis |
| `automatic reply (…)` / `read receipt (…)` / `mailing list (…)` | Automatische Antwort, Lesebestätigung oder Newsletter: keine Kategorie. Ein angehängtes Avis-Dokument (Avis-Titel, Bankformular) in einer automatischen Antwort bleibt „Avis prüfen" (`…, but the mail is an automatic reply`) |
| `balance confirmation request ('…')` | Bitte um Saldenbestätigung oder Abgleich der offenen Posten („bestätigen Sie uns den Saldo", „confirm the balance") neben Wörtern wie Abstimmung, Stichtag oder Monatsabschluss. Kein Avis, keine Kategorie |
| `bank transfer confirmation? ('Auftragsbestätigung' …, with transfer fields)` | Eine Bank-„Auftragsbestätigung" mit Auftraggeber, Empfänger, IBAN und Betrag: wahrscheinlich eine Überweisung, „Avis prüfen" |
| `bank transfer form` / `bank credit advice` | Überweisungsbestätigung der Bank des Zahlers bzw. Gutschriftsanzeige einer Bank, mit Auftraggeber, Empfänger und Betrag: „Avis" |
| `…, beside a mail text about a payment not made (…)` | Eine Anlage ohne Betrag mit nur allgemeinen Zahlungswörtern (z. B. ein Lieferanten-Stammdatenformular) neben einem Mailtext, laut dem noch nicht gezahlt ist (in der Klammer der Grund des Mailtexts, z. B. `payment not made yet ('…')`), und nirgends ein Avis-Wort. Keine Kategorie |
| `…, beside a mail text about a withheld payment (…)` | Nicht lesbare Datei (z. B. ZIP) neben einem Mailtext, der sagt, dass die Zahlung zurückgehalten oder gesperrt ist, ohne erfolgte Zahlung, ohne Zahlungsnachweis und ohne Avis-Wort. Keine Kategorie |
| `…, but a short note without the invoice it pays` | Eine Kurznotiz ohne Rechnungsbezug („ist bezahlt, 5.949,58 €", „paid today - EUR 3,836.70"). Ein Avis ist sie nur als Antwort auf unsere Rechnungs- oder Mahnmail, deren zitierter Betrag passt (`…, the amount of the quoted mail`); sonst, und immer in einer Anlage, „Avis prüfen" |
| `…, but payment announced for later ('…')` | Ein Avis-Titel oder ein Bankformular nennt einen Zahltag mehr als 8 Tage nach dem Datum der Mail. Beispiele: `advice title 'REMITTANCE ADVICE', but payment announced for later ('Planned payment date 20/11/2026')` (Entwurf eines Avis) und `bank transfer form, but payment announced for later ('Ausführungsdatum 20.11.2026')` (Terminüberweisung). Es ist noch nichts bezahlt: „Avis prüfen“ ohne Betrag im Betreff |
| `…, but the amount is not positive` | Das Dokument sieht wie ein Avis aus, aber der gewählte Betrag ist 0,00 oder negativ (leeres Formular, Verrechnung auf null): „Avis prüfen" |
| `…, but the colleague who passes it on writes '…'` | Ein Kollege leitet ein Avis intern weiter und schreibt dazu, dass hier nichts zu buchen ist („nothing to book on your side", „bitte nicht buchen", „kein Handlungsbedarf"), etwa weil die Zahlung an eine Konzerngesellschaft ging. Zur Prüfung |
| `…, but the mail text speaks against an advice (…)` | Der Mailtext ist eine Reklamation, Mahnung, Bestellung, ein Zahlungsplan oder das Begleitschreiben einer Rechnung („anbei erhalten Sie unsere Rechnung"). Eine Anlage, die nur eine Zahlbetrag-Spalte oder -Zeile hat, gilt dann nicht als Avis („Avis prüfen") |
| `…, but the mail text withdraws a payment ('…')` | Der Mailtext zieht eine Zahlung oder ein Avis zurück („betrachten Sie unser Zahlungsavis als gegenstandslos", „Zahlung wurde von unserer Bank zurückgerufen", „please disregard our remittance advice") und nennt weder eine neue Zahlung noch ein beigefügtes Ersatz-Avis („anbei das korrigierte Avis"). Ein Avis in der Mail ist das zurückgezogene: „Avis prüfen" |
| `…, but the payee is another company ('…')` | Ein Bankformular oder eine Bankbestätigung (z. B. MT103) nennt als Empfänger eine andere Firma, und kein Empfängerfeld nennt die eigene. Wohl eine Zahlung an jemand anderen, irrtümlich als Nachweis geschickt: „Avis prüfen". Geprüft wird das nur, wenn der eigene Firmenname in der Mail oder im Dokument steht |
| `chat notification (…)` / `…, but the mail is a chat notification` | Die Mail ist die Benachrichtigung eines Chat- oder Aufgaben-Tools: Jemand hat das Postfach erwähnt, in einem Kanal geschrieben („Neue Nachricht in Finanzen › Zahlungsverkehr“, „New activity in Finance › ap-payments“, „… posted in Finance › ap-payments: …“), eine Direktnachricht oder Aufgabe geschickt (mit Schaltfläche „In … anzeigen“ oder Benachrichtigungs-Fußzeile), auch wenn das Tool die Mail mit List-Unsubscribe verschickt. Sie gibt Gespräche von Kollegen wieder: keine Kategorie, auch mit Avis-Wort. Liest sich eine Nachricht darin wie ein Avis mit Betrag (z. B. ein Kunde in einem geteilten Kanal): „Avis prüfen“, nie „Avis“ |
| `colleague's reply above a quoted payment advice (…)` | Ein Kollege (eigene Domain) antwortet einem Kunden und setzt das Postfach in Kopie; die zitierte Mail des Kunden an den Kollegen ist ein Zahlungsavis (in der Klammer dessen Grund). „Avis prüfen" mit dem Betrag des zitierten Avis (nicht im Betreff). Nicht, wenn der Kollege schreibt, dass die Zahlung eingegangen oder gebucht ist, oder wenn das zitierte Avis an das Postfach selbst ging |
| `column '…' with its total, but …` / `column '…', but …` | Tabelle mit Zahlbetrag-Spalte (mit oder ohne Summe), aber mit einem Zeichen für einen Plan statt einer Zahlung: `due-date column '…'` (Fälligkeitsspalte), `instalment rows` (Ratenzeilen) oder `name '…'` (Datei- oder Blattname wie Zahlungsplan, OP-Liste, Abstimmung). Kein sicheres Avis: „Avis prüfen" ohne Betrag. Das Zeichen kann auch hinter einem anderen Grund stehen (`…, but instalment rows`). Nennt der Mailtext einen Zahlungsplan oder eine noch nicht geleistete Zahlung, keine Kategorie (`…, in a mail about another topic (…)`). `due-date column '…'` gilt nicht, wenn jede Zeile dasselbe Buchungs- oder Zahlungsdatum trägt („Buchungsdatum", „Valuta", „Payment date") und es das Maildatum ist oder höchstens fünf Tage davor liegt. Dann ist die Liste ein Export gemachter Zahlungen |
| `copy of an own mail to … - our own payment, not a payment received (…)` / `own mail to …, forwarded internally - …` / `own mail to … with the mailbox in copy - …` | Die Mail ist eine Blindkopie einer eigenen Mail an einen Lieferanten, eine intern weitergeleitete eigene Mail oder eine eigene Mail an einen Externen, in der das Postfach nur in Cc steht (Absender in unserer Domain, alle An-Empfänger außerhalb, kein „WG:“/„FW:“). Ein Avis darin ist eine eigene Zahlung, kein Zahlungseingang: keine Kategorie. Nennt ein Dokument der Mail uns als Zahlungsempfänger oder Adressaten, gilt das nicht. Ebenso nicht, wenn die zuerst zitierte eigene Mail nur eine kurze Antwort an den Kunden ist („danke, ich gebe das an unsere Buchhaltung weiter“) und Betrag und Zahlungsaussage in der darunter zitierten Mail des Externen stehen („Von: … <…@kunde…>“, „Am … schrieb …:“): Das ist die weitergeleitete Zahlung des Kunden |
| `cover note of an invoice ('…')` | Der Mailtext ist das Begleitschreiben einer eigenen Rechnung oder Abrechnung des Absenders („anbei erhalten Sie unsere Rechnung", „your … invoice is attached") mit einem offenen oder schon eingezogenen Betrag („zahlbar bis …", „already deducted from your payouts"): kein Avis, keine Kategorie. Daneben gilt eine Anlage mit nur einer Zahlbetrag-Spalte oder -Zeile nicht als Avis (`…, but the mail text speaks against an advice (…)`). Gilt nicht, wenn der Mailtext daneben die eigene Zahlung des Absenders nennt („die Details zu unserer heutigen Zahlung sowie unsere Rechnung …", „our invoice … together with the breakdown of our payment of today"). Dann entscheidet die Zahlungsanlage |
| `credit note requested or announced ('…')` | Der Text bittet um eine Gutschrift oder kündigt eine an („bitte erstellen Sie uns eine Gutschrift"), und nichts spricht für ein Avis. Kein Avis |
| `forwarded payment confirmation ('…')` | Der Kunde leitet die Bestätigung seines Zahlungsdienstes oder seiner Bank weiter („Your transfer to … is complete", „Sie haben … an … gesendet"). Das ist sein Zahlungsnachweis: „Avis" |
| `further payment named in the mail text (…)` | Neben dem Avis nennt der Mailtext eine weitere, schon erfolgte Zahlung mit einem Betrag, der in keiner Anlage steht („Zusätzlich hat unsere Niederlassung heute CHF 3'810.78 überwiesen"): Kategorie „Avis“, beide Beträge mit ` + ` im Betreff |
| Hinweis zu `mailing list` | Avis-Mails von Zahlungsportalen kommen oft als Massenmail (Kopf `List-Unsubscribe`). Hat der Mailtext einen Avis-Titel, eine Zahlungserklärung oder ein Zahlbetrag-Feld mit Betrag, zählt er als Avis. Newsletter mit Beispiel-Avis, „What's new", Webinar bleiben ohne Kategorie |
| `…, in a mail about another topic (…)` | Eine Anlage mit Zahlungswörtern, aber ohne Avis-Merkmal und ohne Avis-Wort (z. B. eine Offene-Posten-Liste oder ein Ratenplan) in einer Mail, deren Text sagt, dass (noch) nicht gezahlt, zurückgehalten oder storniert wird, oder die ein anderes Thema hat (Abstimmung, Mahnung, Preis; in der Klammer der Grund des Mailtexts). Die Anlage gehört zu diesem Thema: keine Kategorie. Nicht, wenn der Mailtext die übrigen Rechnungen als heute bezahlt nennt oder die Anlage andere Rechnungsnummern enthält als der Mailtext |
| `… in a reply, a deduction or discount whose amount it does not state` | Eine Antwort auf unsere Rechnungs- oder Mahnmail sagt, dass bezahlt wurde, nennt keinen eigenen Betrag, aber einen Abzug, dessen Höhe offen bleibt: eine Gutschrift oder Verrechnung („abzüglich unserer Gutschrift GS-…“, „net of your credit note …“), mehrere Prozentsätze, Skonto ohne Satz, wenn die zitierte Mail keinen oder mehrere Skontosätze nennt, oder nur ein Skonto-Wort ohne Aussage, ob abgezogen wurde („innerhalb der Skontofrist“). Der Betrag der zitierten Mail ist dann nicht der Zahlbetrag: „Avis prüfen“ ohne Betrag |
| `… in a reply, amount of the quoted mail ('…')` | Eine Antwort (AW:/RE:) sagt, dass der Absender bezahlt hat, nennt aber selbst keinen Betrag („We sent the wire for this one today", „die haben wir heute bezahlt"). Die zitierte Mail darunter (z. B. unsere Mahnung oder Rechnungsmail) nennt genau einen Betrag: Das Skript nimmt ihn als Zahlbetrag. „Avis" mit „(prüfen)" |
| `… in a reply, amount of the quoted mail ('…') less N %` | Wie `… in a reply, amount of the quoted mail ('…')`, aber die Antwort nennt einen Abzug in Prozent („die Rechnung haben wir heute abzüglich 3 % Skonto überwiesen“, „we paid this today less the 2% prompt payment discount“) oder Skonto ohne Satz („mit Skontoabzug“, „taking the early payment discount“), und die zitierte Mail nennt genau einen Skontosatz („innerhalb von 10 Tagen mit 3 % Skonto“). Zahlbetrag = Betrag der zitierten Mail abzüglich dieses Prozentsatzes (Skonto auf den Cent gerundet): „Avis“ mit „(prüfen)“. „ohne Abzug“, „in full“, „kein Skonto“ oder „Skonto nicht abgezogen“ lassen den Betrag unverändert |
| `… in a reply, several amounts in the quoted mail` | Eine Antwort sagt, dass bezahlt wurde, nennt aber keinen Betrag, und die zitierte Mail nennt mehrere Beträge (z. B. eine Mahnung mit drei Rechnungen und Summe). Welche davon bezahlt wurden, ist offen: „Avis prüfen" |
| `… in a reply, the transfer details only in a picture` | Eine Antwort (AW:/RE:) meldet die Zahlung als erledigt, nennt aber keinen Betrag; Betrag und Details stehen nur in einem Bild (Screenshot aus dem Online-Banking, Foto), das das Skript nicht liest: „Avis prüfen". Betrag aus dem Bild übernehmen |
| `information letter ('…')` | Infoschreiben ohne Betrag: neue Adresse, neuer Firmenname, neue Ansprechpartnerin, Öffnungszeiten über die Feiertage, neue Bankverbindung. Keine Kategorie |
| `instalment N named as paid in the mail text, total of column '…'` | Der Mailtext nennt die bezahlte Rate ohne Betrag („haben wir heute die 3. Rate überwiesen"), die Anlage hat eine Spalte für diese Rate („3. Rate 30.10.2026"). Die Summe dieser Spalte ist die Zahlung, nicht der Rechnungsbetrag, frühere Raten oder der Restbetrag: „Avis" mit „(prüfen)" |
| `internal mail (sender and recipients in one domain), no payer's advice (…)` | Interne Mail: Absender und alle Empfänger (An, Cc) haben dieselbe Domain, und es ist keine Weiterleitung. Eine Zahlung, die die Kollegin oder der Kollege nennt, ist eine eigene Zahlung der Firma (z. B. eine Erstattung an einen Kunden) oder die weitergegebene Aussage eines Kunden, kein Avis eines Zahlers (in der Klammer der Grund, den der Mailtext sonst bekommen hätte). Keine Kategorie. Nicht, wenn eine Konzernfirma mit derselben Domain unsere Rechnung bezahlt („wir haben heute eure Rechnung … überwiesen“, „intercompany invoice“; eine Konzernumlage oder Weiterbelastung: `payment of a group company on the same mail domain (…)`); ein angehängtes Avis zählt weiter |
| `invoice disputed or complaint by the sender` / `return of goods` / `order` / `request for a quote` / `price change` / `change of payment terms` / `change of bank details` / `holiday notice` | Was der Text statt eines Avis ist: Reklamation, Rücksendung, Bestellung, Anfrage, Preisänderung, neue Zahlungsbedingungen („neue Zahlungsbedingungen ab …", „payment term changes"), neue Bankverbindung oder Betriebsferien. Kein Avis; neben einer Zahlungserklärung „Avis prüfen". Steht das Wort im Titel, folgt `('…' in the title)`. Ein Warnhinweis wie „Wir ändern unsere Bankverbindung niemals per E-Mail" ist keine neue Bankverbindung |
| `invoice features (…) beside payment label '…' - not a payment advice?` / `payment label '…', but invoice features (…)` | Ein Dokument ohne Avis-Titel endet mit „Zahlbetrag", hat aber Merkmale einer Rechnung, Quittung oder eines Leistungsnachweises (Positionstabelle, Umsatzsteuerzeile, „bezahlt mit girocard", Titel „Leistungsnachweis"). Zwei Merkmale: kein Avis; ein Merkmal: „Avis prüfen" |
| `invoices sent ('…')` | Der Absender schreibt, dass Rechnungen an den Leser oder an seinen Kunden „raus" sind („die beiden Rechnungen an Sie … sind heute raus", „the invoices to our customer … went out today"). Er hat Rechnungen verschickt, ist also Verkäufer: kein Zahlungseingang, keine Kategorie |
| `line of '…' in a payment register` | In einer Zahlungsliste mit mehreren Empfängern steht genau eine Zeile oder genau ein Block von Zeilen mit eigener Summenzeile mit dem eigenen Firmennamen, auch gekürzt („NORDWERK ANTRIEBST"). Den Firmennamen leitet das Skript aus der Empfängeradresse der Mail ab. Dieser Betrag ist die Zahlung, nicht die Summe des Zahllaufs: „Avis" mit „(prüfen)". Heißt die Datei wie ein Vorschlag oder Plan („Zahlungsvorschlag"), bleibt sie zur Prüfung |
| `mail of the group company … to … with the mailbox in copy - our own payment, not a payment received (…)` | Eine Konzerngesellschaft (Domain wie unsere mit einem Zusatz, z. B. nordwerk-group.example zu nordwerk.example) schreibt an einen Externen, unser Postfach steht nur in Cc: Die Inhouse-Bank oder die Zentrale zahlt für uns an einen Lieferanten. Eigene Zahlung: keine Kategorie |
| `mail text refers to an attachment, amount doubtful (…)` | Der Mailtext verweist auf eine Anlage („anbei unser Zahlungsavis", „Details siehe Anhang"), aber sein Betrag ist unsicher (nur nach Größe gewählt, z. B. eine Rechnungssumme oder eine Zahl aus der Signatur), und keine Anlage ist ein lesbares Avis (z. B. nur ein Foto): „Avis prüfen" ohne Betrag im Betreff. Anlage von Hand öffnen |
| `meeting invitation (…)` | Eine Termineinladung (Kalenderteil oder .ics-Datei; auch als Text weitergeleitet mit „Einladung:" und „Wann:"), deren Mailtext Zahlungswörter, aber kein Avis-Merkmal enthält: keine Kategorie, auch wenn die Einladung selbst ein Avis-Wort im Betreff oder in der Tagesordnung hat. Hängt nur eine .ics-Datei an einer normalen Mail, hebt ein Avis-Wort im Betreff sie weiter auf „Avis prüfen" |
| `N payments in table '…'` / `several payments in one document` / `several advices in the mail with different amounts` / `N advices with different amounts (…)` | Mehrere Zahlungen in einer Tabelle, einem Dokument oder einer Mail: Kategorie „Avis“, die einzelnen Beträge stehen mit ` + ` vor dem Originalbetreff |
| `N payments in the document (…)` | Ein Dokument (PDF, Datei oder Mailtext) enthält mehrere Zahlungen mit je eigener Summe: Überschriften wie „Payment 1 of 2" / „Zahlung 2 von 2" / „Auszahlung 1 / 2", in einer Sammel-Gutschriftsanzeige der Bank auch „Gutschrift 1 von 3" / „Credit 1 of 3", oder verschiedene Zahlbeleg-, Zahlungs-, Avis- oder Schecknummern. Auch eine Überweisung und ein Scheck oder zwei Teilüberweisungen mit eigenem Valutadatum, deren Summe darüber oder darunter steht, sind getrennte Zahlungen. In der Klammer stehen die Beträge; sie werden mit ` + ` vor den Originalbetreff gesetzt, Kategorie „Avis“ |
| `N payments in …, the mail text names separate payments` | Eine Tabelle mit mehreren Zahlungen und einem Zeitraum („Zeitraum 01.10.2026 – 31.10.2026") wäre sonst eine mögliche Zahlungshistorie. Der Mailtext sagt, dass die Zahlungen getrennt ausgeführt wurden: einzelne Beträge mit ` + ` im Betreff, Kategorie „Avis“ |
| `N payments named in the mail text (…)` | Der Mailtext sagt, dass mehrere getrennte Zahlungen gemacht wurden („Heute sind zwei Überweisungen an Sie rausgegangen"), und listet darunter genauso viele Beträge, je einen pro Zeile: einzelne Beträge mit ` + ` im Betreff, Kategorie „Avis“ |
| `no amount, no payment wording` | Weder ein Betrag noch ein Zahlungswort: kein Avis |
| `no document to check` | Die Mail hatte weder lesbaren Text noch Anlagen |
| `no input` / `script error` | Das Skript hat keinen Inhalt bekommen (`error`: `no PDF content passed`) oder ist an einem internen Fehler gescheitert (`exception: …`): „Avis prüfen". Bei `no input` das Feld pdfBase64 in Run_script prüfen (Schritt 5.4) |
| `only mentioned, no amount and no file (…)` | Die Mail erwähnt ein Avis oder eine Zahlung nur, hat aber weder einen Betrag noch eine Datei oder ein Foto. Beispiele: die Frage „kann ich euch das Avis per Mail schicken?", eine Ankündigung, ein Hinweis in einer Bestellung oder Signatur, ein Lieferavis, ein vergessener Anhang. Keine Kategorie. Ein Hinweis auf ein Avis im Kundenportal („Zahlungsavis im Lieferantenportal verfügbar") bleibt „Avis prüfen" |
| `own mail to … with the mailbox among its recipients - our own payment, not a payment received (…)` | Eigene Mail an einen Externen, in der das Postfach mit in „An“ steht, und der Absender aus unserer Domain nennt seine eigene Zahlung („we have today paid the following invoices“, „wir haben heute … bezahlt“). Eigene ausgehende Zahlung: keine Kategorie. Gilt nicht bei „WG:“/„FW:“, bei einer zitierten Mail im Text, bei einer Konzernverrechnung oder wenn ein Dokument uns als Zahlungsempfänger nennt |
| `own mail to … with the mailbox in copy - our own payment, not a payment received (…)` | Eigene Mail an einen Externen, in der das Postfach nur in Cc steht (Absender in unserer Domain, alle An-Empfänger außerhalb, kein „WG:“/„FW:“). Wird jetzt auch bei interner Zustellung ohne Umschlag-Empfänger erkannt: „X-MS-Exchange-Organization-AuthAs: Internal“ zeigt, dass der Absender zu unserer Organisation gehört. Ein Avis darin ist eine eigene Zahlung, kein Zahlungseingang: keine Kategorie. Nennt ein Dokument der Mail uns als Zahlungsempfänger oder Adressaten, gilt das nicht |
| `own mail to …, passed on internally as an attached mail - our own payment, not a payment received (…)` | Ein Kollege gibt unsere eigene Mail an einen Externen als angehängte Mail intern weiter („anbei unsere Mail an Hesselbach“): Absender der angehängten Mail in unserer Domain, Empfänger außerhalb. Eigene Zahlung: keine Kategorie. Gilt nicht, wenn eine angehängte Mail von außen kommt oder selbst eine Weiterleitung ist |
| `own payment named by a colleague (…) - not a payment received` | Interne Mail (keine Antwort, keine Weiterleitung), in der ein Kollege eine eigene Ausgabe der Firma nennt (Handkasse, bar, Firmenkarte, Kostenstelle, Quittung, z. B. „we have paid your invoice … with the company card"). Eigene Zahlung, kein Zahlungseingang: keine Kategorie. Steht ein Avis-Wort im Mailtext, wird die Mail trotzdem „Avis prüfen" |
| `own payment sent by a colleague ('…') - not a payment received (…)` | Interne Mail, in der ein Kollege unseren eigenen Zahllauf oder unsere Zahlung an einen Lieferanten als Datei schickt („anbei unser heutiger Zahllauf als Export“, „anbei unsere heutige Zahlung an …“, „please find attached today's payment run“). Die Liste ist eine eigene ausgehende Zahlung: keine Kategorie. Ein Dokument, das uns als Zahlungsempfänger nennt, zählt weiter |
| `own payment, the mail text names several payments (…)` | Der Mailtext sagt, dass mehrere getrennte Zahlungen gemacht wurden („zwei separate Überweisungen", „two separate payments"), und ein weiteres Dokument hat einen eigenen sicheren Betrag: beide Beträge mit ` + ` im Betreff, Kategorie „Avis“ |
| `payer statement ('…')` | Der Schreiber sagt selbst, dass er bezahlt hat („wir haben heute … überwiesen“, „we have paid …“, „Rechnung 4711 ist bezahlt“). Neu gilt das auch im Präsens („wir überweisen Ihnen … mit Valuta 02.11.2026“, „We are paying invoices … with value date November 2, 2026“, „we have today wired the second instalment of …“) und für den heutigen Zahllauf („ist im heutigen Zahllauf enthalten“, „is included in today's payment run“). Steht das nur im Mailtext, höchstens „Avis“ mit „(prüfen)“ |
| `payer statement …, but …` / `payer statement, but …` (z. B. `holiday notice`, `'…' - not a payment advice?`) | Eine Zahlungserklärung neben einem Hinweis wie Betriebsferien, neuer Bankverbindung, einer Reklamation oder einem Wort für einen anderen Dokumenttyp: „Avis prüfen", nie stillschweigend „kein Avis" |
| `…, payment amount in every row of column '…', equal to the sum of column '…'` | Eine Exportliste wiederholt den Zahlbetrag in jeder Rechnungszeile („Payment Amount"); die bezahlten Beträge der Rechnungen („Amount Paid") ergeben genau diesen Betrag. Er zählt einmal, nicht so oft wie Zeilen: „Avis" mit „(prüfen)" |
| `payment announced for later ('…')` | Der Schreiber kündigt eine Zahlung nur an: keine Kategorie. Das gilt für einen kommenden Zahllauf, „nächste Woche“ oder ein Datum mehr als etwa 5 Tage nach der Mail im Satz des Schreibers („werden wir am 20.11.2026 überweisen“, „wir überweisen die 2.450,00 EUR nächste Woche“, „we are wiring the GBP 2,450.00 next week“). Neu gilt es auch für einen Zahltag im Dokument, der mehr als 8 Tage nach der Mail liegt, auch neben einer Zahlbetrag-Tabelle, einem Zahlbetrag-Feld oder einer Zahlungserklärung: „mit unserem Zahllauf am 13.11.2026“, „Ausführungsdatum 20.11.2026“, „Planned payment date 20/11/2026“, „Expected payout date“, „Auszahlungsdatum“, „Run date“, „check run on 11/13/2026“ (US-Datum, wenn das Dokument das US-Format zeigt), eine Spalte „Valuta“/„Value date“ mit lauter späten Daten, „haben wir mit Valuta 13.11.2026 zur Zahlung angewiesen“. Nennt das Dokument daneben einen Zahltag bis 8 Tage nach der Mail (zwei Teilzahlungen mit eigener Wertstellung), bleibt es ein Avis. Eine Zahlung unter einer Bedingung ohne eigene Zahlungserklärung („wird nach Freigabe überwiesen“, „will be paid after approval/review“) bekommt ebenfalls keine Kategorie. „Avis prüfen“ bleibt es, wenn der Schreiber seine eigene Zahlung an eine Bedingung knüpft („überweisen wir, sobald die Mängel behoben sind“). „we will pay … as soon as we receive the corrected invoice“ steht jetzt unter diesem Grund statt unter `payment withheld`. Das Datum der Mail kommt aus dem Date-Header, auch mit deutschem Monatsnamen („Do, 29 Okt 2026“). Fehlt er oder liegt er mehr als 7 Tage neben der obersten Received-Zeile (z. B. „01 Jan 1970“), zählt der Tag der Received-Zeile |
| `payment batch with … payees, none named like the recipient` | Eine JSON- oder XML-Datei (z. B. camt.054, pain.001) enthält Zahlungen an mehrere Empfänger, und keiner heißt wie die eigene Firma. Welche Zahlung uns betrifft, ist unklar; die Summe über alle Empfänger ist nicht unser Betrag: „Avis prüfen" ohne Betrag im Betreff |
| `payment blocked ('…')` (Zahlungssperre) | Die Zahlung ist gesperrt („zur Zahlung gesperrt", „Zahlungssperre", „payment on hold", „unable to release payment"). Kein Avis |
| `payment history ('…', N payments) - no new payment` | Eine Tabelle mit mehreren Zahlungen, die als Zahlungshistorie oder Zeitraum-Liste betitelt ist („Payment history", „Zahlungsverlauf", „year to date"): frühere Zahlungen, keine neue. Ohne Avis-Wort keine Kategorie; steht nur ein Zeitraum oder eine YTD-Summe darin, „Avis prüfen" |
| `payment label '…'` / `payment table (payment / deduction columns)` / `payment column '…' with its total` | Ein Feld wie „Zahlbetrag", „Überweisungsbetrag", „Amount paid", eine Tabelle mit Zahlbetrag- und Abzugsspalten oder eine Zahlbetrag-Spalte mit passender Summenzeile trägt den Betrag |
| `payment line clearing N items of the account` | Ein Auszug aus dem Kreditorenkonto des Zahlers (z. B. SAP-Einzelposten FBL1N): Eine Zeile mit Zahlungswort oder Zahlungsbelegart („Payment 27.10.2026", „Zahlung", „KZ") gleicht die Rechnungen und Gutschriften daneben genau aus. Ihr Betrag ist die Zahlung, die Kontosumme (nur offene Posten) nicht: „Avis" |
| `payment list read in part (column '…'), total not computed` | Eine sehr lange Zahlungsliste wurde nur teilweise gelesen, die Summe fehlt: „Avis prüfen" |
| `payment named in the mail text, executed according to …` | Der Mailtext nennt die eigene Zahlung mit Betrag („Darin enthalten ist unsere Zahlung an Sie über …") und verweist auf eine Anlage, in der die Bank den Auftrag als ausgeführt bestätigt (z. B. Sammelauftrag). Der Betrag aus dem Mailtext ist das Avis: „Avis" mit „(prüfen)" |
| `payment not made yet ('…')` (auch ohne Zahlungsliste) | Der Schreiber sagt, dass er noch nicht gezahlt hat oder erst später zahlt („haben wir noch nicht beauftragt", „erst für nächste Woche beauftragt", „not yet paid", „no payment has been made"), legt die Zahlung in einen kommenden Zahllauf („im nächsten Zahllauf", „next payment run") oder hinter eine interne Freigabe („for internal approval") oder will nur unter einer Bedingung zahlen („möchte … überweisen", „nach Erhalt der Auftragsbestätigung überweisen", „wants to pay"), und nennt keine heutige oder erfolgte Zahlung. Kein Avis, keine Kategorie |
| `payment not made yet ('…')` / `payment not made yet, the advice follows ('…')` | Eine vorläufige Zahlungsliste („Zahlungsvorschlag", „subject to approval", „scheduled") oder die Ankündigung, dass das Avis erst nach der Zahlung kommt („remittance advice will follow once the payment has been released"): noch nichts bezahlt. Keine Kategorie |
| `payment note in the subject ('…')` | Die Mail hat keine Anlage und im Text keinen Betrag („siehe Betreff", „Danke!"), aber der Betreff ist eine Zahlungsnotiz mit Betrag („Überweisung 1.842,47 EUR - RE 2026-4379", „Paid INV-4711 - EUR 596.42"). Das Skript liest den Betreff dann wie eine Zeile des Mailtexts: „Avis" mit „(prüfen)". Betreffs mit „offen", „Erinnerung", „bitte", „?" und Ähnlichem zählen nicht als Zahlungsnotiz |
| `payment of a customer passed on by a colleague (…)` | Interne Mail, in der ein Kollege die Zahlung eines Kunden mit Betrag weitergibt, ohne zu fragen, ob sie angekommen ist („Herr … hat gerade angerufen: sie haben heute … überwiesen“, auch mit Gedankenstrich, Komma oder „und“: „hat eben angerufen – die Rechnungen wurden heute überwiesen“, „rief vorhin an und sagte …“, „Anruf von Herrn …“, „gebe ich es hiermit weiter“; „on the phone: we paid …“, „just rang – invoices … were paid“, „called to say …“, „got a call from …“, „asked me to pass it on“, „so I'm passing it on“): „Avis prüfen“ mit dem genannten Betrag (nicht im Betreff). Fragt der Kollege, ob das Geld da ist, oder geht es um unsere eigene Zahlung, die beim Anrufer nicht angekommen ist („unsere Zahlung … ist dort nicht angekommen“, „our payment … has not reached them“), bekommt die Mail keine Kategorie (`internal mail (…)`) |
| `payment of a group company on the same mail domain (…)` | Interne Mail (Absender und alle Empfänger in einer Domain), in der eine Konzernfirma eine Konzernbelastung bezahlt: Konzernumlage, Kostenumlage, Leistungsverrechnung, Weiterbelastung, „recharge“, „management fee“ oder „cost allocation“ und die Zahlung des Schreibers im selben Satz („die Konzernumlage … haben wir heute … überwiesen“, „we have today settled the Q3 … recharge …“, „… was paid by us“) oder „wir haben euch heute … überwiesen“. Ob das Geld an uns oder von uns geht, lässt sich bei Konzernfirmen mit gemeinsamer Domain nicht sicher sagen: „Avis prüfen“ mit dem genannten Betrag (nicht im Betreff). Steht die Umlage in einem anderen Satz als die Zahlung, bleibt es `internal mail (…)` |
| `payment on account received ('…') - invoice?` | Eine Abrechnung mit Mehrwertsteuer zieht eine Anzahlung oder Abschlagszahlung ab, die der Absender schon erhalten hat („abzgl. Abschlagszahlung vom … (erhalten)", „abzüglich erhaltene Anzahlung", „less advance payment received"; in der Klammer steht die Zeile). Der Absender ist der Zahlungsempfänger, die Schlussrechnung folgt: kein Avis, keine Kategorie |
| `payment plan ('…')` | Ein Ratenplan oder Zahlungsplan ohne erfolgte Zahlung („payment plan", „Ratenvereinbarung", „per month"). Kein Avis. Schreibt der Absender dazu „die 2. Rate haben wir heute überwiesen", ist es ein Avis |
| `payment register with N payees, no total for the recipient's block - which payment is ours?` | Zahlungsliste in Blöcken (Empfängerzeile mit IBAN, Rechnungen, Blocksumme wie „Zahlung 70412"); der Block der eigenen Firma hat keine Summenzeile: „Avis prüfen" ohne Betrag |
| `payment register with N payees, …` (`no line named like the recipient` / `N lines named like the recipient`) `- which payment is ours?` | Eine Zahlungsliste (Zahllauf, Ausführungsprotokoll) zahlt an mehrere Empfänger. Das Skript sucht die Zeile mit dem eigenen Firmennamen, den es aus der Empfängeradresse der Mail ableitet (z. B. `debitoren@nordwerk….de` → „Nordwerk"). Findet es keine oder mehrere solche Zeilen: „Avis prüfen" ohne Betrag, nie „Avis" mit der Listensumme |
| `payment reminder ('…')` | Eine Zahlungserinnerung oder Mahnung ohne Zahlung des Schreibers („We've sent the payment reminder"). Kein Avis |
| `payment requested from the reader ('…')` | Der Absender bittet Sie, ihm Geld zu zahlen („Bitte … auf mein Konto überweisen", „please pay the total amount"), und nennt keine eigene Zahlung, z. B. eine Reisekostenabrechnung. Keine Kategorie |
| `payment returned ('…')` | Die Zahlung ist zurückgekommen („sent back by the bank", „Rückläufer", „zurückgebucht"), und sonst nennt der Text keine Zahlung. Kein Avis |
| `…, payment to '…' in a batch` | Eine JSON- oder XML-Sammelzahlung (z. B. pain.001, camt.054) an mehrere Empfänger: Gezählt wird nur die Zahlung an die eigene Firma (in der Klammer der Empfängername), nicht die Stapelsumme: „Avis" |
| `payment to a third party ('…') - not a payment to the recipient?` | Das Schreiben nennt eine Zahlung an einen Dritten, nicht an uns („an den Geschädigten überwiesen“, „mit dem Anspruchsteller reguliert“, „Total paid to the third party“). Neu erkannt wird das auch ohne „an“ und mit Anzahl („Den beiden Geschädigten haben wir … überwiesen“, „an die zwei Geschädigten“, „paid both claimants“). Typisch: Der Haftpflichtversicherer teilt uns mit, dass er die Geschädigten entschädigt hat. Keine Kategorie. Nennt der Text uns als Empfänger („paid to you“, „auf Ihr Konto überwiesen“) oder steht unsere Firma im Feld Anspruchsteller, gilt der Grund nicht |
| `payment to a third party or for the reader ('…') - not a payment to the reader` / `… - not a payment to the reader?` / `…, but payment to a third party or for the reader ('…')` | Gezahlt wurde an Dritte (Anspruchsteller, Geschädigter, Warenempfänger, „an Ihren Kunden") oder für uns ausgelegt („on your behalf", Zoll, Fracht): an uns wurde nichts gezahlt, keine Kategorie. „Avis prüfen", wenn der Empfänger nur ein Firmenname ist (vielleicht wir unter anderem Namen, z. B. Factoring) oder eine Behörde (Finanzamt, Zoll), und mit `…, but …`, wenn daneben ein Avis-Titel oder Zahlbetrag-Feld steht. Prüfen, an wen gezahlt wurde. Eine einbehaltene Steuer, die der Zahler ans Finanzamt abführt, ist dagegen nur ein Abzug im Avis |
| `payment to a third party or for the reader ('…') - not a payment to the reader?` | Gezahlt wurde an einen Dritten, der nur als Firmenname genannt ist. Neu auch als direktes Objekt („we have today paid Thornbury Bottling Ltd the sum …“, am Satzanfang „Der Lindqvist Getränke GmbH haben wir … überwiesen“), wenn unser Name im Text steht und die Firma nicht wir sind: „Avis prüfen“ (es könnte unsere Firma unter anderem Namen sein). Prüfen, an wen gezahlt wurde |
| `payment to an authority for the recipient ('…'), billed to it - not a payment to the recipient` | Ein Zollagent oder Dienstleister hat Zoll, Einfuhrumsatzsteuer oder andere Abgaben für uns an die Behörde bezahlt und berechnet sie uns weiter („Der Betrag wird Ihnen … in Rechnung gestellt", „will be included in our … invoice"). Wir schulden das Geld: kein Avis |
| `payment to the addressee '…', the sender's own company - not a payment to the reader?` / `payment to the addressee of the forwarded notice '…', the sender itself - not a payment to the reader?` | Weitergeleitete Auszahlungs- oder Zahlungsmitteilung (Marktplatz, Zahlungsdienst), die an die Firma des Absenders gerichtet ist: Die Anrede („Hello …, we've sent your payout") oder die Zeile „An:/To:" der weitergeleiteten Mail nennt den Absender selbst. Das Geld ging an ihn, nicht an uns: keine Kategorie |
| `payment voided or cancelled ('…')` | Die Zahlung wurde storniert oder zurückgezogen („Payment voided", „will not be sent", „Zahlung storniert"), auch als Status- oder Stornofeld des Dokuments („Status: STORNIERT", „Payment status: Cancelled", „Stornogrund: …"). Kein Avis; mit Avis-Titel „Avis prüfen" |
| `payment withheld ('…')` | Der Kunde hält eine Zahlung ohne Betrag zurück („Payment of invoice … is on hold", „Zahlung ausgesetzt"), auch als Statusfeld („Status: On hold", „Zahlungsstatus: gesperrt"). Kein Avis; mit Avis-Titel „Avis prüfen" |
| `payment word '…' in the subject, but no advice found` | „Zahlung" oder „Überweisung" im Betreff, dazu ein Betrag im Mailtext oder ein Foto als Anlage, aber kein erkennbares Avis: „Avis prüfen" |
| `payment wording without an amount beside documents that are no advice` | Der Mailtext nennt eine Zahlung ohne Betrag, und alle Anlagen sind etwas anderes (Rechnung, Gutschrift): kein Avis |
| `payment wording, but no advice evidence, in a workbook of another type (…)` | Tabellenblatt mit Zahlungswörtern, aber ohne Avis-Merkmal, in einer Excel-Datei, deren anderes Blatt ein anderer Dokumenttyp ist (z. B. Offene-Posten- oder Mahnliste). Keine Kategorie |
| `payment wording, but no amount` | Ein Zahlungswort ohne lesbaren Betrag (z. B. neben einer Anlage, die sich nicht lesen ließ): „Avis prüfen". Ohne Datei und ohne Betrag gilt die Mail als nur erwähnt (keine Kategorie) |
| `payments in different currencies (…)` | Das Dokument nennt Zahlbeträge in zwei oder mehr Währungen ohne Umrechnungskurs oder Gegenwert (z. B. eine Summe in USD und eine in EUR, oder eine Währungsspalte mit EUR- und GBP-Zeilen). Jede Währung ist eine eigene Überweisung: Kategorie „Avis“, die einzelnen Beträge stehen mit ` + ` im Betreff. Währungskürzel bleiben im Betreff weg und sind unter `paymentAmounts` nachlesbar |
| `payout to the writer ('…'), its own payment announced - not a payment to the reader` | Ein Kunde leitet die Auszahlungsmitteilung seines eigenen Shops oder Marktplatzkontos weiter oder hängt sie an („Unsere Auszahlung …", „our payout …", „Sobald das Geld bei uns eingegangen ist …") und kündigt seine eigene Zahlung an uns erst an. Das Geld ging an den Kunden, nicht an uns: kein Avis |
| `price negotiation ('…')` | Preisverhandlung („Is there any further discount", „Preisnachlass"). Kein Avis |
| `question whether a reported payment came in ('…')` | Der Absender gibt nur wieder, was ein Dritter über eine Zahlung gesagt hat („hat mir gesagt, sie hätten überwiesen", „told me they had paid"), und fragt, ob das Geld eingegangen ist (z. B. eine Rückfrage aus dem Vertrieb). Kein Avis, keine Kategorie |
| `quoted mail below 'wrote' names a payment (reply without a reply prefix?)` | Eine Antwort ohne AW:/RE: im Betreff; erst im zitierten Teil unter „Am … schrieb" steht eine Zahlung mit Betrag: „Avis prüfen" |
| `read receipt in an attached mail (…)` / `automatic reply in an attached mail (…)` / `delivery report in an attached mail (…)` | Eine weitergeleitete Mail im Anhang ist selbst eine Lesebestätigung, Abwesenheitsnotiz oder Zustellmeldung (z. B. „Gelesen: Zahlungsavis - 889,01 EUR"). Ihr Text ist kein Avis |
| `receipt of the payee ('Received from') - not a payment advice?` | Eine Quittung des Zahlungsempfängers („RECEIPT", „Received from …"): Wir haben bezahlt, nicht der Kunde. Keine Kategorie |
| `receipt of the payee ('…') - not a payment advice?` | Eine Quittung oder Zahlungsbestätigung des Zahlungsempfängers, deren Kundenfeld unsere eigene Firma nennt („Payment Receipt" / „Customer: …", „Zahlungsbestätigung" / „Kunde: …"; in der Klammer steht das Feld, bei „RECEIPT" mit „Received from …" steht dort `Received from`). Ein Lieferant bestätigt den Eingang unserer eigenen Zahlung, kein Kunde hat gezahlt. Keine Kategorie |
| `receipts from several payers - not a payment advice?` | Liste von Zahlungseingängen mehrerer Zahler (mindestens drei Namen in der Spalte „Remitter"/„Auftraggeber" oder „DEBTOR:"), z. B. nicht zugeordnete Eingänge auf dem eigenen Konto. Kein Avis. Steht ein Auszahlungsbetrag darin („Total remitted"), gilt der Grund nicht |
| `refund of a supplier ('…') - not a customer payment?` | Ein Lieferant zahlt uns Geld zurück (Guthaben aus seiner Gutschrift, doppelte oder zu hohe Zahlung: „Refund of overpayment", „haben wir Ihnen … zurückgezahlt"). Es kommt Geld, aber keine Kundenzahlung: „Avis prüfen"; an die Kreditorenbuchhaltung geben. Nicht, wenn der Schreiber zugleich eine Rechnung von uns bezahlt oder die Erstattung nur erbittet, verrechnet oder verneint. Auch die Rückzahlung einer Anzahlung, Vorauszahlung oder Vorkasse durch einen Lieferanten, z. B. nach einer stornierten Bestellung. Geld kommt herein, ist aber keine Kundenzahlung: zur Prüfung |
| `refund request ('…') - not a payment advice` | Der Mailtext bittet um Rückzahlung oder Erstattung („please refund the duplicate amount", „bitte erstatten Sie uns …"). Das Geld soll an den Schreiber gehen: kein Avis. Nennt der Schreiber daneben eine heute erfolgte Zahlung, bleibt die Mail zur Prüfung (`…, but refund request ('…')`) |
| `refund requested after a duplicate payment ('…')` | Der Kunde hat eine Rechnung doppelt oder zu viel bezahlt und bittet um Erstattung oder Verrechnung („was paid twice … please refund", „doppelt überwiesen … bitte erstatten Sie"). Das ist eine Rückforderung, kein Avis. Keine Kategorie |
| `remittance slip to return with a payment ('…') - statement or invoice?` | Das Dokument hat einen Abschnitt, den man mit der Zahlung zurückschicken soll („detach and return this portion with your payment", „amount enclosed"). So enden Kontoauszüge und Rechnungen des Lieferanten; ein Avis des Zahlers ist das nicht. Keine Kategorie |
| `reply without an amount` | Eine Antwort (AW:/RE:) ohne eigenen Betrag und ohne eigene Zahlungserklärung: kein Avis |
| `sample ('…') - not a payment advice` | Das Dokument ist ein Muster mit Beispieldaten („Muster: neues Zahlungsavis (Beispieldaten)", „for illustration only", Wasserzeichen „M U S T E R"), z. B. ein Infoschreiben zum neuen Avis-Layout. Kein echtes Avis, auch wenn Sätze über Zahlungen darin stehen. Keine Kategorie |
| `scan without text, the mail text says what it is (…)` | Die Anlage ist ein Scan ohne Text, der Mailtext sagt, was sie ist (Lieferschein, Reklamation, Rechnung), und nirgends steht ein Avis- oder Zahlungswort. Keine Kategorie |
| `settlement of a claim against the recipient ('…') - not a payment to the recipient?` | Der Versicherer reguliert den Anspruch eines Dritten gegen uns („the claimant's claim against you“, „Ihres Haftpflichtschadens“). Neu reicht auch: Die Selbstbeteiligung wird uns gesondert berechnet oder mit dem nächsten Beitrag verrechnet („Die Selbstbeteiligung … verrechnen wir mit der nächsten Beitragsrechnung“, „The policy excess … will be collected with your next premium instalment“). Das Geld ging an den Anspruchsteller, nicht an uns: keine Kategorie |
| `tax refund ('…') - not a customer payment?` | Das Finanzamt oder eine andere Steuerbehörde erstattet Steuern (Erstattung, Guthaben, Überschuss aus der Steuererklärung, „VAT refund", auch über den Steuerberater gemeldet). Das gilt auch, wenn nur der Auftraggeber einer Gutschrift ein Finanzamt, eine Finanzkasse oder ein Zollamt ist (in der Klammer steht dann dessen Name). Es kommt Geld, aber keine Kundenzahlung: „Avis prüfen"; nicht auf ein Debitorenkonto buchen |
| `the advice went to the payee ('…') - not a payment to the recipient?` | Der Text sagt, das Avis sei an den Zahlungsempfänger gegangen („Das Zahlungsavis wurde an den Lieferanten versandt“, „A remittance advice has been sent to the supplier's remittance e-mail address“, „Das Avis ging direkt an deren Buchhaltung“). Zusätzlich nennt ein Feld uns als zahlende Firma („Firma:“, „Company:“, „Auftraggeber:“), oder der Schreiber nennt seine eigene Zahlung an diesen Empfänger. Das ist eine Mitteilung an die Zahlerseite (eigenes Kreditorenportal, eigene Treasury), kein Avis an uns: keine Kategorie. Gilt nicht, wenn der Text uns als Empfänger nennt („an Sie“, „to your account“) |
| `…, the amount of the quoted mail` / `…, the amount of the quoted mail less N %` | Eine Antwort auf unsere Rechnungs- oder Mahnmail nennt einen Betrag (auch als Kurznotiz „ist beglichen, 4.508,00 €"), der genau dem Rechnungsbetrag der zitierten Mail entspricht oder ihm abzüglich des in der Antwort genannten Prozentsatzes (Skonto). Damit ist der Betrag bestätigt: „Avis" mit „(prüfen)". Gebühren- und Zinszeilen der Mahnung und Beträge, die die Antwort ablehnt oder verschiebt, zählen nicht |
| `the bank's own credit ('…') - not a customer payment?` | Die eigene Bank schreibt Geld aus einem eigenen Produkt gut (Zinsen, Fest- oder Termingeld, erstattete Kontoführungsentgelte, „Refund of charges") ohne Auftraggeber eines Kunden, oder die Bank ist selbst der Auftraggeber, z. B. bei einer Rückvergütung von Entgelten nach einer Reklamation oder einer Kulanzgutschrift (in der Klammer steht dann der Name der Bank). Kein Kundenzahlungseingang: keine Kategorie |
| `the reader is the payer ('…') - not a payment advice?` | Der Absender ist der Verkäufer: Er dankt für Ihre Bestellung oder Ihren Einkauf („vielen Dank für Ihre Bestellung", „Thank you for your order") oder schreibt, ob Sie noch zahlen müssen („bitte nicht erneut überweisen"). Eine genannte Zahlung (z. B. Vorkasse) ist Ihre eigene. Gilt nicht, wenn das Dokument von Ihrer Firma stammt oder der Absender selbst eine Zahlung nennt („wir haben überwiesen"). Keine Kategorie |
| `the recipient is the buyer ('…') - not a payment to it?` | Rechnung oder Quittung, in der Ihre Firma als Käufer steht („Billed to: …", „Bill to", „Rechnungsempfänger"): Sie haben selbst bezahlt (z. B. per Karte). Keine Kategorie |
| `the recipient is the payer ('…') - not a payment to it?` | Im Formular steht die eigene Firma als Auftraggeber oder Zahler, also eine eigene ausgehende Zahlung (z. B. ein eigenes Avis in Kopie). Neu ist ein weiterer Fall: Ein Zahlungsdienst schreibt uns als Kontoinhaber („Hallo Nordwerk Antriebstechnik GmbH, Sie haben 2.340,00 EUR an Brenner Werkzeughandel gesendet“, „Hi …, You sent €2,340.00 to …“), und der Empfänger sind nicht wir: keine Kategorie. Sonst wie bisher: Steht ein anderer Empfänger daneben, keine Kategorie, sonst „Avis prüfen“ |
| `the recipient's own advice to '…' - not a payment to it?` | Das Dokument stammt von uns: unser Name steht im Briefkopf oder in der Absenderzeile über dem Anschriftfeld, im Anschriftfeld steht eine andere Firma, dazu ein Avis-Titel oder eine Zahlungsaussage („Zahlungsavis … überweisen wir“). Unser eigenes Avis an einen Lieferanten, z. B. von einem Zahlungsdienstleister mit uns in Cc verschickt: keine Kategorie (wegen ihres Begleittexts kann die Mail „Avis prüfen“ bekommen). Gilt nicht für eine eigene Rechnung mit Bezahlt-Stempel des Kunden |
| `…, total computed from the payment column` | Eine Zahlungsliste ohne Summenzeile: Das Skript hat die Zahlbetrag-Spalte addiert (`uncertain: total computed from …`), „Avis prüfen" mit Betrag und „?". Nennt der Mailtext genau diesen Betrag, „Avis" (`…, the mail text states the same amount`) |
| `transfer to the recipient confirmed ('…')` | Die Bank oder der Zahlungsdienst des Zahlers bestätigt eine Überweisung an uns als ausgeführt („Your payment has been executed", „Ihre Überweisung ist unterwegs", „Deine Zahlung an … war erfolgreich"), auch weitergeleitet oder in den Mailtext kopiert. Wir stehen als Empfänger darin, nie als Auftraggeber: „Avis"; nach einer Umrechnung zählt der Betrag, den wir erhalten. Nicht bei fehlgeschlagen, zurückgegeben, geplant, wartet auf Freigabe oder neben einer Bitte um Erstattung |

**Aus dem Flow selbst (nicht vom Skript)**

| Was du siehst | Bedeutung |
| --- | --- |
| Kategorie „Avis prüfen", im Ausführungsverlauf ist **Run script** rot | Das Skript ist auch nach 3 Wiederholungen gescheitert; die Meldung von Microsoft steht im Verlauf bei Run script. Mail von Hand bearbeiten |
| Kategorie „Avis prüfen", Run script mit **Zeitüberschreitung** | Run script hat länger als 120 Sekunden gebraucht (sehr große Mail). Mail von Hand bearbeiten |
| Keine Kategorie, Lauf endet bei **Keine Automatik** | Der Betreff enthielt einen der Texte aus Keine_Automatik (Abwesenheitsnotiz, Zustellmeldung) |

**Weitere Hinweise (Feld `warnings`)**

| Hinweis (englisch) | Bedeutung |
| --- | --- |
| leer | Alles normal |
| `from signed mail: …` | Der Betrag stammt aus dieser PDF in der signierten Mail (`from mail: …` bei einer weitergeleiteten Mail-Datei) |
| `… PDFs checked (…)` / `only … of … PDFs checked` | Die Mail enthielt mehrere PDFs, das Skript hat die genannten geprüft und die beste genommen. Hat eine PDF „Zahlungsavis" oder „Avis" als eigenes Wort im Namen (nicht „Lieferavis"), prüft es nur diese |
| `only the first 50 of … PDFs read` | Die Mail enthielt mehr als 50 PDFs. Das Skript hat nur die ersten 50 angesehen |
| `PDF arrived as text instead of Base64` | Power Automate hat die PDF als Text übergeben, sie ließ sich aber vollständig zurückwandeln. Der Betrag stimmt; trotzdem das Feld pdfBase64 in Run_script auf fx `base64(body('Export_email'))` umstellen (Schritt 5.4), sonst gehen bei anderen PDFs Teile verloren. Mit `(… characters lost)` gingen Zeichen verloren; dann steht im Grund `uncertain: PDF arrived as text instead of Base64 - parts may be damaged` oder `PDF arrived as text instead of Base64 - content damaged (…)` |
| `decrypted (permissions-only encryption)` | Die PDF war nur gegen Kopieren oder Drucken geschützt und wurde normal gelesen |
| `OCR text layer (… % of the text)` | Text aus Texterkennung. Solche Avise bekommen nie „Avis" ohne Prüfung |
| `incomplete: …` | PDF teilweise gelesen. Kommt bei „Avis" ebenfalls nicht vor |
| andere Texte (z. B. `page 2: …`) | Technische Details zum Lesen der PDF, für die Person, die das Skript pflegt |
| `no currency in … - … assumed from the mail` | Das Dokument nennt keine Währung; sie stammt aus dem Mailtext oder aus einem anderen Dokument der Mail mit demselben Betrag. Ein bloßes „$" wird zur Währung des Landes, die das Dokument nennt („All amounts in Australian dollars", ABN, „Pty Ltd" → AUD). Betrag mit „(prüfen)". Währung kurz prüfen |
| `…, currency … from body` | Das Dokument nennt keine Währung; sie stammt aus dem Mailtext, der denselben Betrag mit Währung nennt |
