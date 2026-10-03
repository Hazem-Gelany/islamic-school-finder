'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export async function login(fd: FormData) {
  const p = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse({ email: fd.get('email'), password: fd.get('password') });
  if (!p.success) redirect('/admin/login?error=invalid');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(p.data);
  if (error) redirect('/admin/login?error=invalid');
  redirect('/admin/dashboard');
}
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
