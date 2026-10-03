'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Facet, Facets } from '@/lib/data/public';
import type { Search } from '@/features/search/params';

const sel = 'h-11 w-full rounded-[10px] border border-[#B9C4BD] bg-white px-3 text-[15px] text-ink-900';
const label = (f: Facet, locale: string) => (typeof f.name === 'string' ? f.name : f.name[locale] || f.name.en);
const key = (f: Facet) => (f.code ?? f.slug)!;

function Group({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-t border-line py-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold">{title}<span aria-hidden className="transition-transform group-open:rotate-180">▾</span></summary>
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </details>
  );
}
function Select({ name, value, placeholder, options, locale, onChange }: { name: string; value?: string; placeholder: string; options: Facet[]; locale: string; onChange?: (v: string) => void }) {
  return (
    <select aria-label={placeholder} name={name} defaultValue={onChange ? undefined : value ?? ''} value={onChange ? value ?? '' : undefined} onChange={onChange && ((e) => onChange(e.target.value))} className={sel}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={key(o)} value={key(o)}>{label(o, locale)} ({o.count})</option>)}
    </select>
  );
}
function Check({ name, value = '1', checked, children }: { name: string; value?: string; checked?: boolean; children: React.ReactNode }) {
  return <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]"><input type="checkbox" name={name} value={value} defaultChecked={checked} className="size-4" />{children}</label>;
}

export function Filters({ facets, values, q, sort, mode = 'search' }: { facets: Facets; values: Search; q?: string; sort?: string; mode?: 'search' | 'match' }) {
  const t = useTranslations('Schools');
  const m = useTranslations('Match');
  const match = mode === 'match';
  const locale = useLocale();
  const [country, setCountry] = useState(values.country ?? '');
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(values.lat != null && values.lng != null ? { lat: values.lat, lng: values.lng } : null);
  const [geo, setGeo] = useState<'idle' | 'busy' | 'denied'>('idle');
  const cities = facets.cities.filter((c) => !country || c.country === country);
  const currency = facets.countries.find((c) => c.slug === country)?.currency;

  function locate() {
    if (!navigator.geolocation) return setGeo('denied');
    setGeo('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPoint({ lat: Math.round(p.coords.latitude * 1e4) / 1e4, lng: Math.round(p.coords.longitude * 1e4) / 1e4 }); setGeo('idle'); },
      () => setGeo('denied'), { timeout: 10000, maximumAge: 300000 });
  }

  return (
    <form action={`/${locale}/${match ? 'match' : 'schools'}`} method="get" aria-label={match ? m('preferences') : t('filters')} className="rounded-2xl border border-line bg-white p-5">
      {!match && q && <input type="hidden" name="q" value={q} />}
      {!match && sort && sort !== 'relevance' && <input type="hidden" name="sort" value={sort} />}
      <div className="flex items-center justify-between pb-3"><h2 className="font-display text-xl font-semibold">{match ? m('preferences') : t('filters')}</h2><a href={`/${locale}/${match ? 'match' : 'schools'}`} className="text-sm underline">{t('clear')}</a></div>
      <Group title={t('where')} open>
        <Select name="country" value={country} placeholder={t('anyCountry')} options={facets.countries} locale={locale} onChange={(v) => setCountry(v)} />
        <Select name="city" value={values.city} placeholder={t('anyCity')} options={cities} locale={locale} key={country} />
        <div className="rounded-xl bg-[#F6F4EC] p-3">
          {point ? (
            <>
              <input type="hidden" name="lat" value={point.lat} /><input type="hidden" name="lng" value={point.lng} />
              <label className="block text-sm font-semibold" htmlFor="radius">{t('radius')}</label>
              <select id="radius" name="radius" defaultValue={String(values.radius ?? 25)} className={`${sel} mt-1`}>{[5, 10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}</select>
              <button type="button" onClick={() => setPoint(null)} className="mt-2 min-h-9 text-sm underline">{t('clearLocation')}</button>
            </>
          ) : <button type="button" onClick={locate} className="min-h-11 w-full rounded-lg border border-[#B9C4BD] bg-white font-semibold">{geo === 'busy' ? t('locating') : t('nearMe')}</button>}
          {geo === 'denied' && <p role="status" className="mt-2 text-sm text-[#8A1F11]">{t('locationDenied')}</p>}
        </div>
      </Group>
      <Group title={t('education')} open>
        <Select name="grade" value={values.grade} placeholder={t('anyGrade')} options={facets.grades} locale={locale} />
        <Select name="curriculum" value={values.curriculum} placeholder={t('anyCurriculum')} options={facets.curricula} locale={locale} />
        <select aria-label={t('anyGender')} name="gender" defaultValue={values.gender ?? ''} className={sel}>
          <option value="">{t('anyGender')}</option><option value="mixed">{t('gender_mixed')}</option><option value="boys">{t('gender_boys')}</option><option value="girls">{t('gender_girls')}</option></select>
        <Select name="language" value={values.language} placeholder={t('anyLanguage')} options={facets.languages} locale={locale} />
      </Group>
      <Group title={t('islamicEducation')}>
        <Check name="islamic" checked={values.islamic}>{t('islamic')}</Check><Check name="quran" checked={values.quran}>{t('quran')}</Check><Check name="arabic" checked={values.arabic}>{t('arabic')}</Check>
      </Group>
      <Group title={t('services')}>
        <Check name="boarding" checked={values.boarding}>{t('boarding')}</Check><Check name="transport" checked={values.transport}>{t('transport')}</Check>
        {facets.facilities.map((f) => <Check key={key(f)} name="facilities" value={key(f)} checked={values.facilities.includes(key(f))}>{label(f, locale)} ({f.count})</Check>)}
      </Group>
      <Group title={match ? m('budget') : t('fees')} open={match}>
        {currency ? (match ? (
          <label className="text-sm">{m('budgetMax')} ({currency})<input name="feeMax" type="number" min={0} inputMode="numeric" defaultValue={values.feeMax} className={`${sel} mt-1`} /></label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">{t('feeMin')} ({currency})<input name="feeMin" type="number" min={0} inputMode="numeric" defaultValue={values.feeMin} className={`${sel} mt-1`} /></label>
            <label className="text-sm">{t('feeMax')} ({currency})<input name="feeMax" type="number" min={0} inputMode="numeric" defaultValue={values.feeMax} className={`${sel} mt-1`} /></label>
          </div>
        )) : <p className="text-sm text-muted">{t('feeHint')}</p>}
      </Group>
      {!match && facets.accreditations.length > 0 && <Group title={t('accreditation')}><Select name="accreditation" value={values.accreditation} placeholder={t('anyAccreditation')} options={facets.accreditations} locale={locale} /></Group>}
      {!match && <Group title={t('trust')}><Check name="verified" checked={values.verified}>{t('verifiedOnly')}</Check></Group>}
      <button className="mt-3 h-12 w-full rounded-xl bg-forest-900 font-semibold text-cream-50 hover:bg-[#14503F]">{match ? m('submit') : t('apply')}</button>
    </form>
  );
}
