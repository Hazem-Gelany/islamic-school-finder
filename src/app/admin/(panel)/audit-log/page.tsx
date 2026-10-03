import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { Flash } from '@/components/admin/Flash';

const PAGE = 50;
const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ entity?: string; school?: string; page?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePermission('audit.read');
  const page = Math.max(1, Number(sp.page) || 1);
  let q = supabase.from('audit_log').select('id, user_id, entity_type, entity_id, school_id, action, field_name, old_value, new_value, created_at', { count: 'exact' }).order('id', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.entity) q = q.eq('entity_type', sp.entity);
  if (sp.school && /^[0-9a-f-]{36}$/i.test(sp.school)) q = q.eq('school_id', sp.school);
  const { data, error, count } = await q;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const link = (p: number) => `/admin/audit-log?${new URLSearchParams({ ...(sp.entity ? { entity: sp.entity } : {}), ...(sp.school ? { school: sp.school } : {}), page: String(p) })}`;
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">Audit log</h1>
      <p className="mb-6 max-w-2xl text-muted">Every important change, with the previous and new value. This log can only be added to, never edited.</p>
      <Flash error={error ? friendlyError(error) : undefined} />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-muted">Record type<select name="entity" defaultValue={sp.entity ?? ''} className="mt-1 block h-11 rounded-[10px] border border-[#B9C4BD] bg-white px-3 font-normal">
          <option value="">All</option>{['schools', 'school_translations', 'school_fees', 'school_media', 'school_curricula', 'school_facilities', 'school_grade_levels', 'school_languages', 'user_roles'].map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
        <button className="h-11 rounded-[10px] border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <caption className="sr-only">Audit log</caption>
          <thead className="border-b border-line bg-[#F6F4EC] text-muted"><tr>{['When', 'Action', 'Record', 'Field', 'Previous', 'New', 'User'].map((h) => <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {(data ?? []).length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted">No entries.</td></tr>}
            {(data ?? []).map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap"><time dateTime={r.created_at}>{new Date(r.created_at).toLocaleString('en')}</time></td>
                <td className="px-3 py-2 font-semibold">{r.action}</td>
                <td className="px-3 py-2">{r.entity_type}{r.school_id && <> · <Link className="underline" href={`/admin/schools/${r.school_id}`}>school</Link></>}</td>
                <td className="px-3 py-2">{r.field_name ?? '—'}</td>
                <td className="max-w-[16rem] break-words px-3 py-2 text-muted">{r.action === 'update' ? show(r.old_value) : r.action === 'delete' ? 'record removed' : '—'}</td>
                <td className="max-w-[16rem] break-words px-3 py-2">{r.action === 'update' ? show(r.new_value) : r.action === 'insert' ? 'record created' : '—'}</td>
                <td className="px-3 py-2 text-xs text-muted">{r.user_id ? r.user_id.slice(0, 8) : 'system'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">Page {page} of {pages}</span>
        <div className="flex gap-2">{page > 1 && <Link className="flex h-10 items-center rounded-lg border border-[#B9C4BD] px-4 font-semibold" href={link(page - 1)}>Previous</Link>}{page < pages && <Link className="flex h-10 items-center rounded-lg border border-[#B9C4BD] px-4 font-semibold" href={link(page + 1)}>Next</Link>}</div>
      </nav>
    </>
  );
}
