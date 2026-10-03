import { createClient } from '@/lib/supabase/server';
import { redirect } from '@/i18n/navigation';

/** Signed-in visitor (parent, school representative or staff). Verified with the auth server, never trusted from the cookie alone. */
export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Sends signed-out visitors to the login page and brings them back afterwards. `path` has no locale prefix. */
export async function requireUser(locale: string, path: string) {
  const s = await getUser();
  if (!s.user) redirect({ href: `/login?next=${encodeURIComponent(`/${locale}${path}`)}`, locale });
  return { supabase: s.supabase, user: s.user! };
}

/** Which of these schools has the visitor saved? `signedIn` is false for anonymous visitors. */
export async function getSavedState(ids: string[]) {
  const { supabase, user } = await getUser();
  if (!user) return { signedIn: false, saved: new Set<string>() };
  if (ids.length === 0) return { signedIn: true, saved: new Set<string>() };
  const { data } = await supabase.from('saved_schools').select('school_id').in('school_id', ids);
  return { signedIn: true, saved: new Set((data ?? []).map((r) => r.school_id as string)) };
}
