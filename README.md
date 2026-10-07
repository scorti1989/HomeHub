# HomeHub 56

Das bestehende Ei bleibt erhalten und wird zum Begleiter: entspannte Pflege, sichtbare HomeHub-Reaktionen, Persönlichkeit, mehrphasige Entdeckungen und zeitbasierte Abenteuer.

## Installation

1. In der laufenden App den Online-Abgleich prüfen. Ein zusätzlicher manueller Export bleibt optional.
2. Alle Dateien aus dem Hauptordner dieser ZIP gemeinsam auf dem bisherigen Hosting ersetzen: index.html, sämtliche JavaScript-/CSS-Dateien, manifest.json und Icons. Neue Fachdateien gehören zwingend dazu. Die Ordner legacy/, tests/, server/ und docs/ sowie Markdown-Dateien sind für den Betrieb nicht erforderlich und müssen nicht veröffentlicht werden.
3. Die App einmal online neu laden. Der Service Worker installiert Version 56. Wenn noch die alte Oberfläche erscheint, die App vollständig schließen und erneut online öffnen.
4. Die App verwendet die bisherigen Speicherschlüssel. Ein Import ist für die Aktualisierung bestehender lokaler Daten nicht notwendig. Bekannte Datenfehler werden bei noch passenden Originalwerten gezielt korrigiert. Der Stand davor lässt sich in den Einstellungen unter „Stand vor Datenkorrektur herunterladen“ sichern.
5. Das separat bereitgestellte korrigierte Backup ist der Datenstand vom 06.10.2026. Importiere es nur, wenn du genau diesen Stand wiederherstellen möchtest. Ein Import ersetzt den gesamten lokalen Datenstand und ist daher ungeeignet, um später erfasste Einträge zu erhalten.

Eine Veröffentlichung auf deinem Hosting wurde hier nicht durchgeführt. Für einen Rückwechsel zuerst den Stand vor dem Begleiter-Umbau sichern: alte Spielversionen berücksichtigen die neuen Ereignisse und Zeitregeln nicht. Die bisherigen Speicherschlüssel bleiben erhalten. Wiederkehrende Ablesungen sind eine neue optionale Einstellung und werden von alten Versionen nicht fortgeschrieben.

## Begleiter ab Version 44

Beim ersten Öffnen wird der vorhandene Spielstand automatisch übernommen. XP, Sterne, Besitz, Freischaltungen und bisherige Statistiken bleiben erhalten. Der gelieferten Stand mit 1.352 XP bleibt ein Watschelndes Ei; zur nächsten Form bei 1.600 XP fehlen 248 XP. Für diesen Stand sind Ball, Pflanze und Teppich sofort nutzbar.

Hunger und Sauberkeit sinken langsam bis zu weichen Untergrenzen. Energie erholt sich selbst. Pflege gibt keine XP und sperrt weder HomeHub-Aktionen noch Spielzeug, Raum oder Album. Das ganze Nest wird mit einem Aufräumen sauber. Abwesenheit kostet keine Entwicklungsstufe. Erst nach 28 Tagen ohne Kontakt kann sich das Ei ausruhen müssen; nach der Rückkehr erholt es sich binnen 24 Stunden oder durch eine freiwillige Aufmerksamkeit.

Die Momentzeile direkt unter dem Ei zeigt, was es erlebt. Im Kopfbereich gibt es nur noch einen kleinen Sicherungspunkt neben dem Logo. Grün bedeutet bestätigte Online-Sicherung, Gelb einen laufenden/ausstehenden Abgleich und Rot fehlende Absicherung mit Empfehlung zum manuellen Export. Die XP-Anzeige und der Fortschrittsbalken sind ausgeblendet; die Entwicklung läuft intern weiter. Ereignisse behalten ihren Fortschritt über Neustarts. Persönlichkeit entsteht ab jetzt aus Nutzung, Spiel, Ruhe und Erkundung. Abenteuer dauern etwa 3, 10 oder 22 Stunden und enden automatisch beim nächsten Öffnen oder während sichtbarer Nutzung. Funde, Besitz, Formen und besondere Momente erscheinen im Album. Online-Sicherungen erzeugen eine Reaktion nur nach einem neu angelegten und überprüften Sicherungspunkt; ein manueller Export ist dafür nicht erforderlich.

