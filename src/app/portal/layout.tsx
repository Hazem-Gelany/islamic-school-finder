import '../globals.css';
export const metadata = { title: 'School portal | Islamic School Finder', robots: { index: false, follow: false } };

export default function PortalRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }} className="min-h-screen bg-cream-50">
        <header className="bg-forest-900 text-cream-50">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <a href="/portal" className="text-lg font-semibold">School portal <span className="text-gold-400">· Islamic School Finder</span></a>
            <nav aria-label="Portal" className="flex gap-5 text-[15px] font-medium"><a href="/portal">My schools</a><a href="/en/account">My account</a><a href="/en">Public site</a></nav>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
      </body>
    </html>
  );
}
