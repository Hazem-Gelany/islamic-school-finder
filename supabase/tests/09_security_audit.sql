-- Assertion-based audit: raises an error (and the run fails) when a privilege or policy drifts from the intended design.
\set ON_ERROR_STOP on
set search_path = public, extensions;
do $$
declare bad text; expected text[];
begin
  -- 1. The only functions an anonymous visitor may execute are the public read API
  expected := array['get_school_public','get_schools_for_compare','match_candidates','search_facets','search_schools'];
  select string_agg(distinct p.proname, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') and p.proname <> all (expected);
  if bad is not null then raise exception 'anon can execute unexpected functions: %', bad; end if;
  select string_agg(e, ', ') into bad from unnest(expected) e where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = e and has_function_privilege('anon', p.oid, 'execute'));
  if bad is not null then raise exception 'public read API is not executable by anon: %', bad; end if;

  -- 2. The rate limiter is server-only
  if has_function_privilege('anon', 'public.rate_limit_hit(text,int,int)', 'execute') or has_function_privilege('authenticated', 'public.rate_limit_hit(text,int,int)', 'execute') then raise exception 'rate_limit_hit must be service_role only'; end if;
  if has_table_privilege('anon', 'public.rate_limits', 'select') or has_table_privilege('authenticated', 'public.rate_limits', 'select') then raise exception 'rate_limits must not be readable through the API'; end if;
  if has_table_privilege('anon', 'public.school_sort_names', 'select') or has_table_privilege('authenticated', 'public.school_sort_names', 'select') then raise exception 'school_sort_names must not be readable through the API'; end if;

  -- 3. Anonymous visitors cannot write anywhere, and nobody can truncate through the API roles
  select string_agg(c.relname, ', ') into bad from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete') or has_table_privilege('anon', c.oid, 'truncate')
         or has_table_privilege('authenticated', c.oid, 'truncate'));
  if bad is not null then raise exception 'unexpected write/truncate privileges on: %', bad; end if;

  -- 4. Anonymous read access is limited to the published catalogue
  expected := array['languages','countries','regions','cities','search_aliases','school_types','curricula','facilities','grade_levels','accreditations','fee_categories','schools','school_translations','school_curricula','school_languages','school_facilities','school_grade_levels','school_accreditations','school_fees','school_media'];
  select string_agg(c.relname, ', ') into bad from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('anon', c.oid, 'select') and c.relname <> all (expected);
  if bad is not null then raise exception 'anon can read tables that should be private: %', bad; end if;

  -- 5. Row level security is on for every table, and every definer function pins its search_path
  select string_agg(c.relname, ', ') into bad from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if bad is not null then raise exception 'row level security is off for: %', bad; end if;
  select string_agg(p.proname, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if bad is not null then raise exception 'security definer functions without a fixed search_path: %', bad; end if;

  -- 6. Every table that holds personal or internal data has at least one policy (default deny otherwise) and the audit trail cannot be edited
  select string_agg(c.relname, ', ') into bad from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
    and c.relname not in ('rate_limits', 'school_sort_names')   /* internal tables, read only by definer functions */ and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);
  if bad is not null then raise exception 'tables with no policy: %', bad; end if;
  if has_table_privilege('authenticated', 'public.audit_log', 'insert') or has_table_privilege('authenticated', 'public.audit_log', 'update') or has_table_privilege('authenticated', 'public.audit_log', 'delete') then raise exception 'audit_log must be append-only for API roles'; end if;
end $$;

-- 7. Behaviour: internal school fields are not readable by anonymous visitors or ordinary accounts, but are by staff and the school's own representatives
select id as s1 from schools where slug = 'al-noor-international-islamic-school' \gset
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'plain@x'), ('00000000-0000-0000-0000-0000000000a2', 'staff@x'), ('00000000-0000-0000-0000-0000000000a3', 'rep@x');
insert into user_roles values ('00000000-0000-0000-0000-0000000000a2', 'data_manager');
insert into school_members (user_id, school_id) values ('00000000-0000-0000-0000-0000000000a3', :'s1');
do $$ declare sid uuid := (select id from schools where slug = 'al-noor-international-islamic-school'); r jsonb; who text;
begin
  foreach who in array array['', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3'] loop
    perform set_config('request.jwt.claim.sub', who, true);
    execute case when who = '' then 'set local role anon' else 'set local role authenticated' end;
    begin
      select public.get_school_for_edit(sid) into r;
      if who in ('', '00000000-0000-0000-0000-0000000000a1') and r is not null then raise exception 'get_school_for_edit leaked to %', coalesce(nullif(who, ''), 'anon'); end if;
      if who in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3') and r is null then raise exception 'get_school_for_edit hidden from %', who; end if;
    exception when insufficient_privilege then
      if who not in ('', '00000000-0000-0000-0000-0000000000a1') then raise; end if;   -- anon is refused outright; that also counts as protected
    end;
    reset role;
  end loop;
end $$;
set role anon; select set_config('request.jwt.claim.sub', '', false);
do $$ begin begin perform 1 from public.profiles limit 1; raise exception 'anon could read profiles'; exception when insufficient_privilege then null; end; end $$;
reset role;
\echo SECURITY AUDIT PASSED

-- 8. Rate limiter: counts per key and window, blocks after the limit, keys are independent
set role service_role;
do $$ declare allowed int; other boolean; begin
  select count(*) filter (where ok) into allowed from (select public.rate_limit_hit('test:a', 3, 60) as ok from generate_series(1, 6)) x;
  if allowed <> 3 then raise exception 'rate limiter allowed % of 6 with a limit of 3', allowed; end if;
  select public.rate_limit_hit('test:b', 3, 60) into other;
  if not other then raise exception 'rate limit keys are not independent'; end if;
end $$;
reset role;
do $$ begin begin set local role authenticated; perform public.rate_limit_hit('x', 1, 1); raise exception 'authenticated could call rate_limit_hit'; exception when insufficient_privilege then null; end; end $$;
\echo RATE LIMITER PASSED
