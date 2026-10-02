'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Data, Driver, Order, Vehicle, isActiveOrder } from '@/lib/domain';
import { VehicleFields } from './vehicle-fields';
export type DialogKind = 'vehicle' | 'driver' | 'order' | 'cancel';
export function EntityDialog({ kind, initial, data, cloud, busy, error, onClose, onSubmit }: {
  kind: DialogKind; initial: Vehicle | Driver | Order | null; data: Data; cloud: boolean; busy: boolean; error: string;
  onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = ref.current!;
    modal.querySelector<HTMLElement>('input,select,textarea')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled)'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    modal.addEventListener('keydown', handleKey);
    return () => { modal.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [busy, onClose]);
  const vehicle = kind === 'vehicle' ? initial as Vehicle | null : null;
  const driver = kind === 'driver' ? initial as Driver | null : null;
  const order = kind === 'order' || kind === 'cancel' ? initial as Order | null : null;
  const inTransit = order?.status === 'in_transit';
  const vehicleInTransit = !!vehicle && data.orders.some(o => o.vehicle_id === vehicle.id && o.status === 'in_transit');
  const title = kind === 'cancel' ? 'Auftrag stornieren' : kind === 'vehicle' ? initial ? 'Fahrzeug bearbeiten' : 'Fahrzeug hinzufügen' : kind === 'driver' ? initial ? 'Fahrer bearbeiten' : 'Fahrer hinzufügen' : initial ? 'Auftrag bearbeiten' : 'Neuer Auftrag';
  const scheduled = order ? new Date(new Date(order.scheduled_at).getTime() - new Date(order.scheduled_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return <div className="modal-backdrop" onClick={() => !busy && onClose()}><section ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}>
    <div className="section-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" type="button" aria-label="Schließen" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    {error && <div role="alert" className="alert">{error}</div>}
    {inTransit && kind === 'order' && <p className="muted small dialog-note">Das Fahrzeug wurde übernommen. Fahrzeug und Abholort bleiben fest; Fahrer, Ziel, Termin und Ansprechpartner können aktualisiert werden.</p>}
    {kind === 'order' && initial && <p className="muted small dialog-note">Nach einer Änderung beginnt ein neuer Protokollentwurf. Bereits abgeschlossene Protokolle bleiben erhalten.</p>}
    {kind === 'cancel' && <p className="muted dialog-note">{order?.reference} wird storniert. Das Fahrzeug steht danach wieder für neue Aufträge zur Verfügung. Der Auftrag bleibt mit Begründung in der Historie erhalten.</p>}
    <form onSubmit={onSubmit}><fieldset disabled={busy} className="inspection-fields"><div className="form-grid">
      {kind === 'vehicle' && <VehicleFields vehicle={vehicle} inTransit={vehicleInTransit} organizationId={data.organization.id} holder={data.holders?.find(h=>h.vehicle_id===vehicle?.id)} />}
      {kind === 'driver' && <>
        <label className="span-2">Name<input name="name" required defaultValue={driver?.name} /></label><label>E-Mail<input name="email" type="email" required defaultValue={driver?.email} /></label>
        <label>Telefon<input name="phone" required defaultValue={driver?.phone} /></label><label className="span-2">Führerschein gültig bis<input name="license_valid_until" type="date" required defaultValue={driver?.license_valid_until} /></label>
        {cloud && <label className="span-2">Teammitglied (optional)<select name="user_id" defaultValue={driver?.user_id ?? ''}><option value="">Noch nicht verknüpft</option>{data.members.filter(m => m.role === 'driver').map(m => <option key={m.id} value={m.user_id}>{m.name}</option>)}</select></label>}
      </>}
      {kind === 'order' && <>
        <label className="span-2">Fahrzeug<select aria-label="Fahrzeug" name="vehicle_id" required defaultValue={order?.vehicle_id ?? ''} disabled={inTransit}><option value="">Fahrzeug auswählen</option>{data.vehicles.filter(v => v.id === order?.vehicle_id || !data.orders.some(o => o.vehicle_id === v.id && isActiveOrder(o))).map(v => <option key={v.id} value={v.id}>{v.plate} · {v.make} {v.model}</option>)}</select></label>
        {inTransit && <input type="hidden" name="vehicle_id" value={order!.vehicle_id} />}
        <label className="span-2">Fahrer<select aria-label="Fahrer" name="driver_id" required defaultValue={order?.driver_id ?? ''}><option value="">Fahrer auswählen</option>{data.drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>Abholort<input name="pickup" required defaultValue={order?.pickup} readOnly={inTransit} /></label><label>Zielort<input name="destination" required defaultValue={order?.destination} /></label>
        <label className="span-2">Datum & Uhrzeit<input name="scheduled_at" type="datetime-local" required defaultValue={scheduled} /></label><label className="span-2">Ansprechpartner<input name="contact" placeholder="Name und Telefonnummer" defaultValue={order?.contact} /></label>
      </>}
      {kind === 'cancel' && <label className="span-2">Stornogrund<textarea name="reason" required maxLength={1000} placeholder="Warum wird der Auftrag storniert?" /></label>}
    </div><div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Abbrechen</button><button className={kind === 'cancel' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Wird gespeichert …' : kind === 'cancel' ? 'Auftrag stornieren' : 'Speichern'}</button></div></fieldset></form>
  </section></div>;
}
