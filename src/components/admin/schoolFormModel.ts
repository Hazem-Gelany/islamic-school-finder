export const CONTENT_LANGS = [['en', 'English'], ['ar', 'العربية (Arabic)'], ['ms', 'Bahasa Melayu (Malay)']] as const;
export const SOCIALS = ['facebook', 'instagram', 'x', 'youtube', 'linkedin'] as const;

export type Tr = { name: string; description: string; admission_information: string; islamic_studies_description: string; quran_description: string; arabic_description: string };
export type Fee = { id?: string; fee_category_id: string; grade_level_id: string; amount: string; period: string };
export type V = {
  slug: string; status: string; school_type_id: string; gender_policy: string;
  country_id: string; region_id: string; city_id: string; address: string; postal_code: string; latitude: string; longitude: string;
  curriculum_ids: number[]; language_codes: string[]; grade_level_ids: number[];
  offers_quran: boolean; offers_arabic: boolean; offers_islamic_studies: boolean;
  currency_code: string; scholarships_available: boolean; fees: Fee[];
  facility_ids: number[]; has_boarding: boolean; has_transport: boolean;
  phone: string; email: string; website: string; admissions_url: string; social: Record<string, string>; founded_year: string; student_capacity: string;
  verification_status: string; verification_source: string; verification_notes: string;
  tr: Record<string, Tr>;
};

const emptyTr = (): Tr => ({ name: '', description: '', admission_information: '', islamic_studies_description: '', quran_description: '', arabic_description: '' });
export const emptyValues = (): V => ({
  slug: '', status: 'draft', school_type_id: '', gender_policy: '', country_id: '', region_id: '', city_id: '', address: '', postal_code: '', latitude: '', longitude: '',
  curriculum_ids: [], language_codes: ['en', 'ar'], grade_level_ids: [], offers_quran: false, offers_arabic: false, offers_islamic_studies: false,
  currency_code: '', scholarships_available: false, fees: [], facility_ids: [], has_boarding: false, has_transport: false,
  phone: '', email: '', website: '', admissions_url: '', social: {}, founded_year: '', student_capacity: '',
  verification_status: 'community_added', verification_source: '', verification_notes: '',
  tr: { en: emptyTr(), ar: emptyTr(), ms: emptyTr() },
});

const s = (x: unknown) => (x === null || x === undefined ? '' : String(x));
export function fromRecord(r: Record<string, any>): V {
  const v = emptyValues();
  for (const k of ['slug', 'status', 'school_type_id', 'gender_policy', 'country_id', 'region_id', 'city_id', 'address', 'postal_code', 'latitude', 'longitude', 'currency_code',
    'phone', 'email', 'website', 'admissions_url', 'founded_year', 'student_capacity', 'verification_status', 'verification_source', 'verification_notes'] as const) (v as any)[k] = s(r[k]);
  for (const k of ['curriculum_ids', 'language_codes', 'grade_level_ids', 'facility_ids'] as const) (v as any)[k] = r[k] ?? [];
  for (const k of ['offers_quran', 'offers_arabic', 'offers_islamic_studies', 'scholarships_available', 'has_boarding', 'has_transport'] as const) v[k] = !!r[k];
  v.social = r.social_links ?? {};
  v.fees = (r.fees ?? []).map((f: any) => ({ id: f.id, fee_category_id: s(f.fee_category_id), grade_level_id: s(f.grade_level_id), amount: s(f.amount), period: f.period }));
  for (const t of r.translations ?? []) v.tr[t.language_code] = { ...emptyTr(), ...Object.fromEntries(Object.entries(t).map(([k, x]) => [k, s(x)])) } as Tr;
  return v;
}

const num = (x: string) => (x.trim() === '' ? null : Number(x));
export function toPayload(v: V, status = v.status) {
  return {
    slug: v.slug.trim(), status,
    country_id: num(v.country_id), region_id: num(v.region_id), city_id: num(v.city_id), school_type_id: num(v.school_type_id),
    gender_policy: v.gender_policy || null, address: v.address, postal_code: v.postal_code, latitude: num(v.latitude), longitude: num(v.longitude),
    phone: v.phone, email: v.email, website: v.website, admissions_url: v.admissions_url,
    social_links: Object.fromEntries(Object.entries(v.social).filter(([, x]) => x.trim())),
    founded_year: num(v.founded_year), student_capacity: num(v.student_capacity),
    has_boarding: v.has_boarding, has_transport: v.has_transport, offers_quran: v.offers_quran, offers_arabic: v.offers_arabic,
    offers_islamic_studies: v.offers_islamic_studies, scholarships_available: v.scholarships_available,
    currency_code: v.currency_code.trim().toUpperCase() || null,
    verification_status: v.verification_status, verification_source: v.verification_source, verification_notes: v.verification_notes,
    translations: CONTENT_LANGS.filter(([c]) => v.tr[c].name.trim()).map(([c]) => ({ language_code: c, ...v.tr[c] })),
    curriculum_ids: v.curriculum_ids, language_codes: v.language_codes, facility_ids: v.facility_ids, grade_level_ids: v.grade_level_ids,
    fees: v.fees.map((f) => ({ ...(f.id ? { id: f.id } : {}), fee_category_id: num(f.fee_category_id), grade_level_id: num(f.grade_level_id), amount: num(f.amount), currency_code: v.currency_code.trim().toUpperCase(), period: f.period })),
  };
}

export const STEPS = ['Basic information', 'Location', 'Education', 'Fees', 'Facilities', 'Contact', 'Media', 'Verification'] as const;
const STEP_OF: [RegExp, number][] = [
  [/^(slug|school_type_id|translations\.\d+\.(name|description|admission_information))/, 0],
  [/^(country_id|region_id|city_id|address|postal_code|latitude|longitude)/, 1],
  [/^(gender_policy|curriculum_ids|language_codes|grade_level_ids|offers_|translations\.\d+\.(islamic|quran|arabic))/, 2],
  [/^(fees|currency_code|scholarships)/, 3], [/^(facility_ids|has_)/, 4],
  [/^(phone|email|website|admissions_url|social_links|founded_year|student_capacity)/, 5], [/^(verification_|status)/, 7],
];
export const stepOf = (path: string) => STEP_OF.find(([re]) => re.test(path))?.[1] ?? 0;
export const slugify = (x: string) => x.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
