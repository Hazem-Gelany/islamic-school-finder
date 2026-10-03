import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Candidate, Result, Status } from '@/features/match/engine';
import { CompareToggle } from './CompareToggle';
import { VerificationBadge } from './VerificationBadge';

const ICON: Record<Status, string> = { match: '✓', no: '✗', unknown: '?' };

export function MatchCard({ c, r }: { c: Candidate; r: Result }) {
  const t = useTranslations('Match');
  const groups: [Status, string, string][] = [['match', t('matched'), 'text-forest-900'], ['no', t('notMatched'), 'text-bronze'], ['unknown', t('unknown'), 'text-muted']];
  return (
    <li className="relative flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-semibold leading-snug">
            <Link href={`/schools/${c.country_slug}/${c.city_slug}/${c.slug}`} className="hover:underline">{c.name}</Link>
          </h3>
          <p className="text-sm text-muted">{c.city_name}, {c.country_name}{c.distance_km != null && ` · ${Math.round(c.distance_km * 10) / 10} km`}</p>
        </div>
        <VerificationBadge status={c.verification_status} />
      </div>
      <p className="text-lg font-semibold">{t('matchesOf', { matched: r.matched, total: r.total })}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map(([status, title, tone]) => {
          const items = r.criteria.filter((x) => x.status === status);
          return items.length === 0 ? null : (
            <section key={status} aria-label={title}>
              <h4 className={`mb-2 text-sm font-semibold ${tone}`}>{title}</h4>
              <ul className="space-y-1.5 text-[15px]">{items.map((x) => <li key={x.key}><span aria-hidden className="me-1.5 font-semibold">{ICON[status]}</span>{t(`c_${x.key}` as never)}</li>)}</ul>
            </section>);
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={`/schools/${c.country_slug}/${c.city_slug}/${c.slug}`} className="flex h-11 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">{t('view')}</Link>
        <CompareToggle id={c.id} name={c.name} />
      </div>
    </li>
  );
}