Unter Einstellungen lässt sich das Ei vor dem Umbau herunterladen. Diese Datei verbindet den gesicherten alten Ei-Zustand mit den übrigen aktuellen App-Daten; sie ist kein historischer Gesamtstand. Die vorhandene allgemeine Wiederherstellung sichert weiterhin komplette Datenstände. Details und Prüfungen: docs/BEGLEITER.md.

## Ausgabenerfassung in Version 56

Kompakte Ausgabenerfassung mit fester Fußzeile für Abbrechen und Speichern oberhalb der Tastatur. Konto, Betrag, Datum, Beschreibung und Kategorie stehen direkt bereit. Lebensbereich, Reise und Notiz liegen unter Weitere Angaben; beim Bearbeiten vorhandener Zusatzangaben öffnet sich der Bereich automatisch. Speichern über die Fertig-Taste der Tastatur ist möglich. Der Kontoauswahlzustand ist zugänglich beschriftet. Viewport, Formularspeicherung und Bearbeitung mit Zusatzangaben sind in der DOM-Simulation geprüft; ein echter Android-Tastaturtest steht weiterhin aus.

## Stoffdarstellung in Version 54

Das Geistergewand hat einen runden Kopf und durchgehenden breiten Stoffkörper statt einer Tropfenform. Es folgt Streckung, Stauchung und Drehung; die darunterliegende Schale wird beim Tragen nicht gezeichnet, damit sie nicht hervorblitzt. Bein- und Armöffnungen verwenden Stofffarben. Begrüßen und Album haben kleinere Symbole neben der Schrift und 44 Pixel hohe Buttons.

## Symbolalbum in Version 53

Das Album enthält nur bereits entdeckte Gegenstände, Formen und erlebte Momente als Symbolkacheln. Es gibt keine unbekannten Platzhalter, Gesamtzahlen oder Vollständigkeitsanzeigen. Leere Kategorien werden nicht angezeigt. Antippen zeigt die Bezeichnung bzw. Erinnerung. Ein einheitliches SVG-Symbolsystem ersetzt die Gegenstandsnamen im Raum-Menü; Preise, Reisedauern und wichtige Aktionen bleiben verständlich. Alle Symbole besitzen zugängliche Beschriftungen.

## Gegenstandsprüfung in Version 52

Alle 17 Raum- und Saisonobjekte, vier Kostüme in sechs Formen und fünf Spielzeuge geprüft. Osternest, Palme und Weihnachtsbaum stehen links neben dem Nest statt am Ei. Erinnerung, Mobile, Lichterketten, Girlanden und Adventskranz haben getrennte Plätze. Das Spinnennetz wird innerhalb der Szene gezeichnet. Hasenohren haben ein Haarband und erkennbare Innenohren; Strohhut und Weihnachtsmütze mehr Stoff-/Materialdetails. Saisonale Dekoration wird außerhalb ihrer Zeit als verstaut bezeichnet. Besitz bleibt erhalten.

Native Canvas-Ansichten zeigen Einzelobjekte, 24 Kostüm-/Formkombinationen sowie die vier vollständig eingerichteten Saisonräume. Die Regression prüft mehrere Animationszeitpunkte und unveränderte gespeicherte Daten. Ein realer Handytest bleibt ausstehend.

## Halloween-Darstellung in Version 51

Das Geisterkostüm ist ein vollständiges helles Stoffgewand mit Falten und gezacktem Saum. Die ursprünglichen Augen und Gliedmaßen bleiben erhalten; die Augenausschnitte zeigen keine gelben Schalenrisse mehr. Der größere geschnitzte Kürbis steht neben dem Teppich, hat deutlichere Rippen, Gesicht, Bodenschatten und ruhiges Kerzenlicht. Bei reduzierter Bewegung leuchtet er statisch. Besitz und Spielstand bleiben unverändert. Alle sechs Formen wurden mit der bestehenden Canvas-Zeichenlogik visuell geprüft.

