import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  const t = await getTranslations('Schools');
  if (pages <= 1) return null;
  const btn = 'flex h-11 items-center rounded-lg border border-[#B9C4BD] px-4 font-semibold hover:bg-mint-100';
  const off = 'flex h-11 items-center rounded-lg border border-line px-4 text-muted';
  return (
    <nav aria-label={t('pagination')} className="mt-8 flex flex-wrap items-center justify-center gap-3">
      {page > 1 ? <Link rel="prev" href={href(page - 1)} className={btn}>{t('prev')}</Link> : <span className={off}>{t('prev')}</span>}
      <span className="px-2 text-sm">{t('pageOf', { page, pages })}</span>
      {page < pages ? <Link rel="next" href={href(page + 1)} className={btn}>{t('next')}</Link> : <span className={off}>{t('next')}</span>}
    </nav>
  );
}
