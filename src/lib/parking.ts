export const MAX_PARKING_BATCH = 200;

export type ParkingSetup = {
  mode: 'none' | 'range' | 'list';
  prefix: string;
  start: string;
  end: string;
  padded: boolean;
  list: string;
};

export const initialParkingSetup = (mode: ParkingSetup['mode'] = 'none'): ParkingSetup =>
  ({ mode, prefix: 'A-', start: '1', end: '20', padded: true, list: '' });

export function normalizeParkingLabels(labels: string[]): string[] {
  if (labels.length > MAX_PARKING_BATCH) throw Error(`Bitte höchstens ${MAX_PARKING_BATCH} Stellplätze auf einmal anlegen.`);
  const cleaned = labels.map(label => label.trim());
  if (cleaned.some(label => !label || [...label].length > 80)) throw Error('Jede Stellplatzbezeichnung benötigt 1 bis 80 Zeichen.');
  return [...new Set(cleaned)];
}

export function parkingPreview(setup: ParkingSetup, existing: string[] = []) {
  try {
    let requested: string[] = [];
    if (setup.mode === 'range') {
      if (!/^\d{1,5}$/.test(setup.start) || !/^\d{1,5}$/.test(setup.end)) throw Error('Bitte ganze Nummern zwischen 0 und 99999 eingeben.');
      const start = Number(setup.start), end = Number(setup.end);
      if (end < start) throw Error('Die letzte Nummer muss mindestens so groß wie die erste sein.');
      if (end - start + 1 > MAX_PARKING_BATCH) throw Error(`Bitte höchstens ${MAX_PARKING_BATCH} Stellplätze auf einmal anlegen.`);
      const width = setup.padded ? Math.max(2, setup.start.length, setup.end.length) : 1;
      requested = Array.from({ length: end - start + 1 }, (_, i) => setup.prefix.trim() + String(start + i).padStart(width, '0'));
    } else if (setup.mode === 'list') {
      requested = setup.list.split(/\r?\n/).map(label => label.trim()).filter(Boolean);
      if (!requested.length) throw Error('Bitte mindestens eine Bezeichnung eintragen, eine pro Zeile.');
    }
    const labels = normalizeParkingLabels(requested), present = new Set(existing);
    return { labels, added: labels.filter(label => !present.has(label)), existing: labels.filter(label => present.has(label)), duplicates: requested.length - labels.length, error: '' };
  } catch (error) {
    return { labels: [], added: [], existing: [], duplicates: 0, error: error instanceof Error ? error.message : 'Bitte Stellplätze prüfen.' };
  }
}
