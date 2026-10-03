import { getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Breadcrumbs } from './Breadcrumbs';

export type Section = { title: string; text: string };

/** Plain content page whose text lives in messages/<locale>.json under `namespace` (title, intro, sections[]). */
export async function StaticPage({ locale, namespace, children, after }: { locale: string; namespace: 'About' | 'ContactPage' | 'Privacy'; children?: React.ReactNode; after?: React.ReactNode }) {
  const t = await getTranslations({ locale, namespace }); const tc = await getTranslations({ locale, namespace: 'Common' });
  const sections = t.raw('sections') as Section[];
  return (
    <>
      <SiteHeader />
      <div className="bg-forest-900 pb-10 pt-6 text-cream-50"><div className="mx-auto max-w-7xl px-6 lg:px-16">
        <Breadcrumbs items={[{ label: tc('home'), href: '/' }, { label: t('title') }]} />
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight lg:text-5xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-lg text-mist">{t('intro')}</p>
      </div></div>
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 lg:px-0">
        {children}
        {sections.map((s, i) => (
          <section key={i} aria-labelledby={`s${i}`} className="rounded-2xl border border-line bg-white p-6">
            <h2 id={`s${i}`} className="mb-3 font-display text-2xl font-semibold">{s.title}</h2>
            <div className="space-y-3 leading-relaxed">{s.text.split('\n').map((p, j) => <p key={j}>{p}</p>)}</div>
          </section>))}
        {after}
      </main>
      <SiteFooter />
    </>
  );
}
