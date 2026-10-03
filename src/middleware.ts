import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from './lib/supabase/middleware';

const intl = createMiddleware(routing);

export async function middleware(req: NextRequest) {
  // Admin, the school portal and auth callbacks are English-only / locale-free and live outside [locale].
  const p = req.nextUrl.pathname;
  if (p.startsWith('/admin') || p.startsWith('/portal') || p.startsWith('/auth')) return updateSession(req, NextResponse.next({ request: req }));
  return updateSession(req, intl(req));
}

export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
