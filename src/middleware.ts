import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from './lib/supabase/middleware';

const intl = createMiddleware(routing);

export async function middleware(req: NextRequest) {
  // Admin is English-only for the MVP and lives outside [locale].
  if (req.nextUrl.pathname.startsWith('/admin')) return updateSession(req, NextResponse.next({ request: req }));
  return updateSession(req, intl(req));
}

export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
