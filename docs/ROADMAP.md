# VehicleOps – verbindliche Roadmap

## Umgesetzt: Fahrzeugakte, Schlüssel und Teamzugang

Baujahr und Erstzulassung, separate Halterdaten, allgemeine Fahrzeugfotos, private Dokumente, Schlüsselakten mit Historie, Schlüsselbestätigung im Protokoll und Passwort-Wiederherstellung. VIN-Modelljahr bleibt ein Hinweis. [Bedienung, Rechte und SMTP-Voraussetzungen](VEHICLE_RECORDS.md).

## Umgesetzt: Unternehmensprofil und gemeinsame Fahrzeugakte

Logo und vollständige Firmenangaben mit Revision, Autohaus/Überführer/Kombiniert als Startprofil, Fahrzeuge ohne Pflichtkennzeichen mit VIN und Bestandsnummer, eigener Baureihe und ausdrücklicher Bestandszuordnung. Bestandsstatus mit Historie bleibt vom Transport getrennt. Eigenständige und auftragsbezogene Protokolle mit zwei Unterschriften, begründeter Ausnahme, versionierten Firmen-/Fahrzeugkopien, Galerie und neuem PDF. [Bedienung und Grenzen](COMPANY_PROTOCOLS.md).

## Als Nächstes: Plattformen und Bestandsausbau

1. **Bestandsübersicht – umgesetzt:** feste Standorte, Anschriften, Stellplätze und Bewegungen mit Person, Zeitpunkt und Anlass. Filter nach Standort, Stellplatz, Verfügbarkeit und Transportstatus. Freie Angaben bleiben erhalten und werden ausdrücklich zugeordnet. Weitere Schritte: feste Ziele in Aufträgen, Standortrechte und Archivierung. [Bedienung und Datenmodell](INVENTORY.md).
2. **mobile.de – erster Import umgesetzt:** lesender Händlerbestandsabruf und Seller-API-Datei, Vorschau, ausdrückliche VIN-Zuordnung, Dublettenprüfung und atomare Wiederholung. [Bedienung und Grenzen](MOBILE_IMPORT.md). Ein echter Test mit freigeschaltetem Händlerzugang steht aus. Danach Bilder mit Herkunft übernehmen; anschließend Inserate veröffentlichen/aktualisieren und regelmäßige Synchronisation ergänzen. Grundlage ist die offizielle [Seller-API](https://services.mobile.de/docs/seller-api.html).
3. **AutoScout24:** als zusätzlichen Kanal evaluieren.
4. **AUTO1/BCA:** Übernahme gekaufter Fahrzeuge einschließlich tatsächlich verfügbarer Daten und Bilder evaluieren. Einkaufsdatenzugriff, Bildnutzungsrechte und Partnerfreigaben zuerst prüfen; kein Zugang wird vorausgesetzt.

| Geplanter Datensatz | Verantwortung |
| --- | --- |
| Fahrzeug | Interne ID, technische Daten, Bestand, Standort |
| Einkaufsquelle | Anbieter, Kauf-/Auktionsreferenz, Datum, verfügbare Einkaufsdaten |
| Externes Inserat | Organisation, internes Fahrzeug, Plattform, Händlerkonto, externe Inserat-ID, Kanalstatus |
| Synchronisationslauf | Richtung, Vorschau, Änderungen, Fehler, Wiederholungsstatus |

Plattform-IDs ersetzen keine internen Fahrzeug-IDs. Import mit Vorschau und Dublettenprüfung anhand VIN und Plattformreferenz; fehlende oder mehrdeutige Daten benötigen eine Auswahl. Veröffentlichung mit ausdrücklicher Freigabe, versionierten Datenständen, Fehlerstatus und wiederholbaren Jobs. Server verwahren Zugangsdaten. Halteranschriften und private Dokumente sind von Inserat-Exporten ausgeschlossen. Je Plattform eigener Adapter, gemeinsame Zuordnung und Fehlerbehandlung.

Ein lesender mobile.de-Adapter ist vorbereitet und mit kontrollierten Antworten geprüft. Der tatsächliche Händlerzugang, Inseratveröffentlichung und Offline-Sync stehen weiterhin aus.

## 1. Pilotbetrieb in eigener Supabase-Instanz
- Öffentliche HTTPS-Adresse und Auth-Redirects konfigurieren; das eigene Cloud-Projekt ist eingerichtet.
- Mailanbieter für Auth-Bestätigungen konfigurieren und echten Mailversand prüfen.
- Administratorkonto, echte Fahrzeug- und Fahrerdaten; kein Demoimport.
- Feste Standorte und Stellplätze, Einladungslinks, Rollenänderungen und Organisationswechsel sind umgesetzt.
- Entwürfe für gemeinsam verwendete Geräte sicher bereinigen; Aufbewahrungsfristen und Löschabläufe festlegen.

## 2. Operativer Alltag
- Abbruchablauf für bereits laufende Transporte ergänzen; Umplanung, Fahrerwechsel und Storno vor Übernahme sind umgesetzt.
- Detaillierte Schadenfotos, Fahrzeugdiagramm und Zubehör-Checkliste; Schlüssel sind umgesetzt.
- Separate Unterschriften und begründete Ausnahme sind umgesetzt. Weiterführend: dokumentierte Annahmeverweigerung mit separatem Vorgangsstatus.
- Status „Neu“ und „Fahrer unterwegs“, Benachrichtigungen, CSV-Import.
- Versionierte PDF-Vorlage ist umgesetzt; persistente PDF-Dateien und dokumentierte Aufbewahrung folgen.

## 3. Offline-Sync
- Versionierte Entwürfe und Medienwarteschlange in IndexedDB.
- Idempotente Uploads, Retry mit Backoff und sichtbare Synchronisationszustände.
- Konfliktprüfung anhand Auftragsversion und Kilometerstand; serverseitiger Abschluss bleibt verbindlich.
- Tests für Netzverlust während Upload/Abschluss und Gerätewechsel.

## 4. SaaS-Betrieb
- Monitoring, Backups/Restore-Übung, Limits, Mandantenverwaltung und Abrechnung.
- RLS-Regressionssuite mit mehreren Nutzern, Migrationen in CI, Upload-Prüfungen.
- Fahreransicht für zugewiesene Aufträge, standortbezogene Rechte und Benachrichtigungen.

KI-Schadensvergleich erst nach verlässlichem Foto- und Schadenprozess evaluieren.
