import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { Badge, Flash } from '@/components/admin/Flash';
import { ConfirmButton } from '@/components/admin/bits';
import { approve, reject, revoke } from './actions';

type C = { id: string; school_id: string; school_name: string; school_slug: string; country_slug: string; city_slug: string; email: string; display_name: string | null; job_title: string | null; contact_email: string | null; message: string | null; evidence_url: string | null; status: string; review_notes: string | null; created_at: string; reviewed_at: string | null; current_managers: number };
const TABS = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['revoked', 'Revoked'], ['', 'All']] as const;

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ status?: string; school?: string; msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePermission('claims.review');
  const status = sp.status === undefined ? 'pending' : TABS.some(([k]) => k === sp.status) ? sp.status : 'pending';
  const { data, error } = await supabase.rpc('admin_list_claims', { p_status: status });
  const claims = ((data ?? []) as C[]).filter((c) => !sp.school || c.school_id === sp.school);
  const ret = `/admin/claims?status=${status}${sp.school ? `&school=${sp.school}` : ''}`;
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">School claims</h1>
      <p className="mb-6 max-w-2xl text-muted">Check that each person really works at the school (their email domain, the evidence link, a call to the school). Approving gives them access to the school portal and marks the school as <b>School managed</b>.</p>
      <Flash msg={sp.msg} error={sp.error ?? (error ? friendlyError(error, 'Unable to load claims.') : undefined)} />
      <nav aria-label="Claim status" className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <Link key={l} href={`/admin/claims?status=${k}`} aria-current={k === status ? 'page' : undefined} className={`flex h-11 items-center rounded-lg border px-4 font-semibold ${k === status ? 'border-forest-900 bg-forest-900 text-cream-50' : 'border-[#7F9288] hover:bg-mint-100'}`}>{l}</Link>)}
      </nav>
      {sp.school && <p className="mb-4 text-sm">Showing one school only. <Link className="underline" href={`/admin/claims?status=${status}`}>Show all</Link></p>}
      <ul className="space-y-4">
        {claims.length === 0 && <li className="rounded-2xl border border-line bg-white p-8 text-center text-muted">No claims here.</li>}
        {claims.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/admin/schools/${c.school_id}`} className="text-lg font-semibold text-forest-900 hover:underline">{c.school_name}</Link>
                <p className="text-sm text-muted"><a className="underline" target="_blank" rel="noreferrer" href={`/en/schools/${c.country_slug}/${c.city_slug}/${c.school_slug}?preview=1`}>View public page</a> · received {new Date(c.created_at).toLocaleDateString('en')}</p>
              </div>
              <Badge tone={c.status === 'approved' ? 'good' : c.status === 'pending' ? 'warn' : 'neutral'}>{c.status}</Badge>
            </div>
            <dl className="mt-4 grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2">
              <div><dt className="text-sm text-muted">Account</dt><dd className="font-semibold">{c.display_name ? `${c.display_name} · ` : ''}{c.email}</dd></div>
              <div><dt className="text-sm text-muted">Role at the school</dt><dd className="font-semibold">{c.job_title ?? '—'}</dd></div>
              <div><dt className="text-sm text-muted">Contact email</dt><dd className="font-semibold break-all">{c.contact_email ?? '—'}</dd></div>
              <div><dt className="text-sm text-muted">Evidence</dt><dd>{c.evidence_url ? <a className="break-all font-semibold underline" href={c.evidence_url} target="_blank" rel="noopener noreferrer nofollow">{c.evidence_url}</a> : '—'}</dd></div>
              {c.message && <div className="sm:col-span-2"><dt className="text-sm text-muted">Message</dt><dd className="whitespace-pre-wrap">{c.message}</dd></div>}
            </dl>
            {c.current_managers > 0 && c.status === 'pending' && <p className="mt-3 rounded-lg bg-[#FBF0D9] p-2 text-sm text-bronze">This school already has {c.current_managers} representative(s). Make sure this is an additional colleague.</p>}
            {c.review_notes && c.status !== 'pending' && <p className="mt-3 text-sm"><b>Note:</b> {c.review_notes}</p>}
            {(c.status === 'pending' || c.status === 'approved') && (
              <form className="mt-4 space-y-3 border-t border-line pt-4">
                <input type="hidden" name="id" value={c.id} /><input type="hidden" name="return" value={ret} />
                <label className="block text-sm font-semibold text-muted">Note for the person (required when rejecting or revoking)<input name="notes" maxLength={1000} className="mt-1 block h-11 w-full rounded-[10px] border border-[#7F9288] px-3 font-normal" /></label>
                <div className="flex flex-wrap gap-3">
                  {c.status === 'pending' ? <>
                    <ConfirmButton message="Approve this claim? They will be able to manage this school." formAction={approve} className="h-11 rounded-xl bg-forest-900 px-5 font-semibold text-cream-50">Approve</ConfirmButton>
                    <ConfirmButton message="Reject this claim?" formAction={reject} className="h-11 rounded-xl border-[1.5px] border-[#B3261E] px-5 font-semibold text-[#8A1F11]">Reject</ConfirmButton></>
                    : <ConfirmButton message="Remove this person's access to the school?" formAction={revoke} className="h-11 rounded-xl border-[1.5px] border-[#B3261E] px-5 font-semibold text-[#8A1F11]">Revoke access</ConfirmButton>}
                </div>
              </form>)}
          </li>))}
      </ul>
    </>
  );
}
