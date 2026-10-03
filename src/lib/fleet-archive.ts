import { Data } from './domain';

export type FleetEntity = 'site' | 'space';
export const activeSites = (data: Data) => (data.sites ?? []).filter(site => !site.archived_at);
export function activeSpaces(data: Data, siteId?: string) {
  const sites = new Set(activeSites(data).map(site => site.id));
  return (data.spaces ?? []).filter(space => !space.archived_at && sites.has(space.site_id) && (!siteId || space.site_id === siteId));
}
export function fleetArchiveUsage(data: Data, kind: FleetEntity, id: string) {
  return {
    vehicles: data.vehicles.filter(vehicle => (kind === 'site' ? vehicle.site_id : vehicle.parking_space_id) === id),
    orders: data.orders.filter(order => kind === 'site'
      ? order.status === 'assigned' && order.pickup_site_id === id || ['assigned', 'in_transit'].includes(order.status) && order.destination_site_id === id
      : ['assigned', 'in_transit'].includes(order.status) && order.destination_space_id === id),
  };
}
export function applyFleetArchive(data: Data, kind: FleetEntity, id: string, revision: number, archived: boolean): Data {
  const entity = (kind === 'site' ? data.sites : data.spaces)?.find(row => row.id === id && row.organization_id === data.organization.id);
  if (!entity) throw Error('Standort oder Stellplatz fehlt.');
  if (!!entity.archived_at === archived) return data;
  if (entity.revision !== revision) throw Error('Standort oder Stellplatz wurde inzwischen geändert. Bitte aktualisieren und erneut prüfen.');
  if (kind === 'space' && !activeSites(data).some(site => site.id === ('site_id' in entity ? entity.site_id : ''))) throw Error('Bitte zuerst den Standort wiederherstellen.');
  const usage = fleetArchiveUsage(data, kind, id);
  if (archived && usage.vehicles.length) throw Error(kind === 'site' ? 'Am Standort stehen noch Fahrzeuge. Bitte zuerst umsetzen.' : 'Der Stellplatz ist belegt. Bitte das Fahrzeug zuerst umsetzen.');
  if (archived && usage.orders.length) throw Error('Offene Aufträge benötigen diesen Bereich noch. Bitte zuerst umplanen oder abschließen.');
  const update = { ...entity, archived_at: archived ? new Date().toISOString() : null, revision: entity.revision + 1 };
  return kind === 'site' ? { ...data, sites: data.sites?.map(site => site.id === id ? update as typeof site : site) }
    : { ...data, spaces: data.spaces?.map(space => space.id === id ? update as typeof space : space) };
}
