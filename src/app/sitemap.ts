import type { MetadataRoute } from 'next';
import { LOCALES, SITE_URL, getFacets } from '@/lib/data/public';
import { createAnon } from '@/lib/supabase/anon';

export const revalidate = 3600;

const entry = (path: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
  url: `${SITE_URL}/en${path}`, lastModified,
  alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`])) },
});

/** Only real, published pages: home, listings that have schools, and active school profiles. No thin or filtered URLs. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out = [entry(''), entry('/schools')];
  try {
    const db = createAnon();
    const [facets, schools, countries, cities] = await Promise.all([
      getFacets(),
      db.from('schools').select('slug, country_id, city_id, updated_at').eq('status', 'active').order('id').range(0, 9999),
      db.from('countries').select('id, slug'), db.from('cities').select('id, slug'),
    ]);
    facets.countries.forEach((c) => out.push(entry(`/schools/${c.slug}`)));
    facets.cities.forEach((c) => out.push(entry(`/schools/${c.country}/${c.slug}`)));
    const co = new Map((countries.data ?? []).map((x) => [x.id, x.slug])), ci = new Map((cities.data ?? []).map((x) => [x.id, x.slug]));
    (schools.data ?? []).forEach((s) => co.has(s.country_id) && ci.has(s.city_id) && out.push(entry(`/schools/${co.get(s.country_id)}/${ci.get(s.city_id)}/${s.slug}`, s.updated_at)));
  } catch (e) { console.error('[sitemap]', e); }
  return out;
}
