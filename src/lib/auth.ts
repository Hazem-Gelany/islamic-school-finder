import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Current user and their permissions. Permissions are read from the database, never from the client. */
export async function getStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, perms: [] as string[] };
  const { data } = await supabase.rpc('my_permissions');
  return { supabase, user, perms: (data as string[] | null) ?? [] };
}

export async function requirePermission(permission: string) {
  const s = await getStaff();
  if (!s.user) redirect('/admin/login');
  if (!s.perms.includes(permission)) redirect('/admin/login?error=forbidden');
  return { ...s, user: s.user };
}
export const requireStaff = () => requirePermission('schools.read_all');

/** Signed-in person (any role). Sends visitors to the public login page and back again afterwards. */
export async function requireUser(next: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/en/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

/** The person must be an approved representative of this school (checked in the database, not from the browser). */
export async function requireMember(schoolId: string) {
  const s = await requireUser(`/portal/schools/${schoolId}`);
  const { data } = await s.supabase.from('school_members').select('school_id').eq('school_id', schoolId).eq('user_id', s.user.id).maybeSingle();
  if (!data) redirect('/portal?error=forbidden');
  return s;
}
