import type { Search } from '@/features/search/params';

export type Candidate = {
  id: string; slug: string; country_slug: string; city_slug: string; name: string; country_name: string; city_name: string;
  verification_status: string; gender_policy: string | null;
  offers_quran: boolean; offers_arabic: boolean; offers_islamic_studies: boolean; has_boarding: boolean; has_transport: boolean;
  tuition_annual_min: number | null; currency_code: string | null;
  grades: string[]; curricula: string[]; languages: string[]; facilities: string[]; distance_km: number | null;
};
export const KEYS = ['location', 'distance', 'grade', 'budget', 'curriculum', 'gender', 'language', 'quran', 'arabic', 'islamic', 'boarding', 'transport', 'facilities'] as const;
export type Key = (typeof KEYS)[number];
/** match = the school meets it, no = it does not, unknown = the school has not published the information */
export type Status = 'match' | 'no' | 'unknown';
export type Criterion = { key: Key; status: Status };
export type Result = { matched: number; total: number; criteria: Criterion[] };

/** The preferences the parent actually set. Only these count towards "X of Y". */
export function activeKeys(p: Search): Key[] {
  const on: Record<Key, boolean> = {
    location: !!p.city, distance: p.lat != null && p.lng != null, grade: !!p.grade, budget: p.feeMax != null, curriculum: !!p.curriculum,
    gender: !!p.gender, language: !!p.language, quran: !!p.quran, arabic: !!p.arabic, islamic: !!p.islamic, boarding: !!p.boarding,
    transport: !!p.transport, facilities: p.facilities.length > 0,
  };
  return KEYS.filter((k) => on[k]);
}

const has = (list: string[], v: string | undefined) => list.includes(v ?? '');
const unknownIfEmpty = (list: string[], ok: boolean): Status => (list.length === 0 ? 'unknown' : ok ? 'match' : 'no');

/** Rules-based and fully explainable: one pass/fail/unknown per preference, no hidden weights and no quality score. */
export function evaluate(c: Candidate, p: Search, ctx: { currency?: string | null } = {}): Result {
  const rule: Record<Key, () => Status> = {
    location: () => (c.city_slug === p.city ? 'match' : 'no'),
    distance: () => (c.distance_km == null ? 'unknown' : c.distance_km <= (p.radius ?? 25) ? 'match' : 'no'),
    grade: () => unknownIfEmpty(c.grades, has(c.grades, p.grade)),
    budget: () => {
      if (c.tuition_annual_min == null) return 'unknown';
      if (ctx.currency && c.currency_code && ctx.currency !== c.currency_code) return 'unknown';
      return c.tuition_annual_min <= (p.feeMax as number) ? 'match' : 'no';
    },
    curriculum: () => unknownIfEmpty(c.curricula, has(c.curricula, p.curriculum)),
    gender: () => (c.gender_policy == null ? 'unknown' : c.gender_policy === p.gender ? 'match' : 'no'),
    language: () => unknownIfEmpty(c.languages, has(c.languages, p.language)),
    quran: () => (c.offers_quran ? 'match' : 'no'),
    arabic: () => (c.offers_arabic ? 'match' : 'no'),
    islamic: () => (c.offers_islamic_studies ? 'match' : 'no'),
    boarding: () => (c.has_boarding ? 'match' : 'no'),
    transport: () => (c.has_transport ? 'match' : 'no'),
    facilities: () => unknownIfEmpty(c.facilities, p.facilities.every((f) => c.facilities.includes(f))),
  };
  const criteria = activeKeys(p).map((key) => ({ key, status: rule[key]() }));
  return { matched: criteria.filter((x) => x.status === 'match').length, total: criteria.length, criteria };
}

/** Most preferences met first, then alphabetical. Verification level and popularity never affect the order. */
export function sortResults<T extends { c: Candidate; r: Result }>(list: T[], locale: string): T[] {
  return [...list].sort((a, b) => b.r.matched - a.r.matched || a.c.name.localeCompare(b.c.name, locale));
}
