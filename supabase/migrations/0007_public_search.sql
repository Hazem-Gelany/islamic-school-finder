-- Public search, facets and profile reads. Callable by anonymous visitors; RLS still applies,
-- and search_schools additionally filters to status = 'active' so staff sessions never leak drafts into public lists.
set search_path = public, extensions;

create function public.search_schools(
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
language plpgsql stable set search_path = public, extensions as $$
#variable_conflict use_column
declare
  q text := lower(trim(coalesce(p_q, '')));
  v_city bigint; v_country bigint; v_match text; v_resid text;
  origin geography;
  stop text[] := array['islamic','islam','school','schools','in','near','at','of','the','and','sekolah','di','dan','مدارس','مدرسة','إسلامية','اسلامية','الإسلامية','في'];
begin
  if q <> '' and p_city is null and p_country is null then
    -- Understand place names in any language, or an alias, inside a free-text query
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

  if p_lat is not null and p_lng is not null then origin := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography; end if;

  return query
  select x.id, x.slug, x.country_slug, x.city_slug, x.name, x.description, x.country_name, x.city_name, x.verification_status, x.gender_policy,
    x.tuition_annual_min, x.tuition_annual_max, x.currency_code, x.has_boarding, x.has_transport, x.offers_quran, x.offers_arabic, x.curricula,
    x.logo_path, x.distance_km, x.updated_at, count(*) over () as total_count
  from (
    select s.id, s.slug, co.slug as country_slug, ci.slug as city_slug,
      (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1) as name,
      (select left(t.description, 220) from school_translations t where t.school_id = s.id and t.description is not null order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1) as description,
      coalesce(co.name_i18n->>p_locale, co.name_i18n->>'en') as country_name, coalesce(ci.name_i18n->>p_locale, ci.name_i18n->>'en') as city_name,
      s.verification_status, s.gender_policy, s.tuition_annual_min, s.tuition_annual_max, s.currency_code,
      s.has_boarding, s.has_transport, s.offers_quran, s.offers_arabic,
      coalesce((select array_agg(coalesce(c.name_i18n->>p_locale, c.name_i18n->>'en') order by c.sort_order) from school_curricula sc join curricula c on c.id = sc.curriculum_id where sc.school_id = s.id), '{}') as curricula,
      (select m.storage_path from school_media m where m.school_id = s.id and m.kind = 'logo' limit 1) as logo_path,
      case when origin is not null and s.location is not null then st_distance(s.location, origin) / 1000.0 end as distance_km,
      s.updated_at,
      case when v_resid is not null then (select max(similarity(t.name, v_resid)) from school_translations t where t.school_id = s.id) end as rel
    from schools s join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
    where s.status = 'active'
      and (p_country is null or co.slug = p_country) and (p_city is null or ci.slug = p_city)
      and (v_city is null or s.city_id = v_city) and (v_country is null or s.country_id = v_country)
      and (v_resid is null or exists (select 1 from school_translations t where t.school_id = s.id
            and (t.name ilike '%' || v_resid || '%' or t.search_tsv @@ plainto_tsquery('simple'::regconfig, v_resid))))
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
  ) x
  order by
    case when p_sort = 'distance' then x.distance_km end asc nulls last,
    case when p_sort = 'fee_low' then x.tuition_annual_min end asc nulls last,
    case when p_sort = 'fee_high' then x.tuition_annual_min end desc nulls last,
    case when p_sort = 'updated' then x.updated_at end desc,
    case when p_sort = 'relevance' then x.rel end desc nulls last,
    x.name asc, x.id
  limit least(greatest(p_limit, 1), 48) offset greatest(p_offset, 0);
end $$;
grant execute on function public.search_schools to anon, authenticated;

-- Filter options that actually exist in the data
create function public.search_facets() returns jsonb language sql stable set search_path = public, extensions as $$
  select jsonb_build_object(
    'countries', coalesce((select jsonb_agg(jsonb_build_object('slug', co.slug, 'name', co.name_i18n, 'currency', co.currency_code, 'count', a.n) order by co.slug)
      from (select country_id, count(*) n from schools where status = 'active' group by 1) a join countries co on co.id = a.country_id), '[]'),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('slug', ci.slug, 'country', co.slug, 'name', ci.name_i18n, 'count', a.n) order by ci.slug)
      from (select city_id, count(*) n from schools where status = 'active' group by 1) a join cities ci on ci.id = a.city_id join countries co on co.id = ci.country_id), '[]'),
    'curricula', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name_i18n, 'count', a.n) order by c.sort_order)
      from (select x.curriculum_id id, count(*) n from school_curricula x join schools s on s.id = x.school_id and s.status = 'active' group by 1) a join curricula c on c.id = a.id), '[]'),
    'grades', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name_i18n, 'count', a.n) order by c.sort_order)
      from (select x.grade_level_id id, count(*) n from school_grade_levels x join schools s on s.id = x.school_id and s.status = 'active' group by 1) a join grade_levels c on c.id = a.id), '[]'),
    'facilities', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name_i18n, 'count', a.n) order by c.sort_order)
      from (select x.facility_id id, count(*) n from school_facilities x join schools s on s.id = x.school_id and s.status = 'active' group by 1) a join facilities c on c.id = a.id), '[]'),
    'accreditations', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name_i18n, 'count', a.n) order by c.sort_order)
      from (select x.accreditation_id id, count(*) n from school_accreditations x join schools s on s.id = x.school_id and s.status = 'active' group by 1) a join accreditations c on c.id = a.id), '[]'),
    'languages', coalesce((select jsonb_agg(jsonb_build_object('code', l.code, 'name', l.native_name, 'count', a.n) order by l.name_en)
      from (select x.language_code code, count(*) n from school_languages x join schools s on s.id = x.school_id and s.status = 'active' group by 1) a join languages l on l.code = a.code), '[]')
  ) $$;