## Schnellzugriffe in Version 50

Drei gleich große Symbolbuttons mit einheitlichen Abständen: Plus in Schieferblau für die bisherige Erfassung, grüne Checkliste für Einkäufe und ockerfarbener Einkaufswagen mit Plus für neue Artikel. Zugängliche Beschriftungen und die bisherigen Aktionen bleiben erhalten.

## Artikelerfassung in Version 49

Der kompakte Einkaufsdialog richtet sich nach dem sichtbaren Bereich oberhalb der Handytastatur. Nur die Felder scrollen, die Fußzeile mit Abbrechen und Hinzufügen bleibt erreichbar. Die Preisnotiz ist optional eingeklappt und öffnet sich bei übernommenen Preisen. Beim Bearbeiten heißt die Schaltfläche Speichern. Der Artikelname erhält den Fokus; die Fertig-Taste kann das Formular speichern. Viewport-Anpassung, Übernahme optionaler Preise, Hinzufügen und Bearbeiten wurden in der DOM-Integration geprüft. Ein echter Android-Tastaturtest steht noch aus.

## Kompakte Themenbereiche in Version 48

Die Form steht oben neben „Dein Begleiter“, Sterne am rechten Rand. Der Bereich unter der Szene ist kompakter. Raum ist grün, Abenteuer blau, freiwillige Pflege warm beige und Erinnerungen violett hinterlegt. Aktionsgegenstände haben einen eigenen Bodenplatz links und werden hinter dem Ei gezeichnet, damit Pflanze und Gesicht frei bleiben.

## Stromanzeige ab Version 47

Die Batterie im Raum und der numerische Energiewert im Pflegemenü sind ausgeblendet. Automatische Energieversorgung, Licht und bestehende Backup-Felder bleiben erhalten.

## Menü und Animationen in Version 46

Das Ei-Menü verwendet größere, gut lesbare Schrift, klare Gruppen für Spielzeug, Einrichtung und Kostüme sowie sichtbare Auswahlzustände. Geöffnete Bereiche und der Tastaturfokus bleiben beim Aktualisieren erhalten.

Begrüßen und Spielen laufen vollständig durch und werden nicht mehr von Fliegen oder anderen Leerlaufgesten unterbrochen. Spielzeuge werden zur Raummitte geführt; der Kreisel bleibt beim Ei und klingt ruhig aus. Schlaf und Ruhe passen zur Tageszeit und Gesundheit. Während eines Abenteuers zeigen die Menüs passende Zustände. Kostüme wurden in allen Formen geprüft; das Geisterkostüm verwendet die ursprünglichen Augen. Bei reduzierter Bewegung aktualisieren Aktionen die statische Darstellung sofort.

Die vorhandenen Spielstände und die kompakte Sicherungsanzeige bleiben erhalten. Die Pixelbilder wurden mit der echten Zeichenlogik geprüft; ein vollständiger Handy-Layouttest bleibt ausstehend.

## Darstellungsanpassungen in Version 45

Die zusätzlichen Statuszeilen im Kopfbereich wurden entfernt. Der Ei-Status bleibt beim Ei. Ein Tipp auf den Sicherungspunkt öffnet die Einstellungen; dort lässt sich auch eine manuelle Sicherung herunterladen.

Beim laufenden Ei ohne Arme wird der Ball am Fuß geführt und mit Bodenschatten, Rollbewegung und kurzen Sprüngen gezeichnet. Andere Spielzeuge haben passende Darstellungen ohne Arme. Die Ballbewegung mit Armen beschleunigt zum Boden und bremst auf dem Rückweg. Neuzeichnen setzt die Spielzeit nicht mehr zurück; Laufen, Fliegen und Blasen berücksichtigen die Bildrate. Beim Portal wird die alte Form nur während der Animation dargestellt, während die neue Generation bereits sicher gespeichert ist. Reduzierte Bewegung zeigt Abreise und Rückkehr direkt im passenden statischen Zustand.

