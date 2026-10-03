\pset format unaligned
\pset tuples_only on
set role anon;
\echo --- Test 9: multilingual search (anon) -> expect 4,4,4,1
select 'en', count(*) from search_schools('en','Islamic schools in Kuala Lumpur');
select 'ar', count(*) from search_schools('ar','مدارس إسلامية في كوالالمبور');
select 'ms', count(*) from search_schools('ms','sekolah Islam di Kuala Lumpur');
select 'name', count(*) from search_schools('en','Nur Hidayah');
\echo --- Arabic locale returns Arabic name + total_count
select name, city_name, total_count from search_schools('ar','كوالالمبور') limit 2;
\echo --- filters: boarding, curriculum british in GB, fee range
select 'boarding', count(*) from search_schools(p_boarding => true);
select 'british', count(*) from search_schools(p_curriculum => 'british', p_country => 'united-kingdom');
select 'fee', count(*) from search_schools(p_country => 'malaysia', p_fee_min => 9000, p_fee_max => 15000);
\echo --- distance: within 15km of KL centre, nearest first
select name, round(distance_km::numeric,1) from search_schools(p_lat => 3.139, p_lng => 101.6869, p_radius_km => 15, p_sort => 'distance') limit 3;
\echo --- facets + public profile
select jsonb_array_length(search_facets()->'countries'), jsonb_array_length(search_facets()->'cities');
select get_school_public('malaysia','kuala-lumpur','al-noor-international-islamic-school')->'translations'->'ar'->>'name';
\echo --- anon cannot write
do $$ begin insert into schools(slug,country_id,city_id) values ('x',1,1); exception when others then raise notice 'blocked: %', sqlstate; end $$;
select count(*) from audit_log;
