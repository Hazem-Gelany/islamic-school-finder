\set VERBOSITY terse
\pset format unaligned
\pset tuples_only on
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000001','dm@x'),('00000000-0000-0000-0000-000000000002','rep@x'),('00000000-0000-0000-0000-000000000006','stranger@x');
insert into user_roles values ('00000000-0000-0000-0000-000000000001','data_manager');
select id as s1 from schools where slug='al-noor-international-islamic-school' \gset
select id as s2 from schools where slug='cahaya-islamic-school' \gset
insert into school_members(user_id,school_id) values ('00000000-0000-0000-0000-000000000002',:'s1');
grant all on storage.objects to authenticated, anon;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
\echo === TEXT PROPOSAL (forbidden keys are stripped)
select submit_change_request(:'s1', jsonb_build_object('status','archived','slug','evil','address','7 Proposal Lane','translations', jsonb_build_array(
   jsonb_build_object('language_code','en','name','Al-Noor Renamed','description','Our new description'),jsonb_build_object('language_code','ms','name','Al-Noor Baharu')),
   'fees', jsonb_build_array(jsonb_build_object('fee_category_id',(select id from fee_categories where code='tuition'),'amount',19500,'currency_code','MYR','period','year')),
   'curriculum_ids', jsonb_build_array((select id from curricula where code='ib'))),'rename and new fees') as rid \gset
select 'stripped status/slug: '||(payload ? 'status')||'/'||(payload ? 'slug')||' ; keys='||(select string_agg(k,',' order by k) from jsonb_object_keys(payload) k) from school_change_requests where id=:'rid';
\echo === PHOTO PROPOSAL (saved independently, text kept)
select submit_media_change(:'s1', jsonb_build_array(jsonb_build_object('kind','photo','storage_path',:'s1'||'/pending/p1.jpg','mime_type','image/jpeg','size_bytes',1000,'alt','Front gate'),
   jsonb_build_object('kind','logo','storage_path',:'s1'||'/pending/logo.png','mime_type','image/png','size_bytes',500,'alt','School logo')), '[]') = :'rid'::uuid as same_request;
select 'still one pending: '||count(*)||' ; text kept: '||(payload ? 'translations')||' ; media adds: '||jsonb_array_length(media->'add') from school_change_requests where status='pending' group by payload, media;
\echo image outside the pending folder / wrong type / too big / no alt text (expect Invalid image upload):
select submit_media_change(:'s1', jsonb_build_array(jsonb_build_object('kind','photo','storage_path',:'s2'||'/pending/x.jpg','mime_type','image/jpeg','size_bytes',10,'alt','abc')), '[]');
select submit_media_change(:'s1', jsonb_build_array(jsonb_build_object('kind','photo','storage_path',:'s1'||'/live.jpg','mime_type','image/jpeg','size_bytes',10,'alt','abc')), '[]');
select submit_media_change(:'s1', jsonb_build_array(jsonb_build_object('kind','photo','storage_path',:'s1'||'/pending/x.svg','mime_type','image/svg+xml','size_bytes',10,'alt','abc')), '[]');
select submit_media_change(:'s1', jsonb_build_array(jsonb_build_object('kind','photo','storage_path',:'s1'||'/pending/x.jpg','mime_type','image/jpeg','size_bytes',99999999,'alt','abc')), '[]');
select submit_media_change(:'s1', jsonb_build_array(jsonb_build_object('kind','photo','storage_path',:'s1'||'/pending/x.jpg','mime_type','image/jpeg','size_bytes',10,'alt','')), '[]');
\echo === STRANGER cannot propose or see
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select submit_change_request(:'s1', jsonb_build_object('address','x'), 'x');
select submit_media_change(:'s1', '[]', '[]');
select 'stranger sees requests: '||count(*) from school_change_requests;
\echo === BEFORE APPROVAL the public site is unchanged
select set_config('request.jwt.claim.sub','',false);
reset role; set role anon; select 'public name: '||(select name from search_schools(p_q=>'Al-Noor International') limit 1);
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
\echo === APPROVAL by a data manager
select 'queue: '||count(*)||' from '||(array_agg(email))[1]||' ; text keys='||(array_agg(jsonb_object_keys_count))[1] from (select r.*, (select count(*) from jsonb_object_keys(r.payload)) jsonb_object_keys_count from admin_list_change_requests('pending') r) q;
select review_change_request(:'rid',true,'ok');
reset role;
select 'name: '||name||' | description: '||description from school_translations where school_id=:'s1' and language_code='en';
select 'ms added: '||name from school_translations where school_id=:'s1' and language_code='ms';
select 'ar KEPT: '||name from school_translations where school_id=:'s1' and language_code='ar';
select 'address: '||address||' ; tuition summary: '||tuition_annual_min||' ; status/slug: '||status||'/'||slug from schools where id=:'s1';
select 'curricula: '||string_agg(c.code,',' order by c.code) from school_curricula x join curricula c on c.id=x.curriculum_id where x.school_id=:'s1';
select 'media: '||string_agg(kind||'('||(alt_text_i18n->>'en')||')', ', ' order by kind) from school_media where school_id=:'s1';
select 'audit: name change by DM='||count(*) from audit_log where entity_type='school_translations' and school_id=:'s1' and field_name='name' and user_id='00000000-0000-0000-0000-000000000001';
reset role; set role anon; select 'public name after: '||(select name from search_schools(p_q=>'Al-Noor Renamed') limit 1);
reset role;
\echo === CLEARING: reverting an edit removes it from the pending request
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select submit_change_request(:'s1', jsonb_build_object('address','Temp'), 't') as ridt \gset
select submit_change_request(:'s1', '{}', null) is null as cleared;
select 'pending rows after clearing text only (no media): '||count(*) from school_change_requests where status='pending';
\echo === REJECT
select submit_change_request(:'s1', jsonb_build_object('address','1 Rejected Street'), 'will be rejected') as rid2 \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select review_change_request(:'rid2',false,'Please add the postcode');
reset role; select 'address after reject: '||s.address||' ; request='||r.status||' ; note='||r.review_notes from schools s, school_change_requests r where s.id=:'s1' and r.id=:'rid2';
\echo === REMOVING A PUBLISHED PHOTO needs approval too
select id as mid from school_media where school_id=:'s1' and kind='photo' \gset
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
\echo rep deleting the media row directly (expect nothing deleted):
delete from school_media where id=:'mid' returning 'deleted directly!';
select submit_media_change(:'s1','[]',jsonb_build_array(:'mid'::text)) is not null as proposed_removal;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select review_change_request(id,true,'ok') from school_change_requests where status='pending';
reset role; select 'photo after approved removal: '||count(*) from school_media where id=:'mid';
\echo === STORAGE
insert into storage.objects(bucket_id,name) values ('school-media', :'s1'||'/pending/logo.png'), ('school-media', :'s1'||'/pending/unused.jpg');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
insert into storage.objects(bucket_id,name) values ('school-media', :'s1'||'/pending/new.jpg') returning 'rep upload to own pending folder: ok';
\echo rep upload to live folder / other school (expect blocked):
insert into storage.objects(bucket_id,name) values ('school-media', :'s1'||'/live.jpg');
insert into storage.objects(bucket_id,name) values ('school-media', :'s2'||'/pending/x.jpg');
with d as (delete from storage.objects where name = :'s1'||'/pending/logo.png' returning 1) select 'deleted the PUBLISHED logo file: '||count(*) from d;
with d as (delete from storage.objects where name = :'s1'||'/pending/unused.jpg' returning 1) select 'deleted own unused upload: '||count(*) from d;
