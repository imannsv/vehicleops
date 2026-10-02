'use client';
import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { InvitePreview } from '@/lib/domain';
import { supabase } from '@/lib/supabase';
import { roleLabels } from '@/lib/team';
export function Access({ authenticated, token, onReady }: { authenticated: boolean; token: string | null; onReady: (org?: string) => Promise<void> }) {
 const [mode, setMode] = useState<'login' | 'signup'>('login'), [preview, setPreview] = useState<InvitePreview | null>(null);
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
 useEffect(() => { if (!token || !supabase) return; let active = true; supabase.rpc('preview_team_invitation', { p_token: token }).then(result => { if (!active) return; if (result.error) setError(result.error.message); else setPreview(result.data as unknown as InvitePreview); }); return () => { active = false; }; }, [token]);
 async function submit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(''); setNotice('');
  try {
   if (authenticated && token) {
    const result = await supabase!.rpc('accept_team_invitation', { p_token: token }); if (result.error) throw new Error(result.error.message);
    window.history.replaceState({}, '', window.location.pathname); await onReady(result.data); return;
   }
   if (authenticated) { const result = await supabase!.rpc('create_organization', { p_name: String(form.get('organization')), p_member_name: String(form.get('name')) }); if (result.error) throw new Error(result.error.message); await onReady(result.data); return; }
   const email = preview?.email ?? String(form.get('email')), password = String(form.get('password'));
   if (mode === 'signup') {
    const result = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + (token ? '/?invite=' + token : '/') } }); if (result.error) throw new Error(result.error.message);
    if (result.data.session) await onReady(); else { setNotice('Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach. Anschließend kannst du dich anmelden.'); setMode('login'); }
   } else { const result = await supabase!.auth.signInWithPassword({ email, password }); if (result.error) throw new Error(result.error.message); await onReady(); }
  } catch (e) { setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.'); } finally { setBusy(false); }
 }
 return <main className="auth-screen"><div className="auth-story"><div className="brand"><Truck />VehicleOps</div><h1>Jede Übergabe.<br />Sauber dokumentiert.</h1><p>Aufträge, Fahrzeuge und Protokolle an einem Ort.</p></div><section className="auth-form">
 <h1>{token ? 'Einladung zum Team' : authenticated ? 'Organisation einrichten' : mode === 'signup' ? 'Konto erstellen' : 'Willkommen zurück'}</h1>
 {preview ? <p className="muted">Hallo {preview.name}. Du wurdest zu {preview.organization_name} als {roleLabels[preview.role]} eingeladen.</p> : <p className="muted">{token ? 'Einladung wird geprüft.' : authenticated ? 'Erstelle den Arbeitsbereich für dein Team.' : 'Melde dich mit deinem Firmenkonto an.'}</p>}
 {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
 {(!token || preview) && <form onSubmit={submit}><fieldset className="inspection-fields" disabled={busy}>
 {authenticated ? token ? <p className="muted">Die Einladung gilt für {preview?.email}. Dein Konto muss diese bestätigte E-Mail-Adresse verwenden.</p> : <><label>Unternehmen<input name="organization" required maxLength={120} /></label><label>Dein Name<input name="name" required maxLength={120} /></label></> : <><label>E-Mail<input name="email" type="email" autoComplete="email" required defaultValue={preview?.email ?? ''} readOnly={!!preview} /></label><label>Passwort<input name="password" type="password" minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required /></label></>}
 <button className="primary full" disabled={busy}>{busy ? 'Bitte warten …' : authenticated ? token ? 'Einladung annehmen' : 'Organisation erstellen' : mode === 'signup' ? 'Konto erstellen' : 'Anmelden'}</button></fieldset></form>}
 {!authenticated && <button className="text-button mt" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? 'Ich habe bereits ein Konto' : 'Neues Konto erstellen'}</button>}
 {authenticated && token && <button className="secondary mt" disabled={busy} onClick={async () => { await supabase!.auth.signOut(); await onReady(); }}>Mit anderem Konto anmelden</button>}
 {token && <button className="text-button mt" onClick={() => { window.history.replaceState({}, '', window.location.pathname); void onReady(); }}>Zur Anmeldung</button>}
 </section></main>;
}
