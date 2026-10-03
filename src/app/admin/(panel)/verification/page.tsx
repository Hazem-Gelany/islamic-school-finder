import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { Badge, Flash, VERIFICATION_LABEL } from '@/components/admin/Flash';
import { setVerification } from '../schools/actions';

type Row = { id: string; slug: string; name: string | null; country: string; city: string; verification_status: string; verification_source: string | null; last_verified_at: string | null };

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ v?: string; msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePermission('verification.write');
  const v = sp.v && sp.v in VERIFICATION_LABEL ? sp.v : 'community_added';
  const { data, error } = await supabase.rpc('admin_list_schools', { p_verification: v, p_sort: 'updated_at', p_dir: 'desc', p_limit: 50, p_offset: 0 });
  const rows = (data ?? []) as Row[];
  const input = 'h-11 w-full rounded-[10px] border border-[#B9C4BD] px-3 text-[15px]';
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">Verification</h1>
      <p className="mb-6 max-w-2xl text-muted">Change a school&apos;s verification level and record where the information came from. Every change is saved in the audit log.</p>
      <Flash msg={sp.msg} error={sp.error ?? (error ? friendlyError(error) : undefined)} />
      <nav aria-label="Verification level" className="mb-6 flex flex-wrap gap-2">
        {Object.entries(VERIFICATION_LABEL).map(([k, label]) => (
          <Link key={k} href={`/admin/verification?v=${k}`} aria-current={k === v ? 'page' : undefined}
            className={`flex h-11 items-center rounded-lg border px-4 font-semibold ${k === v ? 'border-forest-900 bg-forest-900 text-cream-50' : 'border-[#B9C4BD] hover:bg-mint-100'}`}>{label}</Link>
        ))}
      </nav>
      <ul className="space-y-4">
        {rows.length === 0 && <li className="rounded-2xl border border-line bg-white p-8 text-center text-muted">No schools at this level.</li>}
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><Link href={`/admin/schools/${r.id}`} className="text-lg font-semibold text-forest-900 hover:underline">{r.name ?? r.slug}</Link><p className="text-sm text-muted">{r.city}, {r.country}</p></div>
              <div className="text-end text-sm text-muted"><Badge>{VERIFICATION_LABEL[r.verification_status]}</Badge><p className="mt-1">{r.last_verified_at ? `Last verified ${new Date(r.last_verified_at).toLocaleDateString('en')}` : 'Never verified'}</p></div>
            </div>
            <form action={setVerification} className="grid gap-3 md:grid-cols-[200px_1fr_1fr_auto] md:items-end">
              <input type="hidden" name="ids" value={r.id} /><input type="hidden" name="return" value={`/admin/verification?v=${v}`} />
              <label className="text-sm font-semibold text-muted">New level<select name="status" defaultValue={r.verification_status} className={`${input} mt-1 font-normal`}>{Object.entries(VERIFICATION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="text-sm font-semibold text-muted">Source<input name="source" defaultValue={r.verification_source ?? ''} placeholder="e.g. School website, phone call" maxLength={300} className={`${input} mt-1 font-normal`} /></label>
              <label className="text-sm font-semibold text-muted">Notes<input name="notes" maxLength={2000} className={`${input} mt-1 font-normal`} /></label>
              <button className="h-11 rounded-[10px] bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">Save</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
