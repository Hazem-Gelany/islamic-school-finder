-- Islamic School Finder: core schema
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
set search_path = public, extensions;
grant usage on schema extensions to anon, authenticated;  -- already true on Supabase; explicit for other Postgres setups
create schema if not exists private;

create type school_status as enum ('draft','pending','active','archived','suspended');
create type verification_status as enum ('community_added','information_checked','school_verified','school_managed');
create type claim_status as enum ('pending','approved','rejected','revoked');
create type gender_policy as enum ('boys','girls','mixed');
create type app_role as enum ('super_admin','data_manager','content_manager','verification_manager','support_admin','school_representative','parent');
create type contact_status as enum ('new','read','replied','closed','spam');
create type media_kind as enum ('logo','photo','video');
create type fee_period as enum ('year','term','month','one_time');
create type import_status as enum ('uploaded','validated','committed','failed');

-- Languages (UI locales and content languages)
create table languages (
  code text primary key check (code ~ '^[a-z]{2,3}$'),
  name_en text not null,
  native_name text not null,
  is_rtl boolean not null default false,
  is_ui_enabled boolean not null default false,
  is_active boolean not null default true
);

-- Geography
create table countries (
  id bigint generated always as identity primary key,
  iso2 char(2) not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_i18n jsonb not null check (name_i18n ? 'en'),
  currency_code char(3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table regions (
  id bigint generated always as identity primary key,
  country_id bigint not null references countries(id),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  name_i18n jsonb not null check (name_i18n ? 'en'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, slug),
  unique (id, country_id)
);
create table cities (
  id bigint generated always as identity primary key,
  country_id bigint not null references countries(id),
  region_id bigint,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  name_i18n jsonb not null check (name_i18n ? 'en'),
  location geography(Point,4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, slug),
  unique (id, country_id),
  foreign key (region_id, country_id) references regions(id, country_id)
);
create table search_aliases (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('country','region','city')),
  entity_id bigint not null,
  alias text not null,
  language_code text references languages(code)
);
create unique index search_aliases_uq on search_aliases (entity_type, entity_id, lower(alias));
create index search_aliases_trgm on search_aliases using gin (alias gin_trgm_ops);

-- Admin-managed lookup tables (labels stored per language in name_i18n)
do $$ declare t text; begin
  foreach t in array array['school_types','curricula','facilities','grade_levels','accreditations','fee_categories'] loop
    execute format('create table public.%I (
      id bigint generated always as identity primary key,
      code text not null unique check (code ~ ''^[a-z0-9_]+$''),
      name_i18n jsonb not null check (name_i18n ? ''en''),
      sort_order int not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())', t);
  end loop;
end $$;

-- Schools
create table schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status school_status not null default 'draft',
  verification_status verification_status not null default 'community_added',
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  last_verified_at timestamptz,
  verification_source text,
  verification_notes text,
  country_id bigint not null references countries(id),
  region_id bigint,
  city_id bigint not null,
  school_type_id bigint references school_types(id),
  gender_policy gender_policy,
  address text,
  postal_code text,
  location geography(Point,4326),
  phone text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website text check (website is null or website ~* '^https?://'),
  admissions_url text check (admissions_url is null or admissions_url ~* '^https?://'),
  social_links jsonb not null default '{}'::jsonb,
  founded_year smallint check (founded_year between 1800 and 2100),
  student_capacity int check (student_capacity > 0),
  has_boarding boolean not null default false,
  has_transport boolean not null default false,
  offers_quran boolean not null default false,
  offers_arabic boolean not null default false,
  offers_islamic_studies boolean not null default false,
  scholarships_available boolean not null default false,
  currency_code char(3),
  tuition_annual_min numeric(14,2),  -- derived from school_fees by trigger
  tuition_annual_max numeric(14,2),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (city_id, slug),
  foreign key (city_id, country_id) references cities(id, country_id),
  foreign key (region_id, country_id) references regions(id, country_id)
);
create index schools_country_idx on schools (country_id);
create index schools_region_idx on schools (region_id);
create index schools_city_idx on schools (city_id);
create index schools_status_idx on schools (status);
create index schools_verification_idx on schools (verification_status);
create index schools_created_idx on schools (created_at);
create index schools_updated_idx on schools (updated_at);
create index schools_location_gix on schools using gist (location);
create index schools_active_browse_idx on schools (country_id, city_id) where status = 'active';

create table school_translations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  language_code text not null references languages(code),
  name text not null check (length(trim(name)) > 0),
  description text,
  admission_information text,
  islamic_studies_description text,
  quran_description text,
  arabic_description text,
  search_tsv tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(name,'') || ' ' || coalesce(description,''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, language_code)
);
create index school_translations_tsv_idx on school_translations using gin (search_tsv);
create index school_translations_name_trgm on school_translations using gin (name gin_trgm_ops);

