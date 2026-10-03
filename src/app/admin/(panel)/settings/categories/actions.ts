'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { done, fail } from '@/lib/flash';
import { friendlyError } from '@/lib/errors';
import { CATEGORY_TABLES } from '@/features/settings/constants';

const here = '/admin/settings/categories';
const schema = z.object({
  table: z.enum(Object.keys(CATEGORY_TABLES) as [keyof typeof CATEGORY_TABLES]),
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().regex(/^[a-z0-9_]+$/, 'The code can only use lowercase letters, numbers and underscores').max(60),
  en: z.string().trim().min(1, 'The English name is required').max(120), ar: z.string().trim().max(120), ms: z.string().trim().max(120),
  sort_order: z.coerce.number().int().min(0).max(9999), is_active: z.boolean(),
});

export async function saveCategory(fd: FormData) {
  const { supabase } = await requirePermission('categories.manage');
  const p = schema.safeParse({ table: fd.get('table'), id: fd.get('id') || undefined, code: fd.get('code'), en: fd.get('en'), ar: fd.get('ar') ?? '', ms: fd.get('ms') ?? '', sort_order: fd.get('sort_order') || 0, is_active: fd.get('is_active') === 'on' });
  if (!p.success) return fail(here, p.error.issues[0].message);
  const { table, id, code, en, ar, ms, sort_order, is_active } = p.data;
  const row = { name_i18n: { en, ...(ar ? { ar } : {}), ...(ms ? { ms } : {}) }, sort_order, is_active };
  const { error } = id ? await supabase.from(table).update(row).eq('id', id) : await supabase.from(table).insert({ code, ...row });
  if (error) return fail(here, friendlyError(error, 'Unable to save.', { '23505': 'That code is already used. Choose a different one.' }));
  return done(here, 'Saved.', ['/admin/schools']);
}

export async function deleteCategory(fd: FormData) {
  const { supabase } = await requirePermission('categories.manage');
  const t = z.enum(Object.keys(CATEGORY_TABLES) as [keyof typeof CATEGORY_TABLES]).safeParse(fd.get('table')), id = Number(fd.get('id'));
  if (!t.success || !Number.isInteger(id)) return fail(here, 'Item not found.');
  const { error } = await supabase.from(t.data).delete().eq('id', id);
  if (error) return fail(here, friendlyError(error, 'Unable to delete.', { '23503': 'This item is used by schools. Untick "Active" to hide it instead of deleting it.' }));
  return done(here, 'Deleted.');
}
