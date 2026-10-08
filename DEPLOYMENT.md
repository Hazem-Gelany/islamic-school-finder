# Deployment guide

Target: **Supabase** (database, accounts, photo storage) + **Vercel** (the website). Allow about two hours the first time. You need a Supabase account, a Vercel account, a GitHub repository for this code, and a domain name.

## 1. Create the Supabase project

1. New project. Choose the **region closest to your visitors** (and later put Vercel's function region next to it).
2. Save the database password. Open *Project Settings, API* and copy the **Project URL**, the **anon key** and the **service_role key**. The service key is secret: it only ever goes into Vercel environment variables.
3. *Database, Extensions*: confirm **postgis** and **pg_trgm** are enabled (the first migration enables them).

## 2. Build the database

With the Supabase CLI (`npm i -g supabase`):

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push            # applies supabase/migrations/0001 … 0012 in order
```

(Or paste each file of `supabase/migrations/` into the SQL editor, in order.) Do **not** run `supabase/seed.sql` in production: it contains fictional demo schools. For a staging copy it is useful; remove it later with `delete from schools where is_demo;`.

Check it: *Table Editor* should show 35 tables, and *Storage* a public bucket called `school-media`.

## 3. Configure sign-in (Authentication)

| Setting | Value |
|---|---|
| URL Configuration, **Site URL** | `https://YOUR-DOMAIN` |
| URL Configuration, **Redirect URLs** | `https://YOUR-DOMAIN/auth/callback` (and your staging address, and `http://localhost:3000/auth/callback` for development) |
| Sign In / Providers, Email | Enabled, **Confirm email ON** |
| Password length | 8 or more (10 recommended). Turn on *leaked password protection* if your plan has it |
| SMTP Settings | **Set up a real sender** (Resend, Postmark, SES, …) with a verified domain. The built-in mailer is for testing only and is heavily rate-limited |
| Email templates | Keep the confirmation and recovery links pointing at `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup` (and `type=recovery`), or leave the defaults: the callback accepts both `code` and `token_hash` links |
| CAPTCHA | Leave **off**. The sign-in forms do not send a CAPTCHA token yet |

## 4. Create the first administrator

1. Open your site's `/en/register` (after step 5) and create your own account, or add a user under *Authentication, Users*.
2. In the SQL editor run (with your email):

```sql
insert into user_roles (user_id, role)
select id, 'super_admin' from auth.users where email = 'you@example.com';
```

3. Sign in at `/admin/login`. From then on give colleagues roles on the **Users** page.

## 5. Deploy the website on Vercel

1. *Add New, Project*, import the GitHub repository (framework: Next.js, Node 22).
2. Environment variables (Production, and Preview if you use staging):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**secret**) |
| `NEXT_PUBLIC_SITE_URL` | `https://YOUR-DOMAIN` (no trailing slash) |
| `CONTACT_EMAIL` | the address shown on the Contact page |
| `CRON_SECRET` | a long random string (`openssl rand -hex 32`) |

3. Deploy. `vercel.json` already schedules the nightly cleanup (`/api/cron/cleanup`).
4. *Settings, Domains*: add your domain and set its DNS records. Then update the Supabase Site URL and redirect URLs (step 3) to the final address.
5. Edit `public/.well-known/security.txt` (contact address, expiry date, domain), `CONTACT_EMAIL`, and have `/privacy` reviewed by a lawyer.

**Optional, recommended: Cloudflare in front.** Proxy the domain, set SSL to *Full (strict)*, and add a rate-limiting rule for `/admin/login`, `/en/login`, `/en/register` and `/api/*`. Do not cache HTML pages (they are personalised for signed-in people).

## 6. Check the deployment

```bash
node scripts/smoke-test.mjs https://YOUR-DOMAIN
```

It checks health, the three languages and right-to-left, security headers and script nonces, hreflang and canonical links, robots and sitemap, structured data, access control, and the REST API. It exits non-zero on any failure. Then run the browser tests against staging:

```bash
E2E_BASE_URL=https://staging.example.com npx playwright install chromium && npx playwright test
# admin and claim tests also need E2E_ADMIN_EMAIL/PASSWORD and E2E_USER_EMAIL/PASSWORD
```

## 7. Monitoring

