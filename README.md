# Islamic School Finder

Phases 1-9: foundation, database, admin dashboard, public website, compare, match, import/export with settings, and school claims with a reviewed school portal. Stack: Next.js (App Router), TypeScript, Tailwind, next-intl, Supabase (Postgres + PostGIS, Auth, Storage, RLS).

## Setup
1. `npm install`
2. Create a Supabase project (or run `supabase start` locally). Copy `.env.example` to `.env.local` and fill in the URL and keys.
3. Apply the schema: `supabase link --project-ref <ref>` then `supabase db push` (runs `supabase/migrations/0001` to `0005` in order). Locally, `supabase db reset` also loads `supabase/seed.sql`.
4. Optional demo data: run `supabase/seed.sql` in the SQL editor (dev only; rows are flagged `is_demo`, remove with `delete from schools where is_demo;`).
5. Create your first account by signing up, then promote it in the SQL editor:
   `insert into user_roles (user_id, role) select id, 'super_admin' from auth.users where email = 'you@example.com';`
6. `npm run dev`, then open `/en`, `/ar` (RTL) and `/ms`.

## Database overview
| Migration | Contents |
|---|---|
| 0001 | Tables, constraints, indexes, PostGIS, tuition summary trigger |
| 0002 | Roles and permissions, RLS policies, school guard trigger, claim review, duplicate detection |
| 0003 | Field-level audit log triggers (append-only) |
| 0004 | `school-media` storage bucket and policies |
| 0005 | Reference data: languages, curricula, grades, facilities, fee categories |
| 0007 | Public API: `search_schools` (multilingual text, filters, distance, sorting), `search_facets`, `get_school_public` |
| 0010 | Claims and change requests: claim limits, `review_school_claim`, `revoke_school_claim`, `school_change_requests`, `submit_change_request`, `submit_media_change`, `review_change_request`, reviewer lists, `my_claims`, `my_schools`, tighter storage and RLS rules for representatives |
| 0009 | CSV import (`import_mark_duplicates`, `commit_import`), `export_schools`, `bulk_edit_schools`, `admin_list_users`, `set_user_roles`, `admin_list_cities` |
| 0008 | Compare and Match APIs: `get_schools_for_compare`, `match_candidates` |
| 0006 | Admin API: `save_school` (atomic), `admin_list_schools` (server-side paging/sort/filter), `get_school_for_edit`, `admin_dashboard_stats` |

## Admin panel (Phase 3)
Open `/admin` and sign in with an account that has a staff role (see setup step 5). English-only for the MVP.
- **Dashboard:** live counts from the database, plus recent changes.
- **Schools:** search, filters, sortable columns, server-side pagination, bulk actions (archive, publish, verification), and per-row Edit / Preview / Duplicate / Verify / Unverify / Archive / Restore / Delete.
- **Add / edit school:** 8-step form with English, Arabic and Malay content tabs, validated in the browser and again on the server (Zod). Saves go through one database transaction, and a duplicate check runs before new schools are created.
- **Media:** logo and photo upload (JPG, PNG, WebP, AVIF, max 5 MB, alt text required) on the edit page.
- **Verification:** change level, source and notes; history is kept in `verification_records`.
- **Translations:** schools still missing Arabic, Malay or English.
- **Audit log:** field-level old/new values, filterable, append-only.

Roles: Super Admin and Data Manager can add/edit; Content Manager can edit translations and media at the database level; Verification Manager handles the Verification page; Support Admin is read-only here.
Preview links open the public page, which arrives in Phase 4 (staff can see drafts there because RLS recognises their session).

