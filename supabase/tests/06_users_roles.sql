\set VERBOSITY terse
\pset format unaligned
\pset tuples_only on
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
\echo === city move verified in a separate statement
select 'country/city now: '||string_agg(distinct co.slug||'/'||ci.slug, ',') from schools s join countries co on co.id=s.country_id join cities ci on ci.id=s.city_id where s.slug like 'new-school-%';
\echo === USERS as super admin
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select 'users: '||count(*)||' ; first: '||(array_agg(email order by email))[1] from admin_list_users();
select set_user_roles('00000000-0000-0000-0000-000000000002','{data_manager,content_manager}');
select 'roles of parent@x: '||array_to_string(roles,',') from admin_list_users('parent@x');
select set_user_roles('00000000-0000-0000-0000-000000000002','{support_admin}');
select 'after change: '||array_to_string(roles,',') from admin_list_users('parent@x');
\echo --- removing the last super admin must fail
select set_user_roles('00000000-0000-0000-0000-000000000005','{data_manager}');
select 'root still super_admin: '||bool_or('super_admin'=any(roles)) from admin_list_users('root@x');
\echo --- cannot grant school_representative or parent via this function
select set_user_roles('00000000-0000-0000-0000-000000000002','{school_representative,support_admin}');
select 'roles: '||array_to_string(roles,',') from admin_list_users('parent@x');
\echo --- audit shows who changed roles
reset role;
select 'audit user_roles rows: '||count(*)||' by '||string_agg(distinct coalesce(user_id::text,'system'),',') from audit_log where entity_type='user_roles' and user_id is not null;
