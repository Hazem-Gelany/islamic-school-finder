import { z } from 'zod';

/** Only same-site paths are allowed as a "go back to" target, so a login link can never send people to another website. */
export function safeNext(next: unknown, fallback = '/'): string {
  if (typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\r\n\t]/.test(next) || next.includes('://')) return fallback;
  return next.length > 500 ? fallback : next;
}
/** Removes a leading /en, /ar or /ms so the path can be passed to the locale-aware redirect. */
export const stripLocale = (path: string) => path.replace(/^\/(en|ar|ms)(?=\/|$|\?|#)/, '') || '/';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optional = (max: number) => z.string().trim().max(max).transform((v) => v || undefined).optional();
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(72); // 72 bytes is bcrypt's limit

export const signInSchema = z.object({ email, password: z.string().min(1).max(200) });
export const signUpSchema = z.object({ displayName: text(2, 80), email, password });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ password });
export const contactSchema = z.object({
  schoolId: z.string().uuid(),
  name: text(2, 120),
  phone: optional(40),
  message: text(10, 2000),
  consent: z.literal('on'),
});
export const claimSchema = z.object({
  schoolId: z.string().uuid(),
  jobTitle: text(2, 120),
  contactEmail: email,
  message: optional(2000),
  evidenceUrl: z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'url').transform((v) => v || undefined).optional(),
});
export const CONTACT_STATUSES = ['new', 'read', 'replied', 'closed', 'spam'] as const;
export const contactStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(CONTACT_STATUSES) });
