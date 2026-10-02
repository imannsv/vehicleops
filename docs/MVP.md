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

Teamverwaltung mit Einladungslinks, Rollenänderungen, Zugangsentzug und Organisationswechsel ist umgesetzt. Fahrer sehen ihre zugewiesenen Aufträge. Das vom Nutzer gewählte externe Cloud-Projekt ist eingerichtet. Öffentliche App-Adresse und Mailanbieter für Auth-Bestätigungen folgen.
