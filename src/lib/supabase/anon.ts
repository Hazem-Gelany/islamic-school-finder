import { createClient } from '@supabase/supabase-js';

/** Cookie-free read-only client for public pages and the sitemap. RLS limits it to published data. */
export const createAnon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
