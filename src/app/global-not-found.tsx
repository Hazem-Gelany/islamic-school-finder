import './globals.css';

/** Shown for any address that matches no page. A complete, static HTML document (language attribute included), in all three site languages
 *  because we cannot know which one the visitor wanted. Pages that call notFound() themselves use the translated [locale]/not-found.tsx instead. */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <head><title>404 | Islamic School Finder</title><meta name="robots" content="noindex" /></head>
      <body style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }} className="bg-cream-50 text-ink-900">
        <main id="main" className="mx-auto max-w-xl px-6 py-24 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-bronze">404</p>
          <h1 lang="en" className="mt-2 text-3xl font-semibold text-forest-900">We could not find that page</h1>
          <p lang="ar" dir="rtl" className="mt-4 text-xl font-semibold text-forest-900">تعذّر العثور على هذه الصفحة</p>
          <p lang="ms" className="mt-4 text-xl font-semibold text-forest-900">Kami tidak menjumpai halaman itu</p>
          <nav aria-label="Language" className="mt-10 flex flex-wrap justify-center gap-3">
            <a href="/en/schools" lang="en" className="flex h-12 items-center rounded-xl bg-forest-900 px-6 font-semibold text-cream-50">Browse schools</a>
            <a href="/ar/schools" lang="ar" dir="rtl" className="flex h-12 items-center rounded-xl border-[1.5px] border-forest-900 px-6 font-semibold text-forest-900">تصفح المدارس</a>
            <a href="/ms/schools" lang="ms" className="flex h-12 items-center rounded-xl border-[1.5px] border-forest-900 px-6 font-semibold text-forest-900">Semak sekolah</a>
          </nav>
        </main>
      </body>
    </html>
  );
}
