\set VERBOSITY terse
\pset format unaligned
\pset tuples_only on
-- users: U1 data_manager, U2 parent (future school rep), U3 content_manager, U4 verification_manager
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','dm@x'),('00000000-0000-0000-0000-000000000002','parent@x'),
 ('00000000-0000-0000-0000-000000000003','cm@x'),('00000000-0000-0000-0000-000000000004','vm@x');
insert into user_roles values ('00000000-0000-0000-0000-000000000001','data_manager'),('00000000-0000-0000-0000-000000000003','content_manager'),('00000000-0000-0000-0000-000000000004','verification_manager');
select 'parent role auto-assigned: '||count(*) from user_roles where user_id='00000000-0000-0000-0000-000000000002' and role='parent';

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
\echo === A: data_manager creates school (draft) + Arabic translation
select (select id from countries where slug='malaysia') c, (select id from cities where slug='kuala-lumpur') k \gset
select save_school(null, jsonb_build_object('slug','test-school','status','draft','country_id',:c,'city_id',:k,'has_boarding',true,
  'translations', jsonb_build_array(jsonb_build_object('language_code','en','name','Test Islamic School','description','d'),jsonb_build_object('language_code','ar','name','مدرسة الاختبار')),
  'curriculum_ids', (select jsonb_agg(id) from curricula where code in ('british')),
  'fees', jsonb_build_array(jsonb_build_object('fee_category_id',(select id from fee_categories where code='tuition'),'amount',8500,'currency_code','MYR','period','year')))) as sid \gset
select 'translations='||count(*) from school_translations where school_id=:'sid';
select 'tuition_annual_min='||tuition_annual_min from schools where id=:'sid';
select 'audit insert rows='||count(*) from audit_log where school_id=:'sid' and action='insert';
\echo === B: duplicate detection (expects similar_name)
select matched_name, reasons from find_duplicate_schools('Al-Noor International Islamic School');
\echo === C: edit tuition -> audit has old/new
select fee_id from (select id fee_id from school_fees where school_id=:'sid') f \gset
select save_school(:'sid', jsonb_build_object('slug','test-school','status','draft','country_id',:c,'city_id',:k,'has_boarding',true,
  'translations', jsonb_build_array(jsonb_build_object('language_code','en','name','Test Islamic School','description','d'),jsonb_build_object('language_code','ar','name','مدرسة الاختبار')),
  'curriculum_ids', (select jsonb_agg(id) from curricula where code in ('british')),
  'fees', jsonb_build_array(jsonb_build_object('id',:'fee_id','fee_category_id',(select id from fee_categories where code='tuition'),'amount',9200,'currency_code','MYR','period','year')))) is not null as saved;
select field_name||': '||old_value||' -> '||new_value from audit_log where school_id=:'sid' and entity_type='school_fees' and action='update';
select 'unchanged fields not logged; school rows in audit for update='||count(*) from audit_log where school_id=:'sid' and entity_type='schools' and action='update';
\echo === D/E: draft hidden from public, active visible, archived hidden
reset role; set role anon;
select 'anon sees draft: '||count(*) from search_schools(p_q=>'Test Islamic School');
select 'anon profile of draft: '||coalesce(get_school_public('malaysia','kuala-lumpur','test-school')::text,'null');
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
update schools set status='active' where id=:'sid';
reset role; set role anon; select 'anon sees active: '||count(*) from search_schools(p_q=>'Test Islamic School');
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
update schools set status='archived' where id=:'sid';
reset role; set role anon; select 'anon sees archived: '||count(*) from search_schools(p_q=>'Test Islamic School');
reset role; select 'archived still in DB: '||count(*) from schools where id=:'sid';
\echo === F: verification rules
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
update schools set verification_status='school_verified', verification_source='phone call' where id=:'sid';
select 'verification_records='||count(*)||' by data_manager' from verification_records where school_id=:'sid';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
\echo content_manager changing verification (expect 0 rows, RLS):
update schools set verification_status='community_added' where id=:'sid';
\echo === G: failed save is atomic (bad city for country)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select count(*) n0 from schools \gset
select save_school(null, jsonb_build_object('slug','broken','country_id',:c,'city_id',(select id from cities where slug='london'),'translations','[{"language_code":"en","name":"Broken"}]'));
reset role; select 'schools before/after: '||:n0||'/'||count(*) from schools;
\echo === H: claim flow
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
insert into school_claims(school_id,user_id,message) select :'sid', '00000000-0000-0000-0000-000000000002', 'I am the principal' returning 'claim created';
\echo parent editing school directly (expect 0 rows):
update schools set phone='123456' where id=:'sid';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
\echo content_manager approving claim (expect denied):
select review_school_claim(id,true) from school_claims limit 1;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select review_school_claim(id,true,'ok') from school_claims limit 1;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
update schools set phone='+60 3 1234 5678' where id=:'sid' returning 'rep updated phone';
\echo rep changing status (expect blocked):
update schools set status='active' where id=:'sid';
\echo rep changing verification (expect blocked):
update schools set verification_status='school_managed' where id=:'sid';
\echo === I: audit log is append-only
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
delete from audit_log;
update audit_log set field_name='x';
\echo === J: admin list + stats
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select 'list total='||min(total_count)||' rows='||count(*) from admin_list_schools(p_limit=>5);
select 'ar-missing='||count(*) from admin_list_schools(p_missing_lang=>'ms');
select 'stats: '||(admin_dashboard_stats()-'parent_accounts')::text;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select admin_dashboard_stats();
