import { Data, Invitation, Member, Role, isActiveOrder } from './domain';
import { loadCloud, mutateDemo } from './repository';
import { supabase } from './supabase';
export const roleLabels: Record<Role, string> = { admin: 'Administrator', dispatcher: 'Disposition', driver: 'Fahrer', viewer: 'Lesend' };
export function applyMemberChange(data: Data, member: Member, role: Role, remove: boolean): Data {
 const current = data.members.find(m => m.id === member.id);
 if (!current || current.role !== member.role) throw new Error('Rolle wurde inzwischen geändert. Bitte neu laden.');
 if (current.role === 'admin' && (remove || role !== 'admin') && data.members.filter(m => m.role === 'admin').length <= 1) throw new Error('Mindestens ein Administrator muss erhalten bleiben.');
 if ((remove || role !== 'driver') && data.orders.some(o => isActiveOrder(o) && data.drivers.some(d => d.id === o.driver_id && d.user_id === current.user_id))) throw new Error('Bitte zuerst die offenen Aufträge dieses Fahrers neu zuweisen.');
 return { ...data, members: remove ? data.members.filter(m => m.id !== member.id) : data.members.map(m => m.id === member.id ? { ...m, role } : m), drivers: data.drivers.map(d => d.user_id === current.user_id && (remove || role !== 'driver') ? { ...d, user_id: null, revision: (d.revision ?? 1) + 1 } : d) };
}
function requireDemoAdmin(data: Data) { if (!data.members.some(m => m.user_id === 'demo' && m.role === 'admin')) throw new Error('Administrator erforderlich.'); }
export async function createInvitation(data: Data, email: string, name: string, role: Role, cloud: boolean) {
 let token: string; let next: Data;
 if (cloud) {
  const result = await supabase!.rpc('create_team_invitation', { p_org: data.organization.id, p_email: email, p_name: name, p_role: role }); if (result.error) throw new Error(result.error.message);
  token = (result.data as { token: string }).token; next = (await loadCloud(data.organization.id))!;
 } else {
  token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  next = await mutateDemo(latest => {
   requireDemoAdmin(latest); const now = new Date().toISOString();
   const invite: Invitation = { id: crypto.randomUUID(), organization_id: latest.organization.id, email: email.trim().toLowerCase(), name: name.trim(), role, created_at: now, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), accepted_at: null, revoked_at: null };
   return { ...latest, invitations: [...latest.invitations.map(i => i.email === invite.email && !i.accepted_at && !i.revoked_at ? { ...i, revoked_at: now } : i), invite] };
  });
 }
 return { data: next, token };
}
export async function revokeInvitation(data: Data, id: string, cloud: boolean): Promise<Data> {
 if (cloud) { const r = await supabase!.rpc('revoke_team_invitation', { p_id: id }); if (r.error) throw new Error(r.error.message); return (await loadCloud(data.organization.id))!; }
 return mutateDemo(latest => { requireDemoAdmin(latest); return { ...latest, invitations: latest.invitations.map(i => i.id === id ? { ...i, revoked_at: new Date().toISOString() } : i) }; });
}
export async function changeMember(data: Data, member: Member, role: Role, remove: boolean, cloud: boolean): Promise<Data | null> {
 if (cloud) { const r = await supabase!.rpc('manage_team_member', { p_id: member.id, p_expected_role: member.role, p_role: role, p_remove: remove }); if (r.error) throw new Error(r.error.message); return member.user_id === (await supabase!.auth.getUser()).data.user?.id && remove ? loadCloud() : loadCloud(data.organization.id); }
 return mutateDemo(latest => { requireDemoAdmin(latest); return applyMemberChange(latest, member, role, remove); });
}
