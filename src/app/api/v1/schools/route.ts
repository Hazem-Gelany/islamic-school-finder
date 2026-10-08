import type { NextRequest } from 'next/server';
import { createAnon } from '@/lib/supabase/anon';
import { parseSearch, toRpc } from '@/features/search/params';
import { fail, guard, localeOf, ok, options } from '@/lib/api';

export const OPTIONS = options;

/** GET /api/v1/schools — same filters as the website (country, city, grade, curriculum, gender, language, quran, arabic, islamic, boarding, transport,
 *  facilities, feeMin, feeMax, accreditation, verified, lat, lng, radius, q, sort, page) plus locale (en|ar|ms) and limit (1-24). */
export async function GET(req: NextRequest) {
  const limited = await guard(); if (limited) return limited;
  const sp = req.nextUrl.searchParams;
  const raw: Record<string, string | string[]> = {};
  sp.forEach((_, k) => { raw[k] = k === 'facilities' ? sp.getAll(k) : (sp.get(k) as string); });
  const s = parseSearch(raw), locale = localeOf(sp.get('locale'));
  const limit = Math.min(Math.max(Math.floor(Number(sp.get('limit'))) || 12, 1), 24);
  const args = { ...toRpc(s, locale), p_limit: limit, p_offset: (s.page - 1) * limit };
  const { data, error } = await createAnon().rpc('search_schools', args);
  if (error) { console.error(JSON.stringify({ level: 'error', msg: 'api search failed', code: error.code })); return fail(502, 'upstream_error', 'The search is temporarily unavailable.'); }
  const rows = (data ?? []) as { total_count: number }[];
  const total = Number(rows[0]?.total_count ?? 0);
  return ok(rows.map(({ total_count: _t, ...r }) => r), { total, page: s.page, limit, pages: Math.max(1, Math.ceil(total / limit)), locale });
}
