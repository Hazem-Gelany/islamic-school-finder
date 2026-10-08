import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export const fieldCls = 'mt-1.5 h-12 w-full rounded-[10px] border border-[#7F9288] bg-white px-3 text-base font-normal text-ink-900';
export const btnCls = 'h-12 w-full rounded-xl bg-forest-900 font-semibold text-cream-50 hover:bg-[#14503F]';

export function AuthCard({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex max-w-xl px-6 py-14">
        <div className="w-full rounded-2xl border border-line bg-white p-8">
          <h1 className="font-display text-3xl font-medium text-forest-900">{title}</h1>
          {intro && <p className="mt-2 text-muted">{intro}</p>}
          <div className="mt-6 space-y-5">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
export function Notice({ tone, children }: { tone: 'ok' | 'err'; children: React.ReactNode }) {
  return <p role={tone === 'err' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${tone === 'err' ? 'bg-[#FCEDEA] text-[#8A1F11]' : 'bg-mint-100 text-forest-900'}`}>{children}</p>;
}