## Public website (Phase 4)
- `/[locale]/schools`, `/schools/[country]`, `/schools/[country]/[city]`: listing with filters generated from the data that exists (countries, cities, grades, curricula, facilities, languages, accreditation), sort, pagination, and "use my location" distance search. Filter state lives in the URL, e.g. `/en/schools?country=malaysia&city=kuala-lumpur&curriculum=british`.
- `/[locale]/schools/[country]/[city]/[school]`: profile with photos, Islamic education, fees, facilities, admissions, contact, map, verification level and related schools. Content falls back to English with a visible note when a translation is missing.
- Search understands place names in any language: "Islamic schools in Kuala Lumpur", "مدارس إسلامية في كوالالمبور" and "sekolah Islam di Kuala Lumpur" all return the same schools. Aliases for places live in `search_aliases`.
- SEO: localized titles and descriptions, canonical URLs, hreflang alternates, Open Graph, schema.org `School` and `BreadcrumbList` JSON-LD, `sitemap.xml` (published pages only) and `robots.txt`. Filtered and preview URLs are `noindex`.
- Staff preview: the admin "Preview" links add `?preview=1`, which uses the staff session so drafts can be checked before publishing.
- Not in this phase: Compare, Match, Save and Contact-school buttons (Phases 6, 7 and 9). Public pages are rendered on demand; response caching is part of Phase 10 hardening.

## Accounts, claims and the school portal (Phase 9)
**Supabase Auth settings (Authentication, URL configuration):** set *Site URL* to your `NEXT_PUBLIC_SITE_URL`, add `<site url>/auth/callback` to *Redirect URLs*, and keep *Confirm email* switched on. Configure a real SMTP sender before launch, because the built-in mailer is heavily rate-limited.

- **Accounts** (`/en/login`, `/register`, `/forgot-password`, `/reset-password`, `/account`, in English, Arabic and Malay): email and password, email confirmation, password reset, sign out. Sign-up and reset never reveal whether an address already has an account. Post-login redirects accept same-site paths only.
- **Claiming** (`/claim`, or *Claim this profile* on any school page): a signed-in person sends a claim with their role, a contact email, an optional evidence link and a message. Only published schools can be claimed; each person can have 3 claims waiting and 10 per day; every claim and decision is audited. They follow the status under *My account*.
- **Reviewing** (`/admin/claims`, Super Admin / Verification Manager): approve, reject or revoke, with a note the person sees. Approving gives portal access and sets the school to *School managed*; revoking removes access, rejects their pending changes and steps verification back down if nobody else manages the school.
- **School portal** (`/portal`, English only): approved representatives see only their own schools. **Published immediately:** phone, email, website, admissions page, social links, student capacity and the yes/no options for Quran, Arabic, Islamic studies, boarding, transport and scholarships. **Reviewed first:** names and descriptions, fees, address and map location, school type, curricula, grade levels, facilities, languages, founded year and all photos. The public profile stays unchanged until a reviewer approves. The URL name, country, city and verification can only be changed by staff.
- **Change requests** (`/admin/changes`, Super Admin / Data Manager): a before/after table of every proposed change, thumbnails of photos, approve or reject with a note. Approval is one transaction and is attributed to the reviewer in the audit log. A request can add or edit a translation but never remove one.
- **How it is enforced:** the database, not the pages. Representatives have no write access to translations, fees, categories or media rows; a trigger limits their direct edits to the fields above; uploads are only possible into `<school>/pending/` and cannot touch published images.

