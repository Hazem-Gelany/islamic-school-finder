import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Breadcrumbs } from '@/components/public/Breadcrumbs';
import { VerificationBadge } from '@/components/public/VerificationBadge';
import { altPaths, getCompare, money, pick } from '@/lib/data/public';
import { MAX_COMPARE, parseCompareIds } from '@/features/compare/ids';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ schools?: string | string[] }> };
type I18n = Record<string, string>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Compare' });
  return { title: t('title'), description: t('metaDescription'), alternates: altPaths(locale, '/compare'), robots: { index: false, follow: true } };
}

export default async function ComparePage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Compare' });
  const ts = await getTranslations({ locale, namespace: 'Schools' });
  const tc = await getTranslations({ locale, namespace: 'Common' });
  const ids = parseCompareIds((await searchParams).schools);
  const found = await getCompare(ids);
  const schools = ids.map((id) => found.find((s) => s.id === id)).filter(Boolean) as Record<string, any>[];
  const nm = (s: Record<string, any>) => (s.translations[locale] ?? s.translations.en ?? Object.values(s.translations)[0] ?? {}).name as string;
  const list = (a: I18n[]) => a.map((x) => pick(x, locale)).join(', ') || null;
  const yes = (b: boolean) => (b ? t('yes') : t('no'));
  const tuition = (s: Record<string, any>) => s.tuition_annual_min == null ? null
    : `${s.tuition_annual_min === s.tuition_annual_max ? money(s.tuition_annual_min, s.currency_code, locale) : `${money(s.tuition_annual_min, s.currency_code, locale)} – ${money(s.tuition_annual_max, s.currency_code, locale)}`} ${t('perYear')}`;

  const rows: [string, (s: Record<string, any>) => string | null][] = [
    ['location', (s) => `${pick(s.city.name, locale)}, ${pick(s.country.name, locale)}`],
    ['type', (s) => pick(s.school_type, locale) || null],
    ['gender', (s) => (s.gender_policy ? ts(`gender_${s.gender_policy}` as never) : null)],
    ['grades', (s) => list(s.grade_levels)], ['curriculum', (s) => list(s.curricula)], ['languages', (s) => s.languages.join(', ') || null],
    ['tuition', tuition], ['scholarships', (s) => yes(s.scholarships_available)],
    ['islamic', (s) => yes(s.offers_islamic_studies)], ['quran', (s) => yes(s.offers_quran)], ['arabic', (s) => yes(s.offers_arabic)],
    ['transport', (s) => yes(s.has_transport)], ['boarding', (s) => yes(s.has_boarding)],
    ['facilities', (s) => list(s.facilities)],
    ['accreditation', (s) => s.accreditations.map((a: any) => pick(a.name, locale)).join(', ') || null],
    ['founded', (s) => (s.founded_year ? String(s.founded_year) : null)], ['capacity', (s) => s.student_capacity?.toLocaleString(locale) ?? null],
  ];
  const href = (without?: string) => `/compare?schools=${ids.filter((i) => i !== without).join(',')}`;

  return (
    <>
      <SiteHeader />
      <div className="bg-forest-900 pb-8 pt-6 text-cream-50"><div className="mx-auto max-w-7xl px-6 lg:px-16">
        <Breadcrumbs items={[{ label: tc('home'), href: '/' }, { label: t('title') }]} />
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight lg:text-5xl">{t('title')}</h1>
      </div></div>
      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-6 py-10 lg:px-16">
        {schools.length < 2 ? (
          <div className="rounded-2xl border border-line bg-white p-10 text-center">
            <p className="font-display text-2xl font-semibold">{schools.length === 0 ? t('empty') : t('needTwo')}</p>
            <p className="mt-2 text-muted">{t('emptyHint')}</p>
            <Link href="/schools" className="mt-5 inline-flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50">{t('browse')}</Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-muted">{t('intro')}</p>
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-[640px] border-collapse text-start">
                <caption className="sr-only">{t('title')}</caption>
                <thead>
                  <tr className="border-b border-line align-top">
                    <td className="w-40 p-4" />
                    {schools.map((s) => (
                      <th key={s.id} scope="col" className="min-w-52 p-4 text-start">
                        <Link href={`/schools/${s.country.slug}/${s.city.slug}/${s.slug}`} className="font-display text-xl font-semibold text-forest-900 hover:underline">{nm(s)}</Link>
                        <div className="mt-2 flex flex-wrap items-center gap-2"><VerificationBadge status={s.verification_status} /></div>
                        <Link href={href(s.id)} className="mt-3 inline-flex min-h-9 items-center text-sm underline">{t('remove')}<span className="sr-only"> {nm(s)}</span></Link>
                      </th>))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([key, get]) => {
                    const vals = schools.map((s) => get(s)), differs = new Set(vals).size > 1;
                    return (
                      <tr key={key} className={`border-b border-line last:border-0 ${differs ? 'bg-[#FFFBEF]' : ''}`}>
                        <th scope="row" className="sticky start-0 w-40 bg-inherit p-4 text-start text-sm font-semibold text-muted">
                          {t(`r_${key}` as never)}{differs && <span className="mt-1 block text-xs font-normal text-bronze">{t('differs')}</span>}
                        </th>
                        {vals.map((v, i) => <td key={schools[i].id} className="p-4 align-top">{v ?? <span className="text-muted">{t('notProvided')}</span>}</td>)}
                      </tr>);
                  })}
                  <tr><th scope="row" className="sticky start-0 bg-white p-4 text-start text-sm font-semibold text-muted">{t('r_website')}</th>
                    {schools.map((s) => <td key={s.id} className="p-4">{/^https?:\/\//.test(s.website ?? '') ? <a className="break-all underline" href={s.website} target="_blank" rel="noopener noreferrer">{s.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : <span className="text-muted">{t('notProvided')}</span>}</td>)}</tr>
                </tbody>
              </table>
            </div>
            {schools.length < MAX_COMPARE && <Link href="/schools" className="mt-5 inline-flex h-11 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">{t('add')}</Link>}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
