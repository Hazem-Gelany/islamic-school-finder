-- Phase 10: performance at scale (tested with 20,000 schools). Same results as before, computed page-first.
set search_path = public, extensions;

-- Indexes that the duplicate checks can actually use
create index if not exists schools_website_norm_idx on schools (lower(regexp_replace(website, '^https?://(www\.)?|/$', '', 'g'))) where website is not null;
create index if not exists schools_phone_digits_idx on schools (regexp_replace(phone, '\D', '', 'g')) where phone is not null;

-- One short row per school holding the name used for alphabetical order (English name, else the first language). Sorting by it avoids a lookup per school.
create table school_sort_names (school_id uuid primary key references schools(id) on delete cascade, sort_name text not null default '');
create index school_sort_names_idx on school_sort_names (sort_name, school_id);
alter table school_sort_names enable row level security;   -- read only by the definer functions below
revoke all on school_sort_names from anon, authenticated;
create function private.refresh_sort_name() returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid := coalesce(new.school_id, old.school_id);
begin
  if exists (select 1 from schools where id = sid) then
    insert into school_sort_names (school_id, sort_name)
    values (sid, coalesce((select t.name from school_translations t where t.school_id = sid order by (t.language_code = 'en') desc, t.language_code limit 1), ''))
    on conflict (school_id) do update set sort_name = excluded.sort_name;
  end if;
  return null;
end $$;
create trigger refresh_sort_name after insert or update of name, language_code or delete on school_translations for each row execute function private.refresh_sort_name();
insert into school_sort_names (school_id, sort_name)
select s.id, coalesce((select t.name from school_translations t where t.school_id = s.id order by (t.language_code = 'en') desc, t.language_code limit 1), '') from schools s
on conflict (school_id) do update set sort_name = excluded.sort_name;
create index if not exists schools_slug_trgm on schools using gin (slug gin_trgm_ops);

