# VehicleOps

Erster lauffähiger MVP einer B2B-Plattform für Fahrzeugüberführungen, Autohäuser und Vermietungen. Next.js 16, TypeScript, Tailwind 4, Supabase/Postgres, IndexedDB und jsPDF.

## Repository und Veröffentlichung

Das Projekt wird in [imannsv/vehicleops](https://github.com/imannsv/vehicleops) entwickelt und über das Vercel-Projekt `imanabi/vehicleops` veröffentlicht. Änderungen auf `main` starten ein Produktionsdeployment; andere Branches erhalten Previews. GitHub Actions prüft den Build und die Anwendung. Details und Wiederherstellung: [Deployment](docs/DEPLOYMENT.md).

**Live-App: [vehicleops-six.vercel.app](https://vehicleops-six.vercel.app)**. Anmeldung mit dem bestehenden VehicleOps-Konto; lokale und öffentliche App verwenden dieselbe Supabase-Datenbank.

## Lokal starten

Voraussetzung: Node.js 24 und npm.

```powershell
npm ci
npm run dev
```

Öffne http://localhost:3000. Ohne Supabase-Umgebungsvariablen startet eine klar gekennzeichnete lokale Demo mit drei Fahrzeugen und zwei Aufträgen. Alle Eingaben und komprimierten Fotos werden in IndexedDB gespeichert und bleiben nach einem Neuladen erhalten. Die Demo arbeitet mit einem lokalen Administratorkonto. Sie ist für die Erprobung auf einem Gerät gedacht.

Für den Produktionsbuild und die PWA-Basis:

```powershell
npm run build
npm run start
```

Die App enthält ein Manifest, PNG-Icons und einen Service Worker mit verständlicher Offline-Seite. Ein vollständiger Offlinebetrieb und die Synchronisation mit der Cloud sind noch nicht implementiert. Auf Mobilgeräten benötigt die Installation außerhalb von localhost HTTPS.

## Was funktioniert

- Dashboard mit offenen Aufträgen, Transportstatus und Aktivitäten.
- Fahrzeuge mit VIN, Kilometerstand, Standort, Schadenakte und Historie anlegen, ansehen und bearbeiten.
- Hersteller mit Logos und 2.664 zugehörige PKW-Modelle aus öffentlichen mobile.de-Referenzdaten auswählen, VIN-Vorschläge prüfen, Ausführung und Ausstattung erfassen. Siehe [Katalog und VIN](docs/VEHICLE_CATALOG.md).
- Fahrer mit Kontaktinformationen und hinterlegtem Führerscheingültigkeitsdatum anlegen und bearbeiten.
- Aufträge mit Fahrzeug, Fahrer, Route, Termin und Ansprechpartner erstellen, umplanen und vor der Übernahme mit Begründung stornieren.
- Übernahme und Übergabe separat dokumentieren, Entwürfe lokal wiederherstellen.
- Zehn Pflichtperspektiven aufnehmen, mehrere Innenraumfotos hochladen/aufnehmen, Schäden beschreiben und Unterschrift zeichnen.
- Abschluss erst bei vollständigem Protokoll, gültigen Werten und nicht sinkendem Kilometerstand.
- Unveränderliche abgeschlossene Protokolle und PDF-Download mit Fotos und Unterschrift.
- Cloud-Modus mit Passwortanmeldung, Organisationsgründung, vier Rollen, RLS und privatem Storage.

Eine Führerscheingültigkeit ist eine hinterlegte Stammdatenangabe, keine automatisierte Führerscheinkontrolle. Die Unterschrift ist eine gezeichnete Bestätigung, keine qualifizierte elektronische Signatur.

## Supabase anbinden

Das vom Nutzer ausgewählte neue Projekt nfocyuyuloyjaikkflai wurde mit sechs geprüften Migrationen eingerichtet. Die lokale App ist damit verbunden. Das andere bestehende Projekt wurde nicht verändert. Siehe docs/CLOUD_SETUP.md für Anmeldung und Teamaufnahme.

1. Ein eigenes Supabase-Projekt auswählen/erstellen.
2. Die Migrationen unter supabase/migrations in Reihenfolge anwenden (SQL-Editor oder Supabase CLI).
3. `.env.example` nach `.env.local` kopieren und Projekt-URL sowie Publishable Key eintragen.
4. In der App ein Konto erstellen, die E-Mail-Adresse bestätigen und anmelden.
5. App neu starten bzw. neu bauen, anmelden und die Organisation erstellen.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

**Niemals einen Secret-/Service-Role-Key in NEXT_PUBLIC-Variablen eintragen.** Die App benötigt ausschließlich den Publishable Key. Alle Autorisierungsentscheidungen liegen in Postgres. Die browserseitige Anzeige der Rolle ist lediglich die Bedienoberfläche.

Weitere Personen werden unter „Organisation“ mit einem Einladungslink aufgenommen. Für administrative Skripte bleibt außerdem die Funktion `add_member` verfügbar. Im SQL-Editor wird keine angemeldete App-Identität gesetzt; deshalb diese RPC mit dem angemeldeten Admin-Client aufrufen, z. B. in einem administrativen Setup-Skript:

```typescript
await client.rpc('add_member', {
  p_org: organizationId,
  p_user: existingAuthUserId,
  p_name: 'Lena Fischer',
  p_role: 'driver', // admin | dispatcher | driver | viewer
});
```

Beim Anlegen eines Fahrers lässt sich dessen Teammitglied verknüpfen. Nur dann kann ein Mitglied mit Fahrerrolle die ihm zugewiesenen Aufträge dokumentieren. Einladungslinks, Rollenänderungen und Organisationswechsel sind umgesetzt. Alle Mitglieder können Daten ihres Mandanten lesen; Bearbeitungsrechte sind rollenabhängig.

## Lokaler Supabase-Testbetrieb

Docker muss laufen. Die Konfiguration nutzt eigene Ports 55421/55422, um andere Projekte nicht zu stören.

```powershell
npx supabase start -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npx supabase status
```

Die dabei ausgegebenen lokalen API-Werte lassen sich in `.env.local` übernehmen. Keine lokalen Testschlüssel für die Produktion verwenden. Die CLI ist als Entwicklungsabhängigkeit installiert.

## Datenmodell und Grenzen

`organizations`, `memberships`, `vehicles`, `drivers`, `orders`, `handovers`, `handover_photos`, `damages`, `vehicle_events`.

Geschäftsdatensätze sind über `organization_id` getrennt. Zusammengesetzte Fremdschlüssel verhindern mandantenfremde Zuordnungen. Rollen werden aus Mitgliedschaften gelesen. RLS schützt alle öffentlichen Tabellen. Ein atomarer RPC sperrt Auftrag/Fahrzeug, prüft Zustand, zehn Pflichtperspektiven, zusätzliche Innenraumfotos und vorhandene Storage-Dateien und schreibt Protokoll, Schäden, Status und Historie zusammen. Direkte Statusänderungen und Änderungen abgeschlossener Protokolle sind für App-Benutzer gesperrt. Protokollbilder sind privat; die App lädt zeitlich begrenzte signierte URLs. Abgeschlossene Evidenzdateien dürfen App-Benutzer weder ersetzen noch löschen.

`src/lib/database.types.ts` wurde aus der lokalen Datenbank generiert. Nach Schemaänderungen neu erzeugen:

```powershell
npx supabase gen types --local --schema public > src/lib/database.types.ts
```

Stammdatenbearbeitung und Umplanung/Stornierung sind umgesetzt. Mehrere Standorte, PDF-Archivierung und Abrechnung folgen. Cloud-Entwürfe werden derzeit auf dem jeweiligen Gerät gespeichert; sie synchronisieren nicht zwischen Geräten. Für Protokollabschlüsse ist im Cloud-Modus eine Verbindung erforderlich. Bei abgelaufenen signierten Foto-URLs die App neu laden. Einen produktiven Betrieb mit realen Kundendaten erst nach Pilotkonfiguration, Backups und Aufbewahrungs-/Löschkonzept beginnen.

## Prüfungen

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
node tests/cloud.integration.mjs
node tests/team.integration.mjs
Get-Content -Raw tests/database.sql | docker exec -i supabase_db_vehicleops psql -U postgres -d postgres -v ON_ERROR_STOP=1
npx supabase db advisors --local --type all --level warn --fail-on error
```

Browserprüfungen laufen gegen einen Produktionsbuild ohne Cloud-Umgebungsvariablen. Sie prüfen Desktop und Pixel-7-Ansicht. Die Cloud-Integrationsprüfung verwendet nur die lokale Supabase-Instanz, legt temporäre Testdaten an und entfernt sie anschließend. Die SQL-Suite rollt sämtliche Fixtures zurück.

Siehe `docs/MVP.md` für Scope/Architektur und `docs/ROADMAP.md` für die nächsten Iterationen.

Innenraumfotos lassen sich gesammelt auswählen oder einzeln mit der Kamera ergänzen. Vorschauen können einzeln entfernt werden; mindestens ein Innenraumfoto bleibt erforderlich. Alle Bilder werden im Entwurf und abgeschlossenen Protokoll gespeichert sowie im PDF nummeriert. Bereits vorhandene Einzelfotos bleiben mit der Folgemigration kompatibel.


## Bearbeitung und unveränderliche Protokolle

Fahrzeugakten und Fahrerkarten bieten einen Bearbeiten-Button. In offenen Aufträgen können Fahrer, Termin, Ziel und Ansprechpartner geändert werden. Fahrzeug und Abholort können nur vor der Übernahme gewechselt werden. Kilometerstand und Standort werden während des Transports ausschließlich über Protokolle fortgeschrieben; der Kilometerstand darf protokollierte Werte auch später nicht unterschreiten.

Storno ist nur vor der Übernahme möglich, benötigt eine Begründung und bleibt in Auftrag und Historie sichtbar. Das Fahrzeug wird wieder verfügbar. Bearbeitungen laufen im Cloud-Modus über autorisierte RPCs und im Demobetrieb über atomare IndexedDB-Transaktionen. Revisionen verhindern, dass veraltete Formulare Änderungen aus anderen Tabs überschreiben. Bei einem Konflikt neu laden und die Änderung prüfen.

Beim Abschluss speichert jedes Protokoll Kopien der Organisations-, Fahrzeug-, Fahrer- und Auftragsangaben. PDF-Exporte verwenden diese Kopien. Frühere Protokolle werden bei der Migration mit den zu diesem Zeitpunkt verfügbaren Angaben ergänzt; ursprüngliche Angaben können nicht rückwirkend rekonstruiert werden. Bearbeitete Aufträge beginnen einen neuen lokalen Protokollentwurf, damit Fotos nicht unbemerkt einem anderen Fahrzeug zugeordnet werden. Alte Entwürfe bleiben lokal gespeichert und werden nicht automatisch übernommen.

Die dritte Migration ersetzt die Abschluss-RPC-Signatur durch eine Variante mit verpflichtender Auftragsrevision. App und Migration zusammen aktualisieren.

## Team und Cloud

Unter Organisation lassen sich Einladungslinks erstellen und widerrufen, Rollen ändern und Zugänge entfernen. Annahme bindet die Mitgliedschaft an die bestätigte E-Mail-Adresse; Links gelten sieben Tage, werden einmalig verwendet und nur gehasht gespeichert. Adminrechte werden serverseitig geprüft. Der letzte Administrator und Fahrer mit offenen Aufträgen bleiben geschützt. Die Fahrer-Auftragsliste zeigt zugewiesene Aufträge. Einladungslinks werden selbst geteilt; automatischer Einladungsmailversand ist nicht eingebaut.

Die Auth-E-Mail-Bestätigung benötigt für beliebige Mitarbeiter einen eigenen SMTP-Anbieter. Die Web-App wird bei Vercel über HTTPS veröffentlicht. Die bisherigen Demodaten bleiben lokal erhalten. Details in docs/CLOUD_SETUP.md.
