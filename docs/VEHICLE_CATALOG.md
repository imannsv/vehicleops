# Fahrzeugauswahl und Ausstattung

Die Web-App verwendet einen lokalen Snapshot der öffentlichen [mobile.de-Referenzdaten](https://services.mobile.de/refdata/sites/GERMANY/classes/Car/makes) für die Klasse `Car` (PKW). Stand und Quellen sind in `src/data/vehicle-catalog.json` gespeichert. Der Snapshot enthält 182 Hersteller und 2.664 Modelle. Es werden keine Inserate, Kundendaten oder Fahrzeugfotos von mobile.de übernommen.

Hersteller und Modelle sind durchsuchbare Auswahllisten; 135 Hersteller zeigen lokal gespeicherte Markenlogos. Für die übrigen Marken erscheint ein Kürzel. Nicht gelistete Hersteller, Modelle und bestehende Modellbezeichnungen lassen sich weiterhin als Freitext nutzen. Ein Herstellerwechsel leert das Modell. Ausführung/Variante ist ein separates Feld.

Die Ausstattung verwendet 110 mobile.de-Merkmalscodes aus [Car/features](https://services.mobile.de/refdata/classes/Car/features), ergänzt um 26 Auswahlwerte für Klima, Tempomat, Einparkhilfe, Licht, Polsterung, Anhängerkupplung und Allrad. Diese zusätzlichen Werte verwenden eigene stabile Codes; die Grundlage sind die [öffentlichen Filter](https://www.mobile.de/s/auto) und die [Schnittstellenbeschreibung](https://services.mobile.de/manual/upload-interface-csv_de.html). Auswahl, Ausführung und Freitext werden in Supabase bzw. der lokalen Demo gespeichert. Die Datenbank akzeptiert nur gültige Codes und verhindert doppelte Einträge. Neue Protokolle speichern die Ausstattung im unveränderlichen Snapshot und geben sie im PDF aus. Alte Protokolle werden nicht nachträglich mit aktuellen Fahrzeugdaten angereichert.

## Kennzeichen

Deutsche Kennzeichen werden im Kennzeichendesign mit EU-Streifen über Ortskürzel, Buchstaben und Zahlen erfasst. E-/H-Zusätze bleiben erhalten. Unter dem Schild erscheint die zum Kürzel gehörende Stadt oder Region. Mehrdeutige Kürzel zeigen mehrere Bezirke; nicht gelistete Kürzel bleiben manuell verwendbar. Die Anzeige beschreibt den Zulassungsbezirk, nicht den aktuellen Standort des Fahrzeugs.

Die lokale Zuordnung enthält 766 Kürzel aus dem [Kennzeichenverzeichnis in der Broschüre des Bundesverkehrsministeriums](https://www.bmv.de/blaetterkatalog/catalogs/122810/pdf/complete.pdf), abgerufen am 2. Oktober 2026. Die Broschüre enthält auch ältere Kennzeichen; daraus wird keine Aussage über die heutige Neuvergabe abgeleitet. Für Sonderkennzeichen und ausländische Fahrzeuge gibt es „Andere Kennzeichen“. Bestehende Angaben werden beim Bearbeiten erhalten. In der Datenbank bleibt das Kennzeichen ein vollständiger Textwert, sodass Fotos, Fahrzeugakte, Aufträge und PDFs dieselbe Angabe verwenden.

## VIN-Abfrage

„VIN prüfen“ sendet die eingegebene VIN erst auf Knopfdruck an den [NHTSA-vPIC-Dienst](https://vpic.nhtsa.dot.gov/api/Home/Index). Der Dienst ist auf Fahrzeuge für den US-Markt ausgerichtet; europäische Fahrzeuge werden nicht zuverlässig vollständig erkannt ([FAQ](https://vpic.nhtsa.dot.gov/api/Home/Index/FAQ)). Hersteller- und Modellvorschläge müssen ausdrücklich übernommen werden. Erkennungsfehler liefern allenfalls einen Herstellerhinweis. Ausstattung wird nie aus einer VIN-Abfrage behauptet. Bei Fehlern oder Zeitüberschreitung bleibt manuelle Erfassung möglich.

In Cloud-Konfiguration überprüft `/api/vin` die Anmeldung und Admin-/Dispositionsrolle im ausgewählten Arbeitsbereich. Es nutzt ausschließlich den öffentlichen Supabase-Schlüssel, keine privilegierten Schlüssel. Antworten werden nicht gecacht; Abfragen sind zeitlich begrenzt.

## Katalog aktualisieren

`node scripts/update-vehicle-catalog.mjs` lädt öffentliche Hersteller-, Modell- und Merkmalsdaten und passende Logos als lokale WebP-Dateien. Es veröffentlicht den JSON-Snapshot erst nach erfolgreichem vollständigem Abruf. Die App selbst benötigt keinen Live-Zugriff auf mobile.de. Änderungen an Merkmalscodes müssen über eine neue Datenbankmigration mit der erlaubten Ausstattungsliste abgeglichen werden; bereits verwendete Codes nicht entfernen. Ein Katalog-Update ersetzt keine gespeicherten Fahrzeugangaben.

Logos: [car-logos-dataset von filippofilip95](https://github.com/filippofilip95/car-logos-dataset), nach dessen Paketmetadaten MIT; Originalquellen je Marke im Snapshot unter `logoSource`. Logos dienen der Identifikation der jeweiligen Marke.

## Baureihe / Generation

Eigenes optionales Feld, getrennt von Modell und Ausführung. Ein kleiner gepflegter Katalog in `src/data/vehicle-generations.json` enthält zunächst die geprüften Audi-A3-Codes 8P, 8V und 8Y sowie gelieferte Untervarianten. Quellen und Abrufdatum 2. Oktober 2026 stehen im Snapshot. Die historischen Stichtage sind Beispiele für den Katalog, keine behaupteten vollständigen Produktionszeiträume.

„Baureihen zur Erstzulassung laden“ fragt die öffentliche mobile.de-Referenzschnittstelle nach Hersteller, Modell und Erstzulassungsmonat ab, zum Beispiel [Audi A3, Mai 2013](https://services.mobile.de/refdata/sites/GERMANY/classes/Car/makes/AUDI/models/A3/modelranges?firstregistration=201305). Mehrere Treffer werden angezeigt und ausdrücklich ausgewählt; Whitespace und doppelte Codes werden bereinigt. Quellenabfrage mit Timeout, ohne Kennzeichen, VIN oder Halterdaten. Cloud-Zugriff ist auf Admin/Disposition des Arbeitsbereichs begrenzt. Bei fehlendem Datum, Freitextmodellen, Dienstausfall oder fehlenden Treffern bleibt freie Eingabe möglich. Die Fahrzeugdaten werden nie automatisch geändert. Keine vollständige historische Abdeckung, VIN-Baureihenerkennung oder Inseratanbindung wird behauptet.

Zulassungskennzeichen dürfen inzwischen leer bleiben und werden als `null` gespeichert. Transportkennzeichen stehen separat im Auftrag bzw. Protokoll und verändern die Fahrzeugzulassung nicht.
