# VehicleOps — erster MVP

Ziel: B2B-Aufträge für Überführer, Autohäuser und Vermieter von der Disposition bis zum dokumentierten Abschluss bearbeiten. Deutschsprachige, responsive Next.js-App. Der erste Stand ist ein lokaler Demonstrator mit einer optionalen Supabase-Anbindung.

## Ablauf
Organisation anlegen → Fahrzeuge und Fahrer erfassen → Auftrag zuweisen → Übernahme mit zehn Pflichtfotos, Schäden, Kilometerstand, Tank/Ladung und Unterschrift → Transport → gleichartig dokumentierte Übergabe → PDF und Fahrzeughistorie.

## Daten und Rechte
Organisationen, Mitgliedschaften (admin, dispatcher, driver, viewer), Fahrzeuge, Fahrer, Aufträge, Übergaben, Übergabefotos, Schäden und Ereignisse. Alle Geschäftsdatensätze tragen eine Organisation-ID; zusammengesetzte Fremdschlüssel verhindern Verweise auf fremde Mandanten. Rollen stammen aus Mitgliedschaften, niemals aus editierbaren Auth-Metadaten. Fahrer bearbeiten nur ihnen zugewiesene Aufträge. Abgeschlossene Protokolle sind unveränderlich.

## Umsetzung
1. Next.js App Router, TypeScript, Tailwind; responsive Disposition.
2. Repository für IndexedDB-Demo und Supabase; Login und Organisationsgründung.
3. Formulare, Zuweisung, kontrollierter Protokollabschluss und PDF.
4. Supabase-Migration mit RLS, privatem Storage und atomarem Abschluss.
5. Tests der Abschlussbedingungen, Produktionsbuild und Browserablauf.

## Grenzen des ersten Stands
Kein Offline-Sync, keine automatische KI-Schadenserkennung, keine Einladungsmails, kein Abrechnungssystem. Lokale Demo speichert Daten einschließlich Fotos im Browser; Cloud-Modus benötigt ein eigenes Supabase-Projekt und die Migration. Installation über Manifest/Service Worker, Offline-Sync folgt separat. Protokolle dokumentieren die Erklärung der Unterzeichnenden; es wird keine qualifizierte elektronische Signatur angeboten.

## Gestaltung
Kühle weiße Arbeitsfläche, tiefblauer Navigationsbereich (#142c49), Kobaltblau (#245de8), grüne Zustandsanzeigen (#187854), Linien (#e3e8ef), Text (#192b42). Systemschrift mit klaren Zahlen. Auftragsliste und Routen sind das zentrale Arbeitsinstrument; kleine Kennzahlen ergänzen sie. Mobile Protokolle haben große Aufnahmefelder und eine sichtbare Vollständigkeitsprüfung.

## Zweite Iteration: Bearbeitung

Stammdaten lassen sich bearbeiten, offene Aufträge umplanen und vor Übernahme mit Begründung stornieren. Ein Storno bleibt sichtbar und gibt das Fahrzeug frei. Nach Übernahme bleiben Fahrzeug und Abholort fest. Führerscheindaten müssen alle offenen Aufträge abdecken. Abgeschlossene Protokolle speichern unveränderliche Kopien der Angaben für spätere PDF-Exporte. Revisionen und atomare Schreibvorgänge verhindern das Überschreiben neuerer Änderungen; Auftragsänderungen beginnen einen neuen lokalen Protokollentwurf.

Teamverwaltung mit Einladungslinks, Rollenänderungen, Zugangsentzug und Organisationswechsel ist umgesetzt. Fahrer sehen ihre zugewiesenen Aufträge. Das gewählte externe Cloud-Projekt und die öffentliche App `https://vehicleops-six.vercel.app` sind eingerichtet. Ein eigener Mailanbieter für Auth-Bestätigungen bleibt offen.

## Fahrzeugakte, Schlüssel und Wiederherstellung

Optionale Angaben: Baujahr, Erstzulassung und separate Halterdaten. Allgemeine Fotos und Dokumente bis 10 MB haben eigenen privaten Storage mit rollenabhängigen Rechten. Schlüsselakten führen Zustand, Aufbewahrung und unveränderliche Bewegungshistorie; die Protokoll-Checkliste speichert Bestätigung, Bewegungen und Snapshot atomar. Alte PDFs bleiben unverändert, ältere App-Aufrufe kompatibel.

Passwort vergessen und ein eigener Recovery-Bildschirm sind umgesetzt und gegen den lokalen Maildienst geprüft. Produktives SMTP wartet auf Anbieter und Absender-Domain. Details: [Fahrzeugakte](VEHICLE_RECORDS.md). Bestandsübersicht, mobile.de, weitere Kanäle und Offline-Sync stehen in der [Roadmap](ROADMAP.md).

## Unternehmensprofil, gemeinsame Fahrzeugakte und neue Protokolle

Die Fahrzeugakte verbindet eigenen Bestand und Kundenfahrzeuge. Zulassungskennzeichen sind optional; VIN und automatische Bestandsnummer identifizieren jedes Fahrzeug. Autohaus, Überführer und kombiniert wählen unterschiedliche Startbereiche bei gleichen Rechten. Bestandsstatus, Auftragsstatus und Position bleiben unabhängig. Eigenständige Protokolle benötigen keinen Auftrag oder Fahrer. Der vierteilige Ablauf enthält beide Beteiligten, Zustand/Schlüssel/Schäden, den vorhandenen Rundgang und Zusammenfassung mit zwei Signaturen. Änderungen löschen Entwurfsunterschriften. Abschluss, Schlüssel-, Schaden-, Positions- und Bestandsänderungen sind atomar und wiederholbar. Firmenangaben, Logoversion und Fahrzeugdaten bleiben als historische Kopie erhalten. Ältere Protokolle behalten die bisherige Darstellung. [Details](COMPANY_PROTOCOLS.md).
