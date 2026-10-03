import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { Badge, Flash, STATUS_LABEL, VERIFICATION_LABEL } from '@/components/admin/Flash';
import { ConfirmButton, SelectAll } from '@/components/admin/bits';
import { bulkAction, deleteSchool, duplicateSchool, setStatus, setVerification } from './actions';

const PAGE_SIZE = 20;
type SP = { q?: string; status?: string; verification?: string; country?: string; sort?: string; dir?: string; page?: string; msg?: string; error?: string };
type Row = { id: string; slug: string; name: string | null; country: string; country_slug: string; city: string; city_slug: string; status: string; verification_status: string; languages: string[]; updated_at: string; total_count: number };

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, perms } = await requireStaff();
  const can = (p: string) => perms.includes(p);
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = sp.sort ?? 'updated_at', dir = sp.dir === 'asc' ? 'asc' : 'desc';
  const [{ data, error }, { data: countries }] = await Promise.all([
    supabase.rpc('admin_list_schools', { p_search: sp.q || null, p_status: sp.status || null, p_verification: sp.verification || null, p_country: sp.country || null, p_sort: sort, p_dir: dir, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    supabase.from('countries').select('slug, name_i18n').order('slug'),
  ]);
  const rows = (data ?? []) as Row[];
  const total = Number(rows[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (o: Partial<SP>) => { const p = new URLSearchParams(); Object.entries({ ...sp, msg: undefined, error: undefined, ...o }).forEach(([k, v]) => v && p.set(k, String(v))); return `/admin/schools?${p}`; };
  const th = (key: string, label: string) => (
    <th scope="col" aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined} className="px-3 py-3 text-start">
      <Link href={qs({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc', page: undefined })} className="font-semibold hover:underline">{label}{sort === key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</Link>
    </th>
  );
  const ret = qs({});
  const field = 'h-11 rounded-[10px] border border-[#B9C4BD] bg-white px-3 text-[15px]';

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-forest-900">Schools</h1>
        <div className="flex flex-wrap gap-3">
          <a href={`/admin/export?${new URLSearchParams(Object.fromEntries(Object.entries({ q: sp.q, status: sp.status, country: sp.country }).filter(([, v]) => v) as [string, string][]))}`} className="flex h-11 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">Export CSV</a>
          {can('imports.manage') && <Link href="/admin/import" className="flex h-11 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">Import</Link>}
          {can('schools.write') && <Link href="/admin/schools/new" className="flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">Add school</Link>}
        </div>
      </div>
      <Flash msg={sp.msg} error={sp.error ?? (error ? friendlyError(error, 'Unable to load schools.') : undefined)} />

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3" role="search">
        <label className="text-sm font-semibold text-muted">Search<input name="q" defaultValue={sp.q} placeholder="School name or URL name" className={`${field} mt-1 block w-64 font-normal`} /></label>
        <label className="text-sm font-semibold text-muted">Status<select name="status" defaultValue={sp.status ?? ''} className={`${field} mt-1 block font-normal`}><option value="">All</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm font-semibold text-muted">Verification<select name="verification" defaultValue={sp.verification ?? ''} className={`${field} mt-1 block font-normal`}><option value="">All</option>{Object.entries(VERIFICATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm font-semibold text-muted">Country<select name="country" defaultValue={sp.country ?? ''} className={`${field} mt-1 block font-normal`}><option value="">All</option>{(countries ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name_i18n.en}</option>)}</select></label>
        <button className="h-11 rounded-[10px] border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">Apply</button>
        {(sp.q || sp.status || sp.verification || sp.country) && <Link href="/admin/schools" className="flex h-11 items-center px-2 text-sm underline">Clear</Link>}
      </form>

      {(can('schools.write') || can('verification.write')) && (
        <form id="bulk" action={bulkAction} className="mb-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="return" value={ret} />
          <label className="sr-only" htmlFor="bulk-choice">Bulk action for selected schools</label>
          <select id="bulk-choice" name="bulk" className={field} defaultValue="">
            <option value="" disabled>Bulk action…</option>
            {can('schools.write') && <><option value="status:archived">Archive selected</option><option value="status:active">Publish selected</option><option value="status:draft">Move to draft</option><option value="edit:categories">Edit categories, type or city…</option></>}
            {can('verification.write') && <><option value="verify:information_checked">Mark information checked</option><option value="verify:school_verified">Mark school verified</option><option value="verify:community_added">Remove verification</option></>}
          </select>
          <ConfirmButton message="Apply this action to all selected schools?" className="h-11 rounded-[10px] bg-forest-900 px-5 font-semibold text-cream-50">Apply to selected</ConfirmButton>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[980px] text-[15px]">
          <caption className="sr-only">Schools</caption>
          <thead className="border-b border-line bg-[#F6F4EC] text-muted">
            <tr><th scope="col" className="w-10 px-3"><SelectAll form="bulk" /></th>{th('name', 'School')}{th('country', 'Country')}{th('city', 'City')}{th('status', 'Status')}{th('verification', 'Verification')}<th scope="col" className="px-3 py-3 text-start">Languages</th>{th('updated_at', 'Updated')}<th scope="col" className="px-3 py-3 text-start">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted">No schools match these filters.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-3 py-3"><input type="checkbox" form="bulk" name="ids" value={r.id} aria-label={`Select ${r.name ?? r.slug}`} className="size-4" /></td>
                <td className="px-3 py-3"><Link href={`/admin/schools/${r.id}`} className="font-semibold text-forest-900 hover:underline">{r.name ?? r.slug}</Link><div className="text-xs text-muted">{r.slug}</div></td>
                <td className="px-3 py-3">{r.country}</td><td className="px-3 py-3">{r.city}</td>
                <td className="px-3 py-3"><Badge tone={r.status === 'active' ? 'good' : r.status === 'archived' ? 'neutral' : 'warn'}>{STATUS_LABEL[r.status]}</Badge></td>
                <td className="px-3 py-3"><Badge tone={r.verification_status === 'community_added' ? 'neutral' : 'good'}>{VERIFICATION_LABEL[r.verification_status]}</Badge></td>
                <td className="px-3 py-3 uppercase">{r.languages.join(' · ') || '—'}</td>
                <td className="px-3 py-3 whitespace-nowrap"><time dateTime={r.updated_at}>{new Date(r.updated_at).toLocaleDateString('en')}</time></td>
                <td className="px-3 py-3">
                  <details className="relative">
                    <summary className="flex h-10 cursor-pointer list-none items-center rounded-lg border border-[#B9C4BD] px-3 font-semibold">Actions ▾</summary>
                    <div className="absolute end-0 z-10 mt-1 w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
                      <Link className="block rounded-lg px-3 py-2 hover:bg-mint-100" href={`/admin/schools/${r.id}`}>Edit</Link>
                      <a className="block rounded-lg px-3 py-2 hover:bg-mint-100" target="_blank" rel="noreferrer" href={`/en/schools/${r.country_slug}/${r.city_slug}/${r.slug}?preview=1`}>Preview public page</a>
                      {can('schools.write') && <form action={duplicateSchool}><input type="hidden" name="id" value={r.id} /><button className="block w-full rounded-lg px-3 py-2 text-start hover:bg-mint-100">Duplicate</button></form>}
                      {can('verification.write') && (r.verification_status === 'school_verified'
                        ? <form action={setVerification}><input type="hidden" name="ids" value={r.id} /><input type="hidden" name="status" value="information_checked" /><input type="hidden" name="return" value={ret} /><button className="block w-full rounded-lg px-3 py-2 text-start hover:bg-mint-100">Unverify</button></form>
                        : <form action={setVerification}><input type="hidden" name="ids" value={r.id} /><input type="hidden" name="status" value="school_verified" /><input type="hidden" name="return" value={ret} /><button className="block w-full rounded-lg px-3 py-2 text-start hover:bg-mint-100">Verify</button></form>)}
                      {can('schools.write') && <form action={setStatus}><input type="hidden" name="ids" value={r.id} /><input type="hidden" name="status" value={r.status === 'archived' ? 'draft' : 'archived'} /><input type="hidden" name="return" value={ret} />
                        <ConfirmButton message={r.status === 'archived' ? 'Restore this school as a draft?' : 'Archive this school? It will disappear from public search but stay in the database.'} className="block w-full rounded-lg px-3 py-2 text-start hover:bg-mint-100">{r.status === 'archived' ? 'Restore' : 'Archive'}</ConfirmButton></form>}
                      {can('schools.delete') && (r.status === 'archived' || r.status === 'draft') && <form action={deleteSchool}><input type="hidden" name="id" value={r.id} />
                        <ConfirmButton message="Permanently delete this school and all of its data? This cannot be undone." className="block w-full rounded-lg px-3 py-2 text-start text-[#8A1F11] hover:bg-[#FCEDEA]">Delete permanently</ConfirmButton></form>}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted">{total ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString('en')}` : 'No results'}</p>
        <div className="flex gap-2">
          {page > 1 ? <Link className="flex h-10 items-center rounded-lg border border-[#B9C4BD] px-4 font-semibold" href={qs({ page: String(page - 1) })}>Previous</Link> : <span className="flex h-10 items-center rounded-lg border border-line px-4 text-muted">Previous</span>}
          <span className="flex h-10 items-center px-2">Page {page} of {pages}</span>
          {page < pages ? <Link className="flex h-10 items-center rounded-lg border border-[#B9C4BD] px-4 font-semibold" href={qs({ page: String(page + 1) })}>Next</Link> : <span className="flex h-10 items-center rounded-lg border border-line px-4 text-muted">Next</span>}
        </div>
      </nav>
    </>
  );
}
