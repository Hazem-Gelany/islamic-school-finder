'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCompare } from './useCompare';

export function CompareBar() {
  const t = useTranslations('CompareBar');
  const { items, remove, clear } = useCompare();
  if (items.length === 0) return null;
  return (
    <aside aria-label={t('label')} className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3 lg:px-16">
        <p className="font-semibold" role="status">{t('selected', { count: items.length })}</p>
        <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-1 rounded-lg bg-mint-100 ps-3 text-sm">
              <span className="max-w-40 truncate">{i.name}</span>
              <button type="button" onClick={() => remove(i.id)} aria-label={t('remove', { name: i.name })} className="grid size-9 place-items-center rounded-lg hover:bg-white/60">✕</button>
            </li>))}
        </ul>
        {items.length >= 2
          ? <Link href={`/compare?schools=${items.map((i) => i.id).join(',')}`} className="flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">{t('compare')}</Link>
          : <span className="text-sm text-muted">{t('needMore')}</span>}
        <button type="button" onClick={clear} className="h-11 rounded-xl border border-[#7F9288] px-4 font-semibold">{t('clear')}</button>
      </div>
    </aside>
  );
}
