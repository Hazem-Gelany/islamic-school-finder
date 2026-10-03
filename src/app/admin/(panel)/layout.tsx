import { requireStaff } from '@/lib/auth';
import { logout } from '../login/actions';
import { NavLink } from '@/components/admin/NavLink';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, perms } = await requireStaff();
  const can = (p: string) => perms.includes(p);
  return (
    <div className="min-h-screen bg-cream-50 lg:flex">
      <aside className="bg-forest-900 p-4 text-cream-50 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0">
        <p className="px-3 py-3 text-lg font-semibold">School Finder <span className="text-gold-400">Admin</span></p>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
          <NavLink href="/admin/dashboard">Dashboard</NavLink>
          <NavLink href="/admin/schools">Schools</NavLink>
          {can('verification.write') && <NavLink href="/admin/verification">Verification</NavLink>}
          {can('claims.review') && <NavLink href="/admin/claims">School claims</NavLink>}
          <NavLink href="/admin/translations">Translations</NavLink>
          {can('imports.manage') && <NavLink href="/admin/import">Import / Export</NavLink>}
          {can('categories.manage') && <NavLink href="/admin/settings/categories">Categories</NavLink>}
          {can('categories.manage') && <NavLink href="/admin/settings/places">Places</NavLink>}
          {can('users.read') && <NavLink href="/admin/users">Users</NavLink>}
          {can('audit.read') && <NavLink href="/admin/audit-log">Audit log</NavLink>}
        </nav>
        <form action={logout} className="mt-4 border-t border-white/15 px-3 pt-4 text-sm lg:absolute lg:bottom-4 lg:start-4 lg:end-4">
          <p className="mb-2 truncate text-mist">{user.email}</p>
          <button className="h-10 w-full rounded-lg border border-white/30 hover:bg-white/10">Sign out</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-5 lg:p-10">{children}</main>
    </div>
  );
}
