# Database

PostgreSQL 15+ with the **PostGIS** and **pg_trgm** extensions (both available on Supabase). The complete schema is built by the 12 files in `supabase/migrations/`, applied in order. Current size: **35 tables, 62 row-level-security policies, 85 indexes, 29 public SQL functions, 12 private helper functions, 46 triggers.**

## Migrations

| # | File | Adds |
|---|---|---|
| 0001 | `initial_schema` | Tables, constraints, indexes, enums, PostGIS columns, `updated_at` triggers |
| 0002 | `rbac_rls` | Roles and permissions, helper functions, every row-level-security policy, the school write guard, claim review, duplicate detection |
| 0003 | `audit_triggers` | Field-level audit log written by triggers; append-only |
| 0004 | `storage` | `school-media` bucket and upload rules |
| 0005 | `reference_data` | Languages, curricula, grades, facilities, fee categories, school types, accreditations |
| 0006 | `admin_functions` | `save_school` (atomic), `admin_list_schools`, `get_school_for_edit`, `admin_dashboard_stats` |
| 0007 | `public_search` | `search_schools`, `search_facets`, `get_school_public` |
| 0008 | `compare_match` | `get_schools_for_compare`, `match_candidates` |
| 0009 | `import_export_settings` | CSV import staging and commit, export, bulk edit, user and role management, city list |
| 0010 | `claims_and_changes` | Claim limits and review, change requests, representative rules, storage rules for uploads |
| 0011 | `security_hardening` | Least-privilege grants, private rate limiter, no internal data in public reads |
| 0012 | `performance` | Sort-name table, page-first queries, indexed duplicate checks |

Rules for new migrations: never edit one that has been applied to a shared database; add a new file. Test with `npm run db:test`. Seed data (`supabase/seed.sql`) is for development only and every demo school has `is_demo = true`: remove it with `delete from schools where is_demo;`.

## Tables

| Group | Tables |
|---|---|
| Schools | `schools`, `school_translations`, `school_curricula`, `school_languages`, `school_facilities`, `school_grade_levels`, `school_accreditations`, `school_fees`, `school_media`, `school_sort_names` (internal) |
| Places and categories | `countries`, `regions`, `cities`, `search_aliases`, `languages`, `school_types`, `curricula`, `facilities`, `grade_levels`, `accreditations`, `fee_categories` |
| People and access | `profiles`, `user_roles`, `role_permissions`, `school_members` |
| Trust and review | `verification_records`, `school_claims`, `school_change_requests` |
| Operations | `import_jobs`, `import_rows`, `audit_log`, `rate_limits` (internal), `contact_requests`, `saved_schools`, `saved_searches` |

Key design points:

- `schools` has a stable `uuid`, a `slug` unique **per city** (URLs are `/schools/{country}/{city}/{slug}`), `status` (`draft`, `pending`, `active`, `archived`, `suspended`), `verification_status` (`community_added`, `information_checked`, `school_verified`, `school_managed`), and a PostGIS `geography(Point, 4326)` location with a GiST index.
- Composite foreign keys keep geography consistent: a school's city must belong to its country, and its region to its country.
- `school_translations` is unique on `(school_id, language_code)`; it has a generated full-text column and a trigram index on the name.
- Category tables store labels as `name_i18n` (`{"en": …, "ar": …, "ms": …}`) so a new language needs no schema change. Archiving a school never deletes it; hard delete is limited to Super Admins and only for drafts and archived schools.
- `tuition_annual_min/max` on `schools` are kept in step with `school_fees` by a trigger, so fee filters and sorting are fast.

## Functions (the database API)

| Purpose | Functions | Who can run them |
|---|---|---|
| Public read | `search_schools`, `search_facets`, `get_school_public`, `get_schools_for_compare`, `match_candidates` | Everyone (published schools only) |
| Admin editing | `save_school`, `get_school_for_edit`, `admin_list_schools`, `admin_dashboard_stats`, `find_duplicate_schools`, `bulk_edit_schools`, `export_schools`, `admin_list_cities` | Staff with the matching permission (checked inside) |
| Import | `import_mark_duplicates`, `commit_import` | `imports.manage` |
| People | `admin_list_users`, `set_user_roles`, `my_permissions` | `users.read`, `roles.manage`, any signed-in user |
| Claims and changes | `review_school_claim`, `revoke_school_claim`, `admin_list_claims`, `submit_change_request`, `submit_media_change`, `review_change_request`, `admin_list_change_requests`, `my_claims`, `my_schools` | Signed-in; each checks membership or permission |
| Server only | `rate_limit_hit`, `rate_limit_cleanup` | `service_role` only |

## Security model in the database

- **Row-level security is on for every table** (no exceptions; verified by `supabase/tests/09_security_audit.sql`). Access is decided from `auth.uid()` through `private.has_permission()`, `private.is_school_member()` and `private.can_admin_school()`. Nothing is read from client-supplied roles.
- **Anonymous visitors** can read only the published catalogue tables and run five read functions. They cannot write to or truncate any table. The audit fails the build if that ever changes.
- **Representatives** can write only a short list of operational columns directly (a trigger enforces it); everything else goes through reviewed change requests.
- **The audit log** is written by triggers on 22 tables and cannot be edited or deleted by API roles.
- **Definer functions** always pin `search_path`.

## Performance (20,000 schools, measured)

| Query | Time |
|---|---|
| Browse everything, page 1 | 94 ms |
| Filtered search (typical) | 20–40 ms |
| Free text "Islamic schools in Kuala Lumpur" (any language) | ~30 ms |
| Distance search within 10 km | ~80 ms |
| School profile | 3 ms |
| Filter options | 68 ms |
| Admin schools table, page 1 | 133 ms |
| Duplicate check for a new school | 297 ms |
| Export 1,000 rows | 158 ms |

## Backup and recovery

Supabase's own daily backups / point-in-time recovery are the first line. `scripts/backup.sh` adds a verified logical backup (application data and user accounts as two archives, with checksums), and `scripts/restore.sh` restores it into a database built from the migrations. A full drill (backup, restore into a fresh database, compare all 35 tables, run a search) passes with zero differences. See `DEPLOYMENT.md`.
