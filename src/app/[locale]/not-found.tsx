import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Deliberately static (no cookies or database): a 404 should render instantly and identically for everyone, including search engine crawlers. */
export default async function NotFound() {
  const t = await getTranslations('Errors');
  return (
    <>
      <header className="bg-forest-900 text-cream-50"><div className="mx-auto flex max-w-7xl items-center px-6 py-5 lg:px-16"><Link href="/" className="font-display text-[22px] font-semibold">{(await getTranslations('Home'))('title')}</Link></div></header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-bronze">404</p>
        <h1 className="mt-2 font-display text-4xl font-medium text-forest-900">{t('notFoundTitle')}</h1>
        <p className="mt-3 text-lg text-muted">{t('notFoundText')}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/schools" className="flex h-12 items-center rounded-xl bg-forest-900 px-6 font-semibold text-cream-50">{t('browse')}</Link>
          <Link href="/" className="flex h-12 items-center rounded-xl border-[1.5px] border-forest-900 px-6 font-semibold text-forest-900">{t('home')}</Link>
        </div>
      </main>
    </>
  );
}
