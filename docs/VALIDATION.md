# Verifikation des ersten MVP

Geprüft am 1. Oktober 2026 lokal unter Windows, Node.js 24.15.0.

| Prüfung | Ergebnis |
|---|---|
| Next.js Produktionsbuild | Erfolgreich |
| TypeScript | Keine Fehler |
| ESLint | Keine Fehler oder Warnungen |
| Fachlogik (Vitest) | 25 Tests bestanden |
| Browser Desktop Chrome | 6 Tests bestanden |
| Browser Pixel 7 | 6 Tests bestanden |
| Supabase-Migration | In isolierter lokaler Instanz angewendet |
| SQL-Berechtigungs-/Workflowprüfungen | Bestanden, alle Fixtures zurückgerollt |
| Auth/REST/Storage/RPC Integration | Bestanden, temporäre Testdaten entfernt |
| Supabase Security/Performance Advisors (warn/error) | Keine Befunde |

Die Browserprüfungen umfassen Pflichtfotos, Unterschrift, rückläufige Kilometer, Schäden, lokal gespeicherte Entwürfe nach Neuladen, Übernahme und Übergabe, PDF-Download, Fahrzeughistorie und die Anlage von Fahrzeugen/Fahrern/Aufträgen. Der mobile Stand hat keinen horizontalen Seitenüberlauf; Tabellen können innerhalb ihrer Fläche gescrollt werden.

Die Datenbankprüfungen umfassen Mandantentrennung, fehlende Schreibrechte für Fahrer, abgelehnte Abschlüsse für lesende Mitglieder, unerlaubte Rollenvergabe, Übergabe vor Übernahme, fehlende Pflichtfotos, rückläufige Kilometer und die Unveränderlichkeit abgeschlossener Protokolle und Auftragszustände.

Die API-Integration prüft echte Anmeldung, Organisationsgründung, Stammdatenanlage, 26 Datei-Uploads, beide atomaren Protokollabschlüsse, unvollständige und doppelte Abschlussversuche, signierte Foto-Downloads, Löschschutz der Evidenz, fortgeschriebene Kilometer/Historie sowie verweigerten anonymen Tabellenzugriff.

Nicht geprüft: vollständiger Echtbetrieb im externen Cloud-Projekt, Produktion auf einer öffentlichen Domain, reale Kameras/HEIC-Bilder, Lastbetrieb, mehrere parallele Geräte, Offline-Synchronisation und rechtliche Beweiskraft. Der getestete Cloud-Stack ist lokal und verwendet eigene Ports; ein bereits vorhandenes fremdes Supabase-Projekt wurde nicht verändert.

Die Erweiterung für mehrere Innenraumfotos wurde ebenfalls auf Desktop und Pixel 7 geprüft: Mehrfachauswahl, Anhängen weiterer Bilder, einzelnes Entfernen, Entwurfswiederherstellung und nummerierte Ausgabe aller verbliebenen Innenraumfotos im PDF. Die lokale Cloud-Prüfung bestätigt drei Innenraumfotos je Protokoll mit stabiler Reihenfolge und kompatiblen Einzelfoto-Protokollen.


Die Bearbeitungsiteration prüft Fahrzeug-/Fahreränderungen, Termin- und Fahrerwechsel, Storno mit Pflichtgrund und Fahrzeugfreigabe. Desktop und Pixel 7 prüfen außerdem einen Konflikt zwischen zwei Tabs und den unveränderten Inhalt eines zuvor abgeschlossenen PDF-Protokolls nach Umplanung. Die Supabase-API-Prüfung bestätigt unveränderte Protokollkopien nach Stammdatenänderungen, veraltete Revisionen, gesperrte Kilometeränderungen während des Transports, Führerscheingültigkeit, gesperrte Bearbeitung abgeschlossener Aufträge und abgewiesene Uploads für stornierte Aufträge. SQL prüft zusätzlich die Ablehnung sämtlicher neuer Schreib-RPCs für lesende Mitglieder.

Teamiteration: 12 Desktop-/Pixel-7-Browsertests bestehen. Die zusätzliche lokale API-Prüfung bestätigt E-Mail-Bindung, bestätigte Identität, einmalige Verwendung, Ablauf/Widerruf, versteckte Token-Hashes, Adminrechte, Schutz des letzten Administrators, Fahrer mit offenen Aufträgen, veraltete Rollenänderungen und sofortigen Verlust von Tabellenzugriff trotz bestehendem JWT.

Die zusätzliche Browserprüfung nutzt getrennte Desktop- und Pixel-7-Sitzungen mit echter lokaler Auth: Administrator legt einen Arbeitsbereich an, Fahrer nimmt Einladung an, sieht ausschließlich seine Aufträge und schließt eine Übernahme mit echten Storage-Uploads ab. Administrator aktualisiert seinen Stand und lädt das PDF. Alle temporären Benutzer, Dateien und Organisationsdaten wurden danach entfernt.

