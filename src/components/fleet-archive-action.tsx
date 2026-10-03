'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import { Data, FleetSite, ParkingSpace } from '@/lib/domain';
import { FleetEntity, fleetArchiveUsage } from '@/lib/fleet-archive';
import { setFleetArchived } from '@/lib/inventory';
import { vehicleTitle } from '@/lib/company';

export function FleetArchiveAction({ data, kind, entity, cloud, onChange, onVehicle, onOrder }: {
  data: Data; kind: FleetEntity; entity: FleetSite | ParkingSpace; cloud: boolean; onChange: (data: Data) => void;
  onVehicle?: (id: string) => void; onOrder?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLElement>(null), title = useId();
  const restoring = !!entity.archived_at, label = kind === 'site' ? 'Standort' : 'Stellplatz';
  const name = 'name' in entity ? entity.name : entity.label, usage = fleetArchiveUsage(data, kind, entity.id);
  const blocked = !restoring && !!(usage.vehicles.length || usage.orders.length);
  useEffect(() => {
    if (!open) return;
    const button=trigger.current;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => button?.focus();
  }, [open]);
  async function save() {
    setBusy(true); setError('');
    try { onChange(await setFleetArchived(data, kind, entity.id, entity.revision, !restoring, cloud)); setOpen(false); }
    catch (error) { setError(error instanceof Error ? error.message : 'Änderung fehlgeschlagen. Bitte erneut versuchen.'); }
    finally { setBusy(false); }
  }
  return <>
    <button ref={trigger} type="button" className="icon-button" title={restoring ? 'Wiederherstellen' : 'Archivieren'} aria-label={`${label} ${name} ${restoring ? 'wiederherstellen' : 'archivieren'}`} onClick={() => { setError(''); setOpen(true); }}>{restoring ? <RotateCcw size={16}/> : <Archive size={16}/>}</button>
    {open && <div className="modal-backdrop"><section ref={dialog} className="modal archive-dialog" role="dialog" aria-modal="true" aria-labelledby={title} onKeyDown={event => {
      if (event.key === 'Escape' && !busy) { event.stopPropagation(); setOpen(false); }
      if (event.key === 'Tab') {
        const controls = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h2 id={title}>{label} {restoring ? 'wiederherstellen' : 'archivieren'}</h2><p className="archive-name">{name}</p>
      <p className="muted">{restoring ? 'Der Bereich steht danach wieder zur Auswahl.'+(kind==='site'?' Einzeln archivierte Stellplätze bleiben archiviert.':'') : 'Der Bereich wird aus neuen Auswahlen entfernt. Frühere Bewegungen und Protokolle bleiben erhalten. Du kannst ihn später wiederherstellen.'}</p>
      {blocked && <div className="archive-blockers"><strong>Dieser Bereich wird noch benötigt.</strong>
        {usage.vehicles.map(vehicle => <p key={vehicle.id}>{onVehicle ? <button className="text-button" onClick={() => { setOpen(false); onVehicle(vehicle.id); }}>{vehicleTitle(vehicle)} ansehen und umsetzen</button> : vehicleTitle(vehicle)}</p>)}
        {usage.orders.map(order => <p key={order.id}>{onOrder ? <button className="text-button" onClick={() => { setOpen(false); onOrder(order.id); }}>Auftrag {order.reference} ansehen</button> : `Offener Auftrag ${order.reference}`}</p>)}
        <p className="muted small">Fahrzeuge zuerst umsetzen und offene Aufträge umplanen oder abschließen.</p>
      </div>}
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="modal-actions"><button className="secondary" disabled={busy} onClick={() => setOpen(false)}>Abbrechen</button><button className="primary" disabled={busy || blocked} onClick={() => void save()}>{busy ? 'Wird gespeichert …' : restoring ? 'Wiederherstellen' : 'Archivieren bestätigen'}</button></div>
    </section></div>}
  </>;
}
