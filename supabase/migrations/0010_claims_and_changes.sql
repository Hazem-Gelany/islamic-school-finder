-- Phase 9: school claims, representative access, and reviewed change requests
set search_path = public, extensions;

alter table school_claims add constraint school_claims_evidence_url_chk check (evidence_url is null or evidence_url ~* '^https?://');
alter table school_claims add constraint school_claims_email_chk check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Only published schools can be claimed, and each person has limits (abuse prevention)
drop policy "create own" on school_claims;
create policy "create own" on school_claims for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and exists (select 1 from public.schools s where s.id = school_id and s.status = 'active'));

create function private.limit_claims() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.school_members where user_id = new.user_id and school_id = new.school_id) then
    raise exception 'You already manage this school.' using hint = 'user_message'; end if;
  if (select count(*) from public.school_claims where user_id = new.user_id and status = 'pending') >= 3 then
    raise exception 'You already have 3 claims waiting for review. Please wait for a decision first.' using hint = 'user_message'; end if;
  if (select count(*) from public.school_claims where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many claim requests today. Please try again tomorrow.' using hint = 'user_message'; end if;
  return new;
end $$;
create trigger limit_claims before insert on school_claims for each row execute function private.limit_claims();

-- Trusted server-side functions can change protected school fields (e.g. verification) on behalf of a reviewer
create or replace function private.guard_school_write() returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
  allowed text[] := array['phone','email','website','admissions_url','social_links','scholarships_available','has_boarding','has_transport','offers_quran','offers_arabic','offers_islamic_studies','student_capacity','tuition_annual_min','tuition_annual_max','updated_at','updated_by'];
begin
  if uid is null then return new; end if;
  if tg_op = 'INSERT' then new.created_by := uid; new.updated_by := uid; return new; end if;
  new.updated_by := uid;
  if current_setting('app.trusted_write', true) = 'on' then return new; end if;
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

-- Approving a claim: grant access and mark the school as school-managed
create or replace function public.review_school_claim(p_claim_id uuid, p_approve boolean, p_notes text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare c public.school_claims; old_status public.verification_status;
begin
  if not private.has_permission('claims.review') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into c from public.school_claims where id = p_claim_id for update;
  if not found or c.status <> 'pending' then raise exception 'This claim is no longer waiting for review.' using hint = 'user_message'; end if;
  update public.school_claims set status = case when p_approve then 'approved'::public.claim_status else 'rejected'::public.claim_status end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes where id = p_claim_id;
  if p_approve then
    insert into public.school_members (user_id, school_id, granted_by) values (c.user_id, c.school_id, auth.uid()) on conflict do nothing;
    insert into public.user_roles (user_id, role) values (c.user_id, 'school_representative') on conflict do nothing;
    select verification_status into old_status from public.schools where id = c.school_id;
    if old_status <> 'school_managed' then
      perform set_config('app.trusted_write', 'on', true);
      update public.schools set verification_status = 'school_managed', verification_source = 'School claim approved', verified_by = auth.uid(),
        verified_at = coalesce(verified_at, now()), last_verified_at = now() where id = c.school_id;
      perform set_config('app.trusted_write', 'off', true);
      insert into public.verification_records (school_id, from_status, to_status, source, notes, performed_by)
      values (c.school_id, old_status, 'school_managed', 'School claim approved', p_notes, auth.uid());
    end if;
  end if;
end $$;

-- Taking access away again
create function public.revoke_school_claim(p_claim_id uuid, p_notes text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare c public.school_claims; old_status public.verification_status;
begin
  if not private.has_permission('claims.review') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into c from public.school_claims where id = p_claim_id for update;
  if not found or c.status <> 'approved' then raise exception 'Only approved claims can be revoked.' using hint = 'user_message'; end if;
  update public.school_claims set status = 'revoked', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes where id = p_claim_id;
  delete from public.school_members where user_id = c.user_id and school_id = c.school_id;
  if not exists (select 1 from public.school_members where user_id = c.user_id) then delete from public.user_roles where user_id = c.user_id and role = 'school_representative'; end if;
  update public.school_change_requests set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = 'Access was revoked'
    where school_id = c.school_id and requested_by = c.user_id and status = 'pending';
  select verification_status into old_status from public.schools where id = c.school_id;
  if old_status = 'school_managed' and not exists (select 1 from public.school_members where school_id = c.school_id) then
    perform set_config('app.trusted_write', 'on', true);
    update public.schools set verification_status = 'information_checked', verification_source = 'School access revoked', last_verified_at = now() where id = c.school_id;
    perform set_config('app.trusted_write', 'off', true);
    insert into public.verification_records (school_id, from_status, to_status, source, notes, performed_by)
    values (c.school_id, old_status, 'information_checked', 'School access revoked', p_notes, auth.uid());
  end if;
end $$;

-- Representatives may publish only operational fields directly. Everything else is proposed and reviewed.
create type change_request_status as enum ('pending', 'approved', 'rejected');
create table school_change_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status change_request_status not null default 'pending',
  payload jsonb not null default '{}'::jsonb,   -- proposed changes to reviewed fields (text, fees, location, categories)
  media jsonb not null default '{}'::jsonb,     -- {"add": [...], "remove": [media ids]}
  summary text check (summary is null or length(summary) <= 500),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz, review_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index school_change_requests_one_pending on school_change_requests (school_id, requested_by) where status = 'pending';
create index school_change_requests_status_idx on school_change_requests (status, created_at);
create trigger set_updated_at before update on school_change_requests for each row execute function private.set_updated_at();
create trigger audit after insert or update or delete on school_change_requests for each row execute function private.audit_row();
alter table school_change_requests enable row level security;
create policy "own, members or reviewers read" on school_change_requests for select to authenticated
  using (requested_by = auth.uid() or private.is_school_member(school_id) or private.has_permission('schools.write'));
create policy "member withdraws own pending" on school_change_requests for delete to authenticated using (requested_by = auth.uid() and status = 'pending');
-- inserts and updates go through submit_change_request / submit_media_change / review_change_request only

-- Text, fee, location and category proposals. Replaces the text part of the person's pending request; an empty proposal clears it.
-- Definer rights: representatives have no direct insert/update rights on this table, and membership is checked explicitly.
create function public.submit_change_request(p_school uuid, p_payload jsonb, p_summary text default null) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare clean jsonb; rid uuid;
  allowed text[] := array['translations','fees','address','postal_code','latitude','longitude','gender_policy','school_type_id','founded_year','currency_code','curriculum_ids','grade_level_ids','facility_ids','language_codes'];
begin
  if auth.uid() is null or not private.is_school_member(p_school) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into clean from jsonb_each(coalesce(p_payload, '{}'::jsonb)) e(k, v) where k = any (allowed);
  select id into rid from school_change_requests where school_id = p_school and requested_by = auth.uid() and status = 'pending' for update;
  if clean = '{}'::jsonb then
    if rid is not null then
      update school_change_requests set payload = '{}'::jsonb, summary = null where id = rid;
      delete from school_change_requests where id = rid and media = '{}'::jsonb;
    end if;
    return null;
  end if;
  if rid is null then
    insert into school_change_requests (school_id, requested_by, payload, summary) values (p_school, auth.uid(), clean, left(p_summary, 500)) returning id into rid;
  else
    update school_change_requests set payload = clean, summary = left(p_summary, 500) where id = rid;
  end if;
  return rid;
end $$;

-- Photo and logo proposals: files were uploaded to <school_id>/pending/, and published images may be proposed for removal
create function public.submit_media_change(p_school uuid, p_add jsonb, p_remove jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare med jsonb := '{}'::jsonb; rid uuid;
begin
  if auth.uid() is null or not private.is_school_member(p_school) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_add, '[]'::jsonb)) m where coalesce(m->>'storage_path', '') not like p_school::text || '/pending/%'
        or m->>'kind' not in ('photo', 'logo') or coalesce(m->>'mime_type', '') not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
        or coalesce((m->>'size_bytes')::int, 0) not between 1 and 5242880 or length(coalesce(m->>'alt', '')) < 3) then
    raise exception 'Invalid image upload.' using hint = 'user_message'; end if;
  if jsonb_array_length(coalesce(p_add, '[]'::jsonb)) > 0 then med := med || jsonb_build_object('add', p_add); end if;
  if jsonb_array_length(coalesce(p_remove, '[]'::jsonb)) > 0 then med := med || jsonb_build_object('remove', p_remove); end if;
  select id into rid from school_change_requests where school_id = p_school and requested_by = auth.uid() and status = 'pending' for update;
  if rid is null then
    if med = '{}'::jsonb then return null; end if;
    insert into school_change_requests (school_id, requested_by, media) values (p_school, auth.uid(), med) returning id into rid;
  else
    update school_change_requests set media = med where id = rid;
    delete from school_change_requests where id = rid and payload = '{}'::jsonb and media = '{}'::jsonb;
  end if;
  return rid;
end $$;

create function public.review_change_request(p_id uuid, p_approve boolean, p_notes text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare cr school_change_requests; cur jsonb; m jsonb; p jsonb;
begin
  if not private.has_permission('schools.write') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into cr from school_change_requests where id = p_id for update;
  if not found or cr.status <> 'pending' then raise exception 'This request is no longer waiting for review.' using hint = 'user_message'; end if;
  if p_approve then
    cur := public.get_school_for_edit(cr.school_id);
    if cur is null then raise exception 'School not found.' using hint = 'user_message'; end if;
    p := cr.payload;
    -- Translations merge language by language: a request can add or edit a language, never silently remove one
    if p ? 'translations' then
      p := jsonb_set(p, '{translations}', (
        select coalesce(jsonb_agg(x.t), '[]'::jsonb) from (
          select distinct on (u.lang) u.lang, u.t from (
            select o->>'language_code' as lang, o as t, 2 as pri from jsonb_array_elements(coalesce(cur->'translations', '[]'::jsonb)) o
            union all
            select n->>'language_code', n, 1 from jsonb_array_elements(p->'translations') n) u
          order by u.lang, u.pri) x));
    end if;
    if p <> '{}'::jsonb then perform public.save_school(cr.school_id, cur || p); end if;
    delete from school_media where school_id = cr.school_id and id in (select v::uuid from jsonb_array_elements_text(coalesce(cr.media->'remove', '[]'::jsonb)) v);
    for m in select * from jsonb_array_elements(coalesce(cr.media->'add', '[]'::jsonb)) loop
      if m->>'kind' = 'logo' then delete from school_media where school_id = cr.school_id and kind = 'logo'; end if;
      insert into school_media (school_id, kind, storage_path, mime_type, size_bytes, alt_text_i18n)
      values (cr.school_id, (m->>'kind')::media_kind, m->>'storage_path', m->>'mime_type', (m->>'size_bytes')::int, jsonb_build_object('en', m->>'alt'));
    end loop;
  end if;
  update school_change_requests set status = case when p_approve then 'approved'::change_request_status else 'rejected'::change_request_status end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes where id = p_id;
end $$;

-- Reviewed fields can no longer be written directly by representatives
create function private.can_admin_school(perm text) returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_permission('schools.write') or private.has_permission(perm) $$;
grant execute on function private.can_admin_school(text) to anon, authenticated;
do $$ declare pair text; t text; perm text; begin
  foreach pair in array array['school_translations:translations.write','school_media:media.write','school_curricula:schools.write','school_languages:schools.write','school_facilities:schools.write','school_grade_levels:schools.write','school_accreditations:schools.write','school_fees:schools.write'] loop
    t := split_part(pair, ':', 1); perm := split_part(pair, ':', 2);
    execute format('drop policy "write" on public.%I', t);
    execute format('create policy "write" on public.%I for all to authenticated using (private.can_admin_school(%L)) with check (private.can_admin_school(%L))', t, perm, perm);
  end loop;
end $$;

-- Storage: representatives may upload only to <school_id>/pending/ and remove their own unpublished uploads
drop policy "school media insert" on storage.objects; drop policy "school media update" on storage.objects; drop policy "school media delete" on storage.objects;
create policy "school media insert" on storage.objects for insert to authenticated with check (bucket_id = 'school-media' and (
  private.can_admin_school('media.write') or (private.is_school_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = 'pending')));
create policy "school media update" on storage.objects for update to authenticated using (bucket_id = 'school-media' and private.can_admin_school('media.write'));
create policy "school media delete" on storage.objects for delete to authenticated using (bucket_id = 'school-media' and (
  private.can_admin_school('media.write') or (private.is_school_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = 'pending'
    and not exists (select 1 from public.school_media m where m.storage_path = name))));

-- Lists for the reviewer screens (need claimant emails, so definer with explicit permission checks)
create function public.admin_list_claims(p_status text default 'pending')
returns table (id uuid, school_id uuid, school_name text, school_slug text, country_slug text, city_slug text, user_id uuid, email text, display_name text,
  job_title text, contact_email text, message text, evidence_url text, status claim_status, review_notes text, created_at timestamptz, reviewed_at timestamptz, current_managers bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not private.has_permission('claims.review') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select c.id, c.school_id,
    (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = 'en') desc, t.language_code limit 1),
    s.slug, co.slug, ci.slug, c.user_id, u.email::text, p.display_name, c.job_title, c.contact_email, c.message, c.evidence_url, c.status, c.review_notes, c.created_at, c.reviewed_at,
    (select count(*) from school_members m where m.school_id = s.id)
  from school_claims c join schools s on s.id = c.school_id join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
    join auth.users u on u.id = c.user_id left join profiles p on p.id = c.user_id
  where p_status is null or p_status = '' or c.status = p_status::claim_status
  order by (c.status = 'pending') desc, c.created_at desc limit 200;
end $$;

create function public.admin_list_change_requests(p_status text default 'pending')
returns table (id uuid, school_id uuid, school_name text, requested_by uuid, email text, display_name text, summary text, payload jsonb, media jsonb, status change_request_status, review_notes text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not private.has_permission('schools.write') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select r.id, r.school_id, (select t.name from school_translations t where t.school_id = r.school_id order by (t.language_code = 'en') desc, t.language_code limit 1),
    r.requested_by, u.email::text, p.display_name, r.summary, r.payload, r.media, r.status, r.review_notes, r.created_at, r.updated_at
  from school_change_requests r join auth.users u on u.id = r.requested_by left join profiles p on p.id = r.requested_by
  where p_status is null or p_status = '' or r.status = p_status::change_request_status
  order by (r.status = 'pending') desc, r.updated_at desc limit 200;
end $$;

-- For the signed-in person: their claims and the schools they manage
create function public.my_claims(p_locale text default 'en')
returns table (id uuid, status claim_status, review_notes text, created_at timestamptz, school_name text, school_slug text, country_slug text, city_slug text)
language sql stable set search_path = public, extensions as $$
  select c.id, c.status, c.review_notes, c.created_at,
    (select t.name from school_translations t where t.school_id = c.school_id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
    s.slug, co.slug, ci.slug
  from school_claims c left join schools s on s.id = c.school_id left join countries co on co.id = s.country_id left join cities ci on ci.id = s.city_id
  where c.user_id = auth.uid() order by c.created_at desc $$;
create function public.my_schools(p_locale text default 'en')
returns table (id uuid, name text, slug text, country_slug text, city_slug text, status school_status, pending_requests bigint)
language sql stable set search_path = public, extensions as $$
  select s.id, (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
    s.slug, co.slug, ci.slug, s.status, (select count(*) from school_change_requests r where r.school_id = s.id and r.requested_by = auth.uid() and r.status = 'pending')
  from school_members m join schools s on s.id = m.school_id join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
  where m.user_id = auth.uid() order by 2 $$;

revoke execute on function public.review_school_claim(uuid, boolean, text), public.revoke_school_claim(uuid, text), public.submit_change_request(uuid, jsonb, text), public.submit_media_change(uuid, jsonb, jsonb),
  public.review_change_request(uuid, boolean, text), public.admin_list_claims(text), public.admin_list_change_requests(text), public.my_claims(text), public.my_schools(text) from public, anon;
grant execute on function public.review_school_claim(uuid, boolean, text), public.revoke_school_claim(uuid, text), public.submit_change_request(uuid, jsonb, text), public.submit_media_change(uuid, jsonb, jsonb),
  public.review_change_request(uuid, boolean, text), public.admin_list_claims(text), public.admin_list_change_requests(text), public.my_claims(text), public.my_schools(text) to authenticated;