Im ausgewählten externen Projekt nfocyuyuloyjaikkflai wurden fünf Migrationen angewendet, die zehn RLS-geschützten Tabellen geprüft und keine Security-Advisory-Befunde gefunden. Fehlende Fremdschlüsselindizes wurden ergänzt. Ein unbenutzter Index in einer frisch eingerichteten Datenbank ist kein Lasttestergebnis. Der abschließende Smoke-Test bestätigt den Publishable Key, die Einladungsschnittstelle, verweigerten anonymen Fahrzeugzugriff und die Login-/Registrierungsoberfläche. Echter Auth-Mailversand, Veröffentlichung und reale Konten sind noch nicht geprüft.

## Fahrzeugkatalog, Ausstattung und VIN – 2. Oktober 2026

- 31 Fachlogiktests und 18 Browserprüfungen bestehen (je neun auf Desktop und Pixel 7). TypeScript, ESLint und der Produktionsbuild sind erfolgreich.
- Hersteller mit Logo, herstellerabhängige Modelle, Herstellerwechsel mit geleertem Modell, freie Eingabe bestehender/unbekannter Modellnamen und Tastaturauswahl geprüft. Die Suche findet auch den Markenschlüssel „VW“.
- Ausstattung suchen, mehrfach auswählen, speichern, nach Neuladen wiederöffnen und entfernen geprüft. Ausführung und zusätzlicher Freitext bleiben erhalten. Keine horizontale Seitenverbreiterung auf Pixel 7.
- PDF enthält die beim Abschluss gespeicherte Ausstattung und den Freitext auch nach späterer Änderung der Fahrzeugakte. Die Fachlogik prüft eine unabhängige Kopie der Ausstattungsliste im Protokoll.
- Lokale Auth-/REST-/Storage-/RPC-Integration prüft erlaubte Ausstattungswerte, doppelte/ungültige Codes, zu lange Texte, atomare Bearbeitung und unveränderte Protokoll-Snapshots.
- Zwei echte lokale Cloud-Sitzungen prüfen Ausstattung über das Webformular, Speicherung in Postgres, mobilen Protokollabschluss und PDF mit Ausstattung. Die neue VIN-Schnittstelle verweigert anonyme Anfragen, Fahrer und fremde Arbeitsbereiche. Eine echte NHTSA-Abfrage mit einer synthetischen BMW-Test-VIN liefert einen Herstellerhinweis; wegen der falschen Prüfziffer wird kein Modell als vollständig erkannt ausgegeben. Alle temporären Benutzer, Organisationen und Dateien wurden entfernt.
- VIN-UI mit kontrollierten Antworten prüft ausdrückliche Übernahme eines Vorschlags und die weiterhin mögliche manuelle Erfassung bei Dienstausfall. Unvollständige Decoderantworten werden nicht als vollständige Modellbestimmung dargestellt.
- Die sechste Migration ist lokal und im ausgewählten externen Projekt angewendet. Neue Spalten und aktualisierte Speicherfunktion sind dort durch Abfragen bestätigt. Es wurden keine vorhandenen Fahrzeuge verändert und keine alten Protokolle nachträglich angereichert.
- Aktuelle Advisors: keine Datenbank-Sicherheitsbefunde, fünf Hinweise auf unbenutzte Indizes. Auth meldet deaktivierten Schutz gegen kompromittierte Passwörter; die Auth-Einstellung wurde in dieser Fahrzeugiteration nicht geändert.

Screenshots: `manufacturer-picker.png` und `equipment-editor-mobile.png`. Die VIN-Erkennung ist keine Garantie für europäische Modelle oder Werksausstattung; die unterstützte Abdeckung ist in [VEHICLE_CATALOG.md](VEHICLE_CATALOG.md) dokumentiert.

## Kennzeicheneingabe – 2. Oktober 2026

Die Eingabe entspricht einem deutschen Kennzeichen mit EU-Streifen und drei getrennten Feldern. 22 Browserprüfungen (je elf auf Desktop und Pixel 7) bestehen. Neue Kennzeichen werden gespeichert, nach Neuladen in ihre Teile zerlegt und erneut bearbeitet. Großschreibung, führende Nullen, E-Zusatz, Umlaute, mehrdeutige Zulassungsbezirke, unbekannte Kürzel und der Wechsel zur freien Eingabe sind geprüft. Vorhandene Sonderkennzeichen bleiben bei erneuter Bearbeitung erhalten. Die übrigen Abläufe einschließlich Fahrzeuganlage, Konfliktbehandlung, Übernahme, Übergabe und PDF bestehen weiterhin. Die 31 Fachlogiktests, TypeScript und ESLint bestehen ebenfalls.

Die Kennzeichen-Zuordnung liegt lokal vor; es werden keine Fahrzeugangaben für die Ortsanzeige an externe Dienste übertragen. Das Datenbankfeld und die Speicherfunktion verwenden weiterhin den vollständigen Kennzeichentext. Es sind keine Datenbankmigration oder Bestandsänderung erforderlich. Screenshot: `registration-plate.png`.

## GitHub und öffentliche App – 2. Oktober 2026

