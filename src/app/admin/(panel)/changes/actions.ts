'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { done, fail } from '@/lib/flash';
import { friendlyError } from '@/lib/errors';

async function review(fd: FormData, approve: boolean) {
  const { supabase } = await requirePermission('schools.write');
  const back = String(fd.get('return') ?? '').startsWith('/admin/changes') ? String(fd.get('return')) : '/admin/changes';
  const p = z.object({ id: z.string().uuid(), notes: z.string().trim().max(1000) }).safeParse({ id: fd.get('id'), notes: fd.get('notes') ?? '' });
  if (!p.success) return fail(back, 'Request not found.');
  if (!approve && p.data.notes.length < 3) return fail(back, 'Please write a short note explaining what to change. The school will see it.');
  const { data: req } = await supabase.from('school_change_requests').select('media').eq('id', p.data.id).maybeSingle();
  const { error } = await supabase.rpc('review_change_request', { p_id: p.data.id, p_approve: approve, p_notes: p.data.notes || null });
  if (error) return fail(back, error.hint === 'user_message' ? error.message : friendlyError(error, 'Unable to save the decision. Nothing was changed.'));
  if (!approve) { // a rejected request leaves unused uploads behind: tidy them up
    const paths = ((req?.media?.add ?? []) as { storage_path: string }[]).map((m) => m.storage_path);
    if (paths.length) await supabase.storage.from('school-media').remove(paths);
  }
  return done(back, approve ? 'Changes approved and published.' : 'Changes rejected.', ['/admin/dashboard', '/admin/schools']);
}
export async function approveChange(fd: FormData) { return review(fd, true); }
export async function rejectChange(fd: FormData) { return review(fd, false); }
