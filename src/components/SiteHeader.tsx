import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';
import { StarIcon } from './icons';
import { createClient } from '@/lib/supabase/server';

export async function SiteHeader() {
  const t = await getTranslations();
  const { data: { user } } = await (await createClient()).auth.getUser();
  const links = [['/schools', 'Nav.schools'], ['/compare', 'Nav.compare'], ['/match', 'Nav.match'], ['/about', 'Nav.about']] as const;
  return (
    <header className="bg-forest-900 text-cream-50">
      <div className="mx-auto flex min-h-[76px] max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3 lg:px-16">
        <Link href="/" className="flex items-center gap-3">
          <StarIcon />
          <span className="font-display text-[22px] font-semibold">{t('Home.title')}</span>
        </Link>
        <nav aria-label={t('Nav.label')} className="flex flex-wrap items-center gap-x-8 gap-y-2 text-base font-medium">
          {links.map(([href, key]) => <Link key={href} href={href} className="hover:text-gold-400">{t(key)}</Link>)}
        </nav>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <Link href={user ? '/account' : '/login'} className="flex h-11 items-center rounded-[10px] border border-gold-400 px-5 text-[15px] font-semibold text-gold-400 hover:bg-white/10">{user ? t('Nav.account') : t('Nav.login')}</Link>
        </div>
      </div>
    </header>
  );
}
