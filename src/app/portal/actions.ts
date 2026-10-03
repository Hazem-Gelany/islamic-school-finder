'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMember } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { schoolSchema } from '@/validations/school';
import { computeChanges } from '@/features/portal/changes';
import type { FormResult } from '@/components/admin/SchoolForm';

const uuid = z.string().uuid();

export async function submitPortal(schoolId: string | null, raw: unknown): Promise<FormResult> {
  if (!schoolId || !uuid.safeParse(schoolId).success) return { ok: false, message: 'School not found.' };
  const { supabase } = await requireMember(schoolId);
  const parsed = schoolSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
  const { data: cur } = await supabase.rpc('get_school_for_edit', { p_id: schoolId });
  if (!cur) return { ok: false, message: 'School not found.' };

  const { direct, review, labels } = computeChanges(cur, parsed.data);
  if (Object.keys(direct).length) {
    const { error } = await supabase.from('schools').update(direct).eq('id', schoolId);
    if (error) return { ok: false, message: friendlyError(error, 'Unable to publish your changes. Nothing was sent for review either.') };
  }
  // Always sync the proposal: an empty one clears anything the person has since changed back
  const { error: e2 } = await supabase.rpc('submit_change_request', { p_school: schoolId, p_payload: review, p_summary: labels.length ? `Changed: ${[...new Set(labels)].join(', ')}` : null });
  if (e2) return { ok: false, message: e2.hint === 'user_message' ? e2.message : friendlyError(e2, 'Your contact details were published, but we could not send the other changes for review. Please try again.') };
  revalidatePath(`/portal/schools/${schoolId}`);

  const published = Object.keys(direct).length > 0, sent = Object.keys(review).length > 0;
  const message = published && sent ? 'Your contact details and options are published. Your other changes were sent for review.'
    : published ? 'Saved. Your changes are published.'
    : sent ? 'Your changes were sent for review. The current profile stays online until they are approved.'
    : 'No changes to save.';
  return { ok: true, message };
}

const item = z.object({ kind: z.enum(['photo', 'logo']), storage_path: z.string().max(300), mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/avif']), size_bytes: z.number().int().positive().max(5_242_880), alt: z.string().trim().min(3, 'Describe the image in a few words (alt text)').max(200) });

/** The full list of photos to add and published photos to remove, as shown on screen. Reviewed before anything goes public. */
export async function saveMediaProposal(schoolId: string, add: unknown, remove: unknown): Promise<{ ok: boolean; message?: string }> {
  if (!uuid.safeParse(schoolId).success) return { ok: false, message: 'School not found.' };
  const { supabase } = await requireMember(schoolId);
  const a = z.array(item).max(12).safeParse(add), r = z.array(uuid).max(50).safeParse(remove);
  if (!a.success) return { ok: false, message: a.error.issues[0].message };
  if (!r.success) return { ok: false, message: 'Invalid request.' };
  const { error } = await supabase.rpc('submit_media_change', { p_school: schoolId, p_add: a.data, p_remove: r.data });
  if (error) return { ok: false, message: error.hint === 'user_message' ? error.message : friendlyError(error, 'Unable to save the photo changes.') };
  revalidatePath(`/portal/schools/${schoolId}`);
  return { ok: true };
}

export async function withdrawChanges(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!uuid.safeParse(id).success) redirect('/portal');
  const { supabase, user } = await requireMember(id);
  const { data: req } = await supabase.from('school_change_requests').select('id, media').eq('school_id', id).eq('requested_by', user.id).eq('status', 'pending').maybeSingle();
  if (req) {
    const paths = ((req.media?.add ?? []) as { storage_path: string }[]).map((m) => m.storage_path);
    await supabase.from('school_change_requests').delete().eq('id', req.id);
    if (paths.length) await supabase.storage.from('school-media').remove(paths);
  }
  revalidatePath(`/portal/schools/${id}`);
  redirect(`/portal/schools/${id}?msg=${encodeURIComponent('Your pending changes were withdrawn.')}`);
}