-- Public search. Runs with fixed rights (it only ever returns published schools), picks the page first, then fetches details for those rows only.
create or replace function public.search_schools(
  p_locale text default 'en', p_q text default null, p_country text default null, p_city text default null,
  p_grade text default null, p_curriculum text default null, p_gender gender_policy default null, p_language text default null,
  p_fee_min numeric default null, p_fee_max numeric default null,
  p_quran boolean default null, p_arabic boolean default null, p_islamic boolean default null,
  p_boarding boolean default null, p_transport boolean default null,
  p_facilities text[] default null, p_accreditation text default null, p_verified boolean default null,
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_sort text default 'relevance', p_limit int default 12, p_offset int default 0)
returns table (id uuid, slug text, country_slug text, city_slug text, name text, description text, country_name text, city_name text,
  verification_status verification_status, gender_policy gender_policy, tuition_annual_min numeric, tuition_annual_max numeric, currency_code char(3),
  has_boarding boolean, has_transport boolean, offers_quran boolean, offers_arabic boolean, curricula text[], logo_path text,
  distance_km double precision, updated_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  q text := lower(trim(coalesce(p_q, '')));
  v_city bigint; v_country bigint; v_match text; v_resid text; v_ids uuid[];
  origin geography;
  stop text[] := array['islamic','islam','school','schools','in','near','at','of','the','and','sekolah','di','dan','مدارس','مدرسة','إسلامية','اسلامية','الإسلامية','في'];
begin
  if q <> '' and p_city is null and p_country is null then
    select ci.id, mm.m into v_city, v_match
    from cities ci cross join lateral (
      select lower(n) as m from (select value as n from jsonb_each_text(ci.name_i18n)
        union all select a.alias from search_aliases a where a.entity_type = 'city' and a.entity_id = ci.id) x
      where length(n) >= 2 and position(lower(n) in q) > 0 order by length(n) desc limit 1) mm
    order by length(mm.m) desc limit 1;
    if v_city is null then
      select co.id, mm.m into v_country, v_match
      from countries co cross join lateral (
        select lower(n) as m from (select value as n from jsonb_each_text(co.name_i18n)
          union all select a.alias from search_aliases a where a.entity_type = 'country' and a.entity_id = co.id) x
        where length(n) >= 2 and position(lower(n) in q) > 0 order by length(n) desc limit 1) mm
      order by length(mm.m) desc limit 1;
    end if;
  end if;
  select nullif(string_agg(w, ' '), '') into v_resid
  from unnest(regexp_split_to_array(case when v_match is null then q else replace(q, v_match, ' ') end, '\s+')) w
  where w <> '' and w <> all (stop);

  if v_resid is not null then
    -- planned with the real term, so the trigram and full-text indexes are used (a generic plan would scan every school)
    execute 'select array_agg(distinct t.school_id) from school_translations t where t.name ilike $1 or t.search_tsv @@ plainto_tsquery(''simple''::regconfig, $2)'
      into v_ids using '%' || v_resid || '%', v_resid;
    v_ids := coalesce(v_ids, '{}');
  end if;

  if p_lat is not null and p_lng is not null then origin := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography; end if;

  return query
  with base as (
    select s.id, sn.sort_name as name, s.tuition_annual_min, s.updated_at,
      case when origin is not null and s.location is not null then st_distance(s.location, origin) / 1000.0 end as distance_km,
      case when v_resid is not null then (select max(similarity(t.name, v_resid)) from school_translations t where t.school_id = s.id) end as rel
    from schools s join school_sort_names sn on sn.school_id = s.id join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
    where s.status = 'active'
      and (p_country is null or co.slug = p_country) and (p_city is null or ci.slug = p_city)
      and (v_city is null or s.city_id = v_city) and (v_country is null or s.country_id = v_country)
      and (v_resid is null or s.id = any (v_ids))
      and (p_grade is null or exists (select 1 from school_grade_levels x join grade_levels g on g.id = x.grade_level_id where x.school_id = s.id and g.code = p_grade))
      and (p_curriculum is null or exists (select 1 from school_curricula x join curricula c on c.id = x.curriculum_id where x.school_id = s.id and c.code = p_curriculum))
      and (p_language is null or exists (select 1 from school_languages x where x.school_id = s.id and x.language_code = p_language))
      and (p_accreditation is null or exists (select 1 from school_accreditations x join accreditations a on a.id = x.accreditation_id where x.school_id = s.id and a.code = p_accreditation))
      and (p_facilities is null or (select count(distinct f.code) from school_facilities x join facilities f on f.id = x.facility_id where x.school_id = s.id and f.code = any (p_facilities)) = cardinality(p_facilities))
      and (p_gender is null or s.gender_policy = p_gender)
      and (p_quran is null or s.offers_quran = p_quran) and (p_arabic is null or s.offers_arabic = p_arabic) and (p_islamic is null or s.offers_islamic_studies = p_islamic)
      and (p_boarding is null or s.has_boarding = p_boarding) and (p_transport is null or s.has_transport = p_transport)
      and (p_fee_max is null or s.tuition_annual_min <= p_fee_max) and (p_fee_min is null or s.tuition_annual_max >= p_fee_min)
      and (p_verified is null or not p_verified or s.verification_status in ('school_verified','school_managed'))
      and (origin is null or p_radius_km is null or (s.location is not null and st_dwithin(s.location, origin, p_radius_km * 1000)))
  ), ranked as (
    select b.id, b.name, b.distance_km, count(*) over () as total,
      row_number() over (order by
        case when p_sort = 'distance' then b.distance_km end asc nulls last,
        case when p_sort = 'fee_low' then b.tuition_annual_min end asc nulls last,
        case when p_sort = 'fee_high' then b.tuition_annual_min end desc nulls last,
        case when p_sort = 'updated' then b.updated_at end desc,
        case when p_sort = 'relevance' then b.rel end desc nulls last,
        b.name asc, b.id) as rn
    from base b
  )
  select s.id, s.slug, co.slug, ci.slug,
    (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
    (select left(t.description, 220) from school_translations t where t.school_id = s.id and t.description is not null order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
    coalesce(co.name_i18n->>p_locale, co.name_i18n->>'en'), coalesce(ci.name_i18n->>p_locale, ci.name_i18n->>'en'),
    s.verification_status, s.gender_policy, s.tuition_annual_min, s.tuition_annual_max, s.currency_code, s.has_boarding, s.has_transport, s.offers_quran, s.offers_arabic,
    coalesce((select array_agg(coalesce(c.name_i18n->>p_locale, c.name_i18n->>'en') order by c.sort_order) from school_curricula sc join curricula c on c.id = sc.curriculum_id where sc.school_id = s.id), '{}'),
    (select m.storage_path from school_media m where m.school_id = s.id and m.kind = 'logo' limit 1),
    r.distance_km, s.updated_at, r.total
  from ranked r join schools s on s.id = r.id join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
  where r.rn > greatest(p_offset, 0) and r.rn <= greatest(p_offset, 0) + least(greatest(p_limit, 1), 48)
  order by r.rn;
end $$;

-- Filter options and match candidates also only read published data, so they skip the per-row security checks
alter function public.search_facets() security definer set search_path = public, extensions;
alter function public.match_candidates(text, text, double precision, double precision, int) security definer set search_path = public, extensions;

-- Admin table: permission checked once up front, then page-first
create or replace function public.admin_list_schools(
  p_search text default null, p_status school_status default null, p_verification verification_status default null,
  p_country text default null, p_missing_lang text default null,
  p_sort text default 'updated_at', p_dir text default 'desc', p_limit int default 20, p_offset int default 0)
returns table (id uuid, slug text, name text, country text, country_slug text, city text, city_slug text, status school_status,
  verification_status verification_status, verification_source text, last_verified_at timestamptz, languages text[], updated_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  col text := case p_sort when 'name' then 'name' when 'country' then 'country' when 'city' then 'city'
                          when 'status' then 'status::text' when 'verification' then 'verification_status::text' else 'updated_at' end;
  dir text := case when lower(p_dir) = 'asc' then 'asc' else 'desc' end;
begin
  if not private.has_permission('schools.read_all') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query execute format($q$
    with base as (
      select s.id, s.slug, sn.sort_name as name, co.name_i18n->>'en' as country, co.slug as country_slug, ci.name_i18n->>'en' as city, ci.slug as city_slug,
        s.status, s.verification_status, s.verification_source, s.last_verified_at, s.updated_at
      from schools s join school_sort_names sn on sn.school_id = s.id join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
      where ($1 is null or s.slug ilike '%%' || $1 || '%%'
             or s.id in (select t.school_id from school_translations t where t.name ilike '%%' || $1 || '%%'))
        and ($2 is null or s.status = $2) and ($3 is null or s.verification_status = $3) and ($4 is null or co.slug = $4)
        and ($5 is null or not exists (select 1 from school_translations t where t.school_id = s.id and t.language_code = $5))
    ), ranked as (
      select b.*, count(*) over () as total, row_number() over (order by b.%s %s, b.id) as rn from base b
    )
    select r.id, r.slug, r.name, r.country, r.country_slug, r.city, r.city_slug, r.status, r.verification_status, r.verification_source, r.last_verified_at,
      coalesce((select array_agg(t.language_code order by t.language_code) from school_translations t where t.school_id = r.id), '{}'), r.updated_at, r.total
    from ranked r where r.rn > $7 and r.rn <= $7 + $6 order by r.rn
  $q$, col, dir)
  using nullif(trim(p_search), ''), p_status, p_verification, p_country, p_missing_lang, least(greatest(p_limit, 1), 100), greatest(p_offset, 0);
end $$;

-- Duplicate check: every candidate source is index-assisted, and only the closest 20 are returned
create or replace function public.find_duplicate_schools(p_name text, p_website text default null, p_phone text default null, p_lat double precision default null, p_lng double precision default null)
returns table (school_id uuid, matched_name text, reasons text[])
language plpgsql stable security definer set search_path = public, extensions set pg_trgm.similarity_threshold = '0.6' as $$
begin
  if not private.has_permission('schools.write') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  with cand as (
    (select t.school_id as id, 'similar_name' as reason, similarity(t.name, p_name) as sim from school_translations t where t.name % p_name order by similarity(t.name, p_name) desc limit 40)
    union all
    (select s.id, 'same_website', 1.0::real from schools s where p_website is not null and s.website is not null
      and lower(regexp_replace(s.website, '^https?://(www\.)?|/$', '', 'g')) = lower(regexp_replace(p_website, '^https?://(www\.)?|/$', '', 'g')) limit 20)
    union all
    (select s.id, 'same_phone', 1.0::real from schools s where coalesce(regexp_replace(p_phone, '\D', '', 'g'), '') <> '' and regexp_replace(s.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g') limit 20)
    union all
    (select s.id, 'within_75m', 1.0::real from schools s where p_lat is not null and p_lng is not null and s.location is not null
      and st_dwithin(s.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, 75) limit 20)
  ), top as (
    select c.id, array_agg(distinct c.reason order by c.reason) as reasons from cand c group by c.id order by cardinality(array_agg(distinct c.reason)) desc, max(c.sim) desc, c.id limit 20
  )
  select top.id, (select t.name from school_translations t where t.school_id = top.id order by similarity(t.name, p_name) desc limit 1), top.reasons from top;
end $$;

-- Import duplicate check: the trigram operator can use the index; similarity() keeps the strict 0.8 cut-off
create or replace function public.import_mark_duplicates(p_job uuid) returns void language plpgsql set search_path = public, extensions as $$
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
        where s.city_id = (r2.raw->>'city_id')::bigint and t.name % (r2.raw->>'name_primary') and similarity(t.name, r2.raw->>'name_primary') > 0.8
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

alter function public.export_schools(school_status, text, text, int, int) security definer set search_path = public, extensions;

alter function public.import_mark_duplicates(uuid) security definer set search_path = public, extensions;
