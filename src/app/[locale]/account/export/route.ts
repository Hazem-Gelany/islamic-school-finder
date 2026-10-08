import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** "Download my data": everything the site holds about the signed-in person, as JSON. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  const [profile, roles, claims, schools, changes, saved, searches, contacts] = await Promise.all([
    supabase.from('profiles').select('display_name, preferred_locale, created_at').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role, created_at').eq('user_id', user.id),
    supabase.rpc('my_claims', { p_locale: 'en' }),
    supabase.rpc('my_schools', { p_locale: 'en' }),
    supabase.from('school_change_requests').select('school_id, status, summary, created_at, reviewed_at, review_notes').eq('requested_by', user.id),
    supabase.from('saved_schools').select('school_id, created_at').eq('user_id', user.id),
    supabase.from('saved_searches').select('name, query, created_at').eq('user_id', user.id),
    supabase.from('contact_requests').select('school_id, message, status, created_at').eq('parent_id', user.id),
  ]);
  const body = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at }, profile: profile.data, roles: roles.data,
    claims: claims.data, schools_managed: schools.data, change_requests: changes.data, saved_schools: saved.data, saved_searches: searches.data, contact_requests: contacts.data };
  return new NextResponse(JSON.stringify(body, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="my-data.json"', 'cache-control': 'no-store' } });
}
