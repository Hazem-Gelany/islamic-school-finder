import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Breadcrumbs } from '@/components/public/Breadcrumbs';
import { Filters } from '@/components/public/Filters';
import { MatchCard } from '@/components/public/MatchCard';
import { Pagination } from '@/components/public/Pagination';
import { altPaths, getFacets, getMatchCandidates, pick } from '@/lib/data/public';
import { PAGE_SIZE, parseSearch, toQuery } from '@/features/search/params';
import { getSavedState } from '@/lib/user';
import { activeKeys, evaluate, sortResults } from '@/features/match/engine';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Match' });
  return { title: t('metaTitle'), description: t('metaDescription'), alternates: altPaths(locale, '/match'), robots: { index: false, follow: true } };
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const raw = await searchParams;
  const t = await getTranslations({ locale, namespace: 'Match' });
  const tc = await getTranslations({ locale, namespace: 'Common' });
  const facets = await getFacets();
  const p = parseSearch(raw);
  // A city implies its country; the country narrows the schools we look at. Neither one is counted as a preference by itself.
  const country = p.country ?? facets.cities.find((c) => c.slug === p.city)?.country;
  const search = { ...p, country, q: undefined };
  const keys = activeKeys(search);
  const fullOnly = raw.full === '1';
  const currency = facets.countries.find((c) => c.slug === country)?.currency;
  const countryName = facets.countries.find((c) => c.slug === country);

  let results: { c: ReturnType<typeof sortResults>[number]['c']; r: ReturnType<typeof evaluate> }[] = [];
  let failed = false;
  if (keys.length) {
    const { rows, error } = await getMatchCandidates(locale, country, search.lat, search.lng);
    failed = error;
    results = sortResults(rows.map((c) => ({ c, r: evaluate(c, search, { currency }) })), locale);
  }
  const shown = fullOnly ? results.filter((x) => x.r.matched === x.r.total) : results;
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const page = Math.min(search.page, pages);
  const visible = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const saved = await getSavedState(visible.map((x) => x.c.id));
  const q = (o: Record<string, string>) => { const base = new URLSearchParams(toQuery({ ...search, page: 1, sort: 'relevance', q: undefined })); Object.entries(o).forEach(([k, v]) => (v ? base.set(k, v) : base.delete(k))); const s = base.toString(); return `/match${s ? `?${s}` : ''}`; };

  return (
    <>
      <SiteHeader />
      <div className="bg-forest-900 pb-8 pt-6 text-cream-50"><div className="mx-auto max-w-7xl px-6 lg:px-16">
        <Breadcrumbs items={[{ label: tc('home'), href: '/' }, { label: t('title') }]} />
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight lg:text-5xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-lg text-mist">{t('intro')}</p>
      </div></div>
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[300px_1fr] lg:px-16">
        <aside><Filters facets={facets} values={search} mode="match" /></aside>
        <section aria-labelledby="match-h">
          {keys.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-10 text-center">
              <h2 id="match-h" className="font-display text-2xl font-semibold">{t('noPrefs')}</h2>
              <p className="mt-2 text-muted">{t('noPrefsHint')}</p>
              <Link href="/schools" className="mt-5 inline-flex h-11 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">{t('browse')}</Link>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 id="match-h" role="status" className="text-lg font-semibold">{t('results', { count: shown.length, total: keys.length })}</h2>
                {countryName && <p className="text-sm text-muted">{t('showingIn', { place: pick(countryName.name as Record<string, string>, locale) })}</p>}
                <p className="mt-2 max-w-2xl rounded-lg bg-[#F6F4EC] p-3 text-sm text-muted">{t('explain')}</p>
                <Link href={q(fullOnly ? { full: '' } : { full: '1' })} className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-[#B9C4BD] px-3 text-sm font-semibold hover:bg-mint-100">{fullOnly ? t('showAll') : t('onlyFull')}</Link>
              </div>
              {failed && <p role="alert" className="rounded-xl bg-[#FCEDEA] p-4 text-[#8A1F11]">{t('error')}</p>}
              {!failed && shown.length === 0 && <div className="rounded-2xl border border-line bg-white p-10 text-center"><p className="font-display text-2xl font-semibold">{fullOnly ? t('noFull') : t('noResults')}</p><p className="mt-2 text-muted">{t('noResultsHint')}</p></div>}
              <ul className="grid gap-5">{visible.map(({ c, r }) => <MatchCard key={c.id} c={c} r={r} save={{ signedIn: saved.signedIn, saved: saved.saved.has(c.id) }} />)}</ul>
              <Pagination page={page} pages={pages} href={(n) => q({ ...(fullOnly ? { full: '1' } : {}), page: String(n) })} />
            </>)}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