## Rezeptimport in Version 43

Der URL-Import unterstützt verschachtelte Rezeptdaten (JSON-LD, Graphen, Referenzen und eingebettete JSON-Daten), strukturierte Zutatenmengen, gegliederte Zubereitung, Microdata, verbreitete Rezeptkarten sowie klar beschriftete Zutaten-/Zubereitungsabschnitte. Hauptrezepte mit passender Quelladresse werden bevorzugt; bei mehreren gefundenen Rezepten steht eine Auswahl in der Vorschau bereit.

Direkter Abruf, AllOrigins-JSON und dessen HTML-Endpunkt werden einzeln geprüft. Ein nicht lesbarer Abruf oder eine unvollständige Rezeptantwort verhindert die übrigen Versuche nicht. Gibt es nur Teile des Rezepts, werden sie mit Hinweisen auf fehlende Angaben angeboten. Eine reine Seitenüberschrift gilt nicht mehr als erfolgreicher Rezeptimport. Mengen bleiben unverändert. Eigene Formularfelder sind standardmäßig nicht zum Überschreiben ausgewählt.

Zeitlimits gelten einschließlich Antwortinhalt; Quelle wechseln, Dialog schließen oder Text einfügen bricht laufende Abrufe ab. Fehlermeldungen öffnen den Textimport als Ausweichweg. Dort sind auch Rezept-JSON und HTML möglich. Alle Seitendaten werden als Text gelesen; fremde Skripte laufen nicht in der App.

CorsProxy wurde entfernt: Laut aktueller Anbieter-Dokumentation erfordert jeder Abruf einen API-Schlüssel, den die bisherige App nicht konfiguriert hatte. Der verbliebene öffentliche Abrufdienst kann ebenfalls ausfallen. Der mitgelieferte eigene Import-Worker bietet dafür einen optionalen, selbst betreibbaren Weg; Einrichtung unter docs/REZEPTIMPORT.md. Er wurde hier nicht bereitgestellt oder mit echten Rezeptseiten getestet. Browserzugriff, Loginpflicht, Bot-Schutz und nur nach JavaScript-Ausführung erscheinende Rezeptdaten können einen automatischen Import weiterhin verhindern.

## Online-Sicherung und Einkauf in Version 42

Änderungen werden nach vier Sekunden automatisch übertragen. Der bestätigte Upload wird zurückgelesen und inhaltlich verglichen, bevor die Änderungsmarkierung gelöscht wird. Täglich entsteht ein zusätzlicher wiederherstellbarer Online-Sicherungspunkt, dessen Lesbarkeit geprüft wird. Der Status im Kopf zeigt auch fehlende Einrichtung, Offlinebetrieb oder Fehler. Export-Erinnerungen entfallen; manueller Export und manuelle Sicherungspunkte bleiben als Zusatz verfügbar.

Die Automatik läuft bei geöffneter App: beim Start, nach Änderungen, nach Rückkehr in die App, stündlich im Vordergrund und nach Wiederherstellung der Internetverbindung. Fehler werden bei bestehender Verbindung nach einer Minute erneut versucht. Bei geschlossener App gibt es keinen zuverlässigen Browser-Hintergrundauftrag. Für unabhängige tägliche Sicherungen muss der Server zusätzlich einen Zeitplan erhalten. Der vorhandene Worker-Code und dessen Zugänge waren nicht enthalten; serverseitige Aufbewahrung und Betrieb wurden nicht geprüft oder geändert. Die App löscht keine Online-Sicherungspunkte.

Voraussetzung ist der bestehende kompatible Online-Server mit /save, /load, /snapshot und /snapshots sowie gespeichertem Zugang. Er muss vollständige Daten, _savedAt beim Laden, savedAt nach dem Speichern und den bestätigten Namen beim Anlegen liefern. Ein veralteter Worker wird als Fehler angezeigt. Die allgemeine Erinnerung wurde durch einen tatsächlichen Sicherungsstatus ersetzt.

