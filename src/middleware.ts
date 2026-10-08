import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from './lib/supabase/middleware';

const intl = createMiddleware(routing);

/** A strict policy: scripts only with this request's nonce, images and connections only to this site and our Supabase project. */
function contentSecurityPolicy(nonce: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : '';
  const dev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabase.replace(/^http/, 'ws')}`.trim(),
    'frame-src https://www.openstreetmap.org',
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export async function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  // Next.js reads the policy from the request headers to put the nonce on its own scripts
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce); headers.set('content-security-policy', csp);
  const request = new NextRequest(req, { headers });

  // Admin, the school portal and auth callbacks are English-only / locale-free and live outside [locale].
  const p = req.nextUrl.pathname;
  const res = p.startsWith('/admin') || p.startsWith('/portal') || p.startsWith('/auth')
    ? await updateSession(request, NextResponse.next({ request: { headers } }))
    : await updateSession(request, intl(request));
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
