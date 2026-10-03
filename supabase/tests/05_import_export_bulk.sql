\set VERBOSITY terse
\pset format unaligned
\pset tuples_only on
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000001','dm@x'),('00000000-0000-0000-0000-000000000002','parent@x'),('00000000-0000-0000-0000-000000000005','root@x');
insert into user_roles values ('00000000-0000-0000-0000-000000000001','data_manager'),('00000000-0000-0000-0000-000000000005','super_admin');
select (select id from countries where slug='malaysia') c, (select id from cities where slug='kuala-lumpur') k, (select id from cities where slug='london') lon \gset
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
\echo === IMPORT: 6 rows -> expect valid 2, duplicate 3, invalid 1
insert into import_jobs(filename, created_by) values ('t.csv','00000000-0000-0000-0000-000000000001') returning id as job \gset
insert into import_rows(job_id,row_number,state,raw,errors) values
 (:'job',1,'valid',jsonb_build_object('slug','new-school-a','status','draft','country_id',:c,'city_id',:k,'name_primary','Brand New School A','verification_source','CSV import: t.csv','translations','[{"language_code":"en","name":"Brand New School A"}]'::jsonb),'[]'),
 (:'job',2,'valid',jsonb_build_object('slug','al-noor-international-islamic-school','country_id',:c,'city_id',:k,'name_primary','Totally Different Name','translations','[{"language_code":"en","name":"Totally Different Name"}]'::jsonb),'[]'),
 (:'job',3,'valid',jsonb_build_object('slug','new-school-a','country_id',:c,'city_id',:k,'name_primary','Another','translations','[{"language_code":"en","name":"Another"}]'::jsonb),'[]'),
 (:'job',4,'valid',jsonb_build_object('slug','alnoor-typo','country_id',:c,'city_id',:k,'name_primary','Al-Noor International Islamic Schol','translations','[{"language_code":"en","name":"Al-Noor International Islamic Schol"}]'::jsonb),'[]'),
 (:'job',5,'invalid','{"source":{"slug":"bad"}}','[{"field":"city","message":"Unknown city"}]'),
 (:'job',6,'valid',jsonb_build_object('slug','new-school-b','status','draft','country_id',:c,'city_id',:k,'name_primary','Brand New School B','translations','[{"language_code":"en","name":"Brand New School B"},{"language_code":"ar","name":"مدرسة جديدة"}]'::jsonb),'[]');
select import_mark_duplicates(:'job');
select 'valid='||valid_rows||' duplicate='||duplicate_rows||' invalid='||invalid_rows||' total='||total_rows||' status='||status from import_jobs where id=:'job';
select 'row '||row_number||': '||(errors->0->>'message') from import_rows where job_id=:'job' and state='duplicate' order by row_number;
\echo === COMMIT -> expect 2 imported
select commit_import(:'job') as imported;
select 'schools new-school-*: '||count(*)||' statuses='||string_agg(distinct status::text,',') from schools where slug like 'new-school-%';
select 'audit inserts by importer: '||count(*) from audit_log where entity_type='schools' and action='insert' and user_id='00000000-0000-0000-0000-000000000001' and new_value->>'slug' like 'new-school-%';
select 'source kept: '||verification_source from schools where slug='new-school-a';
\echo === commit twice (expect error)
select commit_import(:'job');
\echo === ROLLBACK: second row has a city from another country -> whole import rolled back
insert into import_jobs(filename) values ('bad.csv') returning id as job2 \gset
insert into import_rows(job_id,row_number,state,raw) values
 (:'job2',1,'valid',jsonb_build_object('slug','new-school-c','country_id',:c,'city_id',:k,'name_primary','C','translations','[{"language_code":"en","name":"C"}]'::jsonb)),
 (:'job2',2,'valid',jsonb_build_object('slug','new-school-d','country_id',:c,'city_id',:lon,'name_primary','D','translations','[{"language_code":"en","name":"D"}]'::jsonb));
select import_mark_duplicates(:'job2');
select commit_import(:'job2');
select 'after failed commit, new-school-c exists: '||count(*) from schools where slug='new-school-c';
select 'job still validated, rows not imported: '||(select status from import_jobs where id=:'job2')||'/'||(select count(*) from import_rows where job_id=:'job2' and state='imported');
\echo === EXPORT
select 'rows exported: '||count(*) from export_schools();
select 'keys: '||(select string_agg(k, ',') from jsonb_object_keys((select j from export_schools(p_search=>'Al-Noor International') j limit 1)) k) ;
select 'sample curricula/tuition: '||(j->>'curricula')||' / '||(j->>'tuition_annual')||' / '||(j->>'name_ar') from export_schools(p_search=>'Al-Noor International') j limit 1;
select 'filter status=draft: '||count(*) from export_schools(p_status=>'draft');
\echo === BULK EDIT
select array_agg(id) ids from schools where slug in ('new-school-a','new-school-b') \gset
select (select id from curricula where code='ib') ib, (select id from facilities where code='library') lib \gset
select 'bulk add ib+library to '||bulk_edit_schools(:'ids'::uuid[], jsonb_build_object('add_curricula', jsonb_build_array(:ib), 'add_facilities', jsonb_build_array(:lib), 'school_type_id', (select id from school_types where code='tahfiz')))||' schools';
select 'curricula rows: '||count(*) from school_curricula where school_id=any(:'ids'::uuid[]);
select bulk_edit_schools(:'ids'::uuid[], jsonb_build_object('remove_curricula', jsonb_build_array(:ib)));
select 'after remove: '||count(*) from school_curricula where school_id=any(:'ids'::uuid[]);
select 'bulk move to london -> country follows: '||bulk_edit_schools(:'ids'::uuid[], jsonb_build_object('city_id', :lon))||' ; country='||(select string_agg(distinct co.slug,',') from schools s join countries co on co.id=s.country_id where s.id=any(:'ids'::uuid[]));
\echo === PERMISSIONS: data_manager cannot manage roles or call it as anon
select set_role_try from (select 1) x, lateral (select set_user_roles('00000000-0000-0000-0000-000000000002','{data_manager}')) set_role_try;
select 'dm list users (users.read missing): ';
select count(*) from admin_list_users();
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select count(*) from export_schools();
