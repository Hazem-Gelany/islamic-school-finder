import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { Badge, Flash } from '@/components/admin/Flash';
import { ConfirmButton } from '@/components/admin/bits';
import { reviewClaim } from './actions';

type Claim = { id: string; status: string; school_name: string | null; school_path: string; claimant_email: string; job_title: string | null; contact_email: string | null; message: string | null; evidence_url: string | null; created_at: string; reviewed_at: string | null; review_notes: string | null; has_members: boolean };
const STATUSES = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', revoked: 'Revoked' } as const;

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ s?: string; msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePermission('claims.review');
  const s = sp.s && sp.s in STATUSES ? sp.s : 'pending';
  const { data, error } = await supabase.rpc('admin_list_claims', { p_status: s });
  const rows = (data ?? []) as Claim[];
  const input = 'h-11 w-full rounded-[10px] border border-[#B9C4BD] px-3 text-[15px]';
  const safe = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">School claims</h1>
      <p className="mb-6 max-w-2xl text-muted">People asking to manage a school profile. Check the evidence (for example, the person is listed on the school&apos;s own website or writes from its email domain) before approving. Approving gives them access to that school only.</p>
      <Flash msg={sp.msg} error={sp.error ?? (error ? friendlyError(error) : undefined)} />
      <nav aria-label="Claim status" className="mb-6 flex flex-wrap gap-2">
        {Object.entries(STATUSES).map(([k, label]) => (
          <Link key={k} href={`/admin/claims?s=${k}`} aria-current={k === s ? 'page' : undefined}
            className={`flex h-11 items-center rounded-lg border px-4 font-semibold ${k === s ? 'border-forest-900 bg-forest-900 text-cream-50' : 'border-[#B9C4BD] hover:bg-mint-100'}`}>{label}</Link>))}
      </nav>
      <ul className="space-y-4">
        {rows.length === 0 && <li className="rounded-2xl border border-line bg-white p-8 text-center text-muted">No {STATUSES[s as keyof typeof STATUSES].toLowerCase()} claims.</li>}
        {rows.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div><Link href={`/en/schools/${c.school_path}?preview=1`} className="text-lg font-semibold text-forest-900 hover:underline">{c.school_name ?? c.school_path}</Link>
                <p className="text-sm text-muted">Submitted {new Date(c.created_at).toLocaleDateString('en', { dateStyle: 'medium' })}</p></div>
              <div className="flex flex-wrap gap-2">{c.has_members && <Badge tone="warn">School already has a manager</Badge>}<Badge>{STATUSES[c.status as keyof typeof STATUSES]}</Badge></div>
            </div>
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Account email</dt><dd className="font-semibold">{c.claimant_email}</dd></div>
              <div><dt className="text-muted">School contact email</dt><dd className="font-semibold">{c.contact_email ?? '—'}</dd></div>
              <div><dt className="text-muted">Role at the school</dt><dd className="font-semibold">{c.job_title ?? '—'}</dd></div>
              <div><dt className="text-muted">Evidence link</dt><dd className="break-all font-semibold">{safe(c.evidence_url) ? <a className="underline" href={safe(c.evidence_url)!} target="_blank" rel="noopener noreferrer nofollow">{c.evidence_url}</a> : '—'}</dd></div>
            </dl>
            {c.message && <p className="mt-3 whitespace-pre-line rounded-lg bg-[#F6F4EC] p-3 text-sm">{c.message}</p>}
            {c.status === 'pending' ? (
              <form action={reviewClaim} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <input type="hidden" name="id" value={c.id} />
                <label className="text-sm font-semibold text-muted">Note for the claimant (optional)<input name="notes" maxLength={2000} className={`${input} mt-1 font-normal`} /></label>
                <ConfirmButton name="decision" value="approve" message="Approve this claim? The person will be able to manage this school." className="h-11 rounded-[10px] bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">Approve</ConfirmButton>
                <button name="decision" value="reject" className="h-11 rounded-[10px] border border-[#B9C4BD] px-5 font-semibold hover:bg-mint-100">Reject</button>
              </form>
            ) : c.review_notes && <p className="mt-3 text-sm text-muted">Note: {c.review_notes}</p>}
          </li>))}
      </ul>
    </>
  );
}
