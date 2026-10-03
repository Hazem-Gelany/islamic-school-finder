'use client';
import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const items = [{ code: 'en', label: 'EN', name: 'English' }, { code: 'ar', label: 'ع', name: 'العربية' }, { code: 'ms', label: 'BM', name: 'Bahasa Melayu' }] as const;

export function LocaleSwitcher() {
  const current = useLocale();
  const pathname = usePathname();
  return (
    <div className="flex overflow-hidden rounded-[10px] border border-[#4E7A69] text-sm font-semibold">
      {items.map((i) => (
        <Link key={i.code} href={pathname} locale={i.code} aria-label={i.name} hrefLang={i.code}
          aria-current={current === i.code ? 'true' : undefined}
          className={`flex h-11 min-w-11 items-center justify-center px-2 ${current === i.code ? 'bg-gold-400 text-forest-900' : 'text-cream-50 hover:bg-white/10'}`}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}
