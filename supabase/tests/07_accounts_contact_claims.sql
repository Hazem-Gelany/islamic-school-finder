\set VERBOSITY terse
\pset format unaligned
\pset tuples_only on
-- users: P1, P2 parents; R1 school representative; V1 verification_manager; S1 support_admin
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000a1','p1@x'),('00000000-0000-0000-0000-0000000000a2','p2@x'),
 ('00000000-0000-0000-0000-0000000000b1','rep@school.org'),('00000000-0000-0000-0000-0000000000c1','vm@x'),('00000000-0000-0000-0000-0000000000d1','support@x');
insert into user_roles values ('00000000-0000-0000-0000-0000000000c1','verification_manager'),('00000000-0000-0000-0000-0000000000d1','support_admin');
select id as sid from schools where slug='cahaya-islamic-school' \gset
select id as sid2 from schools where slug='al-noor-international-islamic-school' \gset

\echo === SAVED SCHOOLS: own list only
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
insert into saved_schools(user_id,school_id) values ('00000000-0000-0000-0000-0000000000a1',:'sid'),('00000000-0000-0000-0000-0000000000a1',:'sid2');
select 'p1 saved list: '||count(*)||' ; first: '||(array_agg(name))[1] from my_saved_schools('en');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select 'p2 sees p1 saves: '||count(*) from saved_schools;
select 'p2 saved list: '||count(*) from my_saved_schools('en');
\echo --- p2 cannot save for p1
insert into saved_schools(user_id,school_id) values ('00000000-0000-0000-0000-0000000000a1',:'sid');
\echo --- anonymous cannot call the saved list
set role anon; select set_config('request.jwt.claim.sub','',false);
select * from my_saved_schools('en');

\echo === CONTACT: parent sends, email is copied from the account, status forced to new
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
insert into contact_requests(school_id,parent_id,message,contact_name,contact_phone,contact_email,status)
  values (:'sid','00000000-0000-0000-0000-0000000000a1','Do you have places in Year 3?','Aisha','+60123','spoof@evil.com','closed');
select 'email from account: '||contact_email||' ; status: '||status from contact_requests;
\echo --- same school again today is refused (RL002)
insert into contact_requests(school_id,parent_id,message) values (:'sid','00000000-0000-0000-0000-0000000000a1','Another question here ok');
\echo --- cannot send as someone else
insert into contact_requests(school_id,parent_id,message) values (:'sid2','00000000-0000-0000-0000-0000000000a2','Pretending to be p2 here');
\echo --- too-short message refused
insert into contact_requests(school_id,parent_id,message) values (:'sid2','00000000-0000-0000-0000-0000000000a1','Hi');
\echo --- daily limit of 5 messages (RL001)
insert into contact_requests(school_id,parent_id,message) select s.id,'00000000-0000-0000-0000-0000000000a1','Question number '||row_number() over () from schools s where s.id not in (:'sid') and s.status='active' limit 4;
select 'p1 messages today: '||count(*) from contact_requests;
insert into contact_requests(school_id,parent_id,message) select s.id,'00000000-0000-0000-0000-0000000000a1','One message too many' from schools s where s.id not in (select school_id from contact_requests) and s.status='active' limit 1;
select 'p1 messages after limit: '||count(*) from contact_requests;
select 'p2 sees p1 messages: '||count(*) from (select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false)) x, contact_requests;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
\echo --- parents cannot edit or delete their own message
update contact_requests set message='edited message text ok' where school_id=:'sid';
delete from contact_requests where school_id=:'sid';
select 'still there: '||count(*) from contact_requests where school_id=:'sid';

\echo === CLAIMS: submit, guards, review, then the new member sees the inbox
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
insert into school_claims(school_id,user_id,job_title,evidence_url) values (:'sid','00000000-0000-0000-0000-0000000000b1','Principal','javascript:alert(1)');
insert into school_claims(school_id,user_id,job_title,evidence_url) values (:'sid','00000000-0000-0000-0000-0000000000b1','Principal','https://school.org/staff') returning 'claim created';
select 'contact_email defaulted to account: '||contact_email from school_claims;
insert into school_claims(school_id,user_id,job_title) values (:'sid','00000000-0000-0000-0000-0000000000b1','Principal');
\echo --- cannot claim a draft or archived school (RL004)
reset role;
set session_replication_role = replica; update schools set status='draft' where id=:'sid2'; reset session_replication_role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
insert into school_claims(school_id,user_id,job_title) values (:'sid2','00000000-0000-0000-0000-0000000000b1','Principal');
reset role; set session_replication_role = replica; update schools set status='active' where id=:'sid2'; reset session_replication_role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
\echo --- a claimant cannot approve their own claim
select review_school_claim(id,true) from school_claims limit 1;
select 'my claims: '||count(*)||' ; status '||min(status::text)||' ; school '||min(school_name) from my_claims('en');
\echo --- p1 cannot see the claim
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select 'p1 sees claims: '||count(*) from school_claims;
\echo --- reviewer list includes the claimant email; others cannot call it
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
select 'pending claims for reviewer: '||jsonb_array_length(admin_list_claims('pending'))||' ; by '||(admin_list_claims('pending')->0->>'claimant_email')||' ; has_members '||(admin_list_claims('pending')->0->>'has_members');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select admin_list_claims('pending');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
select review_school_claim((select id from school_claims where school_id=:'sid'), true, 'Confirmed by phone');
reset role;
select 'approved; members of school: '||count(*) from school_members where school_id=:'sid';
select 'claim status: '||status||' ; notes: '||review_notes from school_claims where school_id=:'sid';
set role authenticated;
\echo --- approved member cannot claim again (RL003)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
insert into school_claims(school_id,user_id,job_title) values (:'sid','00000000-0000-0000-0000-0000000000b1','Principal');
select 'member schools: '||string_agg(name||' ['||status||']',',') from my_member_schools('en');

\echo === INBOX: member sees only messages sent to their school
select 'rep inbox: '||count(*)||' ; directions '||string_agg(distinct direction,',')||' ; from '||string_agg(distinct contact_email,',') from my_messages('en');
select 'rep sees other schools: '||count(*) from my_messages('en') where school_id <> :'sid';
\echo --- member can change status but not content
update contact_requests set status='replied' where school_id=:'sid';
select 'status now: '||status from contact_requests where school_id=:'sid';
update contact_requests set message='Rewritten by the school, not allowed' where school_id=:'sid';
update contact_requests set contact_email='other@x' where school_id=:'sid';
select 'message unchanged: '||message from contact_requests where school_id=:'sid';
\echo --- parent sees the new status in their sent list
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select 'p1 sent list: '||count(*)||' ; replied: '||count(*) filter (where status='replied') from my_messages('en') where direction='sent';
\echo --- p2 (stranger) sees nothing
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select 'p2 messages: '||count(*) from my_messages('en');
\echo --- support_admin can read all requests through the table (support.manage) but my_messages stays personal
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false);
select 'support my_messages: '||count(*)||' ; table-level read: '||(select count(*) from contact_requests) from my_messages('en');
