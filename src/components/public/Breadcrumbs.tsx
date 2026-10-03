import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function Breadcrumbs({ items, tone = 'dark' }: { items: { label: string; href?: string }[]; tone?: 'dark' | 'light' }) {
  const t = await getTranslations('Common');
  return (
    <nav aria-label={t('breadcrumb')} className={`text-sm ${tone === 'dark' ? 'text-mist' : 'text-muted'}`}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            {it.href ? <Link href={it.href} className="underline-offset-2 hover:underline">{it.label}</Link> : <span aria-current="page" className="font-semibold">{it.label}</span>}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
