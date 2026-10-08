import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Breadcrumbs } from '@/components/public/Breadcrumbs';
import { Filters } from '@/components/public/Filters';
import { Pagination } from '@/components/public/Pagination';
import { SchoolCard } from '@/components/public/SchoolCard';
import { getFacets, pick, runSearch } from '@/lib/data/public';
import { PAGE_SIZE, SORTS, toQuery, type Search } from './params';

export async function SchoolsExplorer({ locale, search, preset }: { locale: string; search: Search; preset?: { country?: string; city?: string } }) {
  const t = await getTranslations({ locale, namespace: 'Schools' });
  const c = await getTranslations({ locale, namespace: 'Common' });
  const s: Search = { ...search, country: preset?.country ?? search.country, city: preset?.city ?? search.city };
  const [facets, { rows, total, error }] = await Promise.all([getFacets(), runSearch(s, locale)]);
  const country = facets.countries.find((x) => x.slug === s.country);
  const city = facets.cities.find((x) => x.slug === s.city);
  const place = city ? pick(city.name as Record<string, string>, locale) : country ? pick(country.name as Record<string, string>, locale) : '';
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = preset?.city ? `/schools/${preset.country}/${preset.city}` : preset?.country ? `/schools/${preset.country}` : '/schools';
  const href = (o: Partial<Search>) => { const q = toQuery({ ...s, ...o }, preset ? ['country', 'city'] : []); return q ? `${base}?${q}` : base; };
  const crumbs = [{ label: c('home'), href: '/' }, { label: c('schools'), href: preset?.country ? '/schools' : undefined },
    ...(preset?.country && country ? [{ label: pick(country.name as Record<string, string>, locale), href: preset.city ? `/schools/${preset.country}` : undefined }] : []),
    ...(preset?.city && city ? [{ label: pick(city.name as Record<string, string>, locale) }] : [])];

  return (
    <>
      <SiteHeader />
      <div className="bg-forest-900 pb-10 pt-6 text-cream-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-16">
          <Breadcrumbs items={crumbs} />
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight lg:text-5xl">{place ? t('titleIn', { place }) : t('title')}</h1>
          <form action={`/${locale}/schools`} method="get" role="search" className="mt-6 flex max-w-3xl flex-col gap-3 sm:flex-row">
            {s.country && <input type="hidden" name="country" value={s.country} />}{s.city && <input type="hidden" name="city" value={s.city} />}
            <label className="sr-only" htmlFor="q">{t('searchLabel')}</label>
            <input id="q" name="q" defaultValue={search.q} placeholder={t('searchPlaceholder')} className="h-12 flex-1 rounded-xl border-0 px-4 text-base text-ink-900" />
            <button className="h-12 rounded-xl bg-gold-400 px-6 font-semibold text-forest-900 hover:brightness-95">{t('search')}</button>
          </form>
        </div>
      </div>

      <main id="main" tabIndex={-1} className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[300px_1fr] lg:px-16">
        <aside><Filters facets={facets} values={s} q={s.q} sort={s.sort} /></aside>
        <section aria-labelledby="results-h">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-h" className="text-lg font-semibold" role="status">{t('results', { count: total })}</h2>
            <nav aria-label={t('sort')} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{t('sort')}:</span>
              {SORTS.filter((k) => k !== 'distance' || s.lat != null).map((k) => (
                <Link key={k} href={href({ sort: k, page: 1 })} aria-current={s.sort === k ? 'true' : undefined}
                  className={`flex min-h-9 items-center rounded-lg border px-3 ${s.sort === k ? 'border-forest-900 bg-forest-900 text-cream-50' : 'border-[#7F9288] hover:bg-mint-100'}`}>{t(`sort_${k}` as never)}</Link>))}
            </nav>
          </div>
          {error && <p role="alert" className="rounded-xl bg-[#FCEDEA] p-4 text-[#8A1F11]">{t('error')}</p>}
          {!error && rows.length === 0 && (
            <div className="rounded-2xl border border-line bg-white p-10 text-center">
              <p className="font-display text-2xl font-semibold">{t('noResults')}</p><p className="mt-2 text-muted">{t('noResultsHint')}</p>
              <Link href="/schools" className="mt-5 inline-flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50">{t('clear')}</Link>
            </div>)}
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 [&>li]:relative">{rows.map((r) => <SchoolCard key={r.id} s={r} />)}</ul>
          <Pagination page={Math.min(s.page, pages)} pages={pages} href={(p) => href({ page: p })} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
