-- Phase 9: parent accounts, contact-school, claims, saved schools.
-- Builds on the tables and RLS policies from 0001/0002; adds contact details, abuse guards and the read functions the app needs.

-- ---------------------------------------------------------------------------
-- Contact requests: who is asking, and how can the school reply?
-- contact_email is copied from the signed-in account by a trigger, so it cannot be spoofed.
-- ---------------------------------------------------------------------------
alter table contact_requests
  add column contact_name  text check (contact_name is null or length(btrim(contact_name)) between 2 and 120),
  add column contact_email text,
  add column contact_phone text check (contact_phone is null or length(contact_phone) <= 40);

create function private.contact_requests_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'new';
    select u.email into new.contact_email from auth.users u where u.id = new.parent_id;
    -- Simple, database-level limits. Captcha / IP limits are Phase 10 work.
    if (select count(*) from public.contact_requests where parent_id = new.parent_id and created_at > now() - interval '1 day') >= 5 then
      raise exception 'Too many messages today' using errcode = 'RL001';
    end if;
    if exists (select 1 from public.contact_requests where parent_id = new.parent_id and school_id = new.school_id and created_at > now() - interval '1 day') then
      raise exception 'Already contacted this school today' using errcode = 'RL002';
    end if;
  else
    -- School members and support may only change the status of a request, never its content.
    if (new.school_id, new.parent_id, new.message, new.contact_name, new.contact_email, new.contact_phone, new.created_at)
       is distinct from (old.school_id, old.parent_id, old.message, old.contact_name, old.contact_email, old.contact_phone, old.created_at) then
      raise exception 'Only the status can be changed' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger contact_requests_guard before insert or update on contact_requests for each row execute function private.contact_requests_guard();

-- ---------------------------------------------------------------------------
-- Claims: sensible limits and a safe evidence link
-- ---------------------------------------------------------------------------
alter table school_claims add constraint school_claims_evidence_url_http check (evidence_url is null or evidence_url ~* '^https?://');

create function private.school_claims_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.school_members m where m.user_id = new.user_id and m.school_id = new.school_id) then
    raise exception 'You already manage this school' using errcode = 'RL003';
  end if;
  if not exists (select 1 from public.schools s where s.id = new.school_id and s.status = 'active') then
    raise exception 'This school is not available for claims' using errcode = 'RL004';
  end if;
  if (select count(*) from public.school_claims c where c.user_id = new.user_id and c.status = 'pending') >= 5 then
    raise exception 'Too many pending claims' using errcode = 'RL005';
  end if;
  if new.contact_email is null then select u.email into new.contact_email from auth.users u where u.id = new.user_id; end if;
  return new;
end $$;
create trigger school_claims_guard before insert on school_claims for each row execute function private.school_claims_guard();

-- ---------------------------------------------------------------------------
-- Reviewers need the claimant's email, which they cannot read from auth.users directly.
-- ---------------------------------------------------------------------------
create function public.admin_list_claims(p_status public.claim_status default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not private.has_permission('claims.review') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(r.j order by r.created_at desc), '[]'::jsonb) from (
    select c.created_at, jsonb_build_object(
      'id', c.id, 'status', c.status, 'school_id', s.id,
      'school_name', (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = 'en') desc, t.language_code limit 1),
      'school_path', co.slug || '/' || ci.slug || '/' || s.slug,
      'claimant_email', u.email, 'job_title', c.job_title, 'contact_email', c.contact_email, 'message', c.message, 'evidence_url', c.evidence_url,
      'created_at', c.created_at, 'reviewed_at', c.reviewed_at, 'review_notes', c.review_notes,
      'has_members', exists (select 1 from school_members m where m.school_id = s.id)) as j
    from school_claims c
    join schools s on s.id = c.school_id join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
    join auth.users u on u.id = c.user_id
    where c.status = p_status order by c.created_at desc limit 100) r);
