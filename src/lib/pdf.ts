import {exportModernProtocol} from './pdf-modern';
import { jsPDF } from 'jspdf';
import { Data, Handover, protocolSnapshot, shots } from './domain';
import { equipmentLabel } from './vehicle-catalog';
async function imageData(url: string) { if (url.startsWith('data:')) return url; const blob = await (await fetch(url)).blob(); return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob); }); }
export async function exportProtocol(data: Data, h: Handover) {
 if(h.version===2)return exportModernProtocol(data,h);
 const snapshot = h.snapshot ?? protocolSnapshot(data, data.orders.find(o => o.id === h.order_id)!);
 const vehicle=snapshot.vehicle,order=snapshot.order!,driver=snapshot.driver!;
 const pdf = new jsPDF(); let y = 22;
 const line = (text: string, size = 11) => { pdf.setFontSize(size); const lines = pdf.splitTextToSize(text, 170); if (y + lines.length * 6 > 274) { pdf.addPage(); y = 22; } pdf.text(lines, 20, y); y += lines.length * 6 + 3; };
 pdf.setTextColor(25, 43, 66);
 line('VehicleOps / ' + snapshot.organization_name, 12);
 line(h.kind === 'pickup' ? 'Fahrzeugübernahme' : 'Fahrzeugübergabe', 24);
 line(`${order.reference} | ${new Date(h.created_at).toLocaleString('de-DE')}`);
 line(`${vehicle.plate} | ${vehicle.make} ${vehicle.model}`);
 line(`VIN: ${vehicle.vin} | Farbe: ${vehicle.color}`);
 if(vehicle.build_year)line(`Baujahr: ${vehicle.build_year}`);
 if(vehicle.first_registration)line(`Erstzulassung: ${vehicle.first_registration}`);
 if (vehicle.variant) line(`Ausführung: ${vehicle.variant}`);
 if (vehicle.equipment?.length || vehicle.equipment_notes) {
  line('Ausstattung bei Protokollerstellung', 15);
  vehicle.equipment?.forEach(key => line(equipmentLabel(key)));
  if (vehicle.equipment_notes) line(`Weitere Ausstattung: ${vehicle.equipment_notes}`);
 }
 line(`Fahrer: ${driver.name}`);
 line(`Route: ${order.pickup} > ${order.destination}`);
 line(`Kilometerstand: ${h.mileage.toLocaleString('de-DE')} km | Tank/Ladung: ${h.fuel} %`);
 line('Festgestellte Schäden', 15);
 const damages = data.damages.filter(d => d.handover_id === h.id);
 if (!damages.length) line('Keine neuen Schäden dokumentiert.');
 damages.forEach(d => line(`${d.area}: ${d.description}`));
 line(`Anmerkungen: ${h.notes || 'Keine'}`);
 line('Schlüsselbestätigung',15);
 if(!h.key_snapshot?.recorded)line('Schlüsselbestand nicht erfasst.');
 else {line(`${h.key_snapshot.selected.length} von ${h.key_snapshot.expected_count} erfassten aktiven Schlüsseln übergeben.`);h.key_snapshot.selected.forEach(k=>line(`${k.label}${k.identifier?' · '+k.identifier:''}`));if(h.key_snapshot.notes)line(`Abweichung / Hinweise: ${h.key_snapshot.notes}`);}
 if (y > 210) { pdf.addPage(); y = 22; }
 line(`Unterzeichnet von: ${h.signer}`, 12);
 pdf.addImage(await imageData(h.signature), 'PNG', 20, y, 65, 24); y += 33;
 line(`Protokoll-ID: ${h.id}`, 9);
 const photos = [...h.photos].sort((a, b) => shots.findIndex(shot => shot === a.slot) - shots.findIndex(shot => shot === b.slot));
 const interiorCount = photos.filter(photo => photo.slot === 'Innenraum').length;
 let interiorNumber = 0;
 for (let i = 0; i < photos.length; i++) {
  if (i % 2 === 0) { pdf.addPage(); y = 22; line('Fotodokumentation', 18); }
  const photo = photos[i]; line(photo.slot === 'Innenraum' ? `Innenraum ${++interiorNumber} / ${interiorCount}` : photo.slot, 12);
  pdf.addImage(await imageData(photo.url), 'JPEG', 20, y, 170, 100, undefined, 'FAST'); y += 114;
 }
 const pages = pdf.getNumberOfPages();
 for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.setFontSize(8); pdf.text(`${order.reference} | ${h.kind} | Seite ${page}/${pages}`, 20, 287); }
 pdf.save(`${order.reference}-${h.kind === 'pickup' ? 'Uebernahme' : 'Uebergabe'}.pdf`);
}
