export const SORTS = ['relevance', 'name', 'fee_low', 'fee_high', 'distance', 'updated'] as const;
export type Sort = (typeof SORTS)[number];
export const PAGE_SIZE = 12;

export type Search = {
  q?: string; country?: string; city?: string; grade?: string; curriculum?: string; gender?: 'boys' | 'girls' | 'mixed';
  language?: string; accreditation?: string; feeMin?: number; feeMax?: number;
  quran?: boolean; arabic?: boolean; islamic?: boolean; boarding?: boolean; transport?: boolean; verified?: boolean;
  facilities: string[]; lat?: number; lng?: number; radius?: number; sort: Sort; page: number;
};
type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const code = (v: string | undefined) => (v && /^[a-z0-9_-]{1,80}$/.test(v) ? v : undefined);
const num = (v: string | undefined, min: number, max: number) => {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const flag = (v: string | undefined) => (v === '1' ? true : undefined);

/** Validates everything that arrives in the URL. Unknown or malformed values are dropped, never trusted. */
export function parseSearch(raw: Raw): Search {
  const g = (k: string) => first(raw[k]);
  const lat = num(g('lat'), -90, 90), lng = num(g('lng'), -180, 180);
  const hasPoint = lat !== undefined && lng !== undefined;
  const sort = SORTS.find((s) => s === g('sort')) ?? 'relevance';
  const fac = raw.facilities === undefined ? [] : Array.isArray(raw.facilities) ? raw.facilities : [raw.facilities];
  return {
    q: g('q')?.trim().slice(0, 120) || undefined,
    country: code(g('country')), city: code(g('city')), grade: code(g('grade')), curriculum: code(g('curriculum')),
    gender: (['boys', 'girls', 'mixed'] as const).find((x) => x === g('gender')),
    language: code(g('language')), accreditation: code(g('accreditation')),
    feeMin: num(g('feeMin'), 0, 1e9), feeMax: num(g('feeMax'), 0, 1e9),
    quran: flag(g('quran')), arabic: flag(g('arabic')), islamic: flag(g('islamic')),
    boarding: flag(g('boarding')), transport: flag(g('transport')), verified: flag(g('verified')),
    facilities: fac.map(code).filter((x): x is string => !!x).slice(0, 12),
    lat: hasPoint ? lat : undefined, lng: hasPoint ? lng : undefined, radius: hasPoint ? num(g('radius'), 1, 500) ?? 25 : undefined,
    sort: sort === 'distance' && !hasPoint ? 'relevance' : sort,
    page: Math.floor(num(g('page'), 1, 10000) ?? 1),
  };
}

export function toRpc(s: Search, locale: string) {
  return {
    p_locale: locale, p_q: s.q ?? null, p_country: s.country ?? null, p_city: s.city ?? null, p_grade: s.grade ?? null, p_curriculum: s.curriculum ?? null,
    p_gender: s.gender ?? null, p_language: s.language ?? null, p_fee_min: s.feeMin ?? null, p_fee_max: s.feeMax ?? null,
    p_quran: s.quran ?? null, p_arabic: s.arabic ?? null, p_islamic: s.islamic ?? null, p_boarding: s.boarding ?? null, p_transport: s.transport ?? null,
    p_facilities: s.facilities.length ? s.facilities : null, p_accreditation: s.accreditation ?? null, p_verified: s.verified ?? null,
    p_lat: s.lat ?? null, p_lng: s.lng ?? null, p_radius_km: s.radius ?? null, p_sort: s.sort, p_limit: PAGE_SIZE, p_offset: (s.page - 1) * PAGE_SIZE,
  };
}

/** True when any filter, search text, location or sort is set (used to keep filtered pages out of search engines). */
export function isFiltered(s: Search, ignore: (keyof Search)[] = []) {
  const skip = new Set<string>(['page', ...ignore]);
  return (Object.entries(s) as [string, unknown][]).some(([k, v]) => !skip.has(k) && v !== undefined && !(Array.isArray(v) && v.length === 0) && !(k === 'sort' && v === 'relevance'));
}

export function toQuery(s: Partial<Search>, drop: string[] = []) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) {
    if (drop.includes(k) || v === undefined || v === false || (Array.isArray(v) && !v.length) || (k === 'sort' && v === 'relevance') || (k === 'page' && v === 1)) continue;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x)); else p.set(k, v === true ? '1' : String(v));
  }
  return p.toString();
}
