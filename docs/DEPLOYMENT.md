# GitHub und Vercel

Das Arbeitsrepository ist [imannsv/vehicleops](https://github.com/imannsv/vehicleops). Die App liegt direkt im Repository-Hauptverzeichnis.

Produktionsadresse: **[vehicleops-six.vercel.app](https://vehicleops-six.vercel.app)**. Vercel-Projekt: [Dashboard](https://vercel.com/imanabi/vehicleops).

## Änderungen veröffentlichen

Für Änderungen einen Branch anlegen und einen Pull Request nach `main` öffnen. GitHub Actions prüft Lint, Fachlogik, Typen, Produktionsbuild und die Browserabläufe auf Desktop und Mobilgeräten. Vercel erzeugt für Branches eine Preview und veröffentlicht `main` als Produktion. Ein direkter Push nach `main` ist ebenfalls möglich und startet dieselben Prüfungen.

Die GitHub-Prüfungen sperren Deployments nicht automatisch. Branch-Schutz ist derzeit nicht eingerichtet. Vor einem Merge fehlgeschlagene Prüfungen beheben und die Preview prüfen.

## Vercel-Konfiguration

- Team: `imanabi`, Projekt: `vehicleops`
- Framework: Next.js
- Root Directory: Repository-Hauptverzeichnis
- Node.js: 24.x
- Installation: `npm ci`
- Build: `npm run build`
- Produktionsbranch: `main`

Die beiden Variablen aus `.env.example` werden in Vercel für Production, Preview und Development gepflegt. Sie werden beim Build eingebunden. Nach einer Änderung neu deployen. Ausschließlich Supabase-URL und Publishable Key verwenden; Service-Role-Schlüssel gehören nicht in die Web-App. `.env.local`, `.vercel`, Builddateien und lokale Supabase-Testdaten bleiben außerhalb von Git.

Previews sind mit der bestehenden Supabase-Datenbank verbunden. Angemeldete Personen bearbeiten dort dieselben Organisationsdaten wie in der Produktion. Tests, die Fixtures schreiben, laufen ausschließlich gegen den lokalen Supabase-Stack.

## Live-Prüfung

```powershell
$env:VEHICLEOPS_BASE_URL='https://vehicleops-six.vercel.app'
node tests/cloud.smoke.mjs
```

Die Prüfung liest die lokale Cloud-Konfiguration, überprüft Anmeldung und Registrierung, die geschützte VIN-Route und die Sperre anonymer Datenzugriffe. Sie legt keine Benutzer oder Fahrzeuge an. Ohne `VEHICLEOPS_BASE_URL` wird localhost geprüft.

Supabase Authentication verwendet `https://vehicleops-six.vercel.app` als Site URL. Erlaubte Redirects sind die Produktionsadresse und `http://localhost:3000`, jeweils mit `/` und `/**`, damit auch Einladungsparameter funktionieren. Diese Einstellungen wurden im Dashboard gespeichert und geprüft. Neue Preview-Adressen nur bei Bedarf als erlaubte Auth-Redirects ergänzen.

![Gespeicherte Auth-Adressen](auth-urls.png)

## Datenbankänderungen und Wiederherstellung

Neue SQL-Migrationen gehören nach `supabase/migrations`. Git-Pushes wenden sie nicht automatisch auf Supabase an. Schemaänderungen getrennt prüfen und vor einem davon abhängigen App-Deployment anwenden. Angewendete Migrationen nicht nachträglich ändern.

Bei einem fehlerhaften App-Deployment kann im Vercel-Dashboard ein vorheriger erfolgreicher Stand wieder zur Produktion werden. Danach die Ursache per Commit beheben. Datenbankmigrationen werden durch einen App-Rollback nicht zurückgenommen.

## Mobile Eingaben und Umsetzen – 3. Oktober 2026

Die Migration `20261003001110_optional_vehicle_movement_reason.sql` ist im ausgewählten Projekt als Cloud-Version `20261003002011` angewendet. Sie erweitert nur die bestehende private Bewegungsfunktion: leere oder `null`-Notizen erhalten die neutrale Beschreibung „Fahrzeug umgesetzt“. Rollenprüfung, Revisionen, Transport- und Stellplatzsperren sowie Historie bleiben bestehen. Der bestehende RPC-Aufruf bleibt kompatibel; frühere Bewegungen werden nicht verändert. Insgesamt sind 14 Migrationen angewendet.

Die Oberfläche verwendet auf Mobil-/Touchgeräten größere Eingabeschrift und passende Tastaturhinweise. Keine zusätzlichen Umgebungsvariablen. Die Prüfungen umfassen 62 Fachlogiktests und 52 Desktop-/Mobilfälle; Grenzen der Geräteemulation sind in [VALIDATION.md](VALIDATION.md) dokumentiert.

## mobile.de-Bestandsimport – 2. Oktober 2026

Die lokal geprüfte additive Migration `20261002175214_mobile_stock_import.sql` wurde vor dem App-Deployment im ausgewählten Projekt `nfocyuyuloyjaikkflai` als Cloud-Version `20261002180507` / `mobile_stock_import` angewendet. Dort läuft Postgres 17.11; insgesamt sind nun 13 Migrationen angewendet. Keine bestehenden Fahrzeug- oder Protokolldaten wurden verändert.

Die neuen Tabellen `external_listings` und `platform_import_runs` haben RLS und ausschließlich lesende App-Tabellenrechte. Schreiben erfolgt über die autorisierte atomare Importfunktion. Der API-Abruf verwendet nur den öffentlichen Supabase-Key zur Prüfung der angemeldeten Person und des Unternehmens; es gibt keine neue Service-Role-Variable oder gespeicherte Händlerzugänge. Ältere App-Versionen bleiben mit der Erweiterung kompatibel.

GitHub Actions prüft 61 Fachlogiktests und 48 Desktop-/Mobilabläufe. Der tatsächliche mobile.de-Händlerzugang ist noch nicht geprüft. API-Voraussetzungen, Dateiformat und Grenzen: [MOBILE_IMPORT.md](MOBILE_IMPORT.md).

## Unternehmensprofil und Protokolle – 2. Oktober 2026

Nach lokaler Prüfung mit leerem Schema und Altbeständen sind drei weitere additive Migrationen im ausgewählten Projekt `nfocyuyuloyjaikkflai` angewendet:

| Lokale Migration | Cloud-Version | Name |
|---|---|---|
| `20261002131221_company_vehicle_identity.sql` | `20261002142132` | `company_vehicle_identity` |
| `20261002131827_structured_protocols.sql` | `20261002142140` | `structured_protocols` |
| `20261002133356_vehicle_image_covers.sql` | `20261002142143` | `vehicle_image_covers` |

Die Cloud-Verwaltung vergibt eigene Zeitstempel. Für diese bereits angewendeten Dateien keine zweite Migration über einen ungeprüften CLI-Push erzeugen. Der lokale isolierte Stack führt dieselben Inhalte unter den lokalen Dateiversionen. Insgesamt sind zwölf Migrationen angewendet.

Alte Speicher- und Abschlussaufrufe bleiben kompatibel. Neue Protokolle verwenden die neue atomare Abschlussfunktion mit optionalem Auftrag und eingefrorenen Firmen-/Fahrzeugdaten. Alte Protokolle behalten ihren bisherigen PDF-Export. `company-logos` ist privat, Logoversionen werden nicht überschrieben; Bildvorschauen werden serverseitig auf Organisationszugriff geprüft. Es sind keine neuen Umgebungsvariablen erforderlich.

GitHub Actions prüft nun 51 Fachlogiktests und 40 Desktop-/Mobilprüfungen. Schreibende Datenbank- und Cloud-Browserprüfungen werden zusätzlich gegen den lokalen Supabase-Stack ausgeführt; die öffentliche Smoke-Prüfung legt keine Geschäftsdaten an. Details: [VALIDATION.md](VALIDATION.md).
# Fahrzeugakte und Recovery – 2. Oktober 2026

Die Erweiterung verwendet zwei additive Migrationen: Fahrzeugakte/Anhänge/Schlüssel und einen ergänzenden Halter-Fremdschlüsselindex. Sie werden vor der App im gewählten Supabase-Projekt angewendet. Die alte Abschluss-API und frühere Fahrzeugbearbeitungsaufrufe bleiben kompatibel; neue App-Abschlüsse verwenden `finalize_handover_v2`. Halterdaten und Dokumente werden nicht in Protokollkopien übernommen.

Die App enthält `/auth/reset-password`; die bestehende Produktionsfreigabe `https://vehicleops-six.vercel.app/**` umfasst diesen Pfad. Ein eigener produktiver SMTP-Anbieter und die Absender-Domain stehen aus. Lokale Recovery- und Uploadprüfungen sind in [VALIDATION.md](VALIDATION.md), Einrichtung in [VEHICLE_RECORDS.md](VEHICLE_RECORDS.md) dokumentiert.

## Bestandsverwaltung – 2. Oktober 2026

Die additive neunte Migration `fleet_inventory` ist vor dem App-Deployment im ausgewählten Supabase-Projekt angewendet. Sie ergänzt Standorte, Stellplätze und unveränderliche Bewegungen, ohne bestehende Freitextstandorte zuzuordnen oder alte Protokolle umzuschreiben. Beide Abschluss-APIs geben den Stellplatz bei Übernahme atomar frei. GitHub Actions prüft 39 Fachlogiktests und 30 Desktop-/Mobilprüfungen. Bedienung: [INVENTORY.md](INVENTORY.md).

## Auftragsstandorte und Fahrerablauf – 3. Oktober 2026

Die fünfzehnte additive Migration `order_routes_and_confirmed_delivery` ist im ausgewählten Projekt `nfocyuyuloyjaikkflai` angewendet. Lokal: `20261003004642_order_routes_and_confirmed_delivery.sql`; Cloud-Verwaltung: `20261003010756`. Die Cloud-Zeitstempel werden weiterhin separat vergeben; keine bereits angewendeten Inhalte ungeprüft nochmals über CLI-Push übertragen. Alle 15 Migrationen wurden lokal gemeinsam mit Altbeständen geprüft.

Aufträge erhalten optionale Abhol-/Zielstandorte, Zielstellplatz und gespeicherte Navigationsanschriften. Rollen, RLS und alte öffentliche Funktionssignaturen bleiben erhalten. Neue Abschlüsse unterstützen bestätigte tatsächliche Positionen, Standort-/Stellplatzrevisionen, atomare Belegung und idempotente Wiederholungen. Die private Triggerfunktion ist für Anonym und Mitglieder nicht direkt ausführbar; der öffentliche Abschluss bleibt für Anonym gesperrt. Cloud-Advisors melden keine neuen Datenbank-Sicherheitsbefunde oder Performance-Warnungen; die vorhandene Auth-Warnung und bisher ungenutzte Fremdschlüsselindizes sind dokumentiert.

Der Release umfasst 70 Fachlogiktests und 58 Desktop-/Mobilprüfungen, die vollständige lokale Auth-/Storage-/Datenbankprüfung und den echten lokalen Recovery-Mailablauf. GitHub Actions führt Lint, Fachlogik, Build, Typprüfung und die Desktop-/Mobilbrowserprüfungen aus. Die abschließende öffentliche Smoke-Prüfung verwendet keine schreibenden Geschäftsvorgänge. [Ablauf und Bedienung](ORDER_WORKFLOW.md) · [Prüfmatrix und Grenzen](FUNCTION_AUDIT.md).

Die vorhandene Supabase-Konfiguration wird weiter genutzt; keine neuen Umgebungsvariablen sind erforderlich. Der echte mobile.de-Händlerzugang und produktive SMTP-Versand bleiben zurückgestellt beziehungsweise noch einzurichten.

## Stellplätze gesammelt einrichten – 3. Oktober 2026

Die sechzehnte additive Migration `bulk_parking_setup` ist im gewählten Projekt `nfocyuyuloyjaikkflai` angewendet. Lokale Datei: `20261003012931_bulk_parking_setup.sql`; Cloud-Version: `20261003013903`. Sie ergänzt zwei öffentliche Aufrufe: `create_fleet_site_with_spaces` für atomare Erstanlage und `add_parking_spaces` für weitere Bezeichnungen. Die bisherigen Aufrufe, Tabellen und vorhandenen Daten bleiben kompatibel. Kein erneuter CLI-Push der abweichend nummerierten Cloud-Historie.

Admin und Disposition können bis zu 200 Plätze je Vorgang anlegen. Die neuen Funktionen prüfen die aktuelle Organisationsmitgliedschaft, verwenden den bestehenden Organisationslock und überspringen vorhandene Bezeichnungen. Wiederholung verändert keine vorhandenen Plätze oder Positionen. Die private Umsetzung hat einen leeren Suchpfad; Anonym hat auf alle vier Funktionen keine Ausführungsrechte. Die öffentliche Umsetzung bleibt ohne erhöhte Rechte. Bestehende Tabellenrechte/RLS sind bestätigt; keine neuen Advisor-Warnungen.

75 Fachlogiktests und 64 Desktop-/Mobilprüfungen bestehen. Zusätzlich sind echte lokale Firmenkonto-/Stellplatzbrowser einschließlich verlorener Antwort und Wiederholung, Rollen/Konkurrenz/Rollback, die bisherige Standortprüfung, bestehende SQL-Suite und alle 16 Migrationen mit Altbeständen geprüft. Keine neuen Umgebungsvariablen. [Bedienung](INVENTORY.md) · [Prüfungen](VALIDATION.md).

## Standort- und Stellplatzarchiv – 3. Oktober 2026

Die siebzehnte additive Migration `fleet_archive` ist vor dem App-Deployment im gewählten Projekt `nfocyuyuloyjaikkflai` angewendet. Lokale Datei: `20261003020414_fleet_archive.sql`; Cloud-Version: `20261003021502`. Die unterschiedlichen Zeitstempel bleiben dokumentiert; keinen ungeprüften CLI-Push der bereits angewendeten Inhalte durchführen.

`fleet_sites` und `parking_spaces` erhalten nullable Archivzeitpunkte; alte Datensätze bleiben aktiv. `set_fleet_archived` prüft Admin/Disposition, Organisation, Revision und aktuelle Belegung/Planung. Wiederholungen des bereits erreichten Zustands erzeugen keinen zusätzlichen Übergang. Bestehende Speicher- und Abschlussfunktionen bleiben erhalten; Schutztrigger verhindern neue Zuordnungen zu archivierten Bereichen und erhalten historische IDs und Kopien. Wiederherstellen des Standorts ändert keine individuellen Stellplatzarchive. Keine neuen Umgebungsvariablen.

Cloud-Metadaten bestätigen RLS, unveränderte lesende Tabellenrechte, den öffentlichen Aufruf ohne erhöhte Rechte, leere private Suchpfade und gesperrte anonyme Aufrufe. Triggerfunktionen sind für App-Mitglieder nicht direkt ausführbar. Keine neuen Datenbank-Sicherheitsbefunde oder Performance-Warnungen; bisheriger Auth-Hinweis und ungenutzte Indizes bleiben dokumentiert.

81 Fachlogiktests, 70 Desktop-/Mobilprüfungen, echte lokale Archiv-/Stellplatzbrowser, Rollen/Konkurrenz/Rollback sowie alle 17 Migrationen mit Altbeständen bestehen. Veröffentlichung erfolgt über den vorhandenen GitHub-/Vercel-Ablauf; die öffentliche Abschlussprüfung ist lesend. [Bedienung](INVENTORY.md) · [Prüfungen](VALIDATION.md).

## Fahrzeugdiagramm und Schadenfotos – 3. Oktober 2026

Die achtzehnte additive Migration `damage_diagram_and_photos` ist vor dem App-Deployment im ausgewählten Projekt `nfocyuyuloyjaikkflai` angewendet. Lokale Datei: `20261003064938_damage_diagram_and_photos.sql`; Cloud-Version: `20261003070024`. Die unterschiedlichen Versionsnummern bleiben dokumentiert; bereits angewendete Inhalte nicht ungeprüft nochmals über CLI-Push übertragen.

Die Migration ergänzt optionale Markierungen und eine separate Detailfototabelle. Der bisherige öffentliche Abschlussaufruf bleibt kompatibel. Sein interner Abschluss prüft Schadenfelder, Upload-Eigentümer, Sitzung und Medienpfade und speichert Schäden/Fotoreferenzen atomar mit dem Protokoll. Neue Kopien frieren bekannte und neue Schäden inklusive Fotoreferenzen ein. Bestehende Protokolle werden nicht umgeschrieben. Der private Storage-Bereich wird weiterverwendet; referenzierte Schadenbilder sind gegen Entfernen durch Mitglieder geschützt. Keine neuen Umgebungsvariablen.

RLS, zusammengesetzte Fremdschlüssel, nur lesende Tabellenrechte und die unveränderten privaten/public Abschlussrechte sind in der Cloud bestätigt. Hilfsfunktionen haben keine erhöhten Rechte. Keine neuen Sicherheits- oder Performance-Warnungen; bisheriger Auth-Hinweis und ungenutzte Indizes bleiben dokumentiert.

89 Fachlogiktests, 74 Desktop-/Mobilprüfungen, echte lokale Schaden-/Foto-/PDF-Browser einschließlich verlorener Antwort und Wiederholung sowie alle 18 Migrationen mit Altbeständen bestehen. Veröffentlichung erfolgt über GitHub/Vercel; die öffentliche Smoke-Prüfung legt keine Geschäftsdaten an. [Bedienung](DAMAGES.md) · [Prüfung](VALIDATION.md).