## Import, export and settings (Phase 8)
- **Import** (`/admin/import`): upload a CSV (UTF-8, comma separated, up to 2,000 rows / 2 MB). Download the template for the columns. Each row is checked, and the report shows how many rows are valid, duplicates and invalid, with the spreadsheet row number and a plain-language reason for each problem (downloadable as CSV). Nothing is saved until you confirm. Duplicates are found against existing schools (same city and URL name, same website, same phone, or a very similar name in the same city) and inside the file. Confirming saves every valid row in **one transaction**: if anything fails, nothing is imported. Imports only create schools (as drafts at the lowest verification level unless the file says `active`); they never change existing schools.
- **Export** (`/admin/export`, or **Export CSV** on the Schools page for the current filters): same columns as the importer, so a file can be edited and re-imported. Cells that spreadsheet programs could run as formulas are protected; the importer removes that protection.
- **Bulk edit**: on the Schools page tick schools and choose *Edit categories, type or city*. Add or remove curricula, grade levels, facilities and languages, set the school type, or move schools to another city (the country follows). One transaction, fully audited. Bulk archive, publish and verification are in the same menu.
- **Categories** (`/admin/settings/categories`): school types, curricula, grade levels, facilities, accreditations and fee categories, with English, Arabic and Malay names. Used items can be hidden but not deleted.
- **Places** (`/admin/settings/places`): countries, regions and cities, including coordinates for distance search and the "other names" people type when searching (e.g. KL).
- **Users** (`/admin/users`): see who has access and assign staff roles (Super Admin only). The last Super Admin cannot be removed. New accounts are created in the Supabase dashboard (Authentication, Users); school representatives are created by the claim process.

## Compare and Match (Phases 6 and 7)
- **Compare** (`/[locale]/compare?schools=id1,id2,id3`): up to four schools side by side. Rows that differ are highlighted; missing information is shown as "Not provided". Visitors pick schools with the Compare button on cards and profiles (stored in their browser, no account needed); a bar at the bottom of every page shows the selection. The link is shareable and uses school IDs, so no data is duplicated.
- **Match** (`/[locale]/match`): a rules-based, explainable engine in `src/features/match/engine.ts`. Only the preferences the parent sets are counted (city, distance, grade, budget, curriculum, gender, language, Islamic studies, Quran, Arabic, boarding, transport, facilities). For every school each preference is *matched*, *not matched*, or *not provided by the school*, shown as "Matches 8 of your 10 preferences". Schools are ordered by how many preferences they meet, then alphabetically. There is no quality score, and verification level does not affect the order. A country (or a city's country) only narrows which schools are considered, and budgets are never compared across different currencies.

## Tests
`supabase/tests/` holds SQL tests that were run against PostgreSQL 16 + PostGIS: load `00_supabase_stub.sql` (stands in for Supabase's `auth` and `storage` on a plain Postgres), then the migrations and seed, then `01`-`08`. Load a fresh database for each file, because the tests create their own users and schools. They cover multilingual search, row-level security for each role, audit entries, verification rules, claim approval and atomic saves. On a real Supabase project you do not need the stub.
`npm test` runs 52 unit tests (validation, form mapping, completeness, search parameters, compare ids, the matching engine, the CSV reader/writer, import row validation, safe redirects, the change-request diff and the direct-versus-reviewed splitter). End-to-end tests arrive in Phase 10.

## Key design decisions
- One school row, translations in `school_translations` (unique per school and language).
- Lookup labels are stored as `name_i18n` JSON ({"en","ar","ms"}) so the admin can add languages without schema changes.
- Permissions live in `role_permissions`; every policy checks `auth.uid()` via `private.has_permission()`.
- Verification changes require `verification.write` and are written to `verification_records` by a trigger.
- Audit entries are written only by triggers; the app has no insert/update/delete access to `audit_log`.
- Admin mutations must use the signed-in user's client (not the service-role key) so audit entries carry the user id.

## Known limits (next phases)
- Nobody is emailed when a claim or change request is decided; the status appears in the person's account. Email notifications need a mail provider (Phase 10).
- The school portal is English only; the public site and account pages are trilingual.
- Sign-in has no application-level rate limit beyond Supabase's own (Phase 10).
- Import only creates schools; updating existing schools by CSV is not supported (use the edit form or bulk edit).
- Staff accounts must exist before roles can be assigned (create them in the Supabase dashboard).
- The header links to `/compare`, `/match`, `/about`, `/login` and `/claim`, which are not built yet.
- School representatives can edit operational fields and translations directly; a review queue for "important fields" is not built yet.
- Rate limiting and spam protection for contact requests are application-level work (Phase 10).
