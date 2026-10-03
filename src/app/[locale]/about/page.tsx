import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { StaticPage } from '@/components/public/StaticPage';
import { VerificationBadge } from '@/components/public/VerificationBadge';
import { altPaths } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'About' });
  return { title: t('title'), description: t('metaDescription'), alternates: altPaths(locale, '/about') };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'About' }); const v = await getTranslations({ locale, namespace: 'Verif' });
  const levels = ['community_added', 'information_checked', 'school_verified', 'school_managed'] as const;
  const btn = 'flex h-11 items-center rounded-xl px-5 font-semibold';
  return (
    <StaticPage locale={locale} namespace="About"
      after={<>
        <section aria-labelledby="levels" className="rounded-2xl bg-sand-100 p-6">
          <h2 id="levels" className="mb-4 font-display text-2xl font-semibold">{t('levelsTitle')}</h2>
          <ul className="space-y-3">{levels.map((k) => <li key={k} className="flex flex-wrap items-center gap-3"><VerificationBadge status={k} /><span className="text-[15px]">{v(`${k}_help`)}</span></li>)}</ul>
        </section>
        <div className="flex flex-wrap gap-3">
          <Link href="/schools" className={`${btn} bg-forest-900 text-cream-50 hover:bg-[#14503F]`}>{t('ctaBrowse')}</Link>
          <Link href="/claim" className={`${btn} border-[1.5px] border-forest-900 text-forest-900 hover:bg-mint-100`}>{t('ctaClaim')}</Link>
          <Link href="/contact" className={`${btn} border-[1.5px] border-forest-900 text-forest-900 hover:bg-mint-100`}>{t('ctaContact')}</Link>
        </div>
      </>} />
  );
}
