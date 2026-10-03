import { createClient } from '@/lib/supabase/server';

type I18n = Record<string, string>;
const label = (n: I18n, locale: string) => n?.[locale] ?? n?.en ?? '';

export type SearchOptions = {
  countries: { value: string; label: string }[];
  cities: { value: string; label: string; country: string }[];
  grades: { value: string; label: string }[];
  curricula: { value: string; label: string }[];
};

/** Filter options come from the database. On failure the form still renders, just with empty lists. */
export async function getSearchOptions(locale: string): Promise<SearchOptions> {
  const empty: SearchOptions = { countries: [], cities: [], grades: [], curricula: [] };
  try {
    const db = await createClient();
    const [co, ci, gr, cu] = await Promise.all([
      db.from('countries').select('id, slug, name_i18n').eq('is_active', true),
      db.from('cities').select('slug, name_i18n, country_id'),
      db.from('grade_levels').select('code, name_i18n').eq('is_active', true).order('sort_order'),
      db.from('curricula').select('code, name_i18n').eq('is_active', true).order('sort_order'),
    ]);
    const slugById = new Map((co.data ?? []).map((c) => [c.id, c.slug as string]));
    return {
      countries: (co.data ?? []).map((c) => ({ value: c.slug, label: label(c.name_i18n, locale) })).sort((a, b) => a.label.localeCompare(b.label, locale)),
      cities: (ci.data ?? []).map((c) => ({ value: c.slug, label: label(c.name_i18n, locale), country: slugById.get(c.country_id) ?? '' })).sort((a, b) => a.label.localeCompare(b.label, locale)),
      grades: (gr.data ?? []).map((g) => ({ value: g.code, label: label(g.name_i18n, locale) })),
      curricula: (cu.data ?? []).map((c) => ({ value: c.code, label: label(c.name_i18n, locale) })),
    };
  } catch {
    return empty;
  }
}
