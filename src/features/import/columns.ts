import { schoolSchema } from '@/validations/school';
import { slugify } from '@/components/admin/schoolFormModel';
import { unguardCell } from '@/lib/csv';

export const CSV_COLUMNS = ['slug', 'status', 'country', 'region', 'city', 'school_type', 'gender', 'address', 'postal_code', 'latitude', 'longitude', 'phone', 'email', 'website', 'admissions_url',
  'founded_year', 'student_capacity', 'has_boarding', 'has_transport', 'offers_quran', 'offers_arabic', 'offers_islamic_studies', 'scholarships_available', 'currency', 'tuition_annual',
  'curricula', 'grade_levels', 'languages', 'facilities', 'name_en', 'name_ar', 'name_ms', 'description_en', 'description_ar', 'description_ms'] as const;
export const EXPORT_COLUMNS = ['id', ...CSV_COLUMNS, 'verification_status'] as const;
export const REQUIRED_COLUMNS = ['country', 'city'] as const;

export type ImportLookups = {
  countries: { id: number; slug: string; iso2: string; name: string; currency: string | null }[];
  regions: { id: number; country_id: number; slug: string; name: string }[];
  cities: { id: number; country_id: number; slug: string; name: string }[];
  schoolTypes: Record<string, number>; curricula: Record<string, number>; gradeLevels: Record<string, number>; facilities: Record<string, number>;
  languages: string[]; tuitionCategoryId: number | null;
};
export type RowIssue = { field: string; message: string };
export type RowResult = { ok: true; payload: Record<string, unknown>; name_primary: string } | { ok: false; errors: RowIssue[] };

const BOOL: Record<string, boolean> = { true: true, yes: true, y: true, '1': true, false: false, no: false, n: false, '0': false, '': false };
const FIELD_OF: Record<string, string> = { country_id: 'country', city_id: 'city', region_id: 'region', school_type_id: 'school_type', gender_policy: 'gender', translations: 'name_en',
  curriculum_ids: 'curricula', grade_level_ids: 'grade_levels', language_codes: 'languages', facility_ids: 'facilities', fees: 'tuition_annual', currency_code: 'currency' };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Turns one CSV line into a validated payload for save_school, or a list of problems in the parent's own column names. */
export function rowToPayload(raw: Record<string, string>, L: ImportLookups, filename: string): RowResult {
  const errors: RowIssue[] = [];
  const bad = (field: string, message: string) => errors.push({ field, message });
  const v = Object.fromEntries(Object.entries(raw).map(([k, x]) => [k, unguardCell((x ?? '').trim())]));
  const g = (k: string) => v[k] ?? '';

  const country = L.countries.find((c) => same(c.slug, g('country')) || same(c.iso2, g('country')) || same(c.name, g('country')));
  if (!country) bad('country', g('country') ? `Unknown country "${g('country')}"` : 'Country is required');
  const city = country && L.cities.find((c) => c.country_id === country.id && (same(c.slug, g('city')) || same(c.name, g('city'))));
  if (country && !city) bad('city', g('city') ? `Unknown city "${g('city')}" in ${country.name}. Add it under Places first.` : 'City is required');
  const region = g('region') && country ? L.regions.find((r) => r.country_id === country.id && (same(r.slug, g('region')) || same(r.name, g('region')))) : undefined;
  if (g('region') && country && !region) bad('region', `Unknown region "${g('region')}"`);
  const typeId = g('school_type') ? L.schoolTypes[g('school_type').toLowerCase()] : undefined;
  if (g('school_type') && !typeId) bad('school_type', `Unknown school type "${g('school_type')}"`);

  const gender = g('gender').toLowerCase();
  if (gender && !['boys', 'girls', 'mixed'].includes(gender)) bad('gender', 'Use boys, girls or mixed');
  const status = g('status').toLowerCase() || 'draft';
  if (!['draft', 'pending', 'active'].includes(status)) bad('status', 'Use draft, pending or active');

  const flag = (k: string) => { const x = BOOL[g(k).toLowerCase()]; if (x === undefined) bad(k, 'Use yes/no or true/false'); return !!x; };
  const flags = { has_boarding: flag('has_boarding'), has_transport: flag('has_transport'), offers_quran: flag('offers_quran'), offers_arabic: flag('offers_arabic'),
    offers_islamic_studies: flag('offers_islamic_studies'), scholarships_available: flag('scholarships_available') };
  const num = (k: string) => { if (g(k) === '') return null; const n = Number(g(k).replace(/,/g, '')); if (!Number.isFinite(n)) { bad(k, `"${g(k)}" is not a number`); return null; } return n; };

  const list = (k: string, table: Record<string, number>, label: string) => g(k).split(';').map((x) => x.trim().toLowerCase()).filter(Boolean)
    .map((code) => { const id = table[code]; if (!id) bad(k, `Unknown ${label} "${code}"`); return id; }).filter((x): x is number => !!x);
  const langs = g('languages').split(';').map((x) => x.trim().toLowerCase()).filter(Boolean);
  langs.filter((l) => !L.languages.includes(l)).forEach((l) => bad('languages', `Unknown language code "${l}"`));

  const translations = (['en', 'ar', 'ms'] as const).filter((l) => g(`name_${l}`)).map((l) => ({ language_code: l, name: g(`name_${l}`), description: g(`description_${l}`) }));
  if (!translations.length) bad('name_en', 'At least one school name is required (name_en, name_ar or name_ms)');
  const slug = g('slug').toLowerCase() || slugify(g('name_en'));
  if (!slug) bad('slug', 'Add a slug (URL name) when the school has no English name');

  const tuition = num('tuition_annual');
  const currency = (g('currency') || country?.currency || '').toUpperCase();
  const fees = tuition !== null && L.tuitionCategoryId ? [{ fee_category_id: L.tuitionCategoryId, amount: tuition, currency_code: currency, period: 'year' }] : [];
  if (tuition !== null && !currency) bad('currency', 'Add a currency (this country has no default)');

  // Evaluate every remaining column before deciding, so the parent sees all problems in one pass
  const extra = {
    latitude: num('latitude'), longitude: num('longitude'), founded_year: num('founded_year'), student_capacity: num('student_capacity'),
    curriculum_ids: list('curricula', L.curricula, 'curriculum'), facility_ids: list('facilities', L.facilities, 'facility'), grade_level_ids: list('grade_levels', L.gradeLevels, 'grade level'),
  };
  if (errors.length || !country || !city) return { ok: false, errors };
  const parsed = schoolSchema.safeParse({
    slug, status, country_id: country.id, region_id: region?.id ?? null, city_id: city.id, school_type_id: typeId ?? null, gender_policy: gender || null,
    address: g('address'), postal_code: g('postal_code'), latitude: extra.latitude, longitude: extra.longitude,
    phone: g('phone'), email: g('email'), website: g('website'), admissions_url: g('admissions_url'), social_links: {},
    founded_year: extra.founded_year, student_capacity: extra.student_capacity, ...flags, currency_code: currency || null,
    verification_status: 'community_added', verification_source: `CSV import: ${filename}`.slice(0, 300), verification_notes: '',
    translations, curriculum_ids: extra.curriculum_ids, language_codes: langs, facility_ids: extra.facility_ids,
    grade_level_ids: extra.grade_level_ids, fees,
  });
  if (errors.length) return { ok: false, errors };
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => ({ field: FIELD_OF[String(i.path[0])] ?? String(i.path[0]), message: i.message })) };
  return { ok: true, payload: parsed.data, name_primary: translations[0].name };
}
