-- Admin API: atomic save, server-side list/sort/filter, dashboard stats
set search_path = public, extensions;

create function public.admin_dashboard_stats() returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not private.has_permission('schools.read_all') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return (select jsonb_build_object(
    'total_schools',      count(*) filter (where status <> 'archived'),
    'active_schools',     count(*) filter (where status = 'active'),
    'verified_schools',   count(*) filter (where verification_status = 'school_verified'),
    'managed_schools',    count(*) filter (where verification_status = 'school_managed'),
    'pending_verification', count(*) filter (where status <> 'archived' and verification_status in ('community_added','information_checked')),
    'incomplete_profiles', count(*) filter (where status <> 'archived' and (location is null
        or not exists (select 1 from school_translations t where t.school_id = s.id and coalesce(t.description,'') <> '')
        or tuition_annual_min is null)),
    'countries',          count(distinct country_id) filter (where status = 'active'),
    'cities',             count(distinct city_id) filter (where status = 'active'),
    'new_schools_30d',    count(*) filter (where created_at > now() - interval '30 days'),
    'parent_accounts',    (select count(*) from user_roles where role = 'parent'),
    'school_leads',       (select count(*) from contact_requests)
  ) from schools s);
end $$;
revoke execute on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

create function public.admin_list_schools(
  p_search text default null, p_status school_status default null, p_verification verification_status default null,
  p_country text default null, p_missing_lang text default null,
  p_sort text default 'updated_at', p_dir text default 'desc', p_limit int default 20, p_offset int default 0)
returns table (id uuid, slug text, name text, country text, country_slug text, city text, city_slug text, status school_status,
  verification_status verification_status, verification_source text, last_verified_at timestamptz, languages text[], updated_at timestamptz, total_count bigint)
language plpgsql stable set search_path = public, extensions as $$
declare
  col text := case p_sort when 'name' then 'name' when 'country' then 'country' when 'city' then 'city'
                          when 'status' then 'status::text' when 'verification' then 'verification_status::text' else 'updated_at' end;
  dir text := case when lower(p_dir) = 'asc' then 'asc' else 'desc' end;
begin
  if not private.has_permission('schools.read_all') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query execute format($q$
    select * from (
      select s.id, s.slug,
        (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = 'en') desc, t.language_code limit 1) as name,
        co.name_i18n->>'en' as country, co.slug as country_slug, ci.name_i18n->>'en' as city, ci.slug as city_slug,
        s.status, s.verification_status, s.verification_source, s.last_verified_at,
        coalesce((select array_agg(t.language_code order by t.language_code) from school_translations t where t.school_id = s.id), '{}') as languages,
        s.updated_at, count(*) over () as total_count
      from schools s join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
      where ($1 is null or s.slug ilike '%%' || $1 || '%%'
             or exists (select 1 from school_translations t where t.school_id = s.id and t.name ilike '%%' || $1 || '%%'))
        and ($2 is null or s.status = $2) and ($3 is null or s.verification_status = $3) and ($4 is null or co.slug = $4)
        and ($5 is null or not exists (select 1 from school_translations t where t.school_id = s.id and t.language_code = $5))
    ) x order by %s %s, id limit $6 offset $7$q$, col, dir)
  using nullif(trim(p_search), ''), p_status, p_verification, p_country, p_missing_lang, least(greatest(p_limit, 1), 100), greatest(p_offset, 0);
end $$;
grant execute on function public.admin_list_schools(text, school_status, verification_status, text, text, text, text, int, int) to authenticated;

create function public.get_school_for_edit(p_id uuid) returns jsonb language sql stable set search_path = public, extensions as $$
  select (to_jsonb(s) - 'location') || jsonb_build_object(
    'latitude', st_y(s.location::geometry), 'longitude', st_x(s.location::geometry),
    'translations', coalesce((select jsonb_agg(to_jsonb(t) - 'search_tsv') from school_translations t where t.school_id = s.id), '[]'),
    'curriculum_ids', coalesce((select jsonb_agg(curriculum_id) from school_curricula where school_id = s.id), '[]'),
    'language_codes', coalesce((select jsonb_agg(language_code) from school_languages where school_id = s.id), '[]'),
    'facility_ids', coalesce((select jsonb_agg(facility_id) from school_facilities where school_id = s.id), '[]'),
    'grade_level_ids', coalesce((select jsonb_agg(grade_level_id) from school_grade_levels where school_id = s.id), '[]'),
    'fees', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from school_fees f where f.school_id = s.id), '[]'),
    'media', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order, m.created_at) from school_media m where m.school_id = s.id), '[]'))
  from schools s where s.id = p_id $$;
grant execute on function public.get_school_for_edit(uuid) to authenticated;

