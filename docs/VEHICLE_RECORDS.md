# Fahrzeugakte, Schlüssel und Wiederherstellung

## Bedienung

Unter **Fahrzeuge → Kennzeichen → Fahrzeug bearbeiten** lassen sich Baujahr, Erstzulassung und Halter ergänzen. Die Datumsangaben sind unabhängig und optional. Ein VIN-Modelljahr ist kein bestätigtes Baujahr. Bei bestehenden Fahrzeugen bleiben fehlende Zusatzangaben leer.

Beim Anlegen/Bearbeiten können mehrere Fahrzeugfotos, Fahrzeugscheine und weitere Dokumente ausgewählt werden. Nach dem Speichern werden sie in der Fahrzeugakte hochgeladen. Dort lassen sich weitere Dateien auswählen, Vorschauen öffnen, Dateien herunterladen oder einzeln entfernen. Ein fehlgeschlagener Upload zeigt **Erneut versuchen**; die Stammdaten bleiben gespeichert. JPEG, PNG und WebP sind für Bilder erlaubt, zusätzlich PDF für Dokumente, maximal 10 MB je Datei. Protokollfotos und Fahrzeugakten-Anhänge bleiben getrennt.

## Daten und Zugriffsrechte

`vehicles` erhält nullable `build_year` und `first_registration` sowie `keys_recorded` und `keys_revision`. `vehicle_holders` und `vehicle_assets` sind separate organisationsgebundene Datensätze mit zusammengesetzter Fahrzeugzuordnung. Baujahr/Erstzulassung und Halter werden gemeinsam über `save_vehicle_record` gespeichert; bei Konflikten oder ungültigen Angaben wird die gesamte Änderung zurückgerollt.

| Rolle | Allgemeine Fahrzeugfotos | Halter / Dokumente | Bearbeitung |
| --- | --- | --- | --- |
| Admin / Disposition | Eigene Organisation | Eigene Organisation | Ja |
| Fahrer | Eigene Organisation | Fahrzeug mit eigenem offenen Auftrag | Nur Schlüsselbestätigung im eigenen Auftrag |
| Zuschauer | Eigene Organisation | Kein Zugriff | Nein |
| Anderer Mandant / anonym | Kein Zugriff | Kein Zugriff | Nein |

RLS prüft den aktuell zugeordneten Fahrer und Auftragsstatus `assigned`/`in_transit`. Nach Fahrerwechsel oder Abschluss werden keine neuen Dokumentlinks ausgestellt. Bereits ausgestellte Links gelten höchstens fünf Minuten. Der private Bucket `vehicle-files` hat eigene Upload-, Lese- und Löschregeln. Metadaten werden erst nach Prüfung des hochgeladenen Storage-Objekts registriert. Anhänge und Halteranschriften gelangen nicht in allgemein lesbare Protokollkopien. [Storage-Rechte](https://supabase.com/docs/guides/storage/security/access-control).

## Schlüssel

Jeder Schlüssel hat Bezeichnung, optionale Kennung, Aufbewahrungsort und Zustand. **Nicht erfasst** ist ein eigener Zustand. **Bestätigen: keine Schlüssel vorhanden** erfasst ausdrücklich null Schlüssel. Die Anzahl wird aus den Schlüsselakten berechnet; ausgemusterte Schlüssel erscheinen weiter in der Historie.

Admin und Disposition können erfassen, bearbeiten, ausgeben, zurücknehmen, Verlust dokumentieren und ausmustern. Ausgabe/Rückgabe benötigen Person und Aufbewahrungsort; Verlust/Ausmusterung benötigen eine Person. Die unveränderliche `key_movements`-Historie speichert Person, Zeitpunkt, dokumentierendes Mitglied und damalige Bezeichnung. App-Konten können Schlüssel und Bewegungen nicht direkt schreiben.

Übernahme/Übergabe zeigen aktive Schlüssel als Checkliste. Auswahl und Bestätigung sind bei erfasstem Bestand erforderlich; fehlende Schlüssel müssen begründet werden. `finalize_handover_v2` speichert Protokoll, Schlüssel-Snapshot und Bewegungen atomar und sperrt Auftrag/Fahrzeug. Revisionen verhindern konkurrierende Ausgaben, doppelte Abschlüsse und stille Überschreibungen. Fahrer dürfen dies ausschließlich im zugewiesenen Auftrag ausführen.

Alte Protokolle bleiben unverändert; PDFs verwenden gespeicherte Schlüsselkopien. Die alte Abschlussfunktion bleibt für ältere App-Versionen verfügbar und erzeugt keine erfundene Schlüsselbestätigung.

## Passwort-Wiederherstellung

**Passwort vergessen?** sendet über Supabase Recovery einen Link mit neutraler Rückmeldung. `/auth/reset-password` verlangt eine Recovery-Sitzung und übereinstimmende Passwörter mit mindestens acht Zeichen. Nach Änderung und Abmeldung führt der Rückweg zur Anmeldung. Eine normale Sitzung allein öffnet das Formular nicht. Abgelaufene oder verwendete Links zeigen einen Hinweis; Einladungstoken bleiben beim Rückweg erhalten.

Ein lokaler benutzergebundener Recovery-Marker erlaubt erneutes Laden innerhalb von 15 Minuten. Supabase Auth autorisiert weiterhin die Passwortänderung. [Recovery-Referenz](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

### Lokaler Test

Lokale Ports: API 55421, Postgres 55422, Mailpit 55424. Mailpit beim Start nicht ausschließen. Nach `node tests/build-local-cloud.mjs` und `npm run start`:

```powershell
node tests/records.integration.mjs
node tests/recovery.browser.mjs
```

Die Tests erstellen ausschließlich lokale temporäre Benutzer, Daten und Dateien und entfernen sie anschließend. Recovery liest nur Nachrichten an diese Testadressen und prüft echten Mailversand, Link-Verwendung, Bestätigung, erneutes Laden, neues Passwort, verwendete und abgelaufene Links. Die Ablaufzeit eines ausschließlich dafür erzeugten Kontos wird lokal zurückgesetzt. Der mobile Browser prüft private Uploads einschließlich kontrolliertem Fehler und Wiederholung.

### Produktives SMTP: externe Voraussetzung offen

Mailanbieter und Absender-Domain fehlen noch. Sobald sie vorliegen:

1. Absender und Domain beim Anbieter verifizieren; SPF/DKIM einrichten und Zustellung prüfen.
2. Supabase **Authentication → Email → SMTP Settings** mit Host, Port, Benutzer, Passwort, Absenderadresse und Anzeigename konfigurieren. Zugangsdaten gehören nicht in Git oder Browservariablen.
3. Site URL `https://vehicleops-six.vercel.app` und erlaubtes Redirect `https://vehicleops-six.vercel.app/**` verwenden; Recovery-Ziel ist `/auth/reset-password`.
4. Recovery-Vorlage mit Supabase `ConfirmationURL` prüfen und Link-Tracking ausschalten, damit der Einmallink unverändert bleibt.
5. Bestätigung und Recovery mit eigenen freigegebenen Testkonten auf der Produktionsdomain prüfen, Limits und Zustellfehler beobachten.

Der Supabase-Standardversand ist kein fertig eingerichteter eigener SMTP-Versand. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Offline-Sync und Live-Plattformanbindungen folgen später.
