'use client';
import { useTranslations } from 'next-intl';
import { COMPARE_MAX, useCompare } from './useCompare';

export function CompareToggle({ id, name, tone = 'light' }: { id: string; name: string; tone?: 'light' | 'dark' }) {
  const t = useTranslations('CompareBar');
  const { has, toggle, items } = useCompare();
  const on = has(id), full = !on && items.length >= COMPARE_MAX;
  const base = 'relative z-10 flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';
  const look = tone === 'dark' ? (on ? 'border-gold-400 bg-gold-400 text-forest-900' : 'border-gold-400 text-gold-400 hover:bg-white/10') : (on ? 'border-forest-900 bg-forest-900 text-cream-50' : 'border-[#B9C4BD] bg-white hover:bg-mint-100');
  return (
    <button type="button" aria-pressed={on} disabled={full} title={full ? t('full') : undefined} onClick={() => toggle({ id, name })} className={`${base} ${look}`}>
      <span aria-hidden>{on ? '✓' : '+'}</span>{on ? t('added') : t('add')}<span className="sr-only"> {name}</span>
    </button>
  );
}
