import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SearchForm } from '@/components/SearchForm';
import { CompareIcon, MailIcon, MatchIcon, SearchIcon, ShieldIcon } from '@/components/icons';
import { altPaths } from '@/lib/data/public';
import { getSearchOptions } from '@/lib/data/searchOptions';

type Step = { title: string; text: string };
type Level = { label: string; name: string; text: string };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: { absolute: `${t('Home.title')} | ${t('Hero.eyebrow')}` }, description: t('Hero.subtitle'), alternates: altPaths(locale, ''), openGraph: { title: t('Home.title'), description: t('Hero.title'), type: 'website', url: `/${locale}` } };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, options] = await Promise.all([getTranslations(), getSearchOptions(locale)]);
  const steps = t.raw('How.steps') as Record<'find' | 'compare' | 'match' | 'contact', Step>;
  const icons = { find: <SearchIcon />, compare: <CompareIcon />, match: <MatchIcon />, contact: <MailIcon /> };
  const levels = t.raw('Verification.levels') as Level[];
  const matched = t.raw('Example.matched') as string[];
  const unmatched = t.raw('Example.unmatched') as string[];
  const pad = 'mx-auto max-w-7xl px-6 lg:px-16';

  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <section className="bg-forest-900 pb-24 pt-16 text-cream-50">
          <div className={`${pad} flex flex-col gap-14 lg:flex-row lg:items-start`}>
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gold-400">{t('Hero.eyebrow')}</p>
              <h1 className="font-display text-5xl font-medium leading-[1.08] tracking-tight lg:text-[68px]">{t('Hero.title')}</h1>
              <p className="max-w-xl text-xl leading-relaxed text-mist">{t('Hero.subtitle')}</p>
              <SearchForm options={options} />
            </div>
            <aside aria-label={t('Example.label')} className="flex w-full flex-col gap-4 rounded-[20px] bg-white p-7 text-ink-900 lg:mt-10 lg:w-[400px] lg:shrink-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7A72]">{t('Example.label')}</p>
              <p className="font-display text-[26px] font-semibold leading-tight">{t('Example.school')}</p>
              <p className="inline-flex items-center gap-2 self-start rounded-full bg-mint-100 px-3.5 py-2 text-[15px] font-semibold text-forest-900"><ShieldIcon />{t('Example.verified')}</p>
              <p className="text-lg font-semibold">{t('Example.score')}</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[15px] text-muted">
                {matched.map((m) => <li key={m}><span aria-hidden>✓ </span>{m}</li>)}
              </ul>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-3.5 text-[15px] text-bronze">
                {unmatched.map((m) => <li key={m}><span aria-hidden>✗ </span>{m}</li>)}
              </ul>
            </aside>
          </div>
        </section>

        <section className={`${pad} flex flex-col gap-10 py-20`}>
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 className="font-display text-4xl font-medium tracking-tight">{t('How.title')}</h2>
            <p className="text-lg leading-relaxed text-muted">{t('How.subtitle')}</p>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(icons) as (keyof typeof icons)[]).map((k) => (
              <li key={k} className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-7">
                <span className="text-forest-900">{icons[k]}</span>
                <h3 className="font-display text-2xl font-semibold">{steps[k].title}</h3>
                <p className="leading-relaxed text-muted">{steps[k].text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-sand-100 py-16">
          <div className={`${pad} flex flex-col gap-12 lg:flex-row`}>
            <div className="flex flex-col gap-4 lg:w-[420px] lg:shrink-0">
              <h2 className="font-display text-4xl font-medium leading-tight tracking-tight">{t('Verification.title')}</h2>
              <p className="text-lg leading-relaxed text-muted">{t('Verification.text')}</p>
            </div>
            <ol className="grid flex-1 gap-5 sm:grid-cols-2">
              {levels.map((l, i) => (
                <li key={l.name} className={`flex flex-col gap-2 rounded-[14px] p-5 ${i === 3 ? 'bg-forest-900 text-cream-50' : 'bg-white'}`}>
                  <span className={`text-[13px] font-semibold uppercase tracking-widest ${i === 3 ? 'text-gold-400' : 'text-[#5E6E66]'}`}>{l.label}</span>
                  <span className="text-xl font-semibold">{l.name}</span>
                  <span className={`text-[15px] leading-normal ${i === 3 ? 'text-mist' : 'text-muted'}`}>{l.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${pad} grid gap-6 py-16 md:grid-cols-2`}>
          <div className="flex flex-col items-start gap-4 rounded-[20px] bg-forest-900 p-10 text-cream-50">
            <h2 className="font-display text-[32px] font-medium leading-tight">{t('Cta.parentTitle')}</h2>
            <p className="text-[17px] leading-relaxed text-mist">{t('Cta.parentText')}</p>
            <Link href="/match" className="mt-2 flex h-[52px] items-center rounded-xl bg-gold-400 px-7 text-[17px] font-semibold text-forest-900 hover:brightness-95">{t('Cta.parentButton')}</Link>
          </div>
          <div className="flex flex-col items-start gap-4 rounded-[20px] border border-line bg-white p-10">
            <h2 className="font-display text-[32px] font-medium leading-tight">{t('Cta.schoolTitle')}</h2>
            <p className="text-[17px] leading-relaxed text-muted">{t('Cta.schoolText')}</p>
            <Link href="/claim" className="mt-2 flex h-[52px] items-center rounded-xl border-[1.5px] border-forest-900 px-7 text-[17px] font-semibold text-forest-900 hover:bg-mint-100">{t('Cta.schoolButton')}</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