-- Junction tables
create table school_curricula (school_id uuid not null references schools(id) on delete cascade, curriculum_id bigint not null references curricula(id), primary key (school_id, curriculum_id));
create table school_languages (school_id uuid not null references schools(id) on delete cascade, language_code text not null references languages(code), primary key (school_id, language_code));
create table school_facilities (school_id uuid not null references schools(id) on delete cascade, facility_id bigint not null references facilities(id), primary key (school_id, facility_id));
create table school_grade_levels (school_id uuid not null references schools(id) on delete cascade, grade_level_id bigint not null references grade_levels(id), primary key (school_id, grade_level_id));
create table school_accreditations (school_id uuid not null references schools(id) on delete cascade, accreditation_id bigint not null references accreditations(id), reference_number text, primary key (school_id, accreditation_id));
create index school_curricula_rev on school_curricula (curriculum_id);
create index school_languages_rev on school_languages (language_code);
create index school_facilities_rev on school_facilities (facility_id);
create index school_grade_levels_rev on school_grade_levels (grade_level_id);

create table school_fees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  fee_category_id bigint not null references fee_categories(id),
  grade_level_id bigint references grade_levels(id),
  amount numeric(14,2) not null check (amount >= 0),
  currency_code char(3) not null,
  period fee_period not null default 'year',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index school_fees_school_idx on school_fees (school_id);

create table school_media (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  kind media_kind not null,
  storage_path text,               -- path in the 'school-media' bucket: <school_id>/<file>
  external_url text,               -- videos are linked, not stored
  mime_type text,
  size_bytes int check (size_bytes is null or size_bytes > 0),
  width int, height int,
  alt_text_i18n jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);
create index school_media_school_idx on school_media (school_id, sort_order);
create unique index school_media_one_logo on school_media (school_id) where kind = 'logo';

-- Users, roles, permissions
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_locale text references languages(code) default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
create table role_permissions (role app_role not null, permission text not null, primary key (role, permission));
create table school_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, school_id)
);
create index school_members_school_idx on school_members (school_id);

-- Verification, claims, contact
create table verification_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  from_status verification_status,
  to_status verification_status not null,
  source text,
  notes text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index verification_records_school_idx on verification_records (school_id, created_at desc);

create table school_claims (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status claim_status not null default 'pending',
  job_title text,
  contact_email text,
  message text check (message is null or length(message) <= 2000),
  evidence_url text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index school_claims_one_pending on school_claims (school_id, user_id) where status = 'pending';
create index school_claims_status_idx on school_claims (status, created_at);

create table contact_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (length(message) between 10 and 2000),
  status contact_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_requests_school_idx on contact_requests (school_id, created_at desc);
create index contact_requests_parent_idx on contact_requests (parent_id);

create table saved_schools (user_id uuid not null references auth.users(id) on delete cascade, school_id uuid not null references schools(id) on delete cascade, created_at timestamptz not null default now(), primary key (user_id, school_id));
create table saved_searches (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, query jsonb not null, created_at timestamptz not null default now());

-- CSV import staging (validate first, commit valid rows in one transaction)
create table import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  filename text not null,
  status import_status not null default 'uploaded',
  total_rows int not null default 0,
  valid_rows int not null default 0,
  duplicate_rows int not null default 0,
  invalid_rows int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table import_rows (
  id bigint generated always as identity primary key,
  job_id uuid not null references import_jobs(id) on delete cascade,
  row_number int not null,
  raw jsonb not null,
  state text not null default 'pending' check (state in ('pending','valid','duplicate','invalid','imported')),
  errors jsonb not null default '[]'::jsonb,
  school_id uuid references schools(id) on delete set null,
  unique (job_id, row_number)
);

-- Audit log (written only by triggers; see 0003)
create table audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  entity_type text not null,
  entity_id text not null,
  school_id uuid,
  action text not null check (action in ('insert','update','delete')),
  field_name text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (entity_type, entity_id, created_at desc);
create index audit_log_school_idx on audit_log (school_id, created_at desc);
create index audit_log_user_idx on audit_log (user_id, created_at desc);

-- Keep tuition summary columns in sync
create function private.refresh_tuition() returns trigger language plpgsql security definer set search_path = '' as $$
declare sid uuid := coalesce(new.school_id, old.school_id);
begin
  update public.schools s set tuition_annual_min = x.mn, tuition_annual_max = x.mx
  from (select min(f.amount * case f.period when 'month' then 12 when 'term' then 3 else 1 end) mn,
               max(f.amount * case f.period when 'month' then 12 when 'term' then 3 else 1 end) mx
        from public.school_fees f join public.fee_categories c on c.id = f.fee_category_id
        where f.school_id = sid and c.code = 'tuition' and f.period <> 'one_time') x
  where s.id = sid;
  return null;
end $$;
create trigger school_fees_refresh after insert or update or delete on school_fees for each row execute function private.refresh_tuition();

-- updated_at on every table that has it
create function private.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare r record; begin
  for r in select table_name from information_schema.columns where table_schema = 'public' and column_name = 'updated_at' loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', r.table_name);
  end loop;
end $$;
