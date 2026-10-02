# Nächste Iterationen

## 1. Pilotbetrieb in eigener Supabase-Instanz
- Öffentliche HTTPS-Adresse und Auth-Redirects konfigurieren; das eigene Cloud-Projekt ist eingerichtet.
- Mailanbieter für Auth-Bestätigungen konfigurieren und echten Mailversand prüfen.
- Administratorkonto, echte Fahrzeug- und Fahrerdaten; kein Demoimport.
- Mehrere Standorte ergänzen; Einladungslinks, Rollenänderungen und Organisationswechsel sind umgesetzt.
- Entwürfe für gemeinsam verwendete Geräte sicher bereinigen; Aufbewahrungsfristen und Löschabläufe festlegen.

## 2. Operativer Alltag
- Abbruchablauf für bereits laufende Transporte ergänzen; Umplanung, Fahrerwechsel und Storno vor Übernahme sind umgesetzt.
- Detaillierte Schadenfotos, Fahrzeugdiagramm, Schlüssel/Zubehör-Checkliste.
- Separate Unterschriften für übergebende und übernehmende Person, Annahmeverweigerung.
- Status „Neu“ und „Fahrer unterwegs“, Benachrichtigungen, CSV-Import.
- Versionierte PDF-Vorlage und persistente PDF-Artefakte.

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
