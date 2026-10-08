'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { SearchOptions } from '@/lib/data/searchOptions';

const selectCls = 'h-12 w-full rounded-[10px] border border-[#7F9288] bg-white px-3 text-base text-ink-900';

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}

export function SearchForm({ options }: { options: SearchOptions }) {
  const t = useTranslations('Search');
  const locale = useLocale();
  const [country, setCountry] = useState('');
  const cities = options.cities.filter((c) => !country || c.country === country);
  return (
    <form action={`/${locale}/schools`} method="get" className="mt-4 flex flex-col gap-5 rounded-[18px] bg-cream-50 p-6 text-ink-900">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="f-country" label={t('country')}>
          <select id="f-country" name="country" className={selectCls} value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">{t('selectCountry')}</option>
            {options.countries.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field id="f-city" label={t('city')}>
          <select id="f-city" name="city" className={selectCls} defaultValue="">
            <option value="">{t('selectCity')}</option>
            {cities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field id="f-grade" label={t('grade')}>
          <select id="f-grade" name="grade" className={selectCls} defaultValue="">
            <option value="">{t('anyGrade')}</option>
            {options.grades.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field id="f-curriculum" label={t('curriculum')}>
          <select id="f-curriculum" name="curriculum" className={selectCls} defaultValue="">
            <option value="">{t('anyCurriculum')}</option>
            {options.curricula.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className="h-[52px] flex-1 rounded-xl bg-forest-900 text-[17px] font-semibold text-cream-50 hover:bg-[#14503F]">{t('find')}</button>
        <Link href="/schools" className="flex h-[52px] flex-1 items-center justify-center rounded-xl border-[1.5px] border-forest-900 text-[17px] font-semibold text-forest-900 hover:bg-mint-100">{t('browse')}</Link>
      </div>
    </form>
  );
}
