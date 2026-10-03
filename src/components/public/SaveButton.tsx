'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { toggleSave } from '@/features/account/actions';

/** Heart button. Signed-out visitors are sent to log in and brought back to this page. */
export function SaveButton({ id, name, saved, signedIn, tone = 'light' }: { id: string; name: string; saved: boolean; signedIn: boolean; tone?: 'light' | 'dark' }) {
  const t = useTranslations('Save');
  const locale = useLocale(), pathname = usePathname(), qs = useSearchParams().toString();
  const base = 'relative z-10 flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold';
  const look = tone === 'dark' ? (saved ? 'border-gold-400 bg-gold-400 text-forest-900' : 'border-gold-400 text-gold-400 hover:bg-white/10') : (saved ? 'border-forest-900 bg-forest-900 text-cream-50' : 'border-[#B9C4BD] bg-white hover:bg-mint-100');
  const label = <><span aria-hidden>{saved ? '♥' : '♡'}</span>{saved ? t('saved') : t('save')}<span className="sr-only"> {name}</span></>;
  if (!signedIn) {
    const next = `/${locale}${pathname === '/' ? '' : pathname}${qs ? `?${qs}` : ''}`;
    return <Link href={`/login?next=${encodeURIComponent(next)}`} title={t('loginToSave')} className={`${base} ${look}`}>{label}</Link>;
  }
  return (
    <form action={toggleSave} className="relative z-10">
      <input type="hidden" name="schoolId" value={id} />
      <button type="submit" aria-pressed={saved} className={`${base} ${look}`}>{label}</button>
    </form>
  );
}
