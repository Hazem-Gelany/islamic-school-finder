import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safeNext';
import { SITE_URL } from '@/lib/data/public';

/** Landing point for email confirmation and password-reset links. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const next = safeNext(q.get('next'), '/en/account');
  const supabase = await createClient();
  const code = q.get('code'), hash = q.get('token_hash'), type = q.get('type') as EmailOtpType | null;
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (hash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: hash })).error;
  return NextResponse.redirect(new URL(ok ? next : '/en/login?error=link', SITE_URL));
}
