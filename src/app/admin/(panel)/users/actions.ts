'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { done, fail } from '@/lib/flash';
import { friendlyError } from '@/lib/errors';
import { STAFF_ROLES } from '@/features/settings/constants';


export async function saveRoles(fd: FormData) {
  const { supabase } = await requirePermission('roles.manage');
  const back = String(fd.get('return') ?? '/admin/users').startsWith('/admin/users') ? String(fd.get('return')) : '/admin/users';
  const user = z.string().uuid().safeParse(fd.get('user'));
  const roles = fd.getAll('roles').map(String).filter((r) => STAFF_ROLES.some(([k]) => k === r));
  if (!user.success) return fail(back, 'User not found.');
  const { error } = await supabase.rpc('set_user_roles', { p_user: user.data, p_roles: roles });
  if (error) return fail(back, friendlyError(error, 'Unable to change roles.', { '23514': 'There must always be at least one Super Admin.' }));
  return done(back, 'Roles updated.');
}
