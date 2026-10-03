\set VERBOSITY terse
\pset format unaligned
\pset tuples_only on
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000001','dm@x'),('00000000-0000-0000-0000-000000000002','rep@x'),('00000000-0000-0000-0000-000000000004','vm@x'),('00000000-0000-0000-0000-000000000006','stranger@x');
insert into user_roles values ('00000000-0000-0000-0000-000000000001','data_manager'),('00000000-0000-0000-0000-000000000004','verification_manager');
update schools set status='draft' where slug='penang-quran-academy';
select id as s1 from schools where slug='al-noor-international-islamic-school' \gset
select id as s2 from schools where slug='cahaya-islamic-school' \gset
select id as s3 from schools where slug='darul-ilmi-boys-academy' \gset
select id as s4 from schools where slug='nur-hidayah-girls-school' \gset
select id as sd from schools where slug='penang-quran-academy' \gset
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
\echo === CLAIMS (as the future representative)
insert into school_claims(school_id,user_id,job_title,message) values (:'s1','00000000-0000-0000-0000-000000000002','Principal','I run it') returning 'claim on active school: created';
\echo claim on a DRAFT school (expect RLS block):
insert into school_claims(school_id,user_id) values (:'sd','00000000-0000-0000-0000-000000000002');
\echo same school twice (expect unique violation):
insert into school_claims(school_id,user_id) values (:'s1','00000000-0000-0000-0000-000000000002');
\echo claiming as someone else (expect RLS block):
insert into school_claims(school_id,user_id) values (:'s2','00000000-0000-0000-0000-000000000006');
\echo bad evidence url (expect check violation):
insert into school_claims(school_id,user_id,evidence_url) values (:'s2','00000000-0000-0000-0000-000000000002','javascript:alert(1)');
insert into school_claims(school_id,user_id) values (:'s2','00000000-0000-0000-0000-000000000002'),(:'s3','00000000-0000-0000-0000-000000000002');
\echo 4th pending claim (expect friendly limit message):
insert into school_claims(school_id,user_id) values (:'s4','00000000-0000-0000-0000-000000000002');
select 'my_claims: '||count(*)||' pending='||count(*) filter (where status='pending') from my_claims('en');
\echo === REVIEW
\echo claimant approving own claim (expect Not allowed):
select review_school_claim(id,true) from school_claims where school_id=:'s1' and user_id='00000000-0000-0000-0000-000000000002';
select id as cid from school_claims where school_id=:'s1' \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select 'queue (reviewer sees email+school): '||count(*)||' first='||(array_agg(email||' / '||school_name))[1] from admin_list_claims('pending');
select review_school_claim(:'cid',true,'Verified by phone');
select review_school_claim(id,false,'Could not verify') from school_claims where school_id=:'s3';
\echo approving again (expect friendly message):
select review_school_claim(:'cid',true);
reset role;
select 'membership: '||count(*) from school_members where school_id=:'s1' and user_id='00000000-0000-0000-0000-000000000002';
select 'role: '||string_agg(role::text,',' order by role) from user_roles where user_id='00000000-0000-0000-0000-000000000002';
select 'school now: '||verification_status||' / '||verification_source from schools where id=:'s1';
select 'verification record by reviewer: '||count(*) from verification_records where school_id=:'s1' and to_status='school_managed' and performed_by='00000000-0000-0000-0000-000000000004';
select 'rejected claim: '||status||' / '||review_notes from school_claims where school_id=:'s3';
\echo === REPRESENTATIVE EDITS
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
update schools set phone='+60 3 5555 0000', website='https://rep.example.org' where id=:'s1' returning 'direct edit of contact: published';
\echo name/translation directly (expect blocked, 0 rows or RLS error):
update school_translations set name='Hacked Name' where school_id=:'s1' and language_code='en';
insert into school_translations(school_id,language_code,name) values (:'s1','ms','Nama Palsu');
update school_fees set amount=1 where school_id=:'s1';
\echo status / slug directly (expect blocked):
update schools set status='draft' where id=:'s1';
update schools set slug='hijack' where id=:'s1';
reset role; select 'unchanged name: '||name from school_translations where school_id=:'s1' and language_code='en';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);

\echo === REVOKE
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select submit_change_request(:'s1', jsonb_build_object('address','pending at revoke time'), 'x') is not null as pending_created;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select id as cid from school_claims where school_id=:'s1' \gset
select revoke_school_claim(:'cid','Left the school');
reset role;
select 'membership: '||count(*)||' ; roles: '||(select string_agg(role::text,',' order by role) from user_roles where user_id='00000000-0000-0000-0000-000000000002') from school_members where school_id=:'s1';
select 'verification after revoke: '||verification_status from schools where id=:'s1';
select 'claim: '||status from school_claims where id=:'cid';
select 'pending request auto-rejected: '||status||' / '||review_notes from school_change_requests where school_id=:'s1';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
\echo ex-rep editing phone (expect nothing updated):
update schools set phone='+1 000 000 0000' where id=:'s1' returning 'ex-rep could edit!';
\echo ex-rep submitting (expect Not allowed):
select submit_change_request(:'s1', jsonb_build_object('address','x'), 'x');
