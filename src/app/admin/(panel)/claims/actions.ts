'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { done, fail } from '@/lib/flash';

const schema = z.object({ id: z.string().uuid(), decision: z.enum(['approve', 'reject']), notes: z.string().trim().max(2000).optional() });

/** Approving makes the claimant a member of the school (inside review_school_claim, in one transaction). */
export async function reviewClaim(fd: FormData) {
  const { supabase } = await requirePermission('claims.review');
  const p = schema.safeParse({ id: fd.get('id'), decision: fd.get('decision'), notes: String(fd.get('notes') ?? '') || undefined });
  if (!p.success) fail('/admin/claims', 'Something went wrong. Please try again.');
  const { error } = await supabase.rpc('review_school_claim', { p_claim_id: p.data!.id, p_approve: p.data!.decision === 'approve', p_notes: p.data!.notes ?? null });
  if (error) fail('/admin/claims', error.message?.includes('not pending') ? 'This claim has already been reviewed.' : friendlyError(error));
  done('/admin/claims', p.data!.decision === 'approve' ? 'Claim approved. The person can now manage this school.' : 'Claim rejected.', ['/admin/claims']);
}
