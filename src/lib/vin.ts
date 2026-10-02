import { findMake, normalizeName } from './vehicle-catalog';
export interface VinSuggestion { make: string; model: string; year: string; message: string }
export const validVin = (vin: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
export function vinSuggestion(payload: unknown): VinSuggestion {
 const results = (payload as { Results?: unknown[] } | null)?.Results;
 const row = results?.[0];
 if (!row || typeof row !== 'object') throw new Error('Die VIN-Abfrage lieferte keine verwertbaren Daten.');
 const values = row as Record<string, unknown>;
 const value = (key: string) => typeof values[key] === 'string' ? values[key].trim().slice(0,120) : '';
 const errors = value('ErrorCode').split(',').map(code => code.trim());
 const rawMake = value('Make');
 const make = findMake(rawMake)?.name ?? rawMake;
 // vPIC also supplies partial values on decoding errors. Never treat those as a full decode.
 const complete = errors.length === 1 && errors[0] === '0';
 const rawModel = complete ? value('Model') : '';
 const model = findMake(make)?.models.find(item => normalizeName(item.name) === normalizeName(rawModel))?.name ?? rawModel;
 return { make, model, year: complete ? value('ModelYear') : '', message: complete && make && model ? 'Hersteller und Modell erkannt. Bitte mit dem Fahrzeug abgleichen.' : make ? 'Nur der Hersteller ist verwertbar. Modell und Ausstattung bitte selbst prüfen.' : 'Für diese VIN wurden keine verlässlichen Angaben gefunden. Bitte manuell auswählen.' };
}