end $$;
revoke execute on function public.admin_list_claims(public.claim_status) from public, anon;
grant execute on function public.admin_list_claims(public.claim_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Account page data. Both run as the caller, so RLS still applies.
-- ---------------------------------------------------------------------------
create function public.my_saved_schools(p_locale text default 'en')
returns table (id uuid, slug text, country_slug text, city_slug text, name text, description text, country_name text, city_name text,
  verification_status verification_status, gender_policy gender_policy, tuition_annual_min numeric, tuition_annual_max numeric, currency_code char(3),
  has_boarding boolean, has_transport boolean, offers_quran boolean, offers_arabic boolean, curricula text[], logo_path text,
  distance_km double precision, updated_at timestamptz, total_count bigint)
language sql stable set search_path = public, extensions as $$
  select s.id, s.slug, co.slug, ci.slug,
    (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
    (select left(t.description, 220) from school_translations t where t.school_id = s.id and t.description is not null order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
    coalesce(co.name_i18n->>p_locale, co.name_i18n->>'en'), coalesce(ci.name_i18n->>p_locale, ci.name_i18n->>'en'),
    s.verification_status, s.gender_policy, s.tuition_annual_min, s.tuition_annual_max, s.currency_code,
    s.has_boarding, s.has_transport, s.offers_quran, s.offers_arabic,
    coalesce((select array_agg(coalesce(c.name_i18n->>p_locale, c.name_i18n->>'en') order by c.sort_order) from school_curricula sc join curricula c on c.id = sc.curriculum_id where sc.school_id = s.id), '{}'),
    (select m.storage_path from school_media m where m.school_id = s.id and m.kind = 'logo' limit 1),
    null::double precision, s.updated_at, count(*) over ()
  from saved_schools ss
  join schools s on s.id = ss.school_id and s.status = 'active'
  join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
  where ss.user_id = auth.uid()
  order by ss.created_at desc limit 100 $$;

create function public.my_member_schools(p_locale text default 'en')
returns table (id uuid, slug text, country_slug text, city_slug text, name text, status text, verification_status verification_status)
language sql stable set search_path = public, extensions as $$
  select s.id, s.slug, co.slug, ci.slug,
    (select t.name from school_translations t where t.school_id = s.id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
    s.status::text, s.verification_status
  from school_members m join schools s on s.id = m.school_id
  join countries co on co.id = s.country_id join cities ci on ci.id = s.city_id
  where m.user_id = auth.uid() order by 5 $$;

revoke execute on function public.my_saved_schools(text), public.my_member_schools(text) from public, anon;
grant execute on function public.my_saved_schools(text), public.my_member_schools(text) to authenticated;

-- Messages the visitor sent, plus messages sent to schools they manage. Only these two groups, even for staff.
create function public.my_messages(p_locale text default 'en')
returns table (id uuid, direction text, school_id uuid, school_name text, school_path text, message text, status contact_status,
  contact_name text, contact_email text, contact_phone text, created_at timestamptz)
language sql stable set search_path = public, extensions as $$
  select r.id, case when r.parent_id = auth.uid() then 'sent' else 'received' end, r.school_id,
    (select t.name from school_translations t where t.school_id = r.school_id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
    co.slug || '/' || ci.slug || '/' || s.slug,
    r.message, r.status, r.contact_name, r.contact_email, r.contact_phone, r.created_at
  from contact_requests r
  left join schools s on s.id = r.school_id
  left join countries co on co.id = s.country_id left join cities ci on ci.id = s.city_id
  where r.parent_id = auth.uid()
     or exists (select 1 from school_members m where m.user_id = auth.uid() and m.school_id = r.school_id)
  order by r.created_at desc limit 200 $$;

create function public.my_claims(p_locale text default 'en')
returns table (id uuid, status claim_status, school_id uuid, school_name text, school_path text, job_title text, review_notes text, created_at timestamptz)
language sql stable set search_path = public, extensions as $$
  select c.id, c.status, c.school_id,
    (select t.name from school_translations t where t.school_id = c.school_id order by (t.language_code = p_locale) desc, (t.language_code = 'en') desc, t.language_code limit 1),
    co.slug || '/' || ci.slug || '/' || s.slug, c.job_title, c.review_notes, c.created_at
  from school_claims c
  left join schools s on s.id = c.school_id
  left join countries co on co.id = s.country_id left join cities ci on ci.id = s.city_id
  where c.user_id = auth.uid() order by c.created_at desc limit 50 $$;

revoke execute on function public.my_messages(text), public.my_claims(text) from public, anon;
grant execute on function public.my_messages(text), public.my_claims(text) to authenticated;
