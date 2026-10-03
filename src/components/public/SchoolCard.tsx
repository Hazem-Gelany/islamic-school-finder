import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { mediaUrl, money, type SchoolRow } from '@/lib/data/public';
import { CompareToggle } from './CompareToggle';
import { SaveButton } from './SaveButton';
import { VerificationBadge } from './VerificationBadge';

export type SaveState = { signedIn: boolean; saved: boolean };

export function SchoolCard({ s, save }: { s: SchoolRow; save?: SaveState }) {
  const t = useTranslations('Schools');
  const locale = useLocale();
  const chips = [s.gender_policy && t(`gender_${s.gender_policy}` as never), s.offers_quran && t('quran'), s.offers_arabic && t('arabic'), s.has_boarding && t('boarding'), s.has_transport && t('transport')].filter(Boolean) as string[];
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 transition-shadow focus-within:shadow-lg hover:shadow-lg">
      <div className="flex items-start gap-4">
        {s.logo_path
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={mediaUrl(s.logo_path)} alt="" loading="lazy" width={56} height={56} className="size-14 shrink-0 rounded-xl border border-line object-contain" />
          : <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-xl bg-mint-100 font-display text-xl font-semibold text-forest-900">{s.name.slice(0, 1)}</span>}
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold leading-snug">
            <Link href={`/schools/${s.country_slug}/${s.city_slug}/${s.slug}`} className="after:absolute after:inset-0 hover:underline">{s.name}</Link>
          </h3>
          <p className="text-sm text-muted">{s.city_name}, {s.country_name}{s.distance_km != null && <> · {t('away', { km: Math.round(s.distance_km * 10) / 10 })}</>}</p>
        </div>
      </div>
      <div><VerificationBadge status={s.verification_status} /></div>
      {s.description && <p className="line-clamp-3 text-[15px] leading-relaxed text-muted">{s.description}</p>}
      {s.curricula.length > 0 && <p className="text-sm"><span className="font-semibold">{t('curriculum')}:</span> {s.curricula.slice(0, 3).join(', ')}{s.curricula.length > 3 ? ` +${s.curricula.length - 3}` : ''}</p>}
      {chips.length > 0 && <ul className="flex flex-wrap gap-2 text-xs font-semibold">{chips.map((c) => <li key={c} className="rounded-md bg-[#F3F0E6] px-2 py-1">{c}</li>)}</ul>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-forest-900">
          {s.tuition_annual_min != null ? t('from', { amount: money(s.tuition_annual_min, s.currency_code, locale) }) : <span className="font-normal text-muted">{t('feesNotListed')}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {save && <SaveButton id={s.id} name={s.name} saved={save.saved} signedIn={save.signedIn} />}
          <CompareToggle id={s.id} name={s.name} />
        </div>
      </div>
    </li>
  );
}
