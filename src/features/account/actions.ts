'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/data/public';
import { claimSchema, contactSchema, contactStatusSchema, forgotSchema, resetSchema, safeNext, signInSchema, signUpSchema, stripLocale } from '@/validations/account';

const loc = (fd: FormData) => { const l = String(fd.get('locale') ?? ''); return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale; };
const go = (locale: string, pathname: string, query: Record<string, string> = {}, hash?: string): never => {
  const qs = new URLSearchParams(query).toString();
  return redirect({ href: `${pathname}${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}`, locale }) as never;
};
/** The page to return to after login. Always a same-site path; falls back to the account page. */
const nextOf = (fd: FormData, locale: string) => stripLocale(safeNext(fd.get('next'), `/${locale}/account`));
const callback = (locale: string, next: string) => `${SITE_URL}/api/auth/callback?next=${encodeURIComponent(`/${locale}${next}`)}`;
/** Raw auth errors are logged, never shown. */
const logged = (where: string, e: { status?: number; code?: string; message?: string }) => console.error(`[${where}]`, e.status, e.code, e.message);

export async function signIn(fd: FormData) {
  const locale = loc(fd), next = nextOf(fd, locale);
  const p = signInSchema.safeParse({ email: fd.get('email'), password: fd.get('password') });
  if (!p.success) go(locale, '/login', { error: 'invalid', next });
  const { error } = await (await createClient()).auth.signInWithPassword(p.data!);
  if (error) {
    logged('signIn', error);
    go(locale, '/login', { error: error.code === 'email_not_confirmed' ? 'unconfirmed' : 'invalid', next });
  }
  go(locale, next);
}

export async function signUp(fd: FormData) {
  const locale = loc(fd), next = nextOf(fd, locale);
  const p = signUpSchema.safeParse({ displayName: fd.get('displayName'), email: fd.get('email'), password: fd.get('password') });
  if (!p.success) go(locale, '/signup', { error: p.error.issues.some((i) => i.path[0] === 'password') ? 'weak' : 'invalid', next });
  const { data, error } = await (await createClient()).auth.signUp({
    email: p.data!.email, password: p.data!.password,
    options: { data: { display_name: p.data!.displayName }, emailRedirectTo: callback(locale, next) },
  });
  if (error) { logged('signUp', error); go(locale, '/signup', { error: error.code === 'weak_password' ? 'weak' : 'failed', next }); }
  // With email confirmation on there is no session yet; otherwise the visitor is already signed in.
  if (data.session) go(locale, next);
  go(locale, '/login', { msg: 'checkEmail', next });
}

export async function signOut(fd: FormData) {
  await (await createClient()).auth.signOut();
  revalidatePath('/', 'layout');
  go(loc(fd), '/');
}

export async function requestPasswordReset(fd: FormData) {
  const locale = loc(fd);
  const p = forgotSchema.safeParse({ email: fd.get('email') });
  if (!p.success) go(locale, '/forgot-password', { error: 'invalid' });
  const { error } = await (await createClient()).auth.resetPasswordForEmail(p.data!.email, { redirectTo: callback(locale, '/reset-password') });
  if (error) logged('reset', error);
  // Same answer whether or not the address has an account, so the form cannot be used to find out who is registered.
  go(locale, '/forgot-password', { sent: '1' });
}

export async function updatePassword(fd: FormData) {
  const locale = loc(fd);
  const p = resetSchema.safeParse({ password: fd.get('password') });
  if (!p.success) go(locale, '/reset-password', { error: 'weak' });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) go(locale, '/forgot-password', { error: 'expired' });
  const { error } = await supabase.auth.updateUser({ password: p.data!.password });
  if (error) { logged('updatePassword', error); go(locale, '/reset-password', { error: error.code === 'weak_password' || error.code === 'same_password' ? 'weak' : 'failed' }); }
  go(locale, '/account', { msg: 'passwordChanged' });
}

