import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { runSearch } from '@/lib/data/public';
import { parseSearch } from '@/features/search/params';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Claim' }); return { title: t('title'), description: t('intro'), robots: { index: false, follow: true } }; }

export default async function ClaimIndex({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Claim' });
  const q = ((await searchParams).q ?? '').trim().slice(0, 120);
  const { rows } = q.length >= 2 ? await runSearch(parseSearch({ q }), locale, 8) : { rows: [] };
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl font-medium text-forest-900">{t('title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('intro')}</p>
        <ol className="mt-6 list-decimal space-y-1 ps-5 text-muted"><li>{t('step1')}</li><li>{t('step2')}</li><li>{t('step3')}</li></ol>
        <form action={`/${locale}/claim`} method="get" role="search" className="mt-8 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="cq">{t('searchLabel')}</label>
          <input id="cq" name="q" defaultValue={q} placeholder={t('searchPlaceholder')} className="h-12 flex-1 rounded-xl border border-[#7F9288] px-4" />
          <button className="h-12 rounded-xl bg-forest-900 px-6 font-semibold text-cream-50">{t('search')}</button>
        </form>
        {q.length >= 2 && (rows.length === 0
          ? <p className="mt-6 rounded-xl bg-[#F6F4EC] p-4">{t('noResults')}</p>
          : <ul className="mt-6 space-y-3">{rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
                <div><p className="font-semibold">{r.name}</p><p className="text-sm text-muted">{r.city_name}, {r.country_name}</p></div>
                <Link href={`/schools/${r.country_slug}/${r.city_slug}/${r.slug}/claim`} className="flex h-11 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">{t('claimThis')}</Link>
              </li>))}</ul>)}
        <p className="mt-8 text-sm text-muted">{t('notListed')}</p>
      </main>
      <SiteFooter />
    </>
  );
}
