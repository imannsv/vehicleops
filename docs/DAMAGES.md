# Schäden markieren und mit Detailfotos dokumentieren

In Übernahme und Übergabe zeigt **Schäden dokumentieren** das Fahrzeug von oben. Die Front liegt oben, links/rechts entsprechen dem bestehenden Rundgang. Tippen auf das Diagramm legt einen neuen Schaden an; Bereichsschaltflächen sind auch per Tastatur bedienbar. Die vorgeschlagene Bereichsbezeichnung kann präzisiert werden, zum Beispiel „Felge vorne rechts“. **Markierung versetzen** und **Markierung entfernen** ändern nur den aktuellen Entwurf. Innenraum und andere nicht im Diagramm abbildbare Bereiche lassen sich ohne Markierung erfassen.

**Bekannt** (grau, B) stammt aus früheren abgeschlossenen Protokollen; **Neu** (orange, N) gehört zum aktuellen Entwurf. Beide Gruppen werden ausdrücklich getrennt angezeigt. Es gibt keinen Schadenstatus und keine Reparaturverwaltung. Die Fahrzeugakte zeigt alle protokollierten Schäden mit Diagramm, Beschreibung und aufklappbaren Detailfotos. Bilder laden bei Bedarf, lassen sich vergrößert öffnen und verwenden erneuerbare private Links.

## Eingaben und Fotos

- Bereich und Beschreibung sind erforderlich: höchstens 120 beziehungsweise 2.000 Zeichen.
- Bis zu 50 neue Schäden je Protokoll, bis zu zehn Detailfotos je Schaden.
- JPEG, PNG oder WebP bis 10 MB je Quelldatei. Die Oberfläche prüft die Datei, normalisiert sie als JPEG und begrenzt die längste Bildseite auf 1.600 Pixel.
- **Bilder hinzufügen** erlaubt Mehrfachauswahl; **Foto aufnehmen** öffnet die Gerätekamera, soweit das Gerät dies unterstützt. Entfernen und erneutes Auswählen sind im Entwurf möglich.
- Detailfotos und Markierung sind optional. Sie ersetzen keine der zehn Pflichtperspektiven. Alte Schäden erhalten keine erfundenen Bilder oder Positionen.

Entwürfe speichern die Schadenkennungen, Markierungen und Bilder auf dem Gerät. Änderungen an Schäden oder Detailfotos verwerfen beide Entwurfsunterschriften. Vor dem Abschluss wird der gesamte Inhalt erneut geprüft.

## Speicherung, Rechte und Historie

Admin und Disposition dokumentieren Schäden in eigenständigen und Transportprotokollen. Fahrer dürfen dies nur in ihrem aktuell zugewiesenen Auftrag. Mitglieder derselben Organisation lesen Schäden und deren Detailfotos; die bisherigen strengeren Halter-/Dokumentrechte bleiben unabhängig davon erhalten. Direkte Änderungen abgeschlossener Schäden oder Fotozuordnungen sind für App-Mitglieder gesperrt.

`damages.marker` speichert optionale Prozentkoordinaten. `damage_photos` führt eindeutige Foto-IDs, Organisations-/Schadenzuordnung, Reihenfolge und private Pfade. Zusammengesetzte Fremdschlüssel und RLS verhindern fremde Zuordnungen. Dateien liegen im bestehenden privaten Bereich `protocol-media`; die Abschlussfunktion prüft Sitzung, Upload-Eigentümer, Dateityp und Protokollpfad. Verwendete Dateien können vom Mitglied nicht entfernt werden. Allgemeine Fahrzeugbilder und Rundgang bleiben getrennt.

Protokoll, Schäden, Fotozuordnungen, Fahrzeugzustand, Position und Schlüsselbewegungen werden gemeinsam abgeschlossen. Ein Fehler nimmt alle Geschäftsdatenänderungen zurück. Wiederholung desselben Inhalts und konkurrierende identische Abschlüsse erzeugen keine doppelten Datensätze. Andere Inhalte unter derselben Protokoll-ID werden abgewiesen.

Neue Protokollkopien frieren bekannte und neue Schäden einschließlich Markierungen und Fotoreferenzen ein. Webansicht und PDF lesen diese Kopien. Der neue PDF-Anhang enthält nummerierte Schadenmarkierungen und proportionale Detailfotos mit Herkunft „Bekannt“/„Neu“. Bestehende Protokollkopien und ältere PDFs werden nicht ergänzt. Ältere Abschlussaufrufe ohne Markierungen/Fotos bleiben kompatibel.

## Prüfung

```powershell
npm test
node tests/build-demo.mjs
npm run test:e2e
node tests/damages.integration.mjs
```

Nach `node tests/build-local-cloud.mjs` und `npm run start`: `node tests/damages.browser.mjs`. Das Skript prüft echte Desktop-/Mobil-Sitzungen, Bilderuploads, private Vorschauen, einen verlorenen Abschlussantwortfall mit sicherer Wiederholung, Neuladen und lesende Zuschauer. Temporäre Konten, Daten und Medien werden entfernt.

Die API-Prüfung umfasst Mandanten/Rollen, Fahrerauftrag, ungültige Markierungen und Fotozuordnungen, Pflichtperspektiven, Grenzen, Abschluss-Rollback, unveränderte frühere Kopien und konkurrierende Wiederholung. Diagramm, Kameraeingaben und mobile Layoutbreite werden im Browser geprüft; die tatsächliche Kamera und iOS-Bedienung benötigen einen späteren Test auf einem physischen Gerät.