grant execute on function public.search_facets() to anon, authenticated;

-- One school for the public profile page (only the fields that are safe to publish)
create function public.get_school_public(p_country text, p_city text, p_slug text) returns jsonb language sql stable set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'status', s.status, 'verification_status', s.verification_status, 'last_verified_at', s.last_verified_at, 'updated_at', s.updated_at,
    'country', jsonb_build_object('slug', co.slug, 'iso2', co.iso2, 'name', co.name_i18n), 'city', jsonb_build_object('slug', ci.slug, 'name', ci.name_i18n),
    'school_type', (select st.name_i18n from school_types st where st.id = s.school_type_id),
    'gender_policy', s.gender_policy, 'address', s.address, 'postal_code', s.postal_code,
    'latitude', st_y(s.location::geometry), 'longitude', st_x(s.location::geometry),
    'phone', s.phone, 'email', s.email, 'website', s.website, 'admissions_url', s.admissions_url, 'social_links', s.social_links,
    'founded_year', s.founded_year, 'student_capacity', s.student_capacity,
    'has_boarding', s.has_boarding, 'has_transport', s.has_transport, 'offers_quran', s.offers_quran, 'offers_arabic', s.offers_arabic,
    'offers_islamic_studies', s.offers_islamic_studies, 'scholarships_available', s.scholarships_available,
    'currency_code', s.currency_code, 'tuition_annual_min', s.tuition_annual_min, 'tuition_annual_max', s.tuition_annual_max,
    'translations', coalesce((select jsonb_object_agg(t.language_code, jsonb_build_object('name', t.name, 'description', t.description, 'admission_information', t.admission_information,
        'islamic_studies_description', t.islamic_studies_description, 'quran_description', t.quran_description, 'arabic_description', t.arabic_description)) from school_translations t where t.school_id = s.id), '{}'),
    'curricula', coalesce((select jsonb_agg(c.name_i18n order by c.sort_order) from school_curricula x join curricula c on c.id = x.curriculum_id where x.school_id = s.id), '[]'),
    'grade_levels', coalesce((select jsonb_agg(c.name_i18n order by c.sort_order) from school_grade_levels x join grade_levels c on c.id = x.grade_level_id where x.school_id = s.id), '[]'),
    'facilities', coalesce((select jsonb_agg(c.name_i18n order by c.sort_order) from school_facilities x join facilities c on c.id = x.facility_id where x.school_id = s.id), '[]'),
    'languages', coalesce((select jsonb_agg(l.native_name order by l.name_en) from school_languages x join languages l on l.code = x.language_code where x.school_id = s.id), '[]'),
    'accreditations', coalesce((select jsonb_agg(jsonb_build_object('name', a.name_i18n, 'reference', x.reference_number) order by a.sort_order) from school_accreditations x join accreditations a on a.id = x.accreditation_id where x.school_id = s.id), '[]'),
    'fees', coalesce((select jsonb_agg(jsonb_build_object('category', fc.name_i18n, 'grade', g.name_i18n, 'amount', f.amount, 'currency', f.currency_code, 'period', f.period) order by fc.sort_order, g.sort_order nulls first)
      from school_fees f join fee_categories fc on fc.id = f.fee_category_id left join grade_levels g on g.id = f.grade_level_id where f.school_id = s.id), '[]'),
    'media', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'path', m.storage_path, 'alt', m.alt_text_i18n) order by m.sort_order, m.created_at) from school_media m where m.school_id = s.id and m.storage_path is not null), '[]')
  ) from schools s join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
  where co.slug = p_country and ci.slug = p_city and s.slug = p_slug $$;
grant execute on function public.get_school_public(text, text, text) to anon, authenticated;
