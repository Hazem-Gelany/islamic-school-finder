import type { SupabaseClient } from '@supabase/supabase-js';

type I18n = Record<string, string>;
const en = (n: I18n | null) => n?.en ?? '';
export type Opt = { id: number; label: string };
export type Lookups = {
  countries: (Opt & { slug: string; currency: string | null })[];
  regions: (Opt & { country_id: number })[];
  cities: (Opt & { slug: string; country_id: number; region_id: number | null })[];
  schoolTypes: Opt[]; curricula: Opt[]; facilities: Opt[]; gradeLevels: Opt[]; feeCategories: Opt[];
  languages: { code: string; label: string }[];
};

/** Everything the admin form needs, read from the database (labels in English for the English-only admin). */
export async function getLookups(db: SupabaseClient): Promise<Lookups> {
  const q = (t: string, cols = 'id, name_i18n') => db.from(t).select(cols).order('sort_order' as never, { ascending: true });
  const simple = async (t: string): Promise<Opt[]> => ((await q(t)).data as any[] ?? []).map((r) => ({ id: r.id, label: en(r.name_i18n) }));
  const [co, re, ci, lang, schoolTypes, curricula, facilities, gradeLevels, feeCategories] = await Promise.all([
    db.from('countries').select('id, slug, name_i18n, currency_code').order('slug'),
    db.from('regions').select('id, country_id, name_i18n').order('slug'),
    db.from('cities').select('id, slug, country_id, region_id, name_i18n').order('slug'),
    db.from('languages').select('code, name_en').eq('is_active', true).order('name_en'),
    simple('school_types'), simple('curricula'), simple('facilities'), simple('grade_levels'), simple('fee_categories'),
  ]);
  return {
    countries: (co.data ?? []).map((r) => ({ id: r.id, slug: r.slug, label: en(r.name_i18n), currency: r.currency_code })),
    regions: (re.data ?? []).map((r) => ({ id: r.id, country_id: r.country_id, label: en(r.name_i18n) })),
    cities: (ci.data ?? []).map((r) => ({ id: r.id, slug: r.slug, country_id: r.country_id, region_id: r.region_id, label: en(r.name_i18n) })),
    languages: (lang.data ?? []).map((l) => ({ code: l.code, label: l.name_en })),
    schoolTypes, curricula, facilities, gradeLevels, feeCategories,
  };
}
