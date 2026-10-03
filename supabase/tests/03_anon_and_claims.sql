\set VERBOSITY terse
\pset format unaligned
\pset tuples_only on
select id as sid from schools where slug='test-school' \gset
select id as cid from school_claims limit 1 \gset
\echo === true anonymous (no session claim): archived school profile must be hidden
select set_config('request.jwt.claim.sub','',false);
set role anon;
select 'anon get_school_public(archived) = '||coalesce(get_school_public('malaysia','kuala-lumpur','test-school')::text,'null');
select 'anon list: '||count(*) from search_schools(p_q=>'Test Islamic School');
select 'anon sees demo active school profile: '||(get_school_public('malaysia','kuala-lumpur','al-noor-international-islamic-school') is not null);
\echo === content_manager reviewing a claim by explicit id (expect Not allowed)
reset role; set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select review_school_claim(:'cid', true);
\echo === parent reading others claims / contact: 0 expected
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
select 'claims visible to stranger: '||count(*) from school_claims;
