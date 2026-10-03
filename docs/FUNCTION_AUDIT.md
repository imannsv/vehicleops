# Funktions- und Ablaufprüfung – 3. Oktober 2026

Prüfumgebung: isolierter lokaler Supabase-Stack mit echten Auth-/Storage-Sitzungen und Test-Maildienst; Produktionsbuild im Browser auf Desktop Chrome und Pixel-7-Format. Schreibende Prüfungen verwenden temporäre Organisationen und Konten. Die öffentliche App wird ergänzend lesend geprüft.

| Bereich | Geprüfte Abläufe | Nachweis |
| --- | --- | --- |
| Zugang und Organisation | Anmelden, Organisation anlegen/wechseln, Unternehmensprofil, Logo hochladen/ersetzen/entfernen, Revisionen, nur Administrator bearbeitet | Cloud-Browser, Company-Browser, Team-/Company-Integration, Company-Browsersuite |
| Team und Fahrer | Einladungsannahme, abgelaufene/widerrufene/wiederverwendete Einladung, letzter Administrator, Fahrerzuordnung/-wechsel, Führerscheingültigkeit, lesende Rollen | Team-/Cloud-Integration, Team-/Workflow-Browsersuite |
| Fahrzeugakte | VIN/Bestandsnummer, mehrere Fahrzeuge ohne Kennzeichen, Hersteller/Modell/Baureihe, Ausstattung, Baujahr/Erstzulassung, Halterrechte, Bearbeiten/Neuladen | Vehicle-/Records-/Company-Fachlogik und Browsersuite |
| Suche und Bestand | kombinierte Suche nach Fahrzeugidentität, Standort-/Stellplatzfilter, Transport und Verkaufsstatus getrennt, freie Positionen, optionale Bewegungsbegründung | Inventory-/Vehicle-Search-/Mobile-Inputs-Browsersuite, Inventory-Integration |
| Standorteinrichtung | neues Firmenkonto, erster Standort mit mehreren Plätzen, Nummernreihen, eigene Listen, Vorschau/Dubletten, Suche, Einzelbearbeitung, verlorene Serverantwort und Wiederholung, Rollen/Konkurrenz/Rollback | Parking-Fachlogik, Desktop-/Mobil-Browsersuite, lokale Parking-Integration und Cloud-Browser |
| Standort- und Stellplatzarchiv | archivieren/wiederherstellen, belegte/verplante Bereiche sperren, vergangene Abholung lesbar, archivierte Auswahlen sperren, Wiederherstellung erhält einzeln archivierte Plätze, Revisionen/verlorene Antwort, Parallelaktionen und alte Abschlussaufrufe | Fleet-Archive-Fachlogik/-Integration, Desktop-/Mobil-Browsersuite und lokaler Parking-Cloud-Browser |
| Dateien und Fahrzeugbilder | mehrere Anhänge, privater Zugriff je Rolle/Mandant, echter Upload, kontrollierter Fehler und Wiederholung, Vorschau, Entfernen, Protokollgalerie/Titelbild | Recovery-/Company-Cloud-Browser, Records-/Company-Integration |
| Schadendokumentation | Diagramm und zugängliche Bereichsauswahl, bekannte/neue Schäden, mehrere separate Detailfotos ohne Status, Entfernen/Versetzen, Entwurf, erneutes Signieren, private Vorschau, atomarer Abschluss und eingefrorener PDF-Anhang | Damage-Fachlogik, Desktop-/Mobil-Browsersuite, lokale Damage-Integration und Damage-Cloud-Browser |
| Schlüssel | Erfassung, Ausgabe/Rückgabe/Verlust/Ausmusterung, konkurrierende Ausgabe, Abweichungsbegründung, unveränderliche Bewegungen und frühere Bezeichnungen | Records-Integration, Records-/Workflow-Browsersuite |
| Aufträge | Anlegen/Umplanen, freie und feste Route, gespeicherte Navigationsadresse, Transportkennzeichen bearbeiten, Fahrerwechsel, Storno vor Abholung, Abholung nach Übernahme gesperrt | Cloud-/Route-Integration, Workflow-/Route-Browsersuite |
| Fahrerablauf | eigene nächste Abholung beziehungsweise aktuelle Fahrt, Kontakt, Navigation, direkter Protokollstart, keine fremden Aufträge | Route-Fachlogik, echter mobiler Cloud-Browser |
| Protokolle | Übernahme/Übergabe und eigenständige Vorgänge, Pflichtperspektiven, mehrere Innenraumfotos, Schäden, mindestens eine Signatur und begründete Ausnahme, Unterschriften bei Änderungen löschen | Company-/Cloud-/Records-/Route-Integration, Company-/Workflow-/Route-Browsersuite |
| Position beim Abschluss | Stellplatzfreigabe, ausdrückliche tatsächliche Position, belegter Platz und Alternative, Standort-/Stellplatzrevision, Konkurrenz/Rollback, identische Wiederholung, kein automatischer Verkaufsstatuswechsel | Route-Integration und Route-Browsersuite |
| Entwurf und Historie | Neuladen, Fahrzeug-/Unternehmensrevision, Fotos erhalten bei erneuter Prüfung, aktualisierten Datenstand laden, unveränderte frühere Protokolle/PDFs | Company-/Workflow-/Route-Browsersuite |
| PDF und ältere Clients | Fotoanhang, Schlüssel/Beteiligte, Firma/Logo/Route/Position eingefroren, keine Halteranschrift, älteres Ein-Signatur-PDF und bisherige Abschlussfunktionen | Company-Cloud-Browser, Company-/Workflow-/Route-Browsersuite, bestehende SQL-Suite |
| Passwort-Recovery | echte lokale E-Mail, Passwortbestätigung, gültige Sitzung nach Reload, neues Passwort anmelden, abgelaufener/wiederverwendeter Link, normale Sitzung ohne Recovery | Recovery-Cloud-Browser mit lokalem Maildienst |
| PWA und mobile Eingaben | Manifest/Icons/Service Worker, tatsächlicher Offline-Fallback mit Wiederverbindung, Mindestschriftgröße ohne Zoomsperre, numerische Eingabemodi, Telefonnummern, Layoutbreite | Public Smoke, separate lokale Offline-Browserprüfung, Mobile-Inputs-Suite und Public-Mobile-Smoke |
| Datenbankmigration | alle 18 Migrationen aus leerem Anwendungsschema mit alten Fahrzeug-/Auftrags-/Protokoll-/Fotodatensätzen, IDs und Historie erhalten, Rollen/Mandanten | separate temporäre Testdatenbank, bestehende SQL-Suite, lokale Advisors |
| Vorbereiteter Plattformimport | bestehende Fachlogik/Dateiimport als Regression mit kontrollierten Antworten | Mobile-Import-Suite und lokale Integration; kein echter Händlerzugang |

