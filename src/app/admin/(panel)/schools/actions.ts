'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { done as flashDone, fail as flashFail } from '@/lib/flash';
import { schoolSchema } from '@/validations/school';

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: { path: string; message: string }[]; duplicates?: { school_id: string; matched_name: string; reasons: string[] }[] };

export async function saveSchool(id: string | null, raw: unknown, confirmDuplicate = false): Promise<SaveResult> {
  const { supabase } = await requirePermission('schools.write');
  const parsed = schoolSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
  }
  const p = parsed.data;
  if (!id && !confirmDuplicate) {
    const { data } = await supabase.rpc('find_duplicate_schools', { p_name: p.translations[0].name, p_website: p.website || null, p_phone: p.phone || null, p_lat: p.latitude, p_lng: p.longitude });
    if (data?.length) return { ok: false, message: 'Possible duplicate schools found.', duplicates: data };
  }
  const { data, error } = await supabase.rpc('save_school', { p_id: id, p });
  if (error) return { ok: false, message: friendlyError(error, 'Unable to save the school. Please try again.') };
  revalidatePath('/admin/schools'); revalidatePath('/admin/dashboard');
  return { ok: true, id: data as string };
}

const idSchema = z.string().uuid();
const done = (msg: string, to = '/admin/schools'): never => flashDone(to, msg, ['/admin/schools', '/admin/dashboard']);
const fail = (msg: string, to = '/admin/schools'): never => flashFail(to, msg);
const back = (fd: FormData) => { const r = String(fd.get('return') ?? ''); return r.startsWith('/admin/') ? r : '/admin/schools'; };
const idsOf = (fd: FormData) => fd.getAll('ids').map(String).filter((x) => idSchema.safeParse(x).success);

export async function setStatus(fd: FormData) {
  const { supabase } = await requirePermission('schools.write');
  const ids = idsOf(fd);
  const status = z.enum(['draft', 'pending', 'active', 'archived']).safeParse(fd.get('status'));
  if (!ids.length || !status.success) return fail('Select at least one school first.', back(fd));
  const { error } = await supabase.from('schools').update({ status: status.data }).in('id', ids);
  if (error) return fail(friendlyError(error), back(fd));
  return done(`${ids.length} school(s) updated.`, back(fd));
}

export async function setVerification(fd: FormData) {
  const { supabase } = await requirePermission('verification.write');
  const ids = idsOf(fd);
  const status = z.enum(['community_added', 'information_checked', 'school_verified', 'school_managed']).safeParse(fd.get('status'));
  if (!ids.length || !status.success) return fail('Select at least one school first.', back(fd));
  const patch: Record<string, unknown> = { verification_status: status.data };
  if (fd.has('source')) patch.verification_source = String(fd.get('source') ?? '').slice(0, 300) || null;
  if (fd.has('notes')) patch.verification_notes = String(fd.get('notes') ?? '').slice(0, 2000) || null;
  const { error } = await supabase.from('schools').update(patch).in('id', ids);
  if (error) return fail(friendlyError(error), back(fd));
  return done('Verification updated.', back(fd));
}

export async function bulkAction(fd: FormData) {
  const [kind, value] = String(fd.get('bulk') ?? '').split(':');
  fd.set('status', value ?? '');
  if (kind === 'status') return setStatus(fd);
  if (kind === 'verify') return setVerification(fd);
  if (kind === 'edit') {
    const ids = idsOf(fd);
    if (!ids.length) return fail('Select at least one school first.', back(fd));
    if (ids.length > 100) return fail('Select up to 100 schools for a bulk edit, or use the CSV import for larger changes.', back(fd));
    return redirect(`/admin/schools/bulk-edit?ids=${ids.join(',')}`);
  }
  return fail('Choose a bulk action first.', back(fd));
}

export async function duplicateSchool(fd: FormData) {
  const { supabase } = await requirePermission('schools.write');
  const id = idSchema.safeParse(fd.get('id'));
  if (!id.success) return fail('School not found.');
  const { data: s, error } = await supabase.rpc('get_school_for_edit', { p_id: id.data });
  if (error || !s) return fail(friendlyError(error, 'School not found.'));
  const copy = { ...s, status: 'draft', verification_status: 'community_added', verification_source: null, verification_notes: null,
    slug: `${s.slug}-copy-${Math.random().toString(36).slice(2, 6)}`,
    fees: (s.fees ?? []).map(({ id: _id, ...f }: Record<string, unknown>) => f),
    translations: (s.translations ?? []).map((t: { name: string }) => ({ ...t, name: `${t.name} (copy)` })) };
  const { data: newId, error: e2 } = await supabase.rpc('save_school', { p_id: null, p: copy });
  if (e2) return fail(friendlyError(e2));
  revalidatePath('/admin/schools');
  return redirect(`/admin/schools/${newId}?msg=${encodeURIComponent('Copy created as a draft.')}`);
}

