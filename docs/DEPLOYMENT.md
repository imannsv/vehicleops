# GitHub und Vercel

Das Arbeitsrepository ist [imannsv/vehicleops](https://github.com/imannsv/vehicleops). Die App liegt direkt im Repository-Hauptverzeichnis.

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
$env:VEHICLEOPS_BASE_URL='https://DEINE-PRODUKTIONSADRESSE'
node tests/cloud.smoke.mjs
```

Die Prüfung liest die lokale Cloud-Konfiguration, überprüft Anmeldung und Registrierung, die geschützte VIN-Route und die Sperre anonymer Datenzugriffe. Sie legt keine Benutzer oder Fahrzeuge an. Ohne `VEHICLEOPS_BASE_URL` wird localhost geprüft.

Supabase Authentication muss die Produktionsadresse als Site URL und erlaubtes Redirect-Ziel enthalten. localhost für die lokale Entwicklung beibehalten. Neue Preview-Adressen nur bei Bedarf als erlaubte Auth-Redirects ergänzen.

## Datenbankänderungen und Wiederherstellung

Neue SQL-Migrationen gehören nach `supabase/migrations`. Git-Pushes wenden sie nicht automatisch auf Supabase an. Schemaänderungen getrennt prüfen und vor einem davon abhängigen App-Deployment anwenden. Angewendete Migrationen nicht nachträglich ändern.

Bei einem fehlerhaften App-Deployment kann im Vercel-Dashboard ein vorheriger erfolgreicher Stand wieder zur Produktion werden. Danach die Ursache per Commit beheben. Datenbankmigrationen werden durch einen App-Rollback nicht zurückgenommen.
