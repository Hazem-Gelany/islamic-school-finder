import type { NextRequest } from 'next/server';
import { getFacets, getMatchCandidates } from '@/lib/data/public';
import { parseSearch } from '@/features/search/params';
import { activeKeys, evaluate, sortResults } from '@/features/match/engine';
import { fail, guard, localeOf, ok, options } from '@/lib/api';

export const OPTIONS = options;

/** POST /api/v1/match — body: the same preference fields as the website (city, grade, curriculum, gender, language, feeMax, quran, arabic, islamic,
 *  boarding, transport, facilities[], lat, lng, radius, country, locale). Returns schools sorted by how many preferences they meet, each with an explanation. */
export async function POST(req: NextRequest) {
  const limited = await guard(); if (limited) return limited;
  if (Number(req.headers.get('content-length') ?? 0) > 10_000) return fail(413, 'too_large', 'The request body is too large.');
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail(400, 'invalid_json', 'The body must be valid JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'invalid_json', 'The body must be a JSON object.');
  const raw: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(body)) {
    if (Array.isArray(v)) raw[k] = v.map(String); else if (v === true) raw[k] = '1'; else if (v !== false && v != null && typeof v !== 'object') raw[k] = String(v);
  }
  const locale = localeOf(typeof body.locale === 'string' ? body.locale : null);
  const facets = await getFacets();
  const p = parseSearch(raw);
  const country = p.country ?? facets.cities.find((c) => c.slug === p.city)?.country;
  const search = { ...p, country, q: undefined };
  if (activeKeys(search).length === 0) return fail(400, 'no_preferences', 'Provide at least one preference, for example city, grade, curriculum, feeMax or quran.');
  const { rows, error } = await getMatchCandidates(locale, country, search.lat, search.lng);
  if (error) return fail(502, 'upstream_error', 'Matching is temporarily unavailable.');
  const currency = facets.countries.find((c) => c.slug === country)?.currency;
  const results = sortResults(rows.map((c) => ({ c, r: evaluate(c, search, { currency }) })), locale);
  const limit = Math.min(Math.max(Math.floor(Number(body.limit)) || 12, 1), 24), page = search.page;
  return ok(results.slice((page - 1) * limit, page * limit).map(({ c, r }) => ({ school: c, matched: r.matched, total: r.total, criteria: r.criteria })),
    { total: results.length, page, limit, preferences: activeKeys(search) }, 'no-store');
}
