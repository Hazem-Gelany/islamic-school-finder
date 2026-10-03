-- Roles, permissions, helper functions, RLS policies
set search_path = public, extensions;

insert into role_permissions (role, permission)
select 'super_admin'::app_role, p from unnest(array['schools.read_all','schools.write','schools.delete','translations.write','media.write','categories.manage','verification.write','claims.review','users.read','roles.manage','support.manage','audit.read','imports.manage']) p
union all select 'data_manager'::app_role, p from unnest(array['schools.read_all','schools.write','translations.write','media.write','categories.manage','verification.write','imports.manage','audit.read']) p
union all select 'content_manager'::app_role, p from unnest(array['schools.read_all','translations.write','media.write']) p
union all select 'verification_manager'::app_role, p from unnest(array['schools.read_all','verification.write','claims.review']) p
union all select 'support_admin'::app_role, p from unnest(array['schools.read_all','users.read','support.manage']) p;

-- Helpers (never trust client-supplied roles: everything derives from auth.uid())
create function private.has_permission(p text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles ur join public.role_permissions rp on rp.role = ur.role
                 where ur.user_id = auth.uid() and rp.permission = p) $$;
create function private.is_school_member(sid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.school_members m where m.user_id = auth.uid() and m.school_id = sid) $$;
create function private.can_edit_school(sid uuid, perm text) returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_permission('schools.write') or private.has_permission(perm) or private.is_school_member(sid) $$;
grant usage on schema private to anon, authenticated;
grant execute on all functions in schema private to anon, authenticated;

create function public.my_permissions() returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct rp.permission), '{}') from public.user_roles ur
  join public.role_permissions rp on rp.role = ur.role where ur.user_id = auth.uid() $$;
revoke execute on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

-- New auth user => profile + parent role
create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.raw_user_meta_data->>'display_name');
  insert into public.user_roles (user_id, role) values (new.id, 'parent');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- Guard: members may only edit operational fields; verification changes need permission and are logged
create function private.guard_school_write() returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
  allowed text[] := array['phone','email','website','admissions_url','social_links','scholarships_available','has_boarding','has_transport','offers_quran','offers_arabic','offers_islamic_studies','student_capacity','tuition_annual_min','tuition_annual_max','updated_at','updated_by'];
begin
  if uid is null then return new; end if;  -- migrations / service role
  if tg_op = 'INSERT' then new.created_by := uid; new.updated_by := uid; return new; end if;
  new.updated_by := uid;
  if not private.has_permission('schools.write') then
    if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
      raise exception 'You are not allowed to change these school fields' using errcode = '42501';
    end if;
  end if;
  if new.verification_status is distinct from old.verification_status then
    if not private.has_permission('verification.write') then
      raise exception 'You are not allowed to change verification status' using errcode = '42501';
    end if;
    new.verified_by := uid; new.last_verified_at := now();
    if new.verification_status in ('school_verified','school_managed') then new.verified_at := coalesce(new.verified_at, now()); end if;
    insert into public.verification_records (school_id, from_status, to_status, source, notes, performed_by)
    values (new.id, old.verification_status, new.verification_status, new.verification_source, new.verification_notes, uid);
  end if;
  return new;
end $$;
create trigger guard_school_write before insert or update on schools for each row execute function private.guard_school_write();

-- Enable RLS everywhere
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- Public-read, permission-managed reference data
do $$ declare t text; begin
  foreach t in array array['languages','countries','regions','cities','search_aliases','school_types','curricula','facilities','grade_levels','accreditations','fee_categories'] loop
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('create policy "manage" on public.%I for all to authenticated using (private.has_permission(''categories.manage'')) with check (private.has_permission(''categories.manage''))', t);
  end loop;
end $$;

-- Schools
create policy "read active or permitted" on schools for select
  using (status = 'active' or private.has_permission('schools.read_all') or private.is_school_member(id));
create policy "admin insert" on schools for insert to authenticated with check (private.has_permission('schools.write'));
create policy "admin or member update" on schools for update to authenticated
  using (private.has_permission('schools.write') or private.is_school_member(id))
  with check (private.has_permission('schools.write') or private.is_school_member(id));
create policy "super admin delete" on schools for delete to authenticated using (private.has_permission('schools.delete'));

-- School child tables: visible when the school is visible; writable by permission or membership
do $$ declare pair text; t text; perm text; begin
  foreach pair in array array['school_translations:translations.write','school_media:media.write','school_curricula:schools.write','school_languages:schools.write','school_facilities:schools.write','school_grade_levels:schools.write','school_accreditations:schools.write','school_fees:schools.write'] loop
    t := split_part(pair, ':', 1); perm := split_part(pair, ':', 2);
    execute format('create policy "read via school" on public.%I for select using (exists (select 1 from public.schools s where s.id = %I.school_id))', t, t);
    execute format('create policy "write" on public.%I for all to authenticated using (private.can_edit_school(school_id, %L)) with check (private.can_edit_school(school_id, %L))', t, perm, perm);
  end loop;
