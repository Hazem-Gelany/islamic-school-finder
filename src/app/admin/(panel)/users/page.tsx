import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { Badge, Flash } from '@/components/admin/Flash';
import { STAFF_ROLES } from '@/features/settings/constants';
import { saveRoles } from './actions';

const PAGE = 25;
const LABEL = Object.fromEntries(STAFF_ROLES.map(([k, l]) => [k, l])) as Record<string, string>;
type U = { id: string; email: string; display_name: string | null; roles: string[]; created_at: string; last_sign_in_at: string | null; total_count: number };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, perms, user: me } = await requirePermission('users.read');
  const canEdit = perms.includes('roles.manage'), page = Math.max(1, Number(sp.page) || 1);
  const { data, error } = await supabase.rpc('admin_list_users', { p_search: sp.q || null, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  const users = (data ?? []) as U[], total = Number(users[0]?.total_count ?? 0), pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => `/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;
  const ret = link(page);
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">Users and roles</h1>
      <p className="mb-6 max-w-2xl text-muted">Give a person access to this admin area. New accounts are created in your Supabase dashboard (Authentication → Users) or when someone signs up; then assign a role here. Parents and school representatives are managed automatically.</p>
      <Flash msg={sp.msg} error={sp.error ?? (error ? friendlyError(error, 'Unable to load users.') : undefined)} />
      <form method="get" role="search" className="mb-5 flex gap-3">
        <label className="sr-only" htmlFor="uq">Search users</label>
        <input id="uq" name="q" defaultValue={sp.q} placeholder="Search by email or name" className="h-11 w-72 rounded-[10px] border border-[#B9C4BD] px-3" />
        <button className="h-11 rounded-[10px] border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">Search</button>
      </form>
      <ul className="space-y-3">
        {users.length === 0 && <li className="rounded-2xl border border-line bg-white p-8 text-center text-muted">No users found.</li>}
        {users.map((u) => (
          <li key={u.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-semibold">{u.email}{u.id === me.id && <span className="ms-2 text-sm font-normal text-muted">(you)</span>}</p>
                <p className="text-sm text-muted">{u.display_name ? `${u.display_name} · ` : ''}Joined {new Date(u.created_at).toLocaleDateString('en')}{u.last_sign_in_at ? ` · Last sign-in ${new Date(u.last_sign_in_at).toLocaleDateString('en')}` : ''}</p></div>
              <p className="flex flex-wrap gap-2">{u.roles.map((r) => <Badge key={r} tone={LABEL[r] ? 'good' : 'neutral'}>{LABEL[r] ?? r.replace('_', ' ')}</Badge>)}</p>
            </div>
            {canEdit && (
              <form action={saveRoles} className="mt-4 border-t border-line pt-4">
                <input type="hidden" name="user" value={u.id} /><input type="hidden" name="return" value={ret} />
                <fieldset><legend className="mb-2 text-sm font-semibold text-muted">Admin access</legend>
                  <div className="grid gap-2 md:grid-cols-2">{STAFF_ROLES.map(([k, label, help]) => (
                    <label key={k} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-2"><input type="checkbox" name="roles" value={k} defaultChecked={u.roles.includes(k)} className="mt-1 size-4" /><span><span className="block font-semibold">{label}</span><span className="text-sm text-muted">{help}</span></span></label>))}</div>
                </fieldset>
                <button className="mt-3 h-11 rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">Save roles</button>
              </form>)}
          </li>))}
      </ul>
      <nav aria-label="Pagination" className="mt-5 flex items-center justify-between text-sm"><span className="text-muted">{total.toLocaleString('en')} users · page {page} of {pages}</span>
        <span className="flex gap-2">{page > 1 && <Link className="flex h-10 items-center rounded-lg border border-[#B9C4BD] px-4 font-semibold" href={link(page - 1)}>Previous</Link>}{page < pages && <Link className="flex h-10 items-center rounded-lg border border-[#B9C4BD] px-4 font-semibold" href={link(page + 1)}>Next</Link>}</span></nav>
    </>
  );
}
