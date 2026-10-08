import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { getLookups } from '@/lib/data/lookups';
import { mediaUrl } from '@/lib/data/public';
import { diffChange, type Names } from '@/features/changes/diff';
import { Badge, Flash } from '@/components/admin/Flash';
import { ConfirmButton } from '@/components/admin/bits';
import { approveChange, rejectChange } from './actions';

type CR = { id: string; school_id: string; school_name: string; email: string; display_name: string | null; summary: string | null; payload: Record<string, any>; media: { add?: any[]; remove?: string[] }; status: string; review_notes: string | null; created_at: string; updated_at: string };
type Media = { id: string; storage_path: string; kind: string; alt_text_i18n?: { en?: string } };
const TABS = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected']] as const;
const map = (o: { id: number; label: string }[]) => Object.fromEntries(o.map((x) => [x.id, x.label]));

export default async function ChangesPage({ searchParams }: { searchParams: Promise<{ status?: string; msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePermission('schools.write');
  const status = TABS.some(([k]) => k === sp.status) ? sp.status! : 'pending';
  const [{ data, error }, L] = await Promise.all([supabase.rpc('admin_list_change_requests', { p_status: status }), getLookups(supabase)]);
  const names: Names = { curricula: map(L.curricula), gradeLevels: map(L.gradeLevels), facilities: map(L.facilities), feeCategories: map(L.feeCategories), schoolTypes: map(L.schoolTypes), languages: Object.fromEntries(L.languages.map((l) => [l.code, l.label])) };
  const reqs = (data ?? []) as CR[];
  const currents = status === 'pending' ? await Promise.all(reqs.map((r) => supabase.rpc('get_school_for_edit', { p_id: r.school_id }).then((x) => x.data ?? {}))) : [];
  const ret = `/admin/changes?status=${status}`;
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">Change requests</h1>
      <p className="mb-6 max-w-2xl text-muted">School representatives publish contact details themselves. Everything else they change (names, descriptions, fees, location, categories, photos) appears here first. Nothing goes live until you approve it.</p>
      <Flash msg={sp.msg} error={sp.error ?? (error ? friendlyError(error, 'Unable to load requests.') : undefined)} />
      <nav aria-label="Request status" className="mb-6 flex gap-2">{TABS.map(([k, l]) => <Link key={k} href={`/admin/changes?status=${k}`} aria-current={k === status ? 'page' : undefined} className={`flex h-11 items-center rounded-lg border px-4 font-semibold ${k === status ? 'border-forest-900 bg-forest-900 text-cream-50' : 'border-[#7F9288] hover:bg-mint-100'}`}>{l}</Link>)}</nav>
      <ul className="space-y-5">
        {reqs.length === 0 && <li className="rounded-2xl border border-line bg-white p-8 text-center text-muted">Nothing here.</li>}
        {reqs.map((r, i) => {
          const rows = status === 'pending' ? diffChange(currents[i], r.payload, names) : [];
          const cur = currents[i] as { media?: Media[] } | undefined;
          const removing = (r.media.remove ?? []).map((id) => cur?.media?.find((m) => m.id === id)).filter((m): m is Media => !!m);
          return (
            <li key={r.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><Link href={`/admin/schools/${r.school_id}`} className="text-lg font-semibold text-forest-900 hover:underline">{r.school_name}</Link>
                  <p className="text-sm text-muted">From {r.display_name ? `${r.display_name} · ` : ''}{r.email} · updated {new Date(r.updated_at).toLocaleString('en')}</p></div>
                <Badge tone={r.status === 'approved' ? 'good' : r.status === 'pending' ? 'warn' : 'neutral'}>{r.status}</Badge>
              </div>
              {r.summary && <p className="mt-3 text-sm"><b>Their summary:</b> {r.summary}</p>}
              {status === 'pending' && (
                <div className="mt-4 space-y-4">
                  {rows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[560px] text-[15px]">
                      <caption className="sr-only">Proposed changes</caption>
                      <thead className="bg-[#F6F4EC] text-sm text-muted"><tr><th scope="col" className="w-44 px-3 py-2 text-start">Field</th><th scope="col" className="px-3 py-2 text-start">Now published</th><th scope="col" className="px-3 py-2 text-start">Proposed</th></tr></thead>
                      <tbody className="divide-y divide-line">{rows.map((d) => (
                        <tr key={d.label} className="align-top"><th scope="row" className="px-3 py-2 text-start font-semibold">{d.label}</th>
                          <td className="whitespace-pre-wrap px-3 py-2 text-muted">{d.before}</td><td className="whitespace-pre-wrap bg-[#FFFBEF] px-3 py-2 font-medium">{d.after}</td></tr>))}</tbody></table></div>)}
                  {rows.length === 0 && !r.media.add?.length && !removing.length && <p className="rounded-lg bg-[#F6F4EC] p-3 text-sm text-muted">Everything in this request already matches the published profile.</p>}
                  {(r.media.add?.length ?? 0) > 0 && (<div><p className="mb-2 text-sm font-semibold">Photos to add</p><ul className="grid grid-cols-2 gap-3 md:grid-cols-4">{r.media.add!.map((m: any) => (
                    <li key={m.storage_path} className="overflow-hidden rounded-xl border border-line">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={mediaUrl(m.storage_path)} alt={m.alt} className="aspect-[4/3] w-full object-cover" /><p className="p-2 text-sm"><b className="capitalize">{m.kind}</b>: {m.alt}</p></li>))}</ul></div>)}
                  {removing.length > 0 && (<div><p className="mb-2 text-sm font-semibold">Published photos they want removed</p><ul className="grid grid-cols-2 gap-3 md:grid-cols-4">{removing.map((m) => (
                    <li key={m.id} className="overflow-hidden rounded-xl border border-[#E8B4AC]">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={mediaUrl(m.storage_path)} alt={m.alt_text_i18n?.en ?? ''} className="aspect-[4/3] w-full object-cover" /><p className="p-2 text-sm capitalize">{m.kind}</p></li>))}</ul></div>)}
                  <form className="space-y-3 border-t border-line pt-4">
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="return" value={ret} />
                    <label className="block text-sm font-semibold text-muted">Note for the school (required when rejecting)<input name="notes" maxLength={1000} className="mt-1 block h-11 w-full rounded-[10px] border border-[#7F9288] px-3 font-normal" /></label>
                    <div className="flex flex-wrap gap-3">
                      <ConfirmButton message="Publish these changes now?" formAction={approveChange} className="h-11 rounded-xl bg-forest-900 px-5 font-semibold text-cream-50">Approve and publish</ConfirmButton>
                      <ConfirmButton message="Reject these changes?" formAction={rejectChange} className="h-11 rounded-xl border-[1.5px] border-[#B3261E] px-5 font-semibold text-[#8A1F11]">Reject</ConfirmButton>
                    </div>
                  </form>
                </div>)}
              {status !== 'pending' && r.review_notes && <p className="mt-3 text-sm"><b>Note:</b> {r.review_notes}</p>}
            </li>);
        })}
      </ul>
    </>
  );
}
