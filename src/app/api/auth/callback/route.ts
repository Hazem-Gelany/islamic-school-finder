import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/validations/account';

/** Landing point for the links in confirmation and password-reset emails. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get('next'), '/en/account');
  const locale = /^\/(en|ar|ms)(\/|$)/.exec(next)?.[1] ?? 'en';
  const supabase = await createClient();
  const code = url.searchParams.get('code'), tokenHash = url.searchParams.get('token_hash'), type = url.searchParams.get('type') as EmailOtpType | null;
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  // Build the redirect from the configured site address, so it cannot be steered to another host.
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, '');
  return NextResponse.redirect(ok ? `${base}${next}` : `${base}/${locale}/login?error=link`);
}
