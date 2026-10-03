-- Phase 8: CSV import/export, bulk edit, user and role management
set search_path = public, extensions;

alter table import_jobs add column error_message text;

-- Flags rows that duplicate schools already in the database, or earlier rows in the same file
create function public.import_mark_duplicates(p_job uuid) returns void language plpgsql set search_path = public, extensions as $$
begin
  if not private.has_permission('imports.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;

  update import_rows r set state = 'duplicate', errors = r.errors || jsonb_build_array(jsonb_build_object('field', d.field, 'message', d.msg))
  from (
    select r2.id, (array_agg(x.field))[1] as field, (array_agg(x.msg))[1] as msg
    from import_rows r2 cross join lateral (
      select 'slug' as field, 'A school with this URL name already exists in this city (' || s.slug || ')' as msg
        from schools s where s.city_id = (r2.raw->>'city_id')::bigint and s.slug = r2.raw->>'slug'
      union all
      select 'website', 'Same website as an existing school (' || s.slug || ')' from schools s
        where coalesce(r2.raw->>'website','') <> '' and s.website is not null
          and lower(regexp_replace(s.website, '^https?://(www\.)?|/$', '', 'g')) = lower(regexp_replace(r2.raw->>'website', '^https?://(www\.)?|/$', '', 'g'))
      union all
      select 'phone', 'Same phone number as an existing school (' || s.slug || ')' from schools s
        where coalesce(regexp_replace(r2.raw->>'phone', '\D', '', 'g'), '') <> '' and regexp_replace(coalesce(s.phone, ''), '\D', '', 'g') = regexp_replace(r2.raw->>'phone', '\D', '', 'g')
      union all
      select 'name', 'Very similar name to an existing school in this city: ' || t.name from school_translations t join schools s on s.id = t.school_id
        where s.city_id = (r2.raw->>'city_id')::bigint and similarity(t.name, r2.raw->>'name_primary') > 0.8
    ) x
    where r2.job_id = p_job and r2.state = 'valid' group by r2.id
  ) d where r.id = d.id;

  update import_rows r set state = 'duplicate',
    errors = r.errors || jsonb_build_array(jsonb_build_object('field', 'slug', 'message', 'Same city and URL name as an earlier row in this file (row ' || f.first_row || ')'))
  from (select id, row_number as rn, min(row_number) over (partition by raw->>'city_id', raw->>'slug') as first_row
        from import_rows where job_id = p_job and state in ('valid', 'duplicate')) f
  where r.id = f.id and f.rn > f.first_row and r.state = 'valid';

  update import_jobs j set status = 'validated',
    total_rows = (select count(*) from import_rows where job_id = p_job),
    valid_rows = (select count(*) from import_rows where job_id = p_job and state = 'valid'),
    duplicate_rows = (select count(*) from import_rows where job_id = p_job and state = 'duplicate'),
    invalid_rows = (select count(*) from import_rows where job_id = p_job and state = 'invalid')
  where j.id = p_job;
end $$;

-- All-or-nothing: if any row fails, the whole import is rolled back and the failing row number is reported
create function public.commit_import(p_job uuid) returns int language plpgsql set search_path = public, extensions as $$
declare r record; sid uuid; n int := 0;
begin
  if not private.has_permission('imports.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if (select status from import_jobs where id = p_job for update) is distinct from 'validated' then raise exception 'This import is not ready to be committed'; end if;
  for r in select id, row_number, raw from import_rows where job_id = p_job and state = 'valid' order by row_number loop
    begin
      sid := public.save_school(null, r.raw);
    exception when others then
      raise exception 'Row %: %', r.row_number, sqlerrm using errcode = sqlstate;
    end;
    update import_rows set state = 'imported', school_id = sid where id = r.id;
    n := n + 1;
  end loop;
  update import_jobs set status = 'committed' where id = p_job;
  return n;
end $$;

-- Flat rows with the same column names the importer reads, so an export can be edited and re-imported
create function public.export_schools(p_status school_status default null, p_country text default null, p_search text default null,
  p_limit int default 1000, p_offset int default 0) returns setof jsonb language plpgsql stable set search_path = public, extensions as $$
begin
  if not private.has_permission('schools.read_all') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'status', s.status, 'country', co.slug, 'region', rg.slug, 'city', ci.slug, 'school_type', st.code, 'gender', s.gender_policy,
    'address', s.address, 'postal_code', s.postal_code, 'latitude', st_y(s.location::geometry), 'longitude', st_x(s.location::geometry),
    'phone', s.phone, 'email', s.email, 'website', s.website, 'admissions_url', s.admissions_url, 'founded_year', s.founded_year, 'student_capacity', s.student_capacity,
    'has_boarding', s.has_boarding, 'has_transport', s.has_transport, 'offers_quran', s.offers_quran, 'offers_arabic', s.offers_arabic,
    'offers_islamic_studies', s.offers_islamic_studies, 'scholarships_available', s.scholarships_available, 'currency', s.currency_code,
    'tuition_annual', (select min(f.amount) from school_fees f join fee_categories fc on fc.id = f.fee_category_id where f.school_id = s.id and fc.code = 'tuition' and f.period = 'year'),
    'curricula', (select string_agg(c.code, ';' order by c.code) from school_curricula x join curricula c on c.id = x.curriculum_id where x.school_id = s.id),
    'grade_levels', (select string_agg(c.code, ';' order by c.code) from school_grade_levels x join grade_levels c on c.id = x.grade_level_id where x.school_id = s.id),
    'languages', (select string_agg(x.language_code, ';' order by x.language_code) from school_languages x where x.school_id = s.id),
    'facilities', (select string_agg(c.code, ';' order by c.code) from school_facilities x join facilities c on c.id = x.facility_id where x.school_id = s.id),
    'verification_status', s.verification_status,
    'name_en', (select t.name from school_translations t where t.school_id = s.id and t.language_code = 'en'),
    'name_ar', (select t.name from school_translations t where t.school_id = s.id and t.language_code = 'ar'),
    'name_ms', (select t.name from school_translations t where t.school_id = s.id and t.language_code = 'ms'),
    'description_en', (select t.description from school_translations t where t.school_id = s.id and t.language_code = 'en'),
    'description_ar', (select t.description from school_translations t where t.school_id = s.id and t.language_code = 'ar'),
    'description_ms', (select t.description from school_translations t where t.school_id = s.id and t.language_code = 'ms'))
  from schools s join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
    left join regions rg on rg.id = s.region_id left join school_types st on st.id = s.school_type_id
  where (p_status is null or s.status = p_status) and (p_country is null or co.slug = p_country)
    and (p_search is null or s.slug ilike '%' || p_search || '%' or exists (select 1 from school_translations t where t.school_id = s.id and t.name ilike '%' || p_search || '%'))
  order by s.created_at, s.id limit least(greatest(p_limit, 1), 5000) offset greatest(p_offset, 0);
end $$;

-- Bulk edit categories, type or city for many schools in one transaction
create function public.bulk_edit_schools(p_ids uuid[], p_changes jsonb) returns int language plpgsql set search_path = public, extensions as $$
declare n int;
begin
  if not private.has_permission('schools.write') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if cardinality(p_ids) = 0 or cardinality(p_ids) > 500 then raise exception 'Select between 1 and 500 schools' using errcode = '22023'; end if;
  if p_changes ? 'school_type_id' then update schools set school_type_id = nullif(p_changes->>'school_type_id', '')::bigint where id = any (p_ids); end if;
  if nullif(p_changes->>'city_id', '') is not null then
    update schools s set city_id = c.id, country_id = c.country_id, region_id = c.region_id from cities c where c.id = (p_changes->>'city_id')::bigint and s.id = any (p_ids);
  end if;
  insert into school_curricula select s, v::bigint from unnest(p_ids) s, jsonb_array_elements_text(coalesce(p_changes->'add_curricula', '[]')) v on conflict do nothing;
  delete from school_curricula where school_id = any (p_ids) and curriculum_id in (select v::bigint from jsonb_array_elements_text(coalesce(p_changes->'remove_curricula', '[]')) v);
  insert into school_facilities select s, v::bigint from unnest(p_ids) s, jsonb_array_elements_text(coalesce(p_changes->'add_facilities', '[]')) v on conflict do nothing;
  delete from school_facilities where school_id = any (p_ids) and facility_id in (select v::bigint from jsonb_array_elements_text(coalesce(p_changes->'remove_facilities', '[]')) v);
  insert into school_grade_levels select s, v::bigint from unnest(p_ids) s, jsonb_array_elements_text(coalesce(p_changes->'add_grade_levels', '[]')) v on conflict do nothing;
  delete from school_grade_levels where school_id = any (p_ids) and grade_level_id in (select v::bigint from jsonb_array_elements_text(coalesce(p_changes->'remove_grade_levels', '[]')) v);
  insert into school_languages select s, v from unnest(p_ids) s, jsonb_array_elements_text(coalesce(p_changes->'add_languages', '[]')) v on conflict do nothing;
  delete from school_languages where school_id = any (p_ids) and language_code in (select v from jsonb_array_elements_text(coalesce(p_changes->'remove_languages', '[]')) v);
  select count(*) into n from schools where id = any (p_ids);
  return n;
end $$;

-- Users and roles (reads auth.users, so these run with definer rights behind explicit permission checks)
create function public.admin_list_users(p_search text default null, p_limit int default 25, p_offset int default 0)
returns table (id uuid, email text, display_name text, roles app_role[], created_at timestamptz, last_sign_in_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not private.has_permission('users.read') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select u.id, u.email::text, p.display_name,
    coalesce((select array_agg(r.role order by r.role) from user_roles r where r.user_id = u.id), '{}'), u.created_at, u.last_sign_in_at, count(*) over ()
  from auth.users u left join profiles p on p.id = u.id
  where p_search is null or p_search = '' or u.email ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%'
  order by (select count(*) from user_roles r where r.user_id = u.id and r.role not in ('parent', 'school_representative')) desc, u.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;

create function public.set_user_roles(p_user uuid, p_roles app_role[]) returns void language plpgsql security definer set search_path = public, extensions as $$
declare staff app_role[] := array['super_admin','data_manager','content_manager','verification_manager','support_admin']::app_role[];
begin
  if not private.has_permission('roles.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'User not found'; end if;
  delete from user_roles where user_id = p_user and role = any (staff) and role <> all (coalesce(p_roles, '{}'));
  insert into user_roles (user_id, role) select p_user, r from unnest(coalesce(p_roles, '{}')) r where r = any (staff) on conflict do nothing;
  if not exists (select 1 from user_roles where role = 'super_admin') then raise exception 'At least one Super Admin is required' using errcode = '23514'; end if;
end $$;

revoke execute on function public.admin_list_users(text, int, int), public.set_user_roles(uuid, app_role[]),
  public.import_mark_duplicates(uuid), public.commit_import(uuid), public.export_schools(school_status, text, text, int, int),
  public.bulk_edit_schools(uuid[], jsonb) from public, anon;
grant execute on function public.admin_list_users(text, int, int), public.set_user_roles(uuid, app_role[]),
  public.import_mark_duplicates(uuid), public.commit_import(uuid), public.export_schools(school_status, text, text, int, int),
  public.bulk_edit_schools(uuid[], jsonb) to authenticated;

-- Cities of one country with plain latitude/longitude and the alternative names people search for
create function public.admin_list_cities(p_country text) returns table (id bigint, slug text, name_i18n jsonb, region_id bigint, latitude double precision, longitude double precision, aliases text[])
language sql stable set search_path = public, extensions as $$
  select c.id, c.slug, c.name_i18n, c.region_id, st_y(c.location::geometry), st_x(c.location::geometry),
    coalesce((select array_agg(a.alias order by a.alias) from search_aliases a where a.entity_type = 'city' and a.entity_id = c.id), '{}')
  from cities c join countries co on co.id = c.country_id where co.slug = p_country order by c.slug $$;
revoke execute on function public.admin_list_cities(text) from public, anon;
grant execute on function public.admin_list_cities(text) to authenticated;
