import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { Badge, Flash } from '@/components/admin/Flash';
import { ConfirmButton } from '@/components/admin/bits';
import { commitImport, discardImport } from '../actions';

type Issue = { field: string; message: string };

export default async function ImportReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requirePermission('imports.manage');
  const { data: job } = await supabase.from('import_jobs').select('*').eq('id', id).maybeSingle();
  if (!job) notFound();
  const { data: rows } = await supabase.from('import_rows').select('row_number, state, raw, errors').eq('job_id', id).in('state', ['invalid', 'duplicate']).order('row_number').limit(200);
  const committed = job.status === 'committed', canCommit = job.status === 'validated' && job.valid_rows > 0;
  const stat = (label: string, n: number, tone: string) => <div className="rounded-2xl border border-line bg-white p-5"><dt className="text-sm text-muted">{label}</dt><dd className={`mt-1 text-4xl font-semibold ${tone}`}>{n.toLocaleString('en')}</dd></div>;
  return (
    <>
      <p className="text-sm"><Link href="/admin/import" className="underline">← Import and export</Link></p>
      <h1 className="mb-1 mt-1 text-3xl font-semibold text-forest-900">{job.filename}</h1>
      <p className="mb-6 text-muted">{committed ? <Badge tone="good">Imported</Badge> : <Badge tone="warn">Not imported yet</Badge>} · {new Date(job.created_at).toLocaleString('en')}</p>
      <Flash msg={sp.msg} error={sp.error ?? (job.error_message && !committed ? job.error_message : undefined)} />
      <dl className="mb-6 grid gap-4 sm:grid-cols-4">
        {stat('Rows in file', job.total_rows, 'text-ink-900')}{stat(committed ? 'Imported' : 'Ready to import', job.valid_rows, 'text-forest-900')}
        {stat('Duplicates (skipped)', job.duplicate_rows, 'text-bronze')}{stat('Invalid (skipped)', job.invalid_rows, 'text-[#B3261E]')}
      </dl>
      {!committed && (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          {canCommit && <form action={commitImport}><input type="hidden" name="id" value={id} />
            <ConfirmButton message={`Import ${job.valid_rows} schools now? All of them are saved together, or none if anything fails.`} className="h-12 rounded-xl bg-forest-900 px-6 font-semibold text-cream-50 hover:bg-[#14503F]">Import {job.valid_rows} schools</ConfirmButton></form>}
          {!canCommit && <p className="text-muted">There are no valid rows to import. Fix the file and upload it again.</p>}
          {(job.duplicate_rows > 0 || job.invalid_rows > 0) && <a href={`/admin/import/${id}/issues`} className="flex h-12 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">Download problems (CSV)</a>}
          <form action={discardImport}><input type="hidden" name="id" value={id} /><ConfirmButton message="Discard this import?" className="h-12 rounded-xl border border-[#B9C4BD] px-5 font-semibold">Discard</ConfirmButton></form>
        </div>)}
      {committed && <Link href="/admin/schools" className="mb-8 inline-flex h-12 items-center rounded-xl bg-forest-900 px-6 font-semibold text-cream-50">View schools</Link>}
      <section aria-labelledby="issues">
        <h2 id="issues" className="mb-3 text-xl font-semibold">Rows that will be skipped</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[640px] text-[15px]">
            <caption className="sr-only">Skipped rows</caption>
            <thead className="border-b border-line bg-[#F6F4EC] text-muted"><tr>{['Spreadsheet row', 'Type', 'School', 'Problem'].map((h) => <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {(rows ?? []).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted">Every row is valid.</td></tr>}
              {(rows ?? []).map((r) => {
                const src = (r.raw.source ?? {}) as Record<string, string>;
                return (
                  <tr key={r.row_number} className="align-top">
                    <td className="px-3 py-3">{r.row_number}</td>
                    <td className="px-3 py-3"><Badge tone={r.state === 'duplicate' ? 'warn' : 'neutral'}>{r.state === 'duplicate' ? 'Duplicate' : 'Invalid'}</Badge></td>
                    <td className="px-3 py-3">{r.raw.name_primary ?? src.name_en ?? src.name_ar ?? src.name_ms ?? src.slug ?? '—'}</td>
                    <td className="px-3 py-3"><ul className="space-y-1">{(r.errors as Issue[]).map((e, i) => <li key={i}><b>{e.field}:</b> {e.message}</li>)}</ul></td>
                  </tr>);
              })}
            </tbody>
          </table>
        </div>
        {(rows ?? []).length === 200 && <p className="mt-2 text-sm text-muted">Showing the first 200. Download the CSV for the full list.</p>}
      </section>
    </>
  );
}