-- One call = one transaction: a failed save never leaves a half-written school.
-- Runs as the caller, so RLS, the guard trigger and the audit log all apply.
create function public.save_school(p_id uuid, p jsonb) returns uuid language plpgsql set search_path = public, extensions as $$
declare sid uuid := p_id; loc geography;
begin
  if nullif(p->>'latitude','') is not null and nullif(p->>'longitude','') is not null then
    loc := st_setsrid(st_makepoint((p->>'longitude')::float8, (p->>'latitude')::float8), 4326)::geography;
  end if;
  if coalesce(p->>'status','draft') = 'active' and jsonb_array_length(coalesce(p->'translations','[]')) = 0 then
    raise exception 'A published school needs at least one translation' using errcode = '23514';
  end if;

  if sid is null then
    insert into schools (slug, country_id, city_id) values (p->>'slug', (p->>'country_id')::bigint, (p->>'city_id')::bigint) returning id into sid;
  end if;

  update schools set
    slug = p->>'slug', status = coalesce((p->>'status')::school_status, status),
    country_id = (p->>'country_id')::bigint, region_id = nullif(p->>'region_id','')::bigint, city_id = (p->>'city_id')::bigint,
    school_type_id = nullif(p->>'school_type_id','')::bigint, gender_policy = nullif(p->>'gender_policy','')::gender_policy,
    address = nullif(p->>'address',''), postal_code = nullif(p->>'postal_code',''), location = loc,
    phone = nullif(p->>'phone',''), email = nullif(p->>'email',''), website = nullif(p->>'website',''), admissions_url = nullif(p->>'admissions_url',''),
    social_links = coalesce(p->'social_links', '{}'::jsonb),
    founded_year = nullif(p->>'founded_year','')::smallint, student_capacity = nullif(p->>'student_capacity','')::int,
    has_boarding = coalesce((p->>'has_boarding')::boolean, false), has_transport = coalesce((p->>'has_transport')::boolean, false),
    offers_quran = coalesce((p->>'offers_quran')::boolean, false), offers_arabic = coalesce((p->>'offers_arabic')::boolean, false),
    offers_islamic_studies = coalesce((p->>'offers_islamic_studies')::boolean, false),
    scholarships_available = coalesce((p->>'scholarships_available')::boolean, false),
    currency_code = nullif(p->>'currency_code',''),
    verification_status = coalesce((p->>'verification_status')::verification_status, verification_status),
    verification_source = nullif(p->>'verification_source',''), verification_notes = nullif(p->>'verification_notes','')
  where id = sid;
  if not found then raise exception 'School not found or not editable' using errcode = '42501'; end if;

  delete from school_translations where school_id = sid
    and language_code not in (select x->>'language_code' from jsonb_array_elements(coalesce(p->'translations','[]')) x);
  insert into school_translations (school_id, language_code, name, description, admission_information, islamic_studies_description, quran_description, arabic_description)
  select sid, x->>'language_code', x->>'name', nullif(x->>'description',''), nullif(x->>'admission_information',''),
         nullif(x->>'islamic_studies_description',''), nullif(x->>'quran_description',''), nullif(x->>'arabic_description','')
  from jsonb_array_elements(coalesce(p->'translations','[]')) x
  on conflict (school_id, language_code) do update set name = excluded.name, description = excluded.description,
    admission_information = excluded.admission_information, islamic_studies_description = excluded.islamic_studies_description,
    quran_description = excluded.quran_description, arabic_description = excluded.arabic_description;

  delete from school_curricula where school_id = sid and curriculum_id <> all (select v::bigint from jsonb_array_elements_text(coalesce(p->'curriculum_ids','[]')) v);
  insert into school_curricula select sid, v::bigint from jsonb_array_elements_text(coalesce(p->'curriculum_ids','[]')) v on conflict do nothing;
  delete from school_languages where school_id = sid and language_code <> all (select v from jsonb_array_elements_text(coalesce(p->'language_codes','[]')) v);
  insert into school_languages select sid, v from jsonb_array_elements_text(coalesce(p->'language_codes','[]')) v on conflict do nothing;
  delete from school_facilities where school_id = sid and facility_id <> all (select v::bigint from jsonb_array_elements_text(coalesce(p->'facility_ids','[]')) v);
  insert into school_facilities select sid, v::bigint from jsonb_array_elements_text(coalesce(p->'facility_ids','[]')) v on conflict do nothing;
  delete from school_grade_levels where school_id = sid and grade_level_id <> all (select v::bigint from jsonb_array_elements_text(coalesce(p->'grade_level_ids','[]')) v);
  insert into school_grade_levels select sid, v::bigint from jsonb_array_elements_text(coalesce(p->'grade_level_ids','[]')) v on conflict do nothing;

  delete from school_fees where school_id = sid
    and id not in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(p->'fees','[]')) x where nullif(x->>'id','') is not null);
  insert into school_fees (id, school_id, fee_category_id, grade_level_id, amount, currency_code, period)
  select coalesce(nullif(x->>'id','')::uuid, gen_random_uuid()), sid, (x->>'fee_category_id')::bigint, nullif(x->>'grade_level_id','')::bigint,
         (x->>'amount')::numeric, x->>'currency_code', (x->>'period')::fee_period
  from jsonb_array_elements(coalesce(p->'fees','[]')) x
  on conflict (id) do update set fee_category_id = excluded.fee_category_id, grade_level_id = excluded.grade_level_id,
    amount = excluded.amount, currency_code = excluded.currency_code, period = excluded.period
    where school_fees.school_id = excluded.school_id;
  return sid;
end $$;
grant execute on function public.save_school(uuid, jsonb) to authenticated;
