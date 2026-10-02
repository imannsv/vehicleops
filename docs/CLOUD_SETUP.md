# VehicleOps Cloud

Das ausgewählte Projekt ist eingerichtet: https://nfocyuyuloyjaikkflai.supabase.co. Sechs Migrationen wurden angewendet, alle zehn Anwendungstabellen sind durch RLS geschützt, Protokollfotos liegen im privaten Storage. Die lokale App ist mit dem Publishable Key verbunden. Das andere Projekt „meinaudit“ wurde nicht geändert. Die Einrichtung importiert keine Demo-Fahrzeuge; bestehende Benutzerkonten und Fahrzeugdaten bleiben erhalten.

Die öffentliche App läuft unter **[vehicleops-six.vercel.app](https://vehicleops-six.vercel.app)** und nutzt dieselbe Datenbank. Bestehende Konten und Organisationsdaten sind dort verfügbar. Auf jedem Gerät mit dem eigenen Konto anmelden.

## Eigenes Konto einrichten

1. https://vehicleops-six.vercel.app öffnen und „Neues Konto erstellen“ auswählen.
2. Deine E-Mail-Adresse und ein Passwort mit mindestens acht Zeichen eingeben.
3. E-Mail bestätigen und anmelden.
4. Firmenname und deinen Namen eingeben. Du erhältst die Administratorrolle.
5. Fahrzeuge und Fahrer anlegen.

Deine bisherigen lokalen Demodaten bleiben im Browser gespeichert. Der Cloud-Arbeitsbereich beginnt leer.

## Team aufnehmen

Unter „Organisation“ Name, E-Mail und Rolle auswählen und einen Einladungslink erstellen. Den Link selbst an die Person weitergeben. Einladungs-E-Mails werden nicht automatisch versendet. Der Link gilt sieben Tage und lässt sich widerrufen. Die Person meldet sich mit ihrer bestätigten E-Mail-Adresse an oder erstellt ein Konto und nimmt die Einladung an.

Nach der Annahme in der Fahrerkarte über „Fahrer bearbeiten“ das passende Teammitglied verknüpfen. Erst dann kann dieses Fahrer-Konto die zugewiesenen Aufträge dokumentieren. Fahrer sehen in der Auftragsliste ihre eigenen Aufträge. „Aktualisieren“ lädt Änderungen anderer Geräte.

Administratoren ändern Rollen und entfernen Mitglieder. Der letzte Administrator bleibt erhalten. Vor dem Entfernen oder Herabstufen eines Fahrers dessen offene Aufträge neu zuweisen.

## E-Mail-Bestätigung und öffentliche Adresse

Im Supabase-Dashboard unter Authentication → URL Configuration ist https://vehicleops-six.vercel.app als Site URL gespeichert. Produktion und http://localhost:3000 sind als Redirect URLs mit `/` und `/**` erlaubt. Einladungsparameter können so erhalten bleiben. Siehe [Deployment](DEPLOYMENT.md) für die geprüfte Konfiguration.

Die E-Mail-Bestätigung muss für die Einladung aktiv bleiben. Supabase liefert ohne eigenen SMTP-Anbieter Bestätigungsmails nur an freigegebene Adressen von Mitgliedern der Supabase-Organisation. Für weitere Mitarbeiter einen Mailanbieter unter Authentication → Email → SMTP konfigurieren. Noch nicht geprüft: echter Mailversand und Annahme durch reale Mitarbeiter. Details: [Supabase SMTP-Dokumentation](https://supabase.com/docs/guides/auth/auth-smtp).

Die Supabase-Projektadresse ist die Datenbank/API-Adresse. Die Web-App ist über die öffentliche Vercel-Adresse erreichbar. Einladungslinks für andere Geräte in der öffentlichen App erstellen; localhost-Links können andere Geräte nicht öffnen.

## Technische Wiederholbarkeit

Die Browser-Demosuite benötigt einen Demobuild ohne Cloud-Konfiguration:

```powershell
node tests/build-demo.mjs
npm run test:e2e
```

Die Prüfung zweier Cloud-Browser-Sitzungen nutzt ausschließlich den lokalen Supabase-Stack:

```powershell
node tests/build-local-cloud.mjs
npm run start
# In einem zweiten Terminal:
node tests/cloud.browser.mjs
```

Anschließend den Testserver beenden und mit npm run build und npm run start wieder die in .env.local gespeicherte externe Cloud-Anbindung aktivieren. Die Testskripte ändern diese Datei nicht.
