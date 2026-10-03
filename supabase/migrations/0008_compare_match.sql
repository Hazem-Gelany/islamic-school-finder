-- Compare and Match read APIs (public, RLS applies; only active schools are returned)
set search_path = public, extensions;

-- Up to 4 schools by id, in the order requested, in the same shape as get_school_public
create function public.get_schools_for_compare(p_ids uuid[]) returns jsonb language sql stable set search_path = public, extensions as $$
  select coalesce(jsonb_agg(public.get_school_public(co.slug, ci.slug, s.slug) order by array_position(p_ids, s.id)), '[]'::jsonb)
  from schools s join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
  where s.id = any (p_ids[1:4]) and s.status = 'active' $$;
grant execute on function public.get_schools_for_compare(uuid[]) to anon, authenticated;

-- Candidate schools with everything the (TypeScript) matching engine needs to explain each match
create function public.match_candidates(p_locale text default 'en', p_country text default null,
  p_lat double precision default null, p_lng double precision default null, p_limit int default 500) returns jsonb
language sql stable set search_path = public, extensions as $$
  select coalesce(jsonb_agg(q.r order by q.nm), '[]'::jsonb) from (
    select
      (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1) as nm,
      jsonb_build_object(
        'id', s.id, 'slug', s.slug, 'country_slug', co.slug, 'city_slug', ci.slug,
        'name', (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
        'country_name', coalesce(co.name_i18n->>p_locale, co.name_i18n->>'en'), 'city_name', coalesce(ci.name_i18n->>p_locale, ci.name_i18n->>'en'),
        'verification_status', s.verification_status, 'gender_policy', s.gender_policy,
        'offers_quran', s.offers_quran, 'offers_arabic', s.offers_arabic, 'offers_islamic_studies', s.offers_islamic_studies,
        'has_boarding', s.has_boarding, 'has_transport', s.has_transport,
        'tuition_annual_min', s.tuition_annual_min, 'currency_code', s.currency_code,
        'grades', coalesce((select jsonb_agg(g.code) from school_grade_levels x join grade_levels g on g.id = x.grade_level_id where x.school_id = s.id), '[]'),
        'curricula', coalesce((select jsonb_agg(c.code) from school_curricula x join curricula c on c.id = x.curriculum_id where x.school_id = s.id), '[]'),
        'languages', coalesce((select jsonb_agg(x.language_code) from school_languages x where x.school_id = s.id), '[]'),
        'facilities', coalesce((select jsonb_agg(f.code) from school_facilities x join facilities f on f.id = x.facility_id where x.school_id = s.id), '[]'),
        'distance_km', case when p_lat is not null and p_lng is not null and s.location is not null
                            then st_distance(s.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0 end
      ) as r
    from schools s join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
    where s.status = 'active' and (p_country is null or co.slug = p_country)
    order by 1 limit least(greatest(p_limit, 1), 500)
  ) q $$;
grant execute on function public.match_candidates(text, text, double precision, double precision, int) to anon, authenticated;
