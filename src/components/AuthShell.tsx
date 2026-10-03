import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

export const fieldClass = 'mt-1.5 h-12 w-full rounded-[10px] border border-[#B9C4BD] bg-white px-3 text-base font-normal text-ink-900';
export const primaryBtn = 'h-12 w-full rounded-xl bg-forest-900 font-semibold text-cream-50 hover:bg-[#14503F]';

/** Header, a centred card and footer shared by the sign-in, sign-up and password pages. */
export function AuthShell({ title, intro, error, notice, children }: { title: string; intro?: string; error?: string; notice?: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-col px-6 py-12">
        <div className="space-y-5 rounded-2xl border border-line bg-white p-8">
          <div><h1 className="font-display text-3xl font-medium text-forest-900">{title}</h1>{intro && <p className="mt-2 text-muted">{intro}</p>}</div>
          {error && <p role="alert" className="rounded-lg bg-[#FCEDEA] p-3 text-sm text-[#8A1F11]">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-mint-100 p-3 text-sm text-forest-900">{notice}</p>}
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
