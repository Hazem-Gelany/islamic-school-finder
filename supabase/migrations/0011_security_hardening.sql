-- Phase 10: least-privilege grants, a private rate limiter, and no internal data in public reads
set search_path = public, extensions;

-- 1) Functions: by default Postgres lets everyone run new functions. Close that, then open only what is intended.
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public;
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema private revoke execute on functions from public;
grant execute on all functions in schema private to anon, authenticated;       -- helpers used inside row level security policies
grant execute on all functions in schema public to authenticated;              -- each one checks permissions itself or relies on RLS
grant execute on function search_schools(text, text, text, text, text, text, gender_policy, text, numeric, numeric, boolean, boolean, boolean, boolean, boolean, text[], text, boolean, double precision, double precision, double precision, text, int, int),
  search_facets(), get_school_public(text, text, text), get_schools_for_compare(uuid[]), match_candidates(text, text, double precision, double precision, int) to anon;

-- 2) Tables: anonymous visitors may only read the published catalogue. Nobody may truncate through the API roles.
revoke all on all tables in schema public from anon;
grant select on languages, countries, regions, cities, search_aliases, school_types, curricula, facilities, grade_levels, accreditations, fee_categories,
  schools, school_translations, school_curricula, school_languages, school_facilities, school_grade_levels, school_accreditations, school_fees, school_media to anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- 3) The editing view of a school includes internal fields (who created it, verification notes). Only staff and the school's own representatives may read it.
create or replace function public.get_school_for_edit(p_id uuid) returns jsonb language sql stable set search_path = public, extensions as $$
  select (to_jsonb(s) - 'location') || jsonb_build_object(
    'latitude', st_y(s.location::geometry), 'longitude', st_x(s.location::geometry),
    'translations', coalesce((select jsonb_agg(to_jsonb(t) - 'search_tsv') from school_translations t where t.school_id = s.id), '[]'),
    'curriculum_ids', coalesce((select jsonb_agg(curriculum_id) from school_curricula where school_id = s.id), '[]'),
    'language_codes', coalesce((select jsonb_agg(language_code) from school_languages where school_id = s.id), '[]'),
    'facility_ids', coalesce((select jsonb_agg(facility_id) from school_facilities where school_id = s.id), '[]'),
    'grade_level_ids', coalesce((select jsonb_agg(grade_level_id) from school_grade_levels where school_id = s.id), '[]'),
    'fees', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from school_fees f where f.school_id = s.id), '[]'),
    'media', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order, m.created_at) from school_media m where m.school_id = s.id), '[]'))
  from schools s where s.id = p_id and (private.has_permission('schools.read_all') or private.is_school_member(s.id)) $$;

-- 4) Storage: unpublished uploads (<school>/pending/...) must not show up when listing the bucket
drop policy "school media read" on storage.objects;
create policy "school media read" on storage.objects for select using (bucket_id = 'school-media' and (
  (storage.foldername(name))[2] is distinct from 'pending'
  or private.can_admin_school('media.write')
  or exists (select 1 from public.school_media m where m.storage_path = name)));

-- 5) Rate limiter used by the web server (service role only). Fixed windows keyed by e.g. "login:ip:1.2.3.4".
create table rate_limits (key text not null, window_start timestamptz not null, hits int not null default 0, primary key (key, window_start));
alter table rate_limits enable row level security;   -- no policies: unreachable through the public API
revoke all on rate_limits from anon, authenticated;

create function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ws timestamptz := to_timestamp(floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1)); h int;
begin
  if length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 then raise exception 'invalid rate limit arguments'; end if;
  insert into rate_limits (key, window_start, hits) values (p_key, ws, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1 returning hits into h;
  return h <= p_limit;
end $$;
create function public.rate_limit_cleanup() returns int language plpgsql security definer set search_path = public as $$
declare n int; begin delete from rate_limits where window_start < now() - interval '1 day'; get diagnostics n = row_count; return n; end $$;
revoke execute on function public.rate_limit_hit(text, int, int), public.rate_limit_cleanup() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int), public.rate_limit_cleanup() to service_role;