## Gefundene und korrigierte Probleme

- Cloud-Auftragsbearbeitung ließ das Transportkennzeichen aus; die Speicherfunktion übernimmt es jetzt.
- Escape im Hersteller-/Modellkatalog erreichte vorzeitig das äußere Formular; zuerst schließt der Katalog, danach das Formular.
- Ein voreingestellter Tankstand konnte eine unbeobachtete Angabe suggerieren; neue Protokolle beginnen ohne Tankangabe.
- Eine veränderte Fahrzeugakte ließ einen gespeicherten Entwurf ohne erneute Prüfmöglichkeit zurück; die Oberfläche erhält Medien, übernimmt die aktuelle Revision bewusst und verlangt neue Bestätigung.
- Eine geplante Route wurde bislang nur als Freitext fortgeschrieben; feste Planung und tatsächlich bestätigte Ankunft sind jetzt getrennt.
- Eine nachträglich geänderte Standort-/Stellplatzbezeichnung darf keine bereits geprüfte Position ersetzen; Revisionen und atomare Belegungsprüfung schützen den Abschluss.
- Ein verspätet geladenes Unterschriftsbild konnte nach einer Änderung erneut gezeichnet werden; verworfene Ladevorgänge werden abgebrochen.
- Fahrer in Autohausorganisationen starteten beim Bestand; sie starten jetzt bei ihren eigenen Aufträgen.

## Ergebnisse und Grenzen

89 Fachlogiktests und 74 Desktop-/Mobilbrowserprüfungen. Zusätzlich sind die lokalen Auth-/Storage-/Datenbankintegrationen geprüft; die aktuelle Schadenerweiterung prüft Rollen/Mandanten, Fahrerauftrag, private Bildzuordnungen, alte Aufrufe, Abschluss-Rollback, unveränderte frühere Kopien und konkurrierende Wiederholung gegen den lokalen Stack. Der echte lokale Damage-Browser prüft Bilderuploads, private Vorschauen, verlorene Abschlussantwort, Wiederholung und Neuladen. Build, Typprüfung und Lint sind Bestandteil der Prüfung. Testdaten und Testdateien werden aufgeräumt. Der letzte veröffentlichte Stand und zugehörige Prüfungen werden in [Deployment](DEPLOYMENT.md) dokumentiert.

Nicht geprüft sind der ausdrücklich zurückgestellte echte mobile.de-Händlerzugang, produktiver SMTP-Versand und Gerätefunktionen eines physischen iPhones. Die Browserprüfung bestätigt Schriftgrößen und Eingabemodi; die tatsächlich eingeblendete iOS-Tastatur/Safari-Zoomreaktion benötigt ein reales Gerät. Offline-Sync ist noch nicht umgesetzt. Ein automatisierter Prüflauf ersetzt keinen späteren Pilotbetrieb mit echten Abläufen.
