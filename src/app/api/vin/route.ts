import { createClient } from '@supabase/supabase-js';
import { validVin, vinSuggestion } from '@/lib/vin';
import type { Database } from '@/lib/database.types';
export async function POST(request: Request) {
 const headers = { 'Cache-Control': 'no-store' };
 const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 try {
  let body;
  try { body = await request.json(); } catch { return reply({error:'Ungültige Anfrage.'},400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({error:'Ungültige Anfrage.'},400);
  const vin = typeof body.vin === 'string' ? body.vin.trim().toUpperCase() : '';
  if (!validVin(vin)) return reply({error:'VIN muss 17 gültige Zeichen enthalten.'},400);
  if (url && key) {
   const authorization = request.headers.get('Authorization') ?? '';
   if (!authorization.startsWith('Bearer ')) return reply({error:'Bitte anmelden.'},401);
   const client = createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
   const {data,error} = await client.auth.getUser(authorization.slice(7));
   if (error || !data.user) return reply({error:'Bitte erneut anmelden.'},401);
   if (typeof body.organization_id !== 'string') return reply({error:'Arbeitsbereich fehlt.'},400);
   const membership = await client.from('memberships').select('role').eq('user_id',data.user.id).eq('organization_id',body.organization_id).maybeSingle();
   if (!membership.data || !['admin','dispatcher'].includes(membership.data.role)) return reply({error:'Keine Berechtigung.'},403);
  }
  const response = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/' + vin + '?format=json',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('provider');
  return reply(vinSuggestion(await response.json()));
 } catch {
  return reply({error:'VIN-Erkennung ist gerade nicht verfügbar. Du kannst Hersteller und Modell manuell auswählen.'},503);
 }
}
