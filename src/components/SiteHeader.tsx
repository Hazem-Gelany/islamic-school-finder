import { getLocale, getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/user';
import { signOut } from '@/features/account/actions';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';
import { StarIcon } from './icons';

export async function SiteHeader() {
  const t = await getTranslations();
  const locale = await getLocale();
  const { user } = await getUser();
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
        <div className="flex flex-wrap items-center gap-4">
          <LocaleSwitcher />
          {user ? (
            <>
              <Link href="/account" className="flex h-11 items-center rounded-[10px] border border-gold-400 px-5 text-[15px] font-semibold text-gold-400 hover:bg-white/10">{t('Nav.account')}</Link>
              <form action={signOut}><input type="hidden" name="locale" value={locale} /><button className="flex h-11 items-center px-2 text-[15px] font-medium hover:text-gold-400">{t('Nav.logout')}</button></form>
            </>
          ) : (
            <Link href="/login" className="flex h-11 items-center rounded-[10px] border border-gold-400 px-5 text-[15px] font-semibold text-gold-400 hover:bg-white/10">{t('Nav.login')}</Link>
          )}
        </div>
      </div>
    </header>
  );
}
