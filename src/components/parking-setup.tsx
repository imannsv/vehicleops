'use client';
import { ParkingSetup, parkingPreview, MAX_PARKING_BATCH } from '@/lib/parking';

export function ParkingSetupFields({ value, onChange, existing = [], optional = false }: {
  value: ParkingSetup; onChange: (value: ParkingSetup) => void; existing?: string[]; optional?: boolean;
}) {
  const preview = parkingPreview(value, existing);
  return <div className="parking-setup">
    <label>Stellplätze anlegen{optional && ' (optional)'}
      <select aria-label={optional ? 'Stellplätze anlegen (optional)' : 'Stellplätze anlegen'} value={value.mode} onChange={e => onChange({ ...value, mode: e.target.value as ParkingSetup['mode'] })}>
        {optional && <option value="none">Später anlegen</option>}
        <option value="range">Nummernreihe</option><option value="list">Eigene Bezeichnungen</option>
      </select>
    </label>
    {value.mode !== 'none' && <>
      <p className="muted small">Bis zu {MAX_PARKING_BATCH} Stellplätze auf einmal. Vorhandene Plätze bleiben erhalten.</p>
      {value.mode === 'range' ? <>
        <div className="parking-range">
          <label>Bereich / Präfix<input maxLength={79} value={value.prefix} onChange={e => onChange({ ...value, prefix: e.target.value })} placeholder="z. B. A- oder Halle-"/></label>
          <label>Erste Nummer<input inputMode="numeric" pattern="[0-9]+" required maxLength={5} value={value.start} onChange={e => onChange({ ...value, start: e.target.value })}/></label>
          <label>Letzte Nummer<input inputMode="numeric" pattern="[0-9]+" required maxLength={5} value={value.end} onChange={e => onChange({ ...value, end: e.target.value })}/></label>
        </div>
        <label className="key-check"><input type="checkbox" checked={value.padded} onChange={e => onChange({ ...value, padded: e.target.checked })}/>Führende Nullen verwenden (01, 02 …)</label>
      </> : <label>Stellplatzbezeichnungen<textarea rows={5} maxLength={16400} value={value.list} onChange={e => onChange({ ...value, list: e.target.value })} placeholder={'Verkaufsfläche 1\nWerkstatt links\nAnlieferung'}/><span className="muted small">Eine Bezeichnung pro Zeile. Leerzeilen werden ignoriert.</span></label>}
      <div className="parking-preview" aria-live="polite">
        {preview.error ? <p className="alert">{preview.error}</p> : <>
          <strong>{preview.added.length} neue Stellplätze</strong>
          {!!preview.existing.length && <p className="muted small">{preview.existing.length} bereits vorhanden – werden übersprungen.</p>}
          {!!preview.duplicates && <p className="muted small">{preview.duplicates} doppelte Bezeichnungen in der Liste – werden nur einmal angelegt.</p>}
          <div className="parking-tags">{preview.added.slice(0, 12).map(label => <span key={label}>{label}</span>)}{preview.added.length > 12 && <span>+ {preview.added.length - 12} weitere</span>}</div>
          {!!preview.labels.length && !preview.added.length && <p className="muted small">Alle angegebenen Stellplätze sind bereits vorhanden.</p>}
        </>}
      </div>
    </>}
  </div>;
}
