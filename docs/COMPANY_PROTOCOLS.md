# Unternehmensprofil und gemeinsame Fahrzeugakte

Unter **Organisation → Unternehmen** liest jedes Mitglied Firmenangaben. Administratoren bearbeiten Namen, Unternehmensart, Rechtsform, Geschäftsführung, Anschrift, Kontakt, Webseite, Steuer- und Registerdaten. **Team** enthält die bisherigen Einladungen und Rollen. Autohaus startet im Bestand, Überführer bei Aufträgen, kombiniert auf der Übersicht. Die Auswahl ändert keine Zugriffsrechte.

JPEG, PNG und WebP bis 10 MB sind als Logo zulässig. Vorschau, Ersetzen und Entfernen sind möglich. Der Browser verkleinert das Logo; der Server prüft das tatsächliche Bildformat und normalisiert es erneut als PNG. SVG und als PNG ausgegebene SVG-Inhalte werden abgelehnt. Jedes Logo erhält eine neue private Dateiversion. Entfernen löst die aktuelle Profilzuordnung, ohne historische Dateien zu löschen. Änderungen benötigen die aktuelle Unternehmensrevision.

## Identität, Bestand und Position

Jedes Fahrzeug behält seine interne UUID. Eine organisationsintern eindeutige VIN ist erforderlich. Bestandsnummern entstehen automatisch nach `FZ-000001`, sind unveränderlich und bleiben auch ohne Kennzeichen sichtbar. Das Zulassungskennzeichen ist optional; Leerwerte werden `null`, tatsächlich hinterlegte Kennzeichen bleiben organisationsintern eindeutig. Transportkennzeichen werden separat am Auftrag bzw. eigenständigen Protokoll dokumentiert.

Hersteller, Modell und optionale Baureihe bilden den Titel. Baureihe/Generation ist von Ausführung/Variante getrennt. [Katalog, Quellen und Grenzen](VEHICLE_CATALOG.md).

Unter **Fahrzeuge** filtert das Suchfeld die Liste direkt nach Kennzeichen, VIN, Bestandsnummer, Hersteller, Modell, Baureihe, Ausführung, Farbe und Standort/Stellplatz. Mehrere Suchbegriffe lassen sich kombinieren, etwa „Golf Berlin“. Groß-/Kleinschreibung sowie Leerzeichen und Bindestriche in Kennzeichen/Bestandsnummern sind unerheblich. Die Trefferzahl ist sichtbar; das X setzt die Suche zurück. Beim Öffnen einer Fahrzeugakte und Zurückgehen bleibt die Suche erhalten. **Bestand** verwendet dieselbe Suche zusätzlich zu seinen Filtern.

Die ausdrückliche Bestandszuordnung lautet eigener Bestand, Kundenfahrzeug oder noch nicht zugeordnet. Altbestände starten ohne erfundene Eigentumszuordnung. Im eigenen Bestand stehen die Status im Bestand, reserviert, verkauft und vermietet zur Verfügung. Eine manuelle Änderung benötigt einen Anlass; historische Änderungen sind unveränderlich. Verkaufsstatus und Transportauftrag bleiben unabhängig: ein verkauftes Fahrzeug lässt sich weiterhin überführen. Die Bestandsliste filtert zusätzlich nach Zuordnung und Verkaufs-/Vermietungsstatus.

## Protokolle erstellen

Auftragsprotokolle beginnen im zugewiesenen Transportauftrag. Admin/Disposition können außerdem in der Fahrzeugakte **Übernahme am Fahrzeug** oder **Übergabe am Fahrzeug** starten, ohne Auftrag oder künstlichen Fahrer. Eigenständige Anlässe: Ankauf, Verkauf, Vermietung, Rücknahme und Sonstiges. Fahrer bleiben auf ihre aktuellen Transportaufträge beschränkt. Während eines laufenden Transports ist ein eigenständiger Abschluss gesperrt.

1. **Vorgang und Beteiligte:** Anlass, Transportkennzeichen, Name und Funktion beider Personen. Eigenständig werden tatsächlicher Standort/Stellplatz und Zielstatus ausdrücklich bestätigt. Ankauf/Übernahme und Rücknahme/Übernahme schlagen im eigenen Bestand „Im Bestand“ vor, Verkauf/Übergabe „Verkauft“, Vermietung/Übergabe „Vermietet“. Sonstiges behält den bisherigen Status.
2. **Zustand:** Kilometerstand, Tank/Ladung, bekannte und neue Schäden, Hinweise und Schlüssel-Checkliste mit begründeten Abweichungen.
3. **Fotos:** Rundgang mit Fahrzeug in der Mitte, zehn Pflichtperspektiven und mehrere Innenraumfotos. Allgemeine Fahrzeugfotos ersetzen keine Protokollfotos.
4. **Prüfen und unterschreiben:** vollständige Angaben einschließlich Schäden, Schlüsseln und Fotos prüfen, beide Personen unterschreiben lassen und verbindlich abschließen. Eine fehlende Signatur benötigt ausdrückliche Ausnahme und Begründung. Ohne jede Unterschrift gibt es keinen Abschluss.

