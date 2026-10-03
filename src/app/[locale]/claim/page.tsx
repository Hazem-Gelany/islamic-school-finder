import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Breadcrumbs } from '@/components/public/Breadcrumbs';
import { altPaths, runSearch } from '@/lib/data/public';
import { parseSearch } from '@/features/search/params';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Claim' });
  return { title: t('title'), description: t('metaDescription'), alternates: altPaths(locale, '/claim') };
}

export default async function ClaimLanding({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const q = ((await searchParams).q ?? '').trim().slice(0, 100);
  const t = await getTranslations({ locale, namespace: 'Claim' }); const tc = await getTranslations({ locale, namespace: 'Common' });
  const results = q ? await runSearch({ ...parseSearch({}), q }, locale, 10) : null;
  const steps = ['step1', 'step2', 'step3'] as const;
  return (
    <>
      <SiteHeader />
      <div className="bg-forest-900 pb-10 pt-6 text-cream-50"><div className="mx-auto max-w-7xl px-6 lg:px-16">
        <Breadcrumbs items={[{ label: tc('home'), href: '/' }, { label: t('title') }]} />
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight lg:text-5xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-lg text-mist">{t('intro')}</p>
        <form action={`/${locale}/claim`} method="get" role="search" className="mt-6 flex max-w-3xl flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="q">{t('searchLabel')}</label>
          <input id="q" name="q" defaultValue={q} placeholder={t('searchPlaceholder')} className="h-12 flex-1 rounded-xl border-0 px-4 text-base text-ink-900" />
          <button className="h-12 rounded-xl bg-gold-400 px-6 font-semibold text-forest-900 hover:brightness-95">{t('search')}</button>
        </form>
      </div></div>
      <main className="mx-auto max-w-4xl px-6 py-10 lg:px-0">
        {results ? (
          <section aria-labelledby="res-h">
            <h2 id="res-h" className="mb-4 text-lg font-semibold" role="status">{t('results', { count: results.rows.length })}</h2>
            {results.error && <p role="alert" className="rounded-xl bg-[#FCEDEA] p-4 text-[#8A1F11]">{t('searchError')}</p>}
            <ul className="space-y-3">{results.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-5">
                <div><p className="font-display text-xl font-semibold">{r.name}</p><p className="text-sm text-muted">{r.city_name}, {r.country_name}</p></div>
                <Link href={`/claim/${r.id}`} className="flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">{t('claimThis')}</Link>
              </li>))}</ul>
            {!results.error && results.rows.length === 0 && <p className="rounded-2xl border border-line bg-white p-8 text-center text-muted">{t('noResults')}</p>}
          </section>
        ) : (
          <section aria-labelledby="how-h">
            <h2 id="how-h" className="mb-5 font-display text-2xl font-semibold">{t('howTitle')}</h2>
            <ol className="grid gap-4 sm:grid-cols-3">{steps.map((k, i) => (
              <li key={k} className="rounded-2xl border border-line bg-white p-6"><span aria-hidden className="grid size-9 place-items-center rounded-full bg-mint-100 font-semibold text-forest-900">{i + 1}</span><h3 className="mt-3 font-semibold">{t(`${k}Title`)}</h3><p className="mt-1 text-[15px] text-muted">{t(`${k}Text`)}</p></li>))}</ol>
            <p className="mt-6 rounded-xl bg-sand-100 p-4 text-sm">{t('notListed')}</p>
          </section>)}
      </main>
      <SiteFooter />
    </>
  );
}
