import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { Flash } from '@/components/admin/Flash';

const LANGS = [['ar', 'Arabic'], ['ms', 'Malay'], ['en', 'English']] as const;
type Row = { id: string; slug: string; name: string | null; city: string; country: string; languages: string[] };

export default async function TranslationsPage({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const missing = LANGS.some(([c]) => c === sp.missing) ? sp.missing! : 'ar';
  const { data, error } = await supabase.rpc('admin_list_schools', { p_missing_lang: missing, p_status: null, p_sort: 'name', p_dir: 'asc', p_limit: 100, p_offset: 0 });
  const rows = ((data ?? []) as Row[]);
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">Translations</h1>
      <p className="mb-6 max-w-2xl text-muted">Schools that are still missing content in a language. Open a school and use the language tabs to add it.</p>
      <Flash error={error ? friendlyError(error) : undefined} />
      <nav aria-label="Missing language" className="mb-6 flex gap-2">
        {LANGS.map(([c, l]) => <Link key={c} href={`/admin/translations?missing=${c}`} aria-current={c === missing ? 'page' : undefined}
          className={`flex h-11 items-center rounded-lg border px-4 font-semibold ${c === missing ? 'border-forest-900 bg-forest-900 text-cream-50' : 'border-[#7F9288] hover:bg-mint-100'}`}>Missing {l}</Link>)}
      </nav>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
        {rows.length === 0 && <li className="p-8 text-center text-muted">Every school has this language.</li>}
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><Link href={`/admin/schools/${r.id}`} className="font-semibold text-forest-900 hover:underline">{r.name ?? r.slug}</Link><p className="text-sm text-muted">{r.city}, {r.country} · has: {r.languages.join(', ').toUpperCase() || 'none'}</p></div>
            <Link href={`/admin/schools/${r.id}`} className="flex h-10 items-center rounded-lg border border-[#7F9288] px-4 font-semibold hover:bg-mint-100">Add translation</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
