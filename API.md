# API

There are three kinds of interface. Only the first is a public, versioned contract.

1. **Public REST API (`/api/v1`)**: read-only JSON for schools, comparison, matching and filter options.
2. **Server actions**: how the admin area, school portal and account pages change data. They are not a public API; each checks the signed-in person's permissions on the server.
3. **Database functions**: the layer both of the above call (see `DATABASE.md`). The browser never calls them directly except through Supabase with row-level security in force.

## Public REST API

Base URL: `https://YOUR-DOMAIN/api/v1`. All responses are JSON. Schools returned are **published schools only**; internal fields (who edited a record, verification notes) are never included.

| Behaviour | Detail |
|---|---|
| CORS | `Access-Control-Allow-Origin: *`, `GET`/`POST`/`OPTIONS` |
| Caching | Lists: `s-maxage=60`; filter options: `s-maxage=300`; match results: `no-store` |
| Rate limit | 120 requests per minute per address. Over the limit: `429` with `Retry-After: 60` |
| Errors | `{"error": {"code": "...", "message": "..."}}` with codes `invalid_id`, `invalid_request`, `invalid_json`, `not_found`, `too_large`, `no_preferences`, `rate_limited`, `upstream_error` |
| Versioning | Additive changes (new fields, new optional parameters) may appear within `v1`. Anything breaking becomes `/api/v2` |

### `GET /schools`

Search and filter. Same behaviour as the website listing.

| Parameter | Meaning |
|---|---|
| `q` | Free text in any language. A place name is understood ("Islamic schools in Kuala Lumpur", "مدارس إسلامية في كوالالمبور", "sekolah Islam di Kuala Lumpur") |
| `country`, `city` | Slugs from `/facets` |
| `grade`, `curriculum`, `language`, `accreditation` | Codes from `/facets` |
| `gender` | `boys`, `girls` or `mixed` |
| `feeMin`, `feeMax` | Annual tuition range (in the country's currency) |
| `quran`, `arabic`, `islamic`, `boarding`, `transport`, `verified` | `1` to require it (`verified` = confirmed by the school) |
| `facilities` | Repeat for several: `facilities=library&facilities=prayer_hall` (all required) |
| `lat`, `lng`, `radius` | Distance search in km (`radius` default 25, max 500) |
| `sort` | `relevance` (default), `name`, `fee_low`, `fee_high`, `distance`, `updated` |
| `page`, `limit` | Page (from 1) and page size (1 to 24, default 12) |
| `locale` | `en` (default), `ar`, `ms`: language of names and descriptions |

```json
{
  "data": [{
    "id": "bf5d6471-…", "slug": "al-noor-international-islamic-school", "country_slug": "malaysia", "city_slug": "kuala-lumpur",
    "name": "مدرسة النور الإسلامية الدولية", "description": "…", "country_name": "ماليزيا", "city_name": "كوالالمبور",
    "verification_status": "school_verified", "gender_policy": "mixed", "tuition_annual_min": "18000.00", "tuition_annual_max": "18000.00", "currency_code": "MYR",
    "has_boarding": false, "has_transport": true, "offers_quran": true, "offers_arabic": true, "curricula": ["…"], "logo_path": null, "distance_km": null, "updated_at": "…"
  }],
  "meta": { "total": 4, "page": 1, "limit": 12, "pages": 1, "locale": "ar" }
}
```

Photos and logos are public files at `{SUPABASE_URL}/storage/v1/object/public/school-media/{path}`.

### `GET /schools/{id}`

One published school by its UUID: location, contact details, all translations (`translations.en/ar/ms`), curricula, grade levels, facilities, languages, accreditations, fees and media. `400` for a malformed id, `404` if it is not published.

### `GET /compare?schools=id1,id2,id3`

Up to four schools in the order requested, in the same shape as `/schools/{id}`. Unknown or unpublished ids are skipped.

### `GET /facets`

The filter options that exist in the data, each with the number of schools: `countries` (with currency), `cities` (with their country), `curricula`, `grades`, `facilities`, `accreditations`, `languages`.

### `POST /match`

Explainable matching. Send JSON (max 10 KB) with any of: `city`, `country`, `grade`, `curriculum`, `gender`, `language`, `feeMax`, `quran`, `arabic`, `islamic`, `boarding`, `transport` (booleans), `facilities` (array), `lat`, `lng`, `radius`, plus `locale`, `page`, `limit`.

```json
{ "data": [{ "school": { "name": "…", "city_name": "…", "…": "…" }, "matched": 4, "total": 5,
             "criteria": [{ "key": "location", "status": "match" }, { "key": "boarding", "status": "no" }, { "key": "budget", "status": "unknown" }] }],
  "meta": { "total": 6, "page": 1, "limit": 12, "preferences": ["location", "budget", "quran", "boarding", "gender"] } }
```

`status` is `match`, `no`, or `unknown` (the school has not published that information). Schools are ordered by how many preferences they meet, then alphabetically. There is no quality score. Send at least one preference or you get `400 no_preferences`. A country alone only narrows the schools considered; it is not a preference.

## Operational endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | `200 {"status":"ok"}` when the site and database respond, `503 degraded` otherwise. For uptime monitors. `Cache-Control: no-store`. |
| `GET /api/cron/cleanup` | Deletes expired rate-limit counters. Requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it). `401` otherwise. |
| `GET /auth/callback` | Landing point for email confirmation and password-reset links. Redirects only to same-site paths. |
| `GET /{locale}/account/export` | Signed-in person downloads their own data as JSON (`401` when signed out). |
| `GET /sitemap.xml`, `/robots.txt` | Published pages only, with language alternates; admin and API are disallowed. |

## Server actions (not public)

| Area | Actions | Permission |
|---|---|---|
| Schools | save (create/edit), archive/restore/publish, duplicate, delete, bulk edit, set verification | `schools.write`, `schools.delete`, `verification.write` |
| Media | add and remove images | `media.write` |
| Import/export | start import, commit, discard; CSV export and template | `imports.manage`, `schools.read_all` |
| Categories, places | add, edit, delete | `categories.manage` |
| Users | assign staff roles | `roles.manage` |
| Claims and changes | review claims, revoke access, approve or reject change requests | `claims.review`, `schools.write` |
| Accounts | sign in, sign up, reset, sign out, claim a school, delete account | signed-in or public (rate limited) |
| Portal | save school changes, propose photos, withdraw changes | approved representative of that school |

Next.js verifies the request origin for every server action (CSRF protection). Unknown or malformed input is rejected by Zod before it reaches the database, and the database re-checks permissions.
