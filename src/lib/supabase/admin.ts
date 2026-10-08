import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Service-role client. Bypasses row level security, so it is only for the few server tasks that need it (rate limiting, deleting an account). Never import this from client code. */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
