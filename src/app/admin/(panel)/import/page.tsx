import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { Badge, Flash } from '@/components/admin/Flash';
import { startImport } from './actions';

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePermission('imports.manage');
  const { data: jobs } = await supabase.from('import_jobs').select('id, filename, status, total_rows, valid_rows, duplicate_rows, invalid_rows, created_at').order('created_at', { ascending: false }).limit(10);
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">Import and export</h1>
      <p className="mb-6 max-w-2xl text-muted">Add many schools at once from a spreadsheet. The file is checked first and you see a report. Nothing is saved until you confirm.</p>
      <Flash msg={sp.msg} error={sp.error} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="imp" className="rounded-2xl border border-line bg-white p-6">
          <h2 id="imp" className="mb-3 text-xl font-semibold">Import schools (CSV)</h2>
          <ol className="mb-4 list-decimal space-y-1 ps-5 text-[15px] text-muted">
            <li><Link className="font-semibold underline" href="/admin/import/template">Download the template</Link> and fill it in (Excel: save as <b>CSV UTF-8</b>).</li>
            <li>Country and city must already exist (see <Link className="underline" href="/admin/settings/places">Places</Link>). Categories use their codes, separated by semicolons, e.g. <code>british;ib</code>.</li>
            <li>Upload the file. Up to 2,000 rows or 2 MB.</li>
            <li>Review the report, then confirm. If anything fails, nothing is imported.</li>
          </ol>
          <form action={startImport} className="space-y-4">
            <label className="block text-sm font-semibold text-muted">CSV file<input name="file" type="file" accept=".csv,text/csv" required className="mt-1 block w-full text-base font-normal" /></label>
            <button className="h-12 rounded-xl bg-forest-900 px-6 font-semibold text-cream-50 hover:bg-[#14503F]">Check file</button>
          </form>
          <p className="mt-4 text-sm text-muted">Imported schools are created as drafts with the lowest verification level unless the file says <code>active</code>. Existing schools are never changed by an import.</p>
        </section>
        <section aria-labelledby="exp" className="rounded-2xl border border-line bg-white p-6">
          <h2 id="exp" className="mb-3 text-xl font-semibold">Export schools (CSV)</h2>
          <p className="mb-4 text-[15px] text-muted">Download every school in the same format the importer reads. To export a filtered list, use the <b>Export CSV</b> link on the Schools page.</p>
          <a href="/admin/export" className="inline-flex h-12 items-center rounded-xl border-[1.5px] border-forest-900 px-6 font-semibold text-forest-900 hover:bg-mint-100">Download all schools</a>
        </section>
      </div>
      <section aria-labelledby="recent" className="mt-8">
        <h2 id="recent" className="mb-3 text-xl font-semibold">Recent imports</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[640px] text-[15px]">
            <caption className="sr-only">Recent imports</caption>
            <thead className="border-b border-line bg-[#F6F4EC] text-muted"><tr>{['File', 'Status', 'Rows', 'Valid', 'Duplicates', 'Invalid', 'Date'].map((h) => <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {(jobs ?? []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted">No imports yet.</td></tr>}
              {(jobs ?? []).map((j) => (
                <tr key={j.id}>
                  <td className="px-3 py-3"><Link className="font-semibold text-forest-900 underline" href={`/admin/import/${j.id}`}>{j.filename}</Link></td>
                  <td className="px-3 py-3"><Badge tone={j.status === 'committed' ? 'good' : 'warn'}>{j.status === 'committed' ? 'Imported' : j.status === 'validated' ? 'Waiting for confirmation' : j.status}</Badge></td>
                  <td className="px-3 py-3">{j.total_rows}</td><td className="px-3 py-3">{j.valid_rows}</td><td className="px-3 py-3">{j.duplicate_rows}</td><td className="px-3 py-3">{j.invalid_rows}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{new Date(j.created_at).toLocaleDateString('en')}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
