# Security

## What is protected

| Asset | Examples | Who may see it |
|---|---|---|
| Published catalogue | School names, fees, facilities, contact details | Everyone |
| Internal school data | Who edited a record, verification notes, drafts | Staff; a school's own representatives for their school |
| Personal data | Email, name, claims, saved items | The person; staff with `users.read` (email and roles only) |
| Credentials and keys | Passwords, service key | Never in the browser; passwords are handled by Supabase Auth (hashed) |
| History | Audit log | Staff with `audit.read`; nobody can edit it |

## Roles and permissions

Permissions are rows in `role_permissions`, checked in the database. A person's roles come only from `user_roles`.

| Permission | Super Admin | Data Manager | Content Manager | Verification Manager | Support Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| `schools.read_all` (see drafts and archived) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `schools.write` (add, edit, bulk edit, approve changes) | ✓ | ✓ | | | |
| `schools.delete` | ✓ | | | | |
| `translations.write`, `media.write` | ✓ | ✓ | ✓ (database level) | | |
| `categories.manage` (categories, places) | ✓ | ✓ | | | |
| `verification.write` | ✓ | ✓ | | ✓ | |
| `claims.review` | ✓ | | | ✓ | |
| `imports.manage` | ✓ | ✓ | | | |
| `audit.read` | ✓ | ✓ | | | |
| `users.read` | ✓ | | | | ✓ |
| `roles.manage` | ✓ | | | | |
| `support.manage` | ✓ | | | | ✓ |

*School Representative* (per school, granted by approving a claim) and *Parent/User* (everyone who registers) have no admin permissions. The admin screens currently require `schools.write` to edit a school, so a Content Manager sees schools read-only until a dedicated content screen is added; the database already allows their translation and media rights.

## Controls

| Area | Control |
|---|---|
| Authorization | Row-level security on all 35 tables; permission and membership checks in SQL, not in pages. Pages also check on the server before rendering |
| Least privilege | Anonymous role: read published catalogue only, five read functions, no writes, no truncate. A test fails the build if this drifts (`supabase/tests/09_security_audit.sql`, run by `npm run db:test` and CI) |
| Input | Zod validation on every form and API input (also in the browser); database constraints; CSV imports validated row by row and committed in one transaction |
| Output | React escapes by default; the only raw HTML is JSON-LD with `<` escaped; URLs from the database are shown only if they start with `http(s)://` |
| Injection | No SQL is built from user input by string concatenation; the two dynamic statements (admin table sort, text search) use an allow-list for column names and bound parameters for values |
| Spreadsheet injection | Exported CSV cells starting with `= + - @` are protected; imports reverse it |
| Redirects | `safeNext()` allows same-site paths only (tested against `//evil.com`, `\\`, `javascript:` etc.) |
| Browser protections | Per-request nonce Content-Security-Policy with `strict-dynamic`, `frame-ancestors 'none'`, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (geolocation only), COOP, `X-Powered-By` removed |
| CSRF | Server actions check the request origin; no state-changing GET routes |
| Rate limiting | Shared database counters (service key) per address and per account: sign-in 20 per 10 min per address and 8 per 15 min per email; admin sign-in 10 and 6; sign-up 10 per hour; password reset 10 per hour per address and 3 per hour per email; claims 10 per hour; imports 20 per hour; account deletion 3 per hour. REST API 120 per minute per address. Claims are also limited in the database (3 waiting, 10 per day). Falls back to per-instance counters without the service key |
| Account safety | Sign-up and reset never reveal whether an address is registered; email confirmation required; passwords min 8 characters (set Supabase to match or stricter) |
| Uploads | Images only (JPEG, PNG, WebP, AVIF), 5 MB, alt text required; representatives can upload only to `<school>/pending/` (unlisted until approved, with unguessable file names) and cannot delete published files |
| Secrets | `.env*` ignored by Git; service key only in `lib/supabase/admin.ts` (`import 'server-only'`); `.env.example` has no values |
| Audit | Field-level before/after for 22 tables, written by triggers, append-only; attributed to the signed-in person because admin changes never use the service key |
| Supply chain | Dependabot weekly; `npm audit` in CI (fails on high); lock file committed |

## Privacy (GDPR and similar)

- **Minimal data:** name, email and the claims a person sends. No tracking, advertising or analytics cookies; the compare list stays in the browser. Only essential cookies (the sign-in session).
- **Rights:** *access/portability* via "Download my data" on the account page; *erasure* via "Delete my account" (removes the account, claims, saved items and requests; schools they edited keep their information; the audit trail keeps only an anonymous id). *Correction* by email (see the Contact page).
- **Children:** no data about children is collected; accounts are for parents, guardians and staff.
- **Processors:** the hosting and database providers. The school map loads OpenStreetMap, which sees the visitor's IP like any site. Technical logs and rate-limit counters are short-lived (counters are deleted after a day).
- **Privacy notice:** `/privacy` is a plain-language **draft**. Have a lawyer adapt it to the countries you operate in (controller identity, legal basis, retention, international transfers, cookie rules) before launch.

## Verified here, and what still needs your environment

| Verified in development (automated) | Needs checking in your environment |
|---|---|
| 52 unit tests; type check; production build | Real Supabase project: confirmation and reset emails, SMTP, Auth settings, storage |
| Migrations and every SQL test on PostgreSQL 16 + PostGIS; assertion-based security audit (fails on the old schema, passes on the final one) | Playwright tests in `e2e/` were written but could not be executed here (no browser available); run them against staging |
| Role and permission behaviour, claims, change requests, import rollback, audit attribution, storage rules | CSP enforcement in real browsers (the nonce is verified on all 40 scripts of the listing page; run the browser tests to confirm no console violations) |
| 20,000-school load test; backup and full restore drill (35 tables, 0 differences) | Visual review of Arabic right-to-left pages and the admin screens on real devices |
| Accessibility: axe scan of 16 rendered pages with 0 violations; computed colour contrast for every text and border pair | Authenticated pages (admin, portal) were not scanned; full axe with colour contrast runs in `e2e/public.spec.ts` |
| Security headers, nonce on every script, API behaviour, 404 pages | Native-speaker review of Arabic and Malay text; legal review of the privacy notice |

## Known risks and accepted items

1. **Next.js bundles an older PostCSS** that `npm audit` reports (moderate; build-time CSS processing of our own source, no visitor-supplied CSS is processed). The fix is a major upgrade to Next.js 16; plan it as a maintenance task. CI fails only on high severity.
2. **No email notifications** for claim or change decisions; people see status in their account. Add a mail provider when volume justifies it.
3. **Sign-in throttling** relies on the counters above plus Supabase's own limits. Add a CAPTCHA or a WAF rule (Cloudflare) if you see credential-stuffing. Do not switch on Supabase's CAPTCHA setting without adding the token to the forms (not implemented).
4. **Public list endpoints** are cached and the in-memory API limiter is per server instance; put Cloudflare or Vercel firewall rate rules in front for strict limits.
5. **Admin and portal are English-only.**

## Reporting a vulnerability

Edit `public/.well-known/security.txt` (contact address and expiry date) before launch. Please report privately by email and allow time to fix before public disclosure.

## If something goes wrong

1. Contain: disable the affected account (Supabase Auth, ban user) or revoke a claim; rotate the service key (Supabase, then Vercel env, then redeploy) if it may have leaked.
2. Investigate with the audit log (who changed what, when) and the JSON request-error logs.
3. Recover with `scripts/restore.sh` or a point-in-time restore.
4. Tell affected people and the regulator where the law requires (usually within 72 hours under GDPR).
