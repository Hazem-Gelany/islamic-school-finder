# Architecture

Islamic School Finder is a database-driven web application. Nothing about a school is written into the code: every page is produced from PostgreSQL, and the founder runs the directory from the admin area.

```
Visitor / parent / school / staff
        │
  Next.js 15 (App Router, React 19, TypeScript, Tailwind)        hosted on Vercel
   ├─ Public site   /[locale]/…        English · Arabic (RTL) · Malay      server-rendered, SEO
   ├─ Admin         /admin/…           English, staff only                 server actions
   ├─ School portal /portal/…          English, approved representatives   server actions
   └─ REST API      /api/v1/…          public read-only JSON               + /api/health, /api/cron/cleanup
        │   middleware: language routing, session refresh, Content-Security-Policy (per-request nonce)
        ▼
  Supabase  ── Auth (email + password, confirmation, reset)
            ── PostgreSQL 15+ with PostGIS and pg_trgm
            │     row level security on every table · SQL functions for search, save, review, import
            └─ Storage (bucket "school-media": logos and photos)
```

## Principles

1. **The database is the source of truth and the security boundary.** Row-level security, permission checks and constraints live in PostgreSQL, so a mistake in a page cannot expose data. Pages only decide what to show.
2. **One identity per school.** A school is one row; names and descriptions live in `school_translations` (one row per language). Search in any language finds the same school.
3. **Simple first, extensible later.** PostgreSQL does the search (full text, trigrams, PostGIS distance). No search engine, queue or cache server until a measured need appears.
4. **Everything important is auditable.** Database triggers write a field-level audit log, so no code path can forget to.
5. **Explainable, not ranked.** The matching engine reports which preferences a school meets; it never produces a quality score.

## Code map

| Path | What lives there |
|---|---|
| `src/app/[locale]/` | Public pages: home, schools (listing, country, city, profile, claim), compare, match, login/register/reset, account, claim, about, contact, privacy, 404 |
| `src/app/admin/` | Staff area: dashboard, schools (table, add/edit, bulk edit), verification, translations, claims, change requests, import/export, categories, places, users, audit log |
| `src/app/portal/` | School representative portal |
| `src/app/api/` | `v1/*` public API, `health`, `cron/cleanup` |
| `src/features/` | Logic with no UI: `search` (URL parameters), `match` (engine), `compare`, `import` (CSV rows), `changes` (diff), `portal` (direct vs reviewed), `auth`, `claims`, `settings` |
| `src/components/` | Shared components (`public/`, `admin/`, `auth/`, header/footer) |
| `src/lib/` | Supabase clients (`server`, `anon`, `admin` = service role), `rateLimit`, `csv`, `safeNext`, `errors`, data access (`data/`) |
| `src/i18n/`, `messages/` | Locale routing and the three translation files |
| `supabase/migrations/` | The 12 migrations that build the whole database |
| `supabase/tests/` | SQL tests, including the assertion-based security audit |
| `scripts/` | `backup.sh`, `restore.sh`, `db-test.sh`, `smoke-test.mjs` |
| `e2e/` | Playwright browser tests |

## Three ways the app talks to the database

| Client | Role | Used for |
|---|---|---|
| `lib/supabase/anon.ts` | `anon`, no cookies | Public read functions (cached) and the sitemap |
| `lib/supabase/server.ts` | The signed-in user (cookie session) | Everything done by a person: admin, portal, claims. Row-level security applies. |
| `lib/supabase/admin.ts` | `service_role` (server only, `import 'server-only'`) | Only the shared rate limiter, account deletion and the cleanup job |

Admin changes deliberately use the signed-in user's session, never the service key, so the audit log records who did what.

## Languages and right-to-left

- URLs carry the language (`/en`, `/ar`, `/ms`); `next-intl` loads one JSON file per language. Adding a language means a new file, a locale in `src/i18n/routing.ts`, and a row in `languages`.
- Arabic sets `dir="rtl"` on `<html>`. All spacing uses logical properties (`ms-`, `pe-`, `start`, `end`), so layouts mirror correctly; a code search finds no `left`/`right` utilities.
- School content is per language with an English fallback that is announced to the reader. Place names and categories carry `{en, ar, ms}` labels; city aliases (`search_aliases`) cover alternative spellings.

## Search

`search_schools()` (SQL) understands free text in any language: it finds a place name or alias in the query, treats the rest as a school-name search (trigram + full text), and combines it with filters (grade, curriculum, gender, language, fees, facilities, services, accreditation, verification) and PostGIS distance. It picks the page of results first and only then fetches details, which keeps it near 100 ms even with 20,000 schools. Filter options are generated from the data that exists (`search_facets()`). Sorting is alphabetical by the English name, and every result page is URL-addressable.

## Caching

Public reads (search results, filter options, school profiles) are cached briefly with Next's data cache (60–300 s) and tagged `schools`. Every admin or portal write calls `revalidateTag('schools')`, so edits show immediately; the time limits only bound staleness if a clear is missed. Failed reads are never cached.

## Claims and reviewed changes

```
Representative ──claim──▶ admin approves ──▶ school_members + role + "School managed"
Representative edits ─┬─ contact details, website, yes/no options ─▶ published at once (database trigger limits the columns)
                      └─ names, text, fees, location, categories, photos ─▶ school_change_requests ─▶ staff reviews ─▶ one transaction publishes it
```

Representatives have no write access to reviewed tables; the only path is `submit_change_request` / `submit_media_change`, and only staff run `review_change_request`.

## Where future modules plug in

The brief's roadmap (applications → admissions → leads → CRM → marketplace) fits the current boundaries without rewriting the core:

- **Leads / contact:** `contact_requests` already exists with its policies; add a form and a school-side inbox.
- **Applications and admissions:** new tables referencing `schools` and `auth.users`, new routes under `/portal` and `/account`.
- **CRM / marketplace / advertising:** new `features/*` modules and tables; the audit trigger and permission model apply unchanged (`role_permissions` is data, so new permissions need no code release).
- **More languages:** see above. **Dedicated search engine:** replace the body of `search_schools` or call it from a sync job; callers see the same function.

## Decisions and trade-offs

| Decision | Why | Cost |
|---|---|---|
| Server actions for mutations, REST only for public reads | Fewer moving parts, built-in origin checks | Admin operations are not a public API (add `/api/v1` routes when a mobile app needs them) |
| Rules-based matching in TypeScript | Testable and explainable | Rules are fixed in code |
| PostgreSQL search | Zero extra infrastructure | Sorting is by English name; very large catalogues (>200k) may want a search engine |
| Admin and portal in English only | Small audience, faster delivery | Representatives who do not read English need help (translation files are ready to extend) |
| Per-instance fallback rate limiter | Works without the service key | Weaker than the shared database counter; set the service key in production |
