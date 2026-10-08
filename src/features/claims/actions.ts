'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';
import { safeNext } from '@/lib/safeNext';
import { isLimited } from '@/lib/rateLimit';

export async function submitClaim(fd: FormData) {
  const l = (routing.locales as readonly string[]).includes(String(fd.get('locale'))) ? String(fd.get('locale')) : 'en';
  const here = safeNext(String(fd.get('return') ?? ''), `/${l}/claim`);
  const back = (e: string, detail?: string): never => redirect(`${here}?error=${e}${detail ? `&detail=${encodeURIComponent(detail)}` : ''}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect(`/${l}/login?next=${encodeURIComponent(here)}`);
  const p = z.object({
    school_id: z.string().uuid(), job_title: z.string().trim().min(2).max(120), contact_email: z.string().trim().email().max(200),
    message: z.string().trim().max(2000), evidence_url: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u)).or(z.literal('')),
  }).safeParse(Object.fromEntries(['school_id', 'job_title', 'contact_email', 'message', 'evidence_url'].map((k) => [k, fd.get(k) ?? ''])));
  if (!p.success) return back('invalid');
  if (await isLimited([[`claim:user:${user.id}`, 10, 3600]])) return back('limit', 'Too many claim requests. Please try again later.');
  const { error } = await supabase.from('school_claims').insert({ ...p.data, evidence_url: p.data.evidence_url || null, message: p.data.message || null, user_id: user.id });
  if (error) {
    console.error('[claim]', error.code, error.message);
    if (error.hint === 'user_message') return back('limit', error.message); // our own plain-language messages
    if (error.code === '23505') return back('duplicate');
    return back('unavailable');
  }
  return redirect(`/${l}/account?msg=claimSent`);
}
