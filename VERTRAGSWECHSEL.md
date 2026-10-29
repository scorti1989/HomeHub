# Vertragswechsel – Version 57

## Verwendung

1. Bisherigen Vertrag öffnen und „Vertragswechsel vorbereiten“ wählen. Bei Strom und Gas ist der Einstieg auch direkt an der Vertragskarte möglich.
2. Neuen Anbieter, monatliche Kosten und Vertragsbeginn erfassen. Wenn ein Ende bekannt ist, wird der Folgetag vorgeschlagen. Der bisherige Vertrag endet am Vortag des neuen Beginns.
3. Den Übergang nur bestätigen, wenn der Termin mit den Anbietern geklärt ist. Die App versendet keine Kündigung und übernimmt keinen Anbieterwechsel.
4. Bei einem verknüpften Energiezähler Arbeitspreis, monatlichen Grundpreis, Gasfaktor und optional den tatsächlich abgelesenen Wechselstand eintragen. Der monatliche Abschlag steht im normalen Kostenfeld.
5. Speichern. Der Altvertrag und der neue Eintrag werden gemeinsam gespeichert. Bisherige Ablesungen und Tarifdaten bleiben erhalten.

Die App übernimmt keine Vertragswerte aus PDFs automatisch. Es wurden keine persönlichen Vertragsdaten in dieser ZIP geändert.

## Energieauswertung

- Zuerst den bisherigen Vertrag in den Zählereinstellungen mit dem richtigen Zähler verknüpfen. Die Wechselmaske bietet dann die Tariffelder an.
- Ein Wechselzählerstand ist Schlusswert des alten und Startwert des neuen Verbrauchszeitraums.
- Fehlende Wechselstände als normale Ablesung mit dem Datum des neuen Vertragsbeginns ergänzen. Tatsächliche Ablesungen haben Vorrang vor einem in der Wechselmaske gespeicherten Stand.
- Unter „Vertragswechsel & Tarifhistorie“ am Zähler lassen sich die einzelnen Perioden aufklappen und ihre Verträge bearbeiten.
- Änderungen an Arbeitspreis, Grundpreis und Gasfaktor erfolgen danach pro Vertrag. Die bisherigen globalen Tariffelder am Zähler sind gesperrt; Stammdaten bleiben bearbeitbar.
- Ohne eine nachfolgende Ablesung gibt es noch keine Verbrauchsauswertung für den neuen Vertrag.
- Guthaben und Nachzahlungen bleiben Näherungen: Abschläge werden zeitanteilig gerechnet. Tatsächliche Zahlungstermine, bereits ausgezahlte Erstattungen, Boni und Schlussrechnungen werden damit nicht abgeglichen.

## Vertragskosten und Korrekturen

- Zukünftige Verträge sind als geplant markiert. Sie zählen vor dem Beginn nicht zur laufenden Belastung.
- Endet ein Vertrag vor heute, zählt er nicht weiter zu den laufenden Kosten. Ein bestätigtes Kündigungsende hat Vorrang vor dem ursprünglichen Vertragsende.
- Monatsauswertungen verteilen die laufenden Vertragskosten nach aktiven Tagen. Das ist eine Kostenverteilung, keine Liste tatsächlich gebuchter Zahlungen.
- Pro Altvertrag ist ein Folgevertrag möglich. Weitere Wechsel können an den Folgevertrag angehängt werden.
- Der letzte Wechsel einer Folge kann über „Wechsel zurücknehmen“ zurückgesetzt und mit korrigiertem Termin neu angelegt werden. Ablesungen bleiben dabei erhalten.
- Vertragsdaten, Verknüpfungen und Tarife werden mit dem normalen Backup gesichert.

## Installation und Prüfung

Vor dem Ersetzen der App-Dateien ein aktuelles Backup aus der laufenden App exportieren. Den Inhalt dieses Ordners vollständig auf dem bisherigen Hosting ersetzen und die App neu laden. App und Service Worker verwenden Version 57.

Geprüft: JavaScript-Syntax aller Dateien sowie App-Start und Formularabläufe in einer DOM-Testumgebung. Wechselbestätigung, Speichern, getrennte Tarife, gemeinsame Übergangsablesung, zukünftige Kosten, Tarifbearbeitung, gespeicherte Verknüpfungen, fehlende Ablesungen und Rücknahme wurden geprüft. Kein visueller Test in einem echten Browser, da die Browserinstallation in dieser Umgebung nicht verfügbar war.