export async function deleteSchool(fd: FormData) {
  const { supabase } = await requirePermission('schools.delete');
  const id = idSchema.safeParse(fd.get('id'));
  if (!id.success) return fail('School not found.');
  const { data: s } = await supabase.from('schools').select('status').eq('id', id.data).single();
  if (s?.status !== 'archived' && s?.status !== 'draft') return fail('Archive the school before deleting it permanently.');
  const { error } = await supabase.from('schools').delete().eq('id', id.data);
  if (error) return fail(friendlyError(error));
  return done('School permanently deleted.');
}

export async function addMedia(input: { school_id: string; kind: 'logo' | 'photo'; storage_path: string; mime_type: string; size_bytes: number; alt: string }) {
  const { supabase } = await requirePermission('media.write');
  const ok = z.object({
    school_id: z.string().uuid(), kind: z.enum(['logo', 'photo']), storage_path: z.string().startsWith(`${input.school_id}/`),
    mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/avif']), size_bytes: z.number().int().positive().max(5_242_880),
    alt: z.string().trim().min(3, 'Describe the image in a few words (alt text)').max(200),
  }).safeParse(input);
  if (!ok.success) return { ok: false as const, message: ok.error.issues[0].message };
  if (input.kind === 'logo') await supabase.from('school_media').delete().eq('school_id', input.school_id).eq('kind', 'logo');
  const { error } = await supabase.from('school_media').insert({ school_id: input.school_id, kind: input.kind, storage_path: input.storage_path, mime_type: input.mime_type, size_bytes: input.size_bytes, alt_text_i18n: { en: ok.data.alt } });
  if (error) return { ok: false as const, message: friendlyError(error, 'Unable to save the image.') };
  revalidatePath(`/admin/schools/${input.school_id}`);
  return { ok: true as const };
}

export async function removeMedia(mediaId: string, schoolId: string) {
  const { supabase } = await requirePermission('media.write');
  const { data: m } = await supabase.from('school_media').select('storage_path').eq('id', mediaId).eq('school_id', schoolId).single();
  const { error } = await supabase.from('school_media').delete().eq('id', mediaId).eq('school_id', schoolId);
  if (error) return { ok: false as const, message: friendlyError(error) };
  if (m?.storage_path) await supabase.storage.from('school-media').remove([m.storage_path]);
  revalidatePath(`/admin/schools/${schoolId}`);
  return { ok: true as const };
}

const nums = (fd: FormData, k: string) => fd.getAll(k).map(Number).filter((n) => Number.isInteger(n) && n > 0);
export async function applyBulkEdit(fd: FormData) {
  const { supabase } = await requirePermission('schools.write');
  const ids = idsOf(fd), here = `/admin/schools/bulk-edit?ids=${ids.join(',')}`;
  if (!ids.length || ids.length > 100) return fail('Select between 1 and 100 schools.');
  const changes: Record<string, unknown> = {};
  const type = String(fd.get('school_type_id') ?? ''), city = String(fd.get('city_id') ?? '');
  if (/^\d+$/.test(type)) changes.school_type_id = Number(type);
  if (/^\d+$/.test(city)) changes.city_id = Number(city);
  for (const k of ['curricula', 'facilities', 'grade_levels']) {
    const add = nums(fd, `add_${k}`), rem = nums(fd, `remove_${k}`);
    if (add.some((x) => rem.includes(x))) return fail('The same item cannot be both added and removed.', here);
    if (add.length) changes[`add_${k}`] = add; if (rem.length) changes[`remove_${k}`] = rem;
  }
  const addL = fd.getAll('add_languages').map(String).filter((x) => /^[a-z]{2,3}$/.test(x)), remL = fd.getAll('remove_languages').map(String).filter((x) => /^[a-z]{2,3}$/.test(x));
  if (addL.some((x) => remL.includes(x))) return fail('The same language cannot be both added and removed.', here);
  if (addL.length) changes.add_languages = addL; if (remL.length) changes.remove_languages = remL;
  if (!Object.keys(changes).length) return fail('Choose at least one change.', here);
  const { data, error } = await supabase.rpc('bulk_edit_schools', { p_ids: ids, p_changes: changes });
  if (error) return fail(friendlyError(error, 'Unable to apply the changes. Nothing was changed.'), here);
  return done(`${data} school(s) updated.`);
}
