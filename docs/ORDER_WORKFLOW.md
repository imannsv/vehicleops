# Auftragsplanung und Fahrerablauf

## Route planen

Admin und Disposition wählen im Auftrag für Abholung und Ziel entweder einen festen Unternehmensstandort oder eine freie Kundenadresse. Ein Zielstellplatz ist optional. Standortnamen und Navigationsanschriften werden beim Auswählen als Planungsstand gespeichert; eine spätere Standortbearbeitung schreibt diese Route nicht um. Bei einem bereits übernommenen Fahrzeug bleibt die Abholung einschließlich Standortzuordnung fest. Das Ziel, der Fahrer, der Termin, der Ansprechpartner und das Transportkennzeichen bleiben umplanbar.

Belegte Stellplätze sind als solche gekennzeichnet. Der eigene aktuelle Stellplatz darf als zukünftiges Ziel verwendet werden. Ein vorgemerkter Zielstellplatz wird **nicht reserviert**: mehrere Transporte können denselben zukünftigen Platz vorsehen. Die aktuelle Belegung ist erst beim Abschluss verbindlich. Dieser Ablauf benötigt keine künstlichen Stellplatzreservierungen für noch nicht angekommene Fahrzeuge.

## Übernahme und tatsächliche Übergabe

Bei Übernahme werden der bisherige Standort und Stellplatz atomar freigegeben; die Fahrzeugposition lautet anschließend „In Transport“. Der Vorgangsort im neuen Protokoll ist die Abholung, nicht dieser nachfolgende Transportstatus.

Bei Übergabe schlägt der Entwurf den geplanten Zielstandort und Stellplatz vor. Die Person muss die tatsächliche Position ausdrücklich bestätigen und darf einen anderen Standort, einen anderen freien Stellplatz oder eine freie Kundenadresse angeben. Ein mittlerweile belegter Zielplatz blockiert den Abschluss; die Oberfläche bietet Alternativen. Die Position wird gemeinsam mit Protokoll, Auftragsstatus, Schäden, Schlüsseln und Bewegung gespeichert. Eine fehlgeschlagene oder konkurrierende Belegung hinterlässt keine Teiländerungen. Identische Wiederholungen erzeugen keine weiteren Vorgänge.

Standort- und Stellplatzrevisionen verhindern, dass zwischen Prüfung und Abschluss geänderte Bezeichnungen unbemerkt übernommen werden. Nach einer Änderung müssen die aktuellen Angaben neu geprüft, die Position bestätigt und erneut unterschrieben werden. Das neue PDF zeigt die eingefrorene Planungsroute sowie die tatsächliche Position und Stellplatzbezeichnung. Ein verkauftes oder vermietetes Fahrzeug behält seinen Verkaufs-/Vermietungsstatus während der Überführung.

## Fahrer auf dem Handy

Fahrer starten bei ihren Aufträgen, auch wenn das Unternehmensprofil „Autohaus“ gewählt ist. Die Karte zeigt zuerst eine laufende Fahrt, danach die nächste eigene Abholung nach Termin. Fahrzeug, Ansprechpartner, Route, Navigation und Protokollstart stehen zusammen. Weitere eigene Aufträge bleiben in der Liste erreichbar. Navigation verwendet die gespeicherte Standortanschrift beziehungsweise die freie Kundenadresse. Ein Telefonlink erscheint nur bei einer erkennbaren Telefonnummer; ein Ansprechpartner ohne Nummer bleibt sichtbar.

## Entwürfe und Beobachtungen

Der Tank-/Ladestand ist bei neuen Protokollen leer und muss tatsächlich erfasst werden. Änderungen nach dem Unterschreiben setzen beide Entwurfsunterschriften zurück. Bei einer veralteten Fahrzeugakte können aktuelle Angaben bewusst übernommen werden; Fotos und Hinweise bleiben erhalten, Position, Schlüssel und Unterschriften müssen erneut geprüft werden. Nach einem Abschlusskonflikt lässt sich der aktuelle Datenstand laden und das Protokoll erneut öffnen. Bei einer umgeplanten oder nicht mehr zugewiesenen Fahrt gelten die aktuelle Zuordnung und ein neuer Auftragsstand.

## Daten und Kompatibilität

`orders` erhält additive optionale Standort-/Stellplatz-Fremdschlüssel sowie gespeicherte Navigationsanschriften. Zusammengesetzte Fremdschlüssel begrenzen Zuordnungen auf Organisation und Zielstandort. Vorhandene freie Aufträge behalten leere Zusatzfelder. Alte Textänderungen lösen eine veraltete feste Zielzuordnung; sie überschreiben weder Zulassungskennzeichen noch Fahrzeugidentität. Die öffentliche Bearbeitungsfunktion behält Namen und Argumente und speichert nun auch Änderungen am Transportkennzeichen.

Neue App-Abschlüsse senden `position_version: 1` mit bestätigter Position und gegebenenfalls Standort-/Stellplatzrevision. Frühere Abschlussaufrufe für vorhandene freie Aufträge bleiben kompatibel und behaupten keine feste tatsächliche Zuordnung. Alte Protokolle und PDFs bleiben unverändert.

## Prüfung

`tests/order-route.test.ts`, `tests/browser/order-route.spec.ts` und `tests/order-route.integration.mjs` prüfen Planungsadressen, Rollen/Mandanten, Fahrerreihenfolge, freie Kundenorte, belegte und konkurrierende Zielplätze, Stellplatzfreigabe, bestätigte Alternativen, Revisionen, Rollback, Wiederholung, PDF und Entwurfswiederherstellung. Die Integration verwendet ausschließlich den lokalen Supabase-Stack und entfernt Konten, Datensätze und Dateien danach. Weitere Abdeckung: [Funktionsprüfung](FUNCTION_AUDIT.md).

Live-mobile.de-Tests, Stellplatzreservierungen, Offline-Sync und Standortarchivierung gehören nicht zu dieser Iteration.
