import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient<Database>(url, key) : null;
// Subscribe immediately, before page mounting or the initial getUser call consumes the URL.
export const recoveryState = { active: false };
if (typeof window !== 'undefined' && supabase) {
 supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
   recoveryState.active = true;
   sessionStorage.setItem('vehicleops-recovery', JSON.stringify({ user:session.user.id,until:Date.now()+15*60*1000 }));
  } else if (event === 'SIGNED_OUT') {
   recoveryState.active = false;
   sessionStorage.removeItem('vehicleops-recovery');
  }
 });
}
