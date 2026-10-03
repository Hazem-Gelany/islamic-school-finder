'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { done, fail } from '@/lib/flash';
import { friendlyError } from '@/lib/errors';

export async function reviewClaim(fd: FormData) {
  const { supabase } = await requirePermission('claims.review');
  const back = String(fd.get('return') ?? '').startsWith('/admin/claims') ? String(fd.get('return')) : '/admin/claims';
  const p = z.object({ id: z.string().uuid(), decision: z.enum(['approve', 'reject', 'revoke']), notes: z.string().trim().max(1000) })
    .safeParse({ id: fd.get('id'), decision: fd.get('decision'), notes: fd.get('notes') ?? '' });
  if (!p.success) return fail(back, 'Claim not found.');
  if (p.data.decision !== 'approve' && p.data.notes.length < 3) return fail(back, 'Please write a short note. The person will see it in their account.');
  const { error } = p.data.decision === 'revoke'
    ? await supabase.rpc('revoke_school_claim', { p_claim_id: p.data.id, p_notes: p.data.notes })
    : await supabase.rpc('review_school_claim', { p_claim_id: p.data.id, p_approve: p.data.decision === 'approve', p_notes: p.data.notes || null });
  if (error) return fail(back, error.hint === 'user_message' ? error.message : friendlyError(error, 'Unable to save the decision.'));
  return done(back, { approve: 'Claim approved. The person can now manage the school.', reject: 'Claim rejected.', revoke: 'Access revoked.' }[p.data.decision], ['/admin/dashboard', '/admin/schools']);
}

export async function approve(fd: FormData) { fd.set('decision', 'approve'); return reviewClaim(fd); }
export async function reject(fd: FormData) { fd.set('decision', 'reject'); return reviewClaim(fd); }
export async function revoke(fd: FormData) { fd.set('decision', 'revoke'); return reviewClaim(fd); }
