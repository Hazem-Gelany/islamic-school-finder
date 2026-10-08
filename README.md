# Islamic School Finder

**Find. Compare. Match. Apply.** A multilingual (English, Arabic with true right-to-left, Malay) directory where families find, compare and contact Islamic schools, and where the founder runs the whole database from an admin area without a developer.

Built with Next.js 15 (React 19, TypeScript, Tailwind), Supabase (PostgreSQL with PostGIS, Auth, Storage) and Vercel. All ten phases of the specification are implemented.

## What it does

**For families**
- Search by place, grade, curriculum, gender, language, fees, Quran / Arabic / Islamic studies, boarding, transport, facilities, accreditation, and distance from them. Free text works in any language: "Islamic schools in Kuala Lumpur", "مدارس إسلامية في كوالالمبور" and "sekolah Islam di Kuala Lumpur" find the same schools. Filters live in the address bar.
- School profiles with photos, fees, facilities, admissions, map, verification level, structured data for search engines.
- **Compare** up to four schools side by side (differences highlighted).
- **Find my school** matching that explains itself: "matches 4 of your 5 preferences", with what matched, what did not, and what the school has not published. Never a quality ranking.
- Accounts: sign up, confirm email, reset password, download or delete their own data.

**For schools**
- Claim a profile; staff review the claim. Approved representatives use the **school portal**: contact details and yes/no options publish at once; names, text, fees, location, categories and photos go to staff for approval first.

**For the founder and team** (`/admin`)
- Dashboard with live numbers; searchable, sortable, paged school table; 8-step add/edit form with English, Arabic and Malay tabs; draft, publish, archive, restore, duplicate, delete; duplicate warnings; bulk actions; photo upload; verification workflow; claims and change-request review with a before/after view; audit log of every change; **CSV import** (checked first, all-or-nothing) and export; manage categories, countries, regions, cities and users and roles.

## Quick start (development)

```bash
npm install
cp .env.example .env.local        # fill in your Supabase project values
supabase link --project-ref <ref> && supabase db push     # builds the database from supabase/migrations
psql "$DATABASE_URL" -f supabase/seed.sql                  # optional: 15 fictional demo schools (is_demo = true)
npm run dev                                                # http://localhost:3000  → /en, /ar, /ms
```

Make yourself the first administrator (after registering at `/en/register`):

```sql
insert into user_roles (user_id, role) select id, 'super_admin' from auth.users where email = 'you@example.com';
```

Production deployment, Supabase settings, backups and the go-live checklist: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Documentation

| File | Contents |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the system fits together, code map, key decisions, where future modules plug in |
| [DATABASE.md](DATABASE.md) | The 12 migrations, tables, functions, security model, measured performance |
| [API.md](API.md) | Public REST API (`/api/v1`), operational endpoints, server actions |
| [SECURITY.md](SECURITY.md) | Roles and permissions, controls, privacy, what was and was not verified, known risks |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Step-by-step launch, monitoring, backup and restore, checklist |

## Commands

| Command | Does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, run |
| `npm run typecheck` | TypeScript check (includes the browser tests) |
| `npm test` | 52 unit tests |
| `npm run db:test` | Builds a scratch database from the migrations and runs the security audit (needs Postgres with PostGIS; CI does this) |
| `node scripts/smoke-test.mjs <url>` | 29 post-deployment checks against a live site |
| `npx playwright test` | Browser tests in `e2e/` (see `playwright.config.ts` for the environment variables) |
| `scripts/backup.sh`, `scripts/restore.sh` | Verified backups and disaster recovery |

SQL behaviour tests (roles, claims, change requests, import, audit) are in `supabase/tests/`; load a fresh database for each file.

## Acceptance tests from the specification

| # | Test | Evidence |
|---|---|---|
| 1 | Create a school | SQL test 02; `e2e/admin.spec.ts` |
| 2 | Edit tuition updates the public profile and the audit log | SQL tests 02 and 08, portal integration run; `e2e/admin.spec.ts` |
| 3 | Arabic translation shows in the Arabic interface | Pages rendered in Arabic against real data (names, price formats, RTL) |
| 4 | Verification change shows publicly | SQL test 02, claim approval test 07 |
| 5 | Archive removes from public search, keeps the record | SQL test 02; `e2e/admin.spec.ts` |
| 6 | **Import 500 schools** | Run exactly as specified: 500 rows → **480 valid, 15 duplicate, 5 invalid**; 480 imported in one transaction in 3.5 s; existing schools untouched |
| 7 | Audit log records previous and new values | SQL tests 02, 08 (attributed to the reviewer) |
| 8 | Language switch changes language and direction | Smoke test (all three languages), `e2e/public.spec.ts` |
| 9 | "Islamic schools in Kuala Lumpur" finds schools, in all languages | SQL test 01 (4 / 4 / 4 results), 20,000-school benchmark (~30 ms) |
| 10 | Three schools compared | Compare page and API tested; `e2e/public.spec.ts` |
| 11 | Matching with transparent criteria | Engine unit tests (includes the "8 of 10" example), SQL and API tests |

## What has been verified, and what has not

**Verified automatically during development:** type check and production build; 52 unit tests; every migration and SQL test on PostgreSQL 16 with PostGIS; an assertion-based security audit that fails on the pre-hardening schema and passes on the final one; the full public site running against a real PostgREST API as the anonymous role (29 of 29 smoke checks); an accessibility scan of 16 rendered pages (0 violations) plus computed colour contrast; security headers and a nonce on every script; a 20,000-school load test (all queries ≤ 300 ms); a complete backup and restore drill (35 tables, 0 differences); the 500-row import.

**Please check in your own environment** (this is not a gap in the code, it was outside what could be run here):
1. A real Supabase project: confirmation and reset emails, SMTP, Auth settings, the storage bucket.
2. The Playwright tests in `e2e/` (written, not executed: no browser could be installed here), including admin and portal screens, which need real accounts.
3. A visual review of the Arabic right-to-left pages and the admin screens on real phones and desktops.
4. Native-speaker review of the Arabic and Malay text, and legal review of the privacy notice (`/privacy` is a draft).
5. Restore drill on a staging Supabase project (the procedure passed locally; Supabase's managed roles can differ).

## Known limits

- Admin and school portal are in English only; the public site and accounts are trilingual.
- No email notifications when a claim or change is decided (status shows in the person's account).
- The importer creates schools; it does not update existing ones (use the edit form or bulk edit).
- Matching and search sort alphabetically by English name; there is no ranking by quality, by design.
- Next.js 15 bundles a PostCSS version flagged by `npm audit` (moderate, build-time only); plan the Next.js 16 upgrade.
- Not built, per the specification's "do not build yet" list: native apps, payments, admissions workflow, CRM, reviews and ratings, AI features, scraping, advertising.

## License and data

The code is yours to license. Demo data in `supabase/seed.sql` is fictional and flagged `is_demo`; never load it in production.
