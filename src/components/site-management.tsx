'use client';
import { useState } from 'react';
import { Data, FleetSite, ParkingSpace } from '@/lib/domain';
import { vehicleIdentity } from '@/lib/company';
import { addSpaces, createSiteWithSpaces, saveSite, saveSpace } from '@/lib/inventory';
import { initialParkingSetup, parkingPreview } from '@/lib/parking';
import { ParkingSetupFields } from './parking-setup';

type Props = { data: Data; cloud: boolean; manage: boolean; onChange: (data: Data) => void };
const message = (error: unknown) => error instanceof Error ? error.message : 'Speichern fehlgeschlagen. Bitte erneut versuchen.';

export function SitesPanel({ data, cloud, manage, onChange }: Props) {
  const [editing, setEditing] = useState<FleetSite | null>(null);
  const [showForm, setShowForm] = useState(!data.sites?.length);
  // Reuse this ID after a failed request: a successful write followed by a lost response must not create a second site.
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const [setup, setSetup] = useState(initialParkingSetup);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const preview = parkingPreview(setup);

  function open(site: FleetSite | null) {
    setEditing(site); setNewId(crypto.randomUUID()); setSetup(initialParkingSetup());
    setShowForm(true); setError(''); setNotice('');
    requestAnimationFrame(() => document.getElementById('site-editor')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      if (editing) {
        onChange(await saveSite(data, editing.id, editing.revision, String(form.get('name')), String(form.get('address')), cloud));
        setNotice('Standort gespeichert.');
      } else {
        if (preview.error) throw Error(preview.error);
        const result = await createSiteWithSpaces(data, newId, String(form.get('name')), String(form.get('address')), preview.labels, cloud);
        onChange(result.data);
        setNotice(result.added ? `Standort mit ${result.added} Stellplätzen angelegt.` : 'Standort gespeichert. Stellplätze können jederzeit ergänzt werden.');
      }
      setEditing(null); setShowForm(false);
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <div className="sites-panel">
    {!data.sites?.length && <section className="panel site-welcome"><h2>{manage ? 'Standort und Stellplätze einrichten' : 'Noch keine festen Standorte'}</h2><p className="muted">{manage ? 'Lege deinen ersten Standort an und füge die Stellplätze direkt hinzu – als Nummernreihe oder mit eigenen Bezeichnungen. Weitere Bereiche und Standorte kannst du jederzeit ergänzen.' : 'Die Verwaltung richtet Standorte und Stellplätze für dein Unternehmen ein.'}</p></section>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {manage && !showForm && <button className="primary" onClick={() => open(null)}>Standort hinzufügen</button>}
    {manage && showForm && <section className="panel" id="site-editor">
      <h2>{editing ? 'Standort bearbeiten' : 'Standort hinzufügen'}</h2>
      {error && <p className="alert" role="alert">{error}</p>}
      <form onSubmit={save} key={editing?.id ?? newId}><fieldset disabled={busy} className="record-fields">
        <label>Standortname<input name="name" required maxLength={120} defaultValue={editing?.name} placeholder="z. B. Autohaus Berlin"/></label>
        <label>Standortanschrift<textarea name="address" maxLength={1000} defaultValue={editing?.address} placeholder="Straße, Hausnummer, PLZ, Ort"/></label>
        {!editing && <ParkingSetupFields value={setup} onChange={setSetup} optional/>}
        <div className="record-actions"><button className="primary" disabled={!editing && !!preview.error}>{busy ? 'Wird gespeichert …' : 'Standort speichern'}</button><button type="button" className="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Abbrechen</button></div>
      </fieldset></form>
    </section>}
    <div className="site-grid">{data.sites?.map(site => <SiteCard key={site.id} {...{ data, site, cloud, manage, onChange }} onEdit={() => open(site)}/>)}</div>
  </div>;
}

function SiteCard({ data, site, cloud, manage, onChange, onEdit }: Props & { site: FleetSite; onEdit: () => void }) {
  const [editing, setEditing] = useState<ParkingSpace | null>(null), [bulk, setBulk] = useState(false);
  const [setup, setSetup] = useState(() => initialParkingSetup('range'));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [search, setSearch] = useState(''), [limit, setLimit] = useState(20);
  const spaces = (data.spaces?.filter(space => space.site_id === site.id) ?? []).sort((a, b) => a.label.localeCompare(b.label, 'de', { numeric: true }));
  const filtered = spaces.filter(space => space.label.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de')));
  const vehicles = data.vehicles.filter(vehicle => vehicle.site_id === site.id);
  const preview = parkingPreview(setup, spaces.map(space => space.label));

  async function single(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    setBusy(true); setError(''); setNotice('');
    try {
      onChange(await saveSpace(data, editing?.id ?? crypto.randomUUID(), site.id, editing?.revision ?? 0, String(fields.get('label')), cloud));
      setEditing(null); form.reset(); setNotice('Stellplatz gespeichert.');
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function multiple(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (preview.error) throw Error(preview.error);
      const result = await addSpaces(data, site.id, preview.labels, cloud);
      onChange(result.data); setBulk(false); setSearch(''); setLimit(20);
      setNotice(result.added ? `${result.added} Stellplätze angelegt.` : 'Die Stellplätze sind bereits vorhanden.');
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <section className="panel site-card">
    <div className="section-heading"><h2>{site.name}</h2>{manage && <button disabled={busy} className="text-button" aria-label={`Standort ${site.name} bearbeiten`} onClick={onEdit}>Bearbeiten</button>}</div>
    <p className="muted preserve-lines">{site.address || 'Anschrift nicht erfasst'}</p>
    <p className="site-total">{spaces.length} Stellplätze · {vehicles.length} Fahrzeuge · {spaces.filter(space => !vehicles.some(vehicle => vehicle.parking_space_id === space.id)).length} freie Stellplätze</p>
    {error && <p className="alert" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {manage && !bulk && <button className="secondary bulk-parking-button" disabled={busy} onClick={() => { setBulk(true); setEditing(null); setSetup(initialParkingSetup('range')); setError(''); setNotice(''); }}>Mehrere Stellplätze anlegen</button>}
    {manage && bulk && <form className="bulk-parking-form" onSubmit={multiple}><fieldset disabled={busy} className="record-fields">
      <h3>Mehrere Stellplätze anlegen</h3><ParkingSetupFields value={setup} onChange={setSetup} existing={spaces.map(space => space.label)}/>
      <div className="record-actions"><button className="primary" disabled={!!preview.error || !preview.added.length}>{busy ? 'Wird angelegt …' : `${preview.added.length} Stellplätze anlegen`}</button><button type="button" className="secondary" onClick={() => { setBulk(false); setError(''); }}>Abbrechen</button></div>
    </fieldset></form>}
    {!!spaces.length && <label className="parking-search">Stellplätze in {site.name} suchen<input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(20); }} placeholder="z. B. A-01 oder Werkstatt"/></label>}
    <div className="space-list">{filtered.slice(0, limit).map(space => {
      const occupied = vehicles.find(vehicle => vehicle.parking_space_id === space.id);
      return <div className="space-row" key={space.id}><strong>{space.label}</strong><span className={occupied ? '' : 'muted'}>{occupied ? vehicleIdentity(occupied) : 'Frei'}</span>{manage && <button disabled={busy} className="text-button" aria-label={`Stellplatz ${space.label} bearbeiten`} onClick={() => { setEditing(space); setBulk(false); setError(''); setNotice(''); }}>Bearbeiten</button>}</div>;
    })}{!spaces.length ? <p className="muted">Noch keine Stellplätze.</p> : !filtered.length && <p className="muted">Keine Stellplätze für diese Suche.</p>}</div>
    {filtered.length > limit && <button className="text-button parking-more" onClick={() => setLimit(limit + 20)}>Weitere Stellplätze anzeigen ({filtered.length - limit})</button>}
    {manage && !bulk && <form onSubmit={single} key={editing?.id ?? 'new'}><fieldset disabled={busy} className="space-form">
      <label>{editing ? 'Stellplatz bearbeiten' : 'Stellplatz in ' + site.name}<input name="label" required maxLength={80} defaultValue={editing?.label ?? ''} placeholder="Einzelner Platz, z. B. A-01"/></label>
      <button className="secondary">{editing ? 'Stellplatz speichern' : 'Stellplatz hinzufügen'}</button>
      {editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setError(''); }}>Abbrechen</button>}
    </fieldset></form>}
  </section>;
}
