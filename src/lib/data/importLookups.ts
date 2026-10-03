import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportLookups } from '@/features/import/columns';

const en = (n: Record<string, string> | null) => n?.en ?? '';
const byCode = (rows: { id: number; code: string }[] | null) => Object.fromEntries((rows ?? []).map((r) => [r.code.toLowerCase(), r.id]));

export async function getImportLookups(db: SupabaseClient): Promise<ImportLookups> {
  const [co, re, ci, st, cu, gr, fa, la, fc] = await Promise.all([
    db.from('countries').select('id, slug, iso2, name_i18n, currency_code'), db.from('regions').select('id, country_id, slug, name_i18n'), db.from('cities').select('id, country_id, slug, name_i18n'),
    db.from('school_types').select('id, code'), db.from('curricula').select('id, code'), db.from('grade_levels').select('id, code'), db.from('facilities').select('id, code'),
    db.from('languages').select('code').eq('is_active', true), db.from('fee_categories').select('id').eq('code', 'tuition').maybeSingle(),
  ]);
  return {
    countries: (co.data ?? []).map((c) => ({ id: c.id, slug: c.slug, iso2: c.iso2, name: en(c.name_i18n), currency: c.currency_code })),
    regions: (re.data ?? []).map((r) => ({ id: r.id, country_id: r.country_id, slug: r.slug, name: en(r.name_i18n) })),
    cities: (ci.data ?? []).map((c) => ({ id: c.id, country_id: c.country_id, slug: c.slug, name: en(c.name_i18n) })),
    schoolTypes: byCode(st.data), curricula: byCode(cu.data), gradeLevels: byCode(gr.data), facilities: byCode(fa.data),
    languages: (la.data ?? []).map((l) => l.code), tuitionCategoryId: fc.data?.id ?? null,
  };
}
