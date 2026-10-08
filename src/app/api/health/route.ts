import { NextResponse } from 'next/server';
import { createAnon } from '@/lib/supabase/anon';

export const dynamic = 'force-dynamic';

/** For uptime monitors and load balancers. Reveals nothing beyond whether the site and its database respond. */
export async function GET() {
  const started = Date.now();
  const { error } = await createAnon().from('languages').select('code').limit(1);
  const ok = !error;
  return NextResponse.json({ status: ok ? 'ok' : 'degraded', database: ok ? 'ok' : 'unreachable', responseMs: Date.now() - started, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
