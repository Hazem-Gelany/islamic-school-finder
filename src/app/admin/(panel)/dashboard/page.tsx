import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';

const cards: [string, string][] = [
  ['total_schools', 'Total schools'], ['active_schools', 'Published schools'], ['verified_schools', 'Verified schools'], ['managed_schools', 'School-managed profiles'],
  ['pending_verification', 'Pending verification'], ['incomplete_profiles', 'Incomplete profiles'], ['countries', 'Countries'], ['cities', 'Cities'],
  ['new_schools_30d', 'New schools (30 days)'], ['parent_accounts', 'Parent accounts'], ['school_leads', 'School leads'],
];

export default async function Dashboard() {
  const { supabase, perms } = await requireStaff();
  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  const stats = (data ?? {}) as Record<string, number>;
  const pending = async (table: string, perm: string) => perms.includes(perm) ? (await supabase.from(table).select('id', { count: 'exact', head: true }).eq('status', 'pending')).count ?? 0 : null;
  const [claimsWaiting, changesWaiting] = await Promise.all([pending('school_claims', 'claims.review'), pending('school_change_requests', 'schools.write')]);
  const { data: recent } = perms.includes('audit.read')
    ? await supabase.from('audit_log').select('id, entity_type, action, field_name, created_at, school_id').order('id', { ascending: false }).limit(8)
    : { data: null };
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-forest-900">Dashboard</h1>
        {perms.includes('schools.write') && <Link href="/admin/schools/new" className="flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">Add school</Link>}
      </div>
      {error && <p role="alert" className="mb-5 rounded-lg bg-[#FCEDEA] p-3 text-sm text-[#8A1F11]">{friendlyError(error, 'Unable to load statistics.')}</p>}
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([k, label]) => (
          <div key={k} className="rounded-2xl border border-line bg-white p-5">
            <dt className="text-sm font-medium text-muted">{label}</dt>
            <dd className="mt-2 text-4xl font-semibold text-forest-900">{(stats[k] ?? 0).toLocaleString('en')}</dd>
          </div>
        ))}
      </dl>
      {(claimsWaiting !== null || changesWaiting !== null) && (
        <section aria-label="Waiting for review" className="mt-8 grid gap-4 sm:grid-cols-2">
          {claimsWaiting !== null && <Link href="/admin/claims" className="rounded-2xl border border-[#E2B95B] bg-[#FFFBEF] p-5 hover:shadow"><p className="text-sm font-medium text-muted">School claims waiting</p><p className="mt-2 text-4xl font-semibold text-bronze">{claimsWaiting}</p></Link>}
          {changesWaiting !== null && <Link href="/admin/changes" className="rounded-2xl border border-[#E2B95B] bg-[#FFFBEF] p-5 hover:shadow"><p className="text-sm font-medium text-muted">Change requests waiting</p><p className="mt-2 text-4xl font-semibold text-bronze">{changesWaiting}</p></Link>}
        </section>)}
      {recent && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Recent changes</h2><Link href="/admin/audit-log" className="text-sm font-semibold text-forest-900 underline">View all</Link></div>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {recent.length === 0 && <li className="p-4 text-muted">No changes recorded yet.</li>}
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
                <span><b>{r.action}</b> {r.entity_type}{r.field_name ? ` · ${r.field_name}` : ''}</span>
                <time className="text-muted" dateTime={r.created_at}>{new Date(r.created_at).toLocaleString('en')}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