Die Einkaufsliste bietet Schnelleingabe, Vorschläge aus abgerechneten Einkäufen, gekauften Artikeln und dem Preisgedächtnis, Übernahme von Menge/Geschäft/Preis sowie Duplikatprüfung. Preise sind optionale Notizen für die gesamte eingetragene Menge. Fehlende Preise werden nicht angemahnt; eine Abrechnung braucht nur den Gesamtbetrag vom Kassenbon. Offene Artikel werden nach Geschäft gruppiert, gekaufte separat angezeigt. Abgerechnet werden ausschließlich abgehakte Artikel. Noch benötigte Artikel bleiben erhalten. Änderungen während eines offenen Abrechnungsdialogs werden erkannt; die Buchung schreibt Ausgaben, Liste und Preisgedächtnis gemeinsam mit Rollback bei einem Speicherfehler.

Weicht der Kassenbon vom erwarteten Gesamtpreis ab, bleiben bekannte Artikelpreise Schätzungen; die App berechnet daraus keine vermeintlich tatsächlichen Einzelpreise. Bis zu 100 zuletzt gekaufte unterschiedliche Artikel bleiben als Wiederkaufvorschläge gespeichert.

## Änderungen

- Fehlerkorrekturen aus Version 40: Urlaubsfilter, Zähler-ID/Typkollision, laufende Vertragssummen, Schnellerfassung, Rezeptimport und jährliche Buchungen.
- Die große index.html ist in Fachdateien aufgeteilt. Layout in app.css; Dateizuordnung und Ladefolge in docs/ARCHITEKTUR.md.
- Belegte Korrektur von zwei Ausgabenzuordnungen, zwei falschen Suppenzutatenlisten sowie Ergänzung fehlender Rezeptangaben. Quellen in docs/DATENKORREKTUREN.md.
- Startseite mit direkten Aktionen für Ausgabe, Ablesung und Vertrag. Die Einkaufsliste liegt hinter „Liste“ neben dem Plus; „Artikel +“ öffnet direkt die Artikelerfassung.
- Schnellerfassungsentwürfe bleiben beim Haushaltswechsel erhalten. Speichern zeigt eine Bestätigung und setzt den Fokus zurück auf den Betrag.
- Ausgeblendete Hauptansichten werden nicht mehr unnötig gerendert; wiederholtes Antippen des aktiven Navigationseintrags erhält die aktuelle Eingabe.
- Hauptbereichswechsel unterstützen Browser-Zurück; Navigation und Hinzufügen-Schaltfläche haben passende Zugänglichkeitsbeschriftungen.
- Hinzufügen im Zählerbereich öffnet die Ablesung, im Konzertbereich ein neues Konzert.
- Alle neuen erforderlichen Module gehören zum Offline-Cache. Unvollständige Updates werden nicht aktiviert.

## Tests und verbleibende Grenze

Bestanden sind Syntax, Original-/korrigiertes Backup, Fachlogik-Regressionen, vollständige App-Ausführung in jsdom sowie Service-Worker-Simulation. Details in docs/TESTBERICHT.md.

Ein echter Chromium-Klick-/Layouttest konnte nicht abgeschlossen werden: Die Browserausführung endet in dieser Umgebung mit SIGSEGV. Deshalb sind Pixel-/Layoutdarstellung, reale Browser-Zurückbedienung und die Installation auf einem physischen Handy nicht abschließend geprüft. Der Cloud-Test nutzt einen simulierten Server; es wurde kein echter Cloud-Zugang verwendet.

### Version 56
Begleitermenü und Album verwenden farbige Emojis für Gegenstände und Aktionen. Entwicklungsformen behalten ihre eigenen Ei-Symbole. Kompakte Kacheln zeigen weiterhin nur Entdecktes; Antippen im Album zeigt die Beschreibung.