end $$;

-- Users
create policy "own or staff read" on profiles for select to authenticated using (id = auth.uid() or private.has_permission('users.read'));
create policy "own update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own or staff read" on user_roles for select to authenticated using (user_id = auth.uid() or private.has_permission('users.read'));
create policy "super admin manage" on user_roles for all to authenticated using (private.has_permission('roles.manage')) with check (private.has_permission('roles.manage'));
create policy "read own or staff" on role_permissions for select to authenticated using (true);
create policy "own or staff read" on school_members for select to authenticated using (user_id = auth.uid() or private.has_permission('users.read'));
create policy "super admin manage" on school_members for all to authenticated using (private.has_permission('roles.manage')) with check (private.has_permission('roles.manage'));

-- Verification (append-only for everyone: no update/delete policies)
create policy "staff read" on verification_records for select to authenticated using (private.has_permission('schools.read_all'));

-- Claims
create policy "create own" on school_claims for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "read own or reviewer" on school_claims for select to authenticated using (user_id = auth.uid() or private.has_permission('claims.review'));
-- Approval/rejection only through review_school_claim()

-- Contact requests
create policy "parent creates" on contact_requests for insert to authenticated
  with check (parent_id = auth.uid() and exists (select 1 from public.schools s where s.id = school_id and s.status = 'active'));
create policy "read own, school or support" on contact_requests for select to authenticated
  using (parent_id = auth.uid() or private.is_school_member(school_id) or private.has_permission('support.manage'));
create policy "school or support update" on contact_requests for update to authenticated
  using (private.is_school_member(school_id) or private.has_permission('support.manage'))
  with check (private.is_school_member(school_id) or private.has_permission('support.manage'));

-- Saved items
create policy "own" on saved_schools for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on saved_searches for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Imports
create policy "importers" on import_jobs for all to authenticated using (private.has_permission('imports.manage')) with check (private.has_permission('imports.manage'));
create policy "importers" on import_rows for all to authenticated using (private.has_permission('imports.manage')) with check (private.has_permission('imports.manage'));

-- Audit log: readable by permission, written only by triggers
create policy "auditors read" on audit_log for select to authenticated using (private.has_permission('audit.read'));
revoke insert, update, delete, truncate on audit_log from anon, authenticated;

-- Claim review (approve/reject) as one atomic, permission-checked action
create function public.review_school_claim(p_claim_id uuid, p_approve boolean, p_notes text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.school_claims;
begin
  if not private.has_permission('claims.review') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into c from public.school_claims where id = p_claim_id for update;
  if not found or c.status <> 'pending' then raise exception 'Claim is not pending'; end if;
  update public.school_claims
     set status = case when p_approve then 'approved'::public.claim_status else 'rejected'::public.claim_status end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
   where id = p_claim_id;
  if p_approve then
    insert into public.school_members (user_id, school_id, granted_by) values (c.user_id, c.school_id, auth.uid()) on conflict do nothing;
    insert into public.user_roles (user_id, role) values (c.user_id, 'school_representative') on conflict do nothing;
  end if;
end $$;
revoke execute on function public.review_school_claim(uuid, boolean, text) from public, anon;
grant execute on function public.review_school_claim(uuid, boolean, text) to authenticated;

-- Duplicate detection (runs as the caller, so RLS applies)
create function public.find_duplicate_schools(p_name text, p_website text default null, p_phone text default null, p_lat double precision default null, p_lng double precision default null)
returns table (school_id uuid, matched_name text, reasons text[])
language sql stable set search_path = public, extensions as $$
  select * from (
    select s.id, min(t.name),
      array_remove(array[
        case when max(similarity(t.name, p_name)) > 0.6 then 'similar_name' end,
        case when p_website is not null and s.website is not null
              and lower(regexp_replace(s.website, '^https?://(www\.)?|/$', '', 'g')) = lower(regexp_replace(p_website, '^https?://(www\.)?|/$', '', 'g')) then 'same_website' end,
        case when p_phone is not null and s.phone is not null
              and regexp_replace(s.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g') then 'same_phone' end,
        case when p_lat is not null and p_lng is not null and s.location is not null
              and st_dwithin(s.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, 75) then 'within_75m' end
      ], null) as reasons
    from schools s join school_translations t on t.school_id = s.id
    group by s.id, s.website, s.phone, s.location
  ) x where cardinality(x.reasons) > 0 $$;
grant execute on function public.find_duplicate_schools(text, text, text, double precision, double precision) to authenticated;