/** Save or unsave a school. Row-level security limits this to the signed-in visitor's own list. */
export async function toggleSave(fd: FormData) {
  const schoolId = String(fd.get('schoolId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(schoolId)) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: existing } = await supabase.from('saved_schools').select('school_id').eq('school_id', schoolId).maybeSingle();
  const { error } = existing
    ? await supabase.from('saved_schools').delete().eq('school_id', schoolId).eq('user_id', user.id)
    : await supabase.from('saved_schools').insert({ user_id: user.id, school_id: schoolId });
  if (error) console.error('[save]', error.code, error.message);
  revalidatePath('/', 'layout');
}

const CONTACT_ERRORS: Record<string, string> = { RL001: 'limit', RL002: 'duplicate' };
export async function submitContact(fd: FormData) {
  const locale = loc(fd);
  const back = safeNext(fd.get('back'), '/schools');
  const path = back.startsWith('/schools/') ? back.split(/[?#]/)[0] : '/schools';
  // Hidden field that people never see; bots fill it in. Pretend it worked so they learn nothing.
  if (String(fd.get('website') ?? '') !== '') go(locale, path, { contact: 'sent' }, 'message');
  const p = contactSchema.safeParse({ schoolId: fd.get('schoolId'), name: fd.get('name'), phone: fd.get('phone') ?? '', message: fd.get('message'), consent: fd.get('consent') ?? undefined });
  if (!p.success) go(locale, path, { contact: p.error.issues.some((i) => i.path[0] === 'consent') ? 'consent' : 'invalid' }, 'message');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) go(locale, '/login', { next: `/${locale}${path}` });
  const d = p.data!;
  const { error } = await supabase.from('contact_requests').insert({ school_id: d.schoolId, parent_id: user!.id, message: d.message, contact_name: d.name, contact_phone: d.phone ?? null });
  if (error) { console.error('[contact]', error.code, error.message); go(locale, path, { contact: CONTACT_ERRORS[error.code ?? ''] ?? 'failed' }, 'message'); }
  go(locale, path, { contact: 'sent' }, 'message');
}

const CLAIM_ERRORS: Record<string, string> = { '23505': 'duplicate', RL003: 'member', RL004: 'unavailable', RL005: 'limit' };
export async function submitClaim(fd: FormData) {
  const locale = loc(fd);
  const id = String(fd.get('schoolId') ?? '');
  const here = `/claim/${/^[0-9a-f-]{36}$/i.test(id) ? id : ''}`;
  const p = claimSchema.safeParse({ schoolId: id, jobTitle: fd.get('jobTitle'), contactEmail: fd.get('contactEmail'), message: fd.get('message') ?? '', evidenceUrl: fd.get('evidenceUrl') ?? '' });
  if (!p.success) go(locale, here, { error: p.error.issues.some((i) => i.path[0] === 'evidenceUrl') ? 'url' : 'invalid' });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) go(locale, '/login', { next: `/${locale}${here}` });
  const d = p.data!;
  const { error } = await supabase.from('school_claims').insert({ school_id: d.schoolId, user_id: user!.id, job_title: d.jobTitle, contact_email: d.contactEmail, message: d.message ?? null, evidence_url: d.evidenceUrl ?? null });
  if (error) { console.error('[claim]', error.code, error.message); go(locale, here, { error: CLAIM_ERRORS[error.code ?? ''] ?? 'failed' }); }
  go(locale, '/account', { msg: 'claimSent' });
}

/** School members update the status of a message sent to their school. The database refuses any other change. */
export async function setContactStatus(fd: FormData) {
  const locale = loc(fd);
  const p = contactStatusSchema.safeParse({ id: fd.get('id'), status: fd.get('status') });
  if (!p.success) go(locale, '/account', { error: 'failed' }, 'inbox');
  const { error } = await (await createClient()).from('contact_requests').update({ status: p.data!.status }).eq('id', p.data!.id);
  if (error) { console.error('[contact status]', error.code, error.message); go(locale, '/account', { error: 'failed' }, 'inbox'); }
  go(locale, '/account', { msg: 'statusUpdated' }, 'inbox');
}
