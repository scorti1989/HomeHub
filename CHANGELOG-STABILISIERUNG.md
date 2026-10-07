## Version 47 – Stromanzeige entfernt

- Batterie im Raum und Energiewert im Ei-Menü entfernt.
- Automatische Versorgung, Lichtdarstellung und Spielstände bleiben erhalten.

## Version 46 – Ei-Menü und Animationsübergänge

- Lesbare Menüschrift, klare Raumgruppen, ausgewählte Kostüme und stabile geöffnete Bereiche samt Fokus.
- Vollständige Begrüßungs- und Spielgesten ohne konkurrierendes Fliegen; Tageszeit und Gesundheit beeinflussen Ruhe.
- Spielzeug zur Raummitte, begrenzte Kreiselbewegung und Geisterkostüm mit ursprünglichen Augen.
- Passende Aktionen und Texte während Expeditionen; frühe Formen reagieren auf gezeigtes Spielzeug.
- Statische Darstellung reagiert sofort bei reduzierter Bewegung; Bewegungseinstellungen räumen laufende Effekte auf.
- Unveränderte Szenen bleiben bei Datenübernahme stabil, andere werden sauber zentriert.
- Wöchentliche Sicherungsbelohnung berücksichtigt auch ältere Datumswerte im importierten Stand.
- Alle sechs Formen, Spielzeuge und Kostüme mit echter Canvas-Zeichenlogik visuell geprüft; Funktions- und DOM-Prüfungen ergänzt.

## Version 45 – Kompakter Kopfbereich und korrigierte Spielanimationen

- Große Sicherungs-/Begleiterzeilen im Header entfernt; Sicherungsstatus als kleiner Punkt neben dem Logo.
- Grün für bestätigte Sicherung, Gelb für den Abgleich, Rot für fehlende Absicherung mit manuellem Export in den Einstellungen.
- Ei-Status bleibt beim Ei; XP-Zahl und Fortschrittsbalken ausgeblendet, interner Fortschritt unverändert.
- Ball ohne Arme am Fuß mit Rollen, Sprung und Bodenschatten; passende Darstellungen für weitere Spielzeuge.
- Dribbelbogen, Blickrichtung, Animationszeit beim Neuzeichnen und Bildratenabhängigkeit korrigiert.
- Portal zeigt die vorherige Form während der bereits sicher gespeicherten Generationenübergabe; Reduced Motion berücksichtigt Abenteuer.
- Echte Canvas-Frames gerendert und visuell geprüft; ergänzte Geometrie- und DOM-Regressionen bestanden.

## Version 44 – Persönlicher Begleiter

- Vorhandene Pixel-Identität und sechs Entwicklungsstufen erhalten; neue XP-Schwellen und sichere automatische Migration.
- Pflege entschärft, Sperren und Pflege-XP entfernt, einmaliges Aufräumen und keine Rückentwicklung durch Abwesenheit.
- Persönlichkeit, gespeicherte Raumgeschichten, subtile HomeHub-Reaktionen und erweiterte Albumkategorien.
- Nutzbare Starterwelt, autonomes Spiel, zeitbasierte Abenteuer mit fixiertem Ergebnis und direktem Gegenstandsbesitz.
- Online-Sicherungsreaktion erst nach bestätigtem Sicherungspunkt; Kochabschluss eingebunden.
- Transaktionaler Generationenwechsel, gemeinsame Zeitrechnung, begrenzter Zustand, Reduced Motion auch im Canvas.
- Upload-/Prüfstände eingefroren; neue Regressionen mit dem Originalbackup. Näheres unter docs/BEGLEITER.md.

# Historischer Änderungsbericht für Version 40

Die aktuelle Version 43 wird in README.md und docs/ beschrieben. Dieser Bericht dokumentiert den vorherigen Durchlauf.

# HomeHub 40 – Stabilisierungsdurchlauf

## Installation

Alle aktiven Dateien aus diesem Ordner gemeinsam auf dem bisherigen Webhosting ersetzen. Neue Dateien `contracts-costs.js`, `app-stability.js` und `modal-ui.js` müssen mit hochgeladen werden. `legacy/` und `tests/` sind für den Betrieb nicht erforderlich. Danach die App online neu laden, damit der Service Worker Version 40 installiert. Die App wurde hier nicht auf deinem Hosting veröffentlicht.

Dein Backup vom 06.10.2026 ist unverändert und wird weiterhin akzeptiert. Bestehender LocalStorage wird mit derselben Schlüsselstruktur verwendet. Vor dem Austausch einen aktuellen Export erstellen.

## Änderungen

