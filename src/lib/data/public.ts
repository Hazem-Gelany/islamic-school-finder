import { unstable_cache } from 'next/cache';
import { createAnon } from '@/lib/supabase/anon';
import { createClient } from '@/lib/supabase/server';
import type { Candidate } from '@/features/match/engine';
import { toRpc, type Search } from '@/features/search/params';

type I18n = Record<string, string>;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const LOCALES = ['en', 'ar', 'ms'] as const;
export const pick = (n: I18n | null | undefined, locale: string) => n?.[locale] || n?.en || '';
export const mediaUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/school-media/${path}`;
export function money(amount: number, currency: string | null | undefined, locale: string) {
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount); }
  catch { return `${amount.toLocaleString(locale)} ${currency ?? ''}`.trim(); }
}

export type SchoolRow = {
  id: string; slug: string; country_slug: string; city_slug: string; name: string; description: string | null; country_name: string; city_name: string;
  verification_status: string; gender_policy: string | null; tuition_annual_min: number | null; tuition_annual_max: number | null; currency_code: string | null;
  has_boarding: boolean; has_transport: boolean; offers_quran: boolean; offers_arabic: boolean; curricula: string[]; logo_path: string | null;
  distance_km: number | null; updated_at: string; total_count: number;
};
export type Facet = { slug?: string; code?: string; country?: string; name: I18n | string; currency?: string; count: number };
export type Facets = { countries: Facet[]; cities: Facet[]; curricula: Facet[]; grades: Facet[]; facilities: Facet[]; accreditations: Facet[]; languages: Facet[] };
const emptyFacets: Facets = { countries: [], cities: [], curricula: [], grades: [], facilities: [], accreditations: [], languages: [] };

// Short-lived caches in front of the database. Any admin change clears everything tagged "schools" (see revalidateTag in flash.ts and the save actions),
// so an edit is visible straight away; the time limits only bound how stale a read can be if a clear is missed. Failures throw, so they are never cached.
const CACHE_TAG = ['schools'];
const cachedSearch = unstable_cache(async (args: ReturnType<typeof toRpc>) => {
  const { data, error } = await createAnon().rpc('search_schools', args);
  if (error) throw new Error(`search_schools ${error.code}: ${error.message}`);
  return (data ?? []) as SchoolRow[];
}, ['search-schools'], { revalidate: 60, tags: CACHE_TAG });

export async function runSearch(s: Search, locale: string, limit?: number): Promise<{ rows: SchoolRow[]; total: number; error: boolean }> {
  const args = toRpc(s, locale); if (limit) args.p_limit = limit;
  try {
    const rows = await cachedSearch(args);
    return { rows, total: Number(rows[0]?.total_count ?? 0), error: false };
  } catch (e) { console.error('[search]', String(e)); return { rows: [], total: 0, error: true }; }
}

const cachedFacets = unstable_cache(async () => {
  const { data, error } = await createAnon().rpc('search_facets');
  if (error) throw new Error(`search_facets ${error.code}: ${error.message}`);
  return data as Facets;
}, ['search-facets'], { revalidate: 300, tags: CACHE_TAG });

export async function getFacets(): Promise<Facets> {
  try { return { ...emptyFacets, ...(await cachedFacets()) }; } catch (e) { console.error('[facets]', String(e)); return emptyFacets; }
}

const cachedSchool = unstable_cache(async (country: string, city: string, slug: string) => {
  const { data, error } = await createAnon().rpc('get_school_public', { p_country: country, p_city: city, p_slug: slug });
  if (error) throw new Error(`get_school_public ${error.code}: ${error.message}`);
  return (data as Record<string, any> | null) ?? null;
}, ['school-public'], { revalidate: 120, tags: CACHE_TAG });

/** Published schools only. With preview=true, staff sessions can also see drafts (never cached, never indexed). */
export async function getSchoolPublic(country: string, city: string, slug: string, preview = false) {
  try {
    if (!preview) return await cachedSchool(country, city, slug);
    const { data, error } = await (await createClient()).rpc('get_school_public', { p_country: country, p_city: city, p_slug: slug });
    if (error) throw new Error(error.message);
    return (data as Record<string, any> | null) ?? null;
  } catch (e) { console.error('[school]', String(e)); return null; }
}

/** Self-referencing canonical plus hreflang alternates for every locale. */
export const altPaths = (locale: string, path: string) => ({
  canonical: `/${locale}${path}`,
  languages: { ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}${path}`])), 'x-default': `/en${path}` },
});

/** Active schools by id, in the requested order (max four). */
export async function getCompare(ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await createAnon().rpc('get_schools_for_compare', { p_ids: ids });
  if (error) { console.error('[compare]', error.message); return []; }
  return (data ?? []) as Record<string, any>[];
}

export async function getMatchCandidates(locale: string, country?: string, lat?: number, lng?: number) {
  const { data, error } = await createAnon().rpc('match_candidates', { p_locale: locale, p_country: country ?? null, p_lat: lat ?? null, p_lng: lng ?? null, p_limit: 500 });
  if (error) { console.error('[match]', error.message); return { rows: [] as Candidate[], error: true }; }
  return { rows: (data ?? []) as Candidate[], error: false };
}
