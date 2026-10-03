import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function SiteFooter() {
  const t = await getTranslations();
  return (
    <footer className="bg-forest-900 py-10 text-mist">
      <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-8 px-6 lg:px-16">
        <div>
          <p className="font-display text-[22px] font-semibold text-cream-50">{t('Home.title')}</p>
          <p className="mt-2 text-[15px]">{t('Hero.eyebrow')}</p>
        </div>
        <nav aria-label={t('Footer.label')} className="flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
          <Link href="/schools">{t('Nav.schools')}</Link><Link href="/compare">{t('Nav.compare')}</Link>
          <Link href="/about">{t('Nav.about')}</Link><Link href="/contact">{t('Footer.contact')}</Link><Link href="/privacy">{t('Footer.privacy')}</Link>
        </nav>
        <p className="text-sm">English · العربية · Bahasa Melayu</p>
      </div>
    </footer>
  );
}
