\pset format unaligned
\pset tuples_only on
select set_config('request.jwt.claim.sub','',false);
set role anon;
select 'candidates MY: '||jsonb_array_length(match_candidates('en','malaysia'));
select 'candidates all: '||jsonb_array_length(match_candidates());
select 'dist KL centre: '||round((match_candidates('en','malaysia',3.139,101.6869)->0->>'distance_km')::numeric,1);
select 'first (alphabetical): '||(match_candidates('en','malaysia')->0->>'name');
select 'sample keys: '||(select string_agg(k, ',' order by k) from jsonb_object_keys(match_candidates('en','malaysia')->0) k);
select 'compare returns 2 in requested order: '||(select string_agg(x->>'slug', ',') from jsonb_array_elements(get_schools_for_compare(array[(select id from schools where slug='cahaya-islamic-school'),(select id from schools where slug='al-noor-international-islamic-school')])) x);
select 'compare ignores archived: '||jsonb_array_length(get_schools_for_compare(array[(select id from schools where slug='test-school')]));
select 'compare caps at 4: '||jsonb_array_length(get_schools_for_compare((select array_agg(id) from schools)));
