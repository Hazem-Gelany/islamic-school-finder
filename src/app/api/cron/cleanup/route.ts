import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Daily housekeeping, called by Vercel Cron (see vercel.json). Deletes expired rate-limit counters. Protected by CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret ?? ''}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: 'service key not configured' }, { status: 500 });
  const { data, error } = await db.rpc('rate_limit_cleanup');
  if (error) { console.error(JSON.stringify({ level: 'error', msg: 'cleanup failed', code: error.code })); return NextResponse.json({ error: 'cleanup failed' }, { status: 500 }); }
  return NextResponse.json({ ok: true, deletedRateLimitRows: data });
}
