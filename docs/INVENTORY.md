# Bestand, Standorte und Stellplätze

**Standorte** verwaltet feste Standorte mit Namen, Anschrift und einzelnen Stellplätzen. Admin und Disposition dürfen anlegen und bearbeiten; Mitglieder der Organisation dürfen den Bestand lesen. Stellplatznamen sind innerhalb eines Standorts eindeutig.

**Bestand** zeigt Fahrzeuge mit Position, Verfügbarkeit und offenem Auftrag. Kombinierbare Filter: Suche, Standort, Stellplatz, Verfügbarkeit und Transportstatus. Verfügbar bedeutet kein offener Auftrag; zugewiesene Fahrzeuge sind reserviert, übernommene in Transport. Standortzuordnung und Auftragsstatus sind unabhängige Angaben.

Der Fahrzeugtitel öffnet die Fahrzeugakte; Fahrzeuge ohne Kennzeichen bleiben über Bestandsnummer und VIN identifizierbar. **Fahrzeug umsetzen** wählt Zielstandort und optionalen Stellplatz oder eine freie Angabe. Anlass ist optional. Ohne Eingabe hält die Historie die neutrale Beschreibung „Fahrzeug umgesetzt“ fest, weiterhin mit Ursprung, Ziel, Person und Zeitpunkt. Belegte Stellplätze sind gesperrt; die Datenbank verhindert gleichzeitige Doppelbelegungen. Konflikte verlangen eine erneute Prüfung der aktuellen Position. **Aktualisieren** lädt Änderungen anderer Benutzer/Tabs; **Aktuelle Position übernehmen und neu prüfen** setzt ein veraltetes Bewegungsformular zurück.

Bestehende Freitextangaben bleiben erhalten. Die Migration erzeugt keine Standorte aus diesen Angaben und ergänzt keine historischen Bewegungen. Fahrzeuge werden bewusst zugeordnet. Löschen/Archivieren von Standorten und Stellplätzen folgt später.

## Übernahme und Übergabe

Übernahme setzt die Position auf „In Transport“ und gibt die feste Standort-/Stellplatzzuordnung atomar frei. Im Transport verhindert die Datenbank manuelles Umsetzen. Die neue Übergabe schlägt den geplanten Standort und Stellplatz vor; die tatsächlich bestätigte Position wird beim Abschluss atomar übernommen. Eine belegte Planung lässt sich vor dem Unterschreiben ändern. Ältere Abschlussaufrufe verwenden weiterhin freie Zieltexte und leiten keinen ähnlich benannten festen Standort ab. Details: [Auftragsplanung und Fahrerablauf](ORDER_WORKFLOW.md).

Die Historie hält Ursprung, Ziel, damalige Bezeichnungen, Anlass, Person, Zeitpunkt und gegebenenfalls Protokoll-ID fest. Umbenennungen ändern alte Bewegungen und Protokollkopien nicht. Standortumbenennung aktualisiert die aktuelle Anzeige ohne eine physische Bewegung zu erfinden.

## Daten und Rechte

- `fleet_sites`: Organisation, Name, Anschrift, Revision.
- `parking_spaces`: Organisation, fester Standort, Bezeichnung, Revision.
- `vehicles.site_id` und `parking_space_id`: optionale Zuordnung neben dem kompatiblen Freitext `location`.
- `vehicle_movements`: unveränderliche Bewegungen mit Ortskopien und optionaler Protokoll-Verknüpfung.

Zusammengesetzte Fremdschlüssel verhindern fremde Zuordnungen. Ein partieller Unique-Index verhindert mehrere Fahrzeuge auf einem Stellplatz. Alle drei neuen Tabellen haben RLS und ausschließlich lesende App-Tabellenrechte. Schreibvorgänge verwenden autorisierte Funktionen; Fahrer/Zuschauer dürfen keine manuellen Bewegungen oder Standortänderungen ausführen. Protokollbewegungen entstehen im autorisierten atomaren Abschluss.

Ältere Fahrzeugbearbeitungsaufrufe bleiben kompatibel: Ändert sich die freie Standortangabe, wird die feste Zuordnung gelöst und die Änderung dokumentiert. Beide Abschlussfunktionen geben bei Übernahme den Stellplatz frei; neue Abschlüsse unterstützen zusätzlich ausdrücklich bestätigte feste Ziele. Die additive neunte Migration schreibt vorhandene Fahrzeugdaten und Protokolle nicht um.

## Prüfung

```powershell
npm test
node tests/build-demo.mjs
npm run test:e2e
node tests/inventory.integration.mjs
node tests/records.integration.mjs
```

Nach `node tests/build-local-cloud.mjs` und `npm run start` prüft `node tests/inventory.browser.mjs` tatsächliche Standort-/Stellplatzanlage, feste und freie Positionen, Speicherung, Filter und lesenden Teamzugang. Die Integrationsskripte sind auf den lokalen Supabase-Stack begrenzt und entfernen ihre Fixtures.

Feste Abhol-/Zielstandorte, optionale Zielstellplätze und bestätigte Ankunft sind umgesetzt. Offline-Sync, Standortrechte einzelner Teams und Archivierung folgen später. Der echte mobile.de-Anbindungstest bleibt auf Wunsch zurückgestellt.
