# Lokale Office-Scripts-Umwandlungsprüfung

`osemu.cjs` stammt aus `Gerinst/2testordner`, Commit
`b9ada7d60cdb2ce76dfc06a90834cecce23ab422`, Datei `test/tools/osemu.js`.
Nur lokale Standardpfade und die Ausgabe des vollständigen Resultats wurden
angepasst. Der Compiler ist für diese Prüfung auf **TypeScript 5.9.3** festgelegt.

Ausführen: `npm ci`, dann `npm run test:office`.

Die Prüfung erzeugt 15 kleine künstliche Dateien, berechnet die synchronen
Resultate des aktuellen Parsers und vergleicht sie vollständig mit vier
Umwandlungsmodellen: M2/paren, M2/es5, M5/paren und M1/await. Zusätzlich muss der
Emulator den früheren Aufruf einer Hilfsfunktion im Lexer-Konstruktor als Fehler
erkennen. Die Prüfung ersetzt weder fachliche Sollwerttests noch einen echten
Office-Script-Lauf in Microsoft 365. Temporäre Resultate verbleiben zur Diagnose
im am Ende ausgegebenen Arbeitsordner.
