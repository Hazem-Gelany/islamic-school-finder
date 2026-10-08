'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';
import { safeNext } from '@/lib/safeNext';
import { SITE_URL } from '@/lib/data/public';
import { clientIp, isLimited } from '@/lib/rateLimit';
import { createServiceClient } from '@/lib/supabase/admin';

const locale = (v: FormDataEntryValue | null) => (routing.locales as readonly string[]).includes(String(v)) ? String(v) : 'en';
const email = z.string().trim().email().max(200);
const password = z.string().min(8).max(72);
const callback = (next: string) => `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signIn(fd: FormData) {
  const l = locale(fd.get('locale')), next = safeNext(String(fd.get('next') ?? ''), `/${l}/account`);
  const back = (e: string): never => redirect(`/${l}/login?error=${e}&next=${encodeURIComponent(next)}`);
  const p = z.object({ email, password: z.string().min(1).max(200) }).safeParse({ email: fd.get('email'), password: fd.get('password') });
  if (!p.success) return back('invalid');
  const ip = await clientIp();
  if (await isLimited([[`login:ip:${ip}`, 20, 600], [`login:email:${p.data.email.toLowerCase()}`, 8, 900]])) return back('rate');
  const { error } = await (await createClient()).auth.signInWithPassword(p.data);
  if (error) return back(error.code === 'email_not_confirmed' ? 'unconfirmed' : 'invalid');
  return redirect(next);
}

export async function signUp(fd: FormData) {
  const l = locale(fd.get('locale')), next = safeNext(String(fd.get('next') ?? ''), `/${l}/account`);
  const back = (e: string): never => redirect(`/${l}/register?error=${e}&next=${encodeURIComponent(next)}`);
  const p = z.object({ name: z.string().trim().min(1).max(80), email, password }).safeParse({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password') });
  if (!p.success) return back(p.error.issues.some((i) => i.path[0] === 'password') ? 'weak' : 'invalid');
  if (await isLimited([[`signup:ip:${await clientIp()}`, 10, 3600]])) return back('rate');
  const { error } = await (await createClient()).auth.signUp({ email: p.data.email, password: p.data.password, options: { data: { display_name: p.data.name }, emailRedirectTo: callback(next) } });
  if (error) return back(error.code === 'weak_password' ? 'weak' : 'generic');
  return redirect(`/${l}/register?sent=1`); // same message whether or not the address already has an account
}

export async function requestReset(fd: FormData) {
  const l = locale(fd.get('locale'));
  const p = email.safeParse(fd.get('email'));
  if (!p.success) return redirect(`/${l}/forgot-password?error=invalid`);
  // When limited we still show the normal confirmation, so the limit cannot be used to probe which addresses exist
  if (await isLimited([[`reset:ip:${await clientIp()}`, 10, 3600], [`reset:email:${p.data.toLowerCase()}`, 3, 3600]])) return redirect(`/${l}/forgot-password?sent=1`);
  await (await createClient()).auth.resetPasswordForEmail(p.data, { redirectTo: callback(`/${l}/reset-password`) });
  return redirect(`/${l}/forgot-password?sent=1`);
}

export async function updatePassword(fd: FormData) {
  const l = locale(fd.get('locale'));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect(`/${l}/login?error=link`);
  const p = password.safeParse(fd.get('password'));
  if (!p.success) return redirect(`/${l}/reset-password?error=weak`);
  const { error } = await supabase.auth.updateUser({ password: p.data });
  if (error) return redirect(`/${l}/reset-password?error=${error.code === 'weak_password' ? 'weak' : 'generic'}`);
  return redirect(`/${l}/account?msg=password`);
}

export async function signOut(fd: FormData) {
  await (await createClient()).auth.signOut();
  redirect(`/${locale(fd.get('locale'))}`);
}

/** Permanently deletes the signed-in person's account and the personal data tied to it (profile, roles, claims, saved items, requests).
 *  School records they edited stay, with the editor reference cleared. The audit trail keeps only an anonymous id. */
export async function deleteAccount(fd: FormData) {
  const l = locale(fd.get('locale'));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect(`/${l}/login`);
  const back = (e: string): never => redirect(`/${l}/account?error=${e}`);
  if (String(fd.get('confirm') ?? '').trim().toUpperCase() !== 'DELETE') return back('confirm');
  if (await isLimited([[`delete:user:${user.id}`, 3, 3600]])) return back('rate');
  const admin = createServiceClient();
  if (!admin) return back('unavailable');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  if (roles?.some((r) => r.role === 'super_admin')) {
    const { count } = await admin.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'super_admin');
    if ((count ?? 0) <= 1) return back('lastAdmin');
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) { console.error(JSON.stringify({ level: 'error', msg: 'account deletion failed', code: error.code })); return back('unavailable'); }
  await supabase.auth.signOut();
  return redirect(`/${l}?deleted=1`);
}
