# Bestand, Standorte und Stellplätze

**Standorte** verwaltet feste Standorte mit Namen, Anschrift und einzelnen Stellplätzen. Admin und Disposition dürfen anlegen und bearbeiten; Mitglieder der Organisation dürfen den Bestand lesen. Stellplatznamen sind innerhalb eines Standorts eindeutig.

**Bestand** zeigt Fahrzeuge mit Position, Verfügbarkeit und offenem Auftrag. Kombinierbare Filter: Suche, Standort, Stellplatz, Verfügbarkeit und Transportstatus. Verfügbar bedeutet kein offener Auftrag; zugewiesene Fahrzeuge sind reserviert, übernommene in Transport. Standortzuordnung und Auftragsstatus sind unabhängige Angaben.

Ein Kennzeichen öffnet die Fahrzeugakte. **Fahrzeug umsetzen** wählt Zielstandort und optionalen Stellplatz oder eine freie Angabe. Anlass ist verpflichtend. Belegte Stellplätze sind gesperrt; die Datenbank verhindert gleichzeitige Doppelbelegungen. Konflikte verlangen eine erneute Prüfung der aktuellen Position. **Aktualisieren** lädt Änderungen anderer Benutzer/Tabs; **Aktuelle Position übernehmen und neu prüfen** setzt ein veraltetes Bewegungsformular zurück.

Bestehende Freitextangaben bleiben erhalten. Die Migration erzeugt keine Standorte aus diesen Angaben und ergänzt keine historischen Bewegungen. Fahrzeuge werden bewusst zugeordnet. Löschen/Archivieren von Standorten und Stellplätzen folgt später.

## Übernahme und Übergabe

Übernahme setzt die Position auf „In Transport“ und gibt die feste Standort-/Stellplatzzuordnung atomar frei. Im Transport verhindert die Datenbank manuelles Umsetzen. Übergabe speichert den Zieltext des Auftrags und eine weitere Bewegung; ein ähnlich benannter fester Standort wird nicht abgeleitet. Danach ordnet die Disposition das Fahrzeug dem tatsächlichen Standort und Stellplatz zu.

Die Historie hält Ursprung, Ziel, damalige Bezeichnungen, Anlass, Person, Zeitpunkt und gegebenenfalls Protokoll-ID fest. Umbenennungen ändern alte Bewegungen und Protokollkopien nicht. Standortumbenennung aktualisiert die aktuelle Anzeige ohne eine physische Bewegung zu erfinden.

## Daten und Rechte

- `fleet_sites`: Organisation, Name, Anschrift, Revision.
- `parking_spaces`: Organisation, fester Standort, Bezeichnung, Revision.
- `vehicles.site_id` und `parking_space_id`: optionale Zuordnung neben dem kompatiblen Freitext `location`.
- `vehicle_movements`: unveränderliche Bewegungen mit Ortskopien und optionaler Protokoll-Verknüpfung.

Zusammengesetzte Fremdschlüssel verhindern fremde Zuordnungen. Ein partieller Unique-Index verhindert mehrere Fahrzeuge auf einem Stellplatz. Alle drei neuen Tabellen haben RLS und ausschließlich lesende App-Tabellenrechte. Schreibvorgänge verwenden autorisierte Funktionen; Fahrer/Zuschauer dürfen keine manuellen Bewegungen oder Standortänderungen ausführen. Protokollbewegungen entstehen im autorisierten atomaren Abschluss.

Ältere Fahrzeugbearbeitungsaufrufe bleiben kompatibel: Ändert sich die freie Standortangabe, wird die feste Zuordnung gelöst und die Änderung dokumentiert. Die alte und die neue Abschlussfunktion verwenden dieselbe Positionsfortschreibung. Die additive neunte Migration schreibt vorhandene Fahrzeugdaten und Protokolle nicht um.

## Prüfung

```powershell
npm test
node tests/build-demo.mjs
npm run test:e2e
node tests/inventory.integration.mjs
node tests/records.integration.mjs
```

Nach `node tests/build-local-cloud.mjs` und `npm run start` prüft `node tests/inventory.browser.mjs` tatsächliche Standort-/Stellplatzanlage, feste und freie Positionen, Speicherung, Filter und lesenden Teamzugang. Die Integrationsskripte sind auf den lokalen Supabase-Stack begrenzt und entfernen ihre Fixtures.

Offline-Sync, Standortrechte einzelner Teams, Archivierung und feste Zielstandorte in Aufträgen folgen später. mobile.de bleibt der nächste verbindliche Plattformkanal.