Entwürfe werden auf diesem Gerät in IndexedDB gespeichert und nach Neuladen wiederhergestellt. Änderungen an bestätigten Inhalten löschen beide Entwurfsunterschriften. Revisionen verhindern das Abschließen mit veralteten Fahrzeug-, Auftrags-, Schlüssel- oder Unternehmensdaten. Nach Konflikten Daten neu laden und den Entwurf prüfen; ein geändertes Firmenprofil kann nach Prüfung ausdrücklich übernommen werden.

`start_protocol` bindet Uploads an Organisation, Fahrzeug, optionalen Auftrag, Art, aktuelle Revisionen und angemeldeten Ersteller. `finalize_protocol` speichert Protokoll, Fotos, Schäden, Schlüsselbewegungen, Position und gegebenenfalls Bestandsstatus in einer Transaktion. Gleiche Protokoll-ID mit gleichem Abschlussinhalt liefert dasselbe Ergebnis. Andere Inhalte unter derselben abgeschlossenen ID werden abgelehnt. Transportprotokolle übernehmen die bisherigen Auftrags-/Positionsübergänge und ändern keinen Verkaufsstatus.

## Bilder und historische Dokumente

Fahrzeuge und Bestand zeigen bedarfsgerecht geladene, serverseitig verkleinerte Vorschaubilder. Die Fahrzeugakte zeigt Hauptbild und Galerie mit Datum, Perspektive und Herkunft. Standard: Außenaufnahme des neuesten abgeschlossenen Protokolls, vorzugsweise vorne links, dann vorne rechts oder vorne; sonst allgemeines Fahrzeugfoto bzw. Platzhalter. Admin/Disposition können ein anderes vorhandenes Foto als Titelbild wählen und zur Automatik zurückkehren. Dokumente und Signaturen sind ausgeschlossen. Protokollfotos werden referenziert und nicht erneut gespeichert.

**Ansehen** öffnet das abgeschlossene Webprotokoll; **PDF** exportiert das A4-Dokument mit Firmenlogo, Fahrzeug-/Vorgangsdaten, Schaden-/Schlüsselübersicht, zwei Signaturbereichen, geordnetem proportionalem Fotoanhang, Protokollnummer und Seitenzahlen. Firmenangaben, Logoversion, Fahrzeugdaten, bekannte Schäden und bestätigte Position/Bestandsstatus sind im Abschluss eingefroren. Spätere Änderungen beeinflussen diese Darstellung nicht. Halteranschriften und Dokumentenlinks stehen weiterhin außerhalb dieser Kopien.

Version 1 bleibt lesbar und verwendet den bisherigen PDF-Export mit einer Signatur. Historische Firmenangaben oder zweite Unterschriften werden nicht ergänzt. Private Originale verwenden kurz gültige erneuerbare Links; die Listen laden keine vollständigen Originalgalerien. Ein exportiertes PDF enthält eingebettete Bilder und bleibt nach Ablauf der Links lesbar.

## Geprüfte Einführung

Die drei additiven Migrationen ergänzen Unternehmens-/Fahrzeugidentität, strukturierte Protokolle und Titelbilder. Alle zwölf Migrationen wurden gemeinsam gegen eine separate lokale Datenbank mit alten Fahrzeug-/Auftrags-/Protokoll-/Fotodatensätzen geprüft. Tests und Veröffentlichung: [VALIDATION.md](VALIDATION.md), [DEPLOYMENT.md](DEPLOYMENT.md).

Verträge, Rechnungen, Mietzeiträume, Abrechnung, öffentliche Inserate und Offline-Sync gehören nicht zu dieser Iteration. mobile.de-Seller-Anbindung ist weiterhin fest in der [Roadmap](ROADMAP.md) eingeplant.

## Auftragsposition und erneute Prüfung – 3. Oktober 2026

Transportübergaben verwenden jetzt eine ausdrücklich bestätigte tatsächliche Position, unabhängig vom geplanten Ziel. Standort- und Stellplatzrevisionen schützen die geprüften Angaben. Beide Entwurfsunterschriften werden nach Positionsänderungen verworfen. Tank-/Ladestand beginnt ohne Vorbelegung. Veraltete Fahrzeugentwürfe bieten eine erneute Prüfung mit erhaltenen Fotos und neuer Abschluss-ID. Die ursprüngliche Protokollversion und alte PDFs bleiben erhalten. [Ablauf](ORDER_WORKFLOW.md) · [Funktionsprüfung](FUNCTION_AUDIT.md).
