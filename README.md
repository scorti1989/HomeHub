# HomeHub 44

Das bestehende Ei bleibt erhalten und wird zum Begleiter: entspannte Pflege, sichtbare HomeHub-Reaktionen, Persönlichkeit, mehrphasige Entdeckungen und zeitbasierte Abenteuer.

## Installation

1. In der laufenden App den Online-Abgleich prüfen. Ein zusätzlicher manueller Export bleibt optional.
2. Alle Dateien aus dem Hauptordner dieser ZIP gemeinsam auf dem bisherigen Hosting ersetzen: index.html, sämtliche JavaScript-/CSS-Dateien, manifest.json und Icons. Neue Fachdateien gehören zwingend dazu. Die Ordner legacy/, tests/, server/ und docs/ sowie Markdown-Dateien sind für den Betrieb nicht erforderlich und müssen nicht veröffentlicht werden.
3. Die App einmal online neu laden. Der Service Worker installiert Version 44. Wenn noch die alte Oberfläche erscheint, die App vollständig schließen und erneut online öffnen.
4. Die App verwendet die bisherigen Speicherschlüssel. Ein Import ist für die Aktualisierung bestehender lokaler Daten nicht notwendig. Bekannte Datenfehler werden bei noch passenden Originalwerten gezielt korrigiert. Der Stand davor lässt sich in den Einstellungen unter „Stand vor Datenkorrektur herunterladen“ sichern.
5. Das separat bereitgestellte korrigierte Backup ist der Datenstand vom 06.10.2026. Importiere es nur, wenn du genau diesen Stand wiederherstellen möchtest. Ein Import ersetzt den gesamten lokalen Datenstand und ist daher ungeeignet, um später erfasste Einträge zu erhalten.

Eine Veröffentlichung auf deinem Hosting wurde hier nicht durchgeführt. Für einen Rückwechsel zuerst den Stand vor dem Begleiter-Umbau sichern: alte Spielversionen berücksichtigen die neuen Ereignisse und Zeitregeln nicht. Die bisherigen Speicherschlüssel bleiben erhalten. Wiederkehrende Ablesungen sind eine neue optionale Einstellung und werden von alten Versionen nicht fortgeschrieben.

## Begleiter in Version 44

Beim ersten Öffnen wird der vorhandene Spielstand automatisch übernommen. XP, Sterne, Besitz, Freischaltungen und bisherige Statistiken bleiben erhalten. Der gelieferten Stand mit 1.352 XP bleibt ein Watschelndes Ei; zur nächsten Form bei 1.600 XP fehlen 248 XP. Für diesen Stand sind Ball, Pflanze und Teppich sofort nutzbar.

Hunger und Sauberkeit sinken langsam bis zu weichen Untergrenzen. Energie erholt sich selbst. Pflege gibt keine XP und sperrt weder HomeHub-Aktionen noch Spielzeug, Raum oder Album. Das ganze Nest wird mit einem Aufräumen sauber. Abwesenheit kostet keine Entwicklungsstufe. Erst nach 28 Tagen ohne Kontakt kann sich das Ei ausruhen müssen; nach der Rückkehr erholt es sich binnen 24 Stunden oder durch eine freiwillige Aufmerksamkeit.

Die Momentzeile und ein dezenter Hinweis im Kopfbereich zeigen, was es erlebt. Ereignisse behalten ihren Fortschritt über Neustarts. Persönlichkeit entsteht ab jetzt aus Nutzung, Spiel, Ruhe und Erkundung. Abenteuer dauern etwa 3, 10 oder 22 Stunden und enden automatisch beim nächsten Öffnen oder während sichtbarer Nutzung. Funde, Besitz, Formen und besondere Momente erscheinen im Album. Online-Sicherungen erzeugen eine Reaktion nur nach einem neu angelegten und überprüften Sicherungspunkt; ein manueller Export ist dafür nicht erforderlich.

Unter Einstellungen lässt sich das Ei vor dem Umbau herunterladen. Diese Datei verbindet den gesicherten alten Ei-Zustand mit den übrigen aktuellen App-Daten; sie ist kein historischer Gesamtstand. Die vorhandene allgemeine Wiederherstellung sichert weiterhin komplette Datenstände. Details und Prüfungen: docs/BEGLEITER.md.

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
