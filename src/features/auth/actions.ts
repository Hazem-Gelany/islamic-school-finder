'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';
import { safeNext } from '@/lib/safeNext';
import { SITE_URL } from '@/lib/data/public';

const locale = (v: FormDataEntryValue | null) => (routing.locales as readonly string[]).includes(String(v)) ? String(v) : 'en';
const email = z.string().trim().email().max(200);
const password = z.string().min(8).max(72);
const callback = (next: string) => `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signIn(fd: FormData) {
  const l = locale(fd.get('locale')), next = safeNext(String(fd.get('next') ?? ''), `/${l}/account`);
  const back = (e: string): never => redirect(`/${l}/login?error=${e}&next=${encodeURIComponent(next)}`);
  const p = z.object({ email, password: z.string().min(1).max(200) }).safeParse({ email: fd.get('email'), password: fd.get('password') });
  if (!p.success) return back('invalid');
  const { error } = await (await createClient()).auth.signInWithPassword(p.data);
  if (error) return back(error.code === 'email_not_confirmed' ? 'unconfirmed' : 'invalid');
  return redirect(next);
}

export async function signUp(fd: FormData) {
  const l = locale(fd.get('locale')), next = safeNext(String(fd.get('next') ?? ''), `/${l}/account`);
  const back = (e: string): never => redirect(`/${l}/register?error=${e}&next=${encodeURIComponent(next)}`);
  const p = z.object({ name: z.string().trim().min(1).max(80), email, password }).safeParse({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password') });
  if (!p.success) return back(p.error.issues.some((i) => i.path[0] === 'password') ? 'weak' : 'invalid');
  const { error } = await (await createClient()).auth.signUp({ email: p.data.email, password: p.data.password, options: { data: { display_name: p.data.name }, emailRedirectTo: callback(next) } });
  if (error) return back(error.code === 'weak_password' ? 'weak' : 'generic');
  return redirect(`/${l}/register?sent=1`); // same message whether or not the address already has an account
}

export async function requestReset(fd: FormData) {
  const l = locale(fd.get('locale'));
  const p = email.safeParse(fd.get('email'));
  if (!p.success) return redirect(`/${l}/forgot-password?error=invalid`);
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
