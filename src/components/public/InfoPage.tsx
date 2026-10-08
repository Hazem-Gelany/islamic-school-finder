import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export function InfoPage({ title, intro, sections, children }: { title: string; intro?: string; sections?: { h: string; p: string }[]; children?: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-display text-4xl font-medium tracking-tight text-forest-900">{title}</h1>
        {intro && <p className="mt-4 text-lg leading-relaxed text-muted">{intro}</p>}
        <div className="mt-8 space-y-7">
          {sections?.map((s) => <section key={s.h}><h2 className="font-display text-2xl font-semibold">{s.h}</h2><p className="mt-2 whitespace-pre-line leading-relaxed text-muted">{s.p}</p></section>)}
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