Der vollständige MVP ist im Repository [imannsv/vehicleops](https://github.com/imannsv/vehicleops) veröffentlicht. Der erste MVP-Commit `e36e01a` wurde durch die Git-Integration als Vercel-Produktion gebaut und steht unter [vehicleops-six.vercel.app](https://vehicleops-six.vercel.app) bereit. Der Build benötigte rund 37 Sekunden. Der zugehörige [GitHub-Actions-Lauf](https://github.com/imannsv/vehicleops/actions/runs/36983014981) besteht einschließlich Lint, 31 Fachlogiktests, Produktionsbuild, Typprüfung und 22 Desktop-/Mobilprüfungen.

Die öffentliche Smoke-Prüfung bestätigt HTTP 200, die Cloud-Login- und Registrierungsoberfläche, das PWA-Manifest, beide Icons und den Service Worker. Die VIN-Route antwortet ohne Anmeldung mit 401 und bei ungültigen Eingaben mit 400. Anonymer Datenbankzugriff bleibt gesperrt. Im Browser wurden keine Laufzeitfehler festgestellt; Vercel meldet für das geprüfte Zeitfenster ebenfalls keine Runtime Errors. Es wurden bei dieser Live-Prüfung keine Benutzerkonten oder Geschäftsdaten angelegt.

Supabase Site URL und vier erlaubte Redirect-Adressen für Produktion/localhost sind im Dashboard gespeichert und sichtbar bestätigt. Ein echter Bestätigungsmailversand wurde in dieser Veröffentlichung nicht ausgelöst. Die öffentliche App nutzt dieselbe bestehende Datenbank. Details: [Deployment](DEPLOYMENT.md).

## Fahrzeugakte, Schlüssel und Recovery – 2. Oktober 2026

- 35 Fachlogiktests und 26 Browserprüfungen auf Desktop/Pixel 7 bestehen. Baujahr/Erstzulassung/Halter werden gespeichert und nach Neuladen geöffnet. Mehrere Anhänge, Vorschau und Entfernen sind geprüft. Die Schlüssel-Checkliste wird bei Übernahme und Übergabe bestätigt. Ein Schlüssel wird nach Übernahme umbenannt; der frühere PDF-Export behält seine ursprüngliche Bezeichnung und enthält keine Halteranschrift.
- Lokale Auth-/REST-/Storage-Integration prüft atomare Fahrzeug-/Halteränderungen, optionale Datumsfelder, Admin-/Dispositionsrechte, Zuschauer/Fahrer/Anonym, private Downloadlinks, Mandantentrennung, Fahrerwechsel und Zugriffsentzug nach Abschluss. Gleichzeitige Schlüsselausgaben erzeugen nur einen Vorgang; doppelte Abschlüsse scheitern ohne weitere Bewegungen. Direkte Änderungen der Bewegungshistorie sind gesperrt.
- Die sieben Migrationen wurden zusammen gegen eine separate Datenbank mit leerem Anwendungsschema installiert. Die Testdatenbank wurde anschließend entfernt. Die bestehende SQL-Suite und alte Abschluss-API bestehen weiter; die lokalen Advisors melden keine Befunde.
- Der mobile lokale Cloud-Browser prüft echte Uploads, kontrollierten 503-Fehler, sichtbaren Fortschritt, Wiederholung, private Bildvorschau und gespeicherte Metadaten. Screenshot: `vehicle-record-cloud-mobile.png`.
- Ein echter Recovery-Link wird aus dem lokalen Maildienst gelesen und im Browser verwendet. Passwortbestätigung, erneutes Laden der gültigen Sitzung, Passwortänderung und Anmeldung mit neuem Passwort bestehen. Alter Login, wiederverwendeter Link, abgelaufener Link und normale Sitzung ohne Recovery werden abgelehnt. Ablauf wird ausschließlich an einem temporären lokalen Testkonto simuliert. Benutzer, Geschäftsdatensätze, Dateien und Testnachrichten werden entfernt.
- Produktiver SMTP-Versand wurde nicht eingerichtet: Anbieter und Absender-Domain fehlen. Die Konfiguration ist dokumentiert. Live-Plattformanbindungen, Inseratveröffentlichung und Offline-Sync gehören nicht zu dieser Iteration.
- Die Fahrzeugakten-Migration ist im ausgewählten externen Projekt angewendet. Alle vier neuen Tabellen haben RLS, `vehicle-files` ist privat mit 10-MB-Limit, die fünf neuen Speicher-/Abschlussfunktionen sind vorhanden. Die anschließende achte Migration ergänzt nach lokaler Prüfung den vollständigen Fremdschlüsselindex der Haltertabelle. Vorhandene Fahrzeuge und Protokolle wurden nicht umgeschrieben.
- Der bereits zuvor bestehende Auth-Hinweis bleibt: [Schutz gegen kompromittierte Passwörter](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) ist deaktiviert. Unbenutzte neue Indizes sind erwartbar, solange die neuen Funktionen noch nicht verwendet wurden; sie werden für Mandantentrennung und Verknüpfungen beibehalten.