- Urlaubsfilter behält seinen gespeicherten Zustand.
- Zählerbearbeitung verwendet die ID, erhält Ablesungen und verhindert doppelte Typen sowie das Überschreiben eines anderen Zählers.
- Rendering sortiert Kopien der Ablesungen.
- Optionales Ableseintervall: monatlich, vierteljährlich oder jährlich. Neue Ablesungen schreiben den Termin fort. Bestehende Zähler bleiben ohne ausdrückliche Auswahl manuell; alte überfällige Termine werden nicht eigenmächtig umgestellt.
- Schnellerfassung schlägt anhand gleicher früherer Beschreibungen die häufigste Kategorie vor, nutzt dann Schlüsselwörter und ansonsten Sonstiges. Manuelle Kategorieauswahl bleibt bestehen. Neue Einträge enthalten Analysegruppe, Reiseverweis und Notiz; Beträge müssen positiv sein.
- Aktuelle Vertragssummen und Kostensortierung verwenden aktuelle Kosten. Der Durchschnitt im ersten Vertragsjahr bleibt separat gekennzeichnet. Die historische Monatsfunktion berücksichtigt den betrachteten Monat und das Vertragsende.
- Jährliche Wiederholungen buchen erst am Jahrestag. Der 29. Februar wird in Nichtschaltjahren auf den 28. Februar begrenzt. Zukünftige Startdaten werden respektiert.
- Rezeptimporte werden an Quelle und Dialogsitzung gebunden. Verspätete Antworten, alte Vorschauen und Quellenwechsel können keine neue Sitzung überschreiben. Zutaten und gefundene Portionen müssen gemeinsam übernommen werden.
- Gleiche Zutaten bei unterschiedlichen Rezepttiteln sowie fehlende Schritte erzeugen beim Bearbeiten einen Prüfhinweis.
- Normaler Export, Erinnerungs-Export und Cloud-Sync nutzen das zentrale Backup-Schema. Notfallexport verwendet die zentrale Schlüsselliste, sofern geladen; ein unabhängiger Fallback bleibt für Startfehler erhalten.
- Konzertdatum hat einen eigenen Funktionsnamen und überschreibt die allgemeine Datumsformatierung nicht mehr.
- Dialoge erhalten Tastaturfokus, Tab-Begrenzung, Escape-Schließen und Fokusrückkehr. Dynamische Kassen- und Konzertdialoge sind angebunden.
- Kostenlogik, neue Fachhelfer und Dialoglogik sind in separate Dateien ausgelagert. Ungenutzte ältere Module liegen in legacy/. Der restliche große App-Code bleibt für einen späteren schrittweisen Umbau erhalten.
- Service Worker und Asset-Versionen auf 40 aktualisiert; neue erforderliche Module gehören zur Offline-App-Shell.

## Daten, die noch manuell geprüft werden müssen

Die verdächtigen Zutaten von Maronensuppe und Kartoffelsuppe sowie vorhandene Fehlkategorisierungen (z. B. Eurojackpot und Switch Spiele) wurden nicht automatisch verändert. Die tatsächlichen Rezeptzutaten bzw. gewünschte Kategorie müssen anhand der Quelle/Originalbuchung geprüft werden. Bestehende Unterschiede zwischen Kategorie und Analysegruppe werden nicht pauschal überschrieben, da manuelle Analysezuordnungen beabsichtigt sein können.

## Validierung

Bestanden: JavaScript-Syntax aller aktiven Dateien und Inline-Skripte; Importprüfung des Originalbackups (36 Verträge, 2 Zähler, 239 Ausgaben, 6 Rezepte, 16 Konzerte); Kategorieauswahl; aktueller versus rabattierter Vertragsbetrag; Schalttag; wiederkehrende Ablesetermine; unveränderte manuelle Termine; tatsächlicher Zähler-Speichercallback mit Typkollision und erfolgreichem Typwechsel; tatsächliche Jahresbuchung vor/am Jahrestag und Schutz vor Duplikaten.

Testaufruf: `node tests/regression.cjs /pfad/homehub-backup-2026-10-06.json`

Der zusätzliche Browser-Smoke-Test konnte nicht ausgeführt werden: Playwright ist vorhanden, aber das Browserprogramm fehlt; der Browserdownload liefert keine gültige ZIP-Datei. Tastaturbedienung, PWA-Update/Offlinebetrieb, vollständige Rezept-UI und Cloud-Sync sind deshalb nicht abschließend in einem echten Browser geprüft. Eine vorbereitete Playwright-Testdatei liegt unter tests/browser-smoke.cjs.