- **Uptime:** point UptimeRobot, Better Stack or similar at `https://YOUR-DOMAIN/api/health` (alert on anything other than 200).
- **Errors and logs:** every unhandled server error is logged as one JSON line (`src/instrumentation.ts`), visible in Vercel *Logs*. For alerting add Sentry: `npx @sentry/wizard@latest -i nextjs`, then call `Sentry.captureRequestError` inside `onRequestError`.
- **Database:** Supabase *Reports* and *Logs*. Watch connection count and slow queries.
- **Business signals:** the admin dashboard shows claims and change requests waiting for review.

## 8. Backups and recovery

**Layer 1: Supabase backups.** Daily backups come with paid plans; **point-in-time recovery** is an add-on. The free plan has no backups, so use layer 2 from day one.

**Layer 2: your own verified backups.** Run `scripts/backup.sh` daily (a scheduled GitHub Action, a small server, or your laptop to start):

```bash
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" ./scripts/backup.sh backups
```

It writes two archives (application data, and user accounts), checks they are readable and contain the main tables, adds checksums, and deletes copies older than 30 days (`KEEP_DAYS`). Store them somewhere outside Supabase (encrypted object storage).

**Photos are not in the database.** Copy the `school-media` bucket with any S3-compatible tool using the S3 credentials from *Storage, S3 connection* (for example `rclone sync`), or `supabase storage cp -r`.

**Restore drill** (do this once now, then twice a year):

1. Create a new Supabase project (or an empty Postgres with PostGIS and pg_trgm) and apply all migrations (step 2). Do not load the seed.
2. `DATABASE_URL=<new project> ./scripts/restore.sh backups/isf-auth-….dump backups/isf-public-….dump` (type `RESTORE` to confirm). It clears the tables, loads the data with triggers off (so the audit log is not duplicated), and prints the row counts.
3. Copy the photos back into the `school-media` bucket, point Vercel at the new project (URL and keys), and run the smoke test.

This procedure was tested here by backing up a database, restoring into a freshly migrated one, comparing all 35 tables (0 differences), and running a search on the restored copy. The Supabase-specific parts (permissions to clear `auth.users`, dashboard-managed roles) should be rehearsed once on a staging project.

## 9. Go-live checklist

- [ ] All 12 migrations applied; seed **not** loaded; `npm run db:test` passes on a scratch database
- [ ] Auth: Site URL and redirect URLs set; confirm email on; real SMTP sender; test sign-up, reset and claim emails arrive (check spam)
- [ ] First Super Admin created; a second person has the role too (the last one cannot be removed)
- [ ] Environment variables set in Vercel; **service key not exposed** (search the built site for `service_role`: there should be no match)
- [ ] Domain, HTTPS and (optionally) Cloudflare rules in place
- [ ] `security.txt`, `CONTACT_EMAIL`, privacy notice reviewed by a lawyer; Arabic and Malay text reviewed by native speakers
- [ ] Real schools loaded through the importer (as drafts), reviewed, then published; demo data removed
- [ ] Smoke test and browser tests pass against the live address; submit `sitemap.xml` to Google Search Console and Bing Webmaster Tools
- [ ] Uptime monitor on `/api/health`; Sentry or log alerts configured
- [ ] `scripts/backup.sh` scheduled; **one restore drill completed**; photo bucket copy scheduled
- [ ] Dependabot enabled on the repository; someone owns the weekly dependency review

## 10. Operating notes

- **Rollback of the website:** Vercel *Deployments, Promote a previous deployment* (instant). **Database changes are forward-only:** fix a bad migration with a new migration, or restore from backup.
- **Releasing a change:** branch, pull request (CI runs types, tests, build, security audit), merge to `main`, Vercel deploys. Apply new migrations with `supabase db push` **before** merging code that needs them.
- **Costs:** the free tiers of Vercel and Supabase are enough to pilot with. Move Supabase to a paid plan before launch for backups and no project pausing; Vercel Pro is needed for commercial use and production support.
- **Maintenance calendar:** weekly review Dependabot; monthly check logs and the audit log for odd activity; yearly renew `security.txt`, rotate keys, run a restore drill, and plan the Next.js major upgrade (clears the build-time PostCSS advisory).
