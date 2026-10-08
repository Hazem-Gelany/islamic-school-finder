#!/usr/bin/env node
// Post-deployment smoke test: checks that a running site is healthy, secure and indexable.
//   node scripts/smoke-test.mjs https://your-domain.com
// Exits with a non-zero status if any check fails, so it can gate a release.
const base = (process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `  (${detail})` : ''}`); if (!ok) failed++; };
const get = async (path, init = {}) => { const r = await fetch(base + path, { redirect: 'manual', ...init }); return { r, text: await r.text() }; };

const health = await get('/api/health'); let h = {}; try { h = JSON.parse(health.text); } catch {}
check('health endpoint reports ok', health.r.status === 200 && h.status === 'ok', `${health.r.status} ${health.text.slice(0, 80)}`);

for (const [loc, dir] of [['en', 'ltr'], ['ar', 'rtl'], ['ms', 'ltr']]) {
  const { r, text } = await get(`/${loc}`);
  check(`/${loc} renders with lang="${loc}" dir="${dir}"`, r.status === 200 && text.includes(`lang="${loc}"`) && text.includes(`dir="${dir}"`), String(r.status));
}

const home = await get('/en');
const hd = home.r.headers, csp = hd.get('content-security-policy') ?? '';
check('Content-Security-Policy with a nonce', /script-src[^;]*'nonce-[A-Za-z0-9+/=]+'/.test(csp) && csp.includes("frame-ancestors 'none'"));
check('Strict-Transport-Security', (hd.get('strict-transport-security') ?? '').includes('max-age='), base.startsWith('http://localhost') ? 'expected only over HTTPS' : '');
check('X-Content-Type-Options nosniff', hd.get('x-content-type-options') === 'nosniff');
check('clickjacking protection', hd.get('x-frame-options') === 'DENY');
check('Referrer-Policy set', !!hd.get('referrer-policy'));
check('X-Powered-By hidden', !hd.get('x-powered-by'));
const scripts = [...home.text.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]).filter((a) => !a.includes('application/ld+json'));
check(`every executable script carries the nonce (${scripts.length} scripts)`, scripts.length > 0 && scripts.every((a) => a.includes('nonce=')));

const list = await get('/en/schools');
check('/en/schools renders', list.r.status === 200);
check('canonical link present', /<link rel="canonical" href="[^"]+\/en\/schools"/.test(list.text));
check('hreflang alternates for en, ar, ms', ['en', 'ar', 'ms'].every((l) => new RegExp(`hrefLang="${l}"`, 'i').test(list.text)));
const filtered = await get('/en/schools?grade=primary');
check('filtered listing is noindex', /name="robots" content="noindex/.test(filtered.text));

const robots = await get('/robots.txt');
check('robots.txt blocks admin and lists the sitemap', robots.text.includes('Disallow: /admin') && robots.text.includes('Sitemap:'));
const sitemap = await get('/sitemap.xml');
check('sitemap.xml is valid XML with alternates', sitemap.r.status === 200 && sitemap.text.includes('<urlset') && sitemap.text.includes('hreflang'), String(sitemap.r.status));
const urls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`      sitemap lists ${urls.length} URLs`);

const nf = await get('/en/definitely-not-a-page');
check('unknown address returns 404 + noindex', nf.r.status === 404 && /noindex/.test(nf.text));

const profileUrl = urls.find((u) => /\/en\/schools\/[^/]+\/[^/]+\/[^/]+$/.test(u));
if (profileUrl) {
  const p = await get(new URL(profileUrl).pathname);
  const ld = [...p.text.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
  check('school profile renders', p.r.status === 200);
  check('structured data parses and includes School + BreadcrumbList', ld.length >= 2 && ld.every(Boolean) && ld.some((x) => x['@type'] === 'School') && ld.some((x) => x['@type'] === 'BreadcrumbList'));
  check('profile page title is specific', !/<title>Islamic School Finder<\/title>/.test(p.text));
} else console.log('SKIP  school profile checks (no published school in the sitemap yet)');

const adm = await get('/admin/schools');
check('admin area redirects signed-out visitors to login', [302, 303, 307, 308].includes(adm.r.status) && (adm.r.headers.get('location') ?? '').includes('/admin/login'), String(adm.r.status));
const portal = await get('/portal');
check('school portal redirects signed-out visitors to login', [302, 303, 307, 308].includes(portal.r.status) && (portal.r.headers.get('location') ?? '').includes('/login'), String(portal.r.status));
check('admin login page is not indexable', /noindex/.test((await get('/admin/login')).text));
const cron = await get('/api/cron/cleanup');
check('cron endpoint refuses unauthenticated calls', cron.r.status === 401, String(cron.r.status));

const api = await get('/api/v1/schools?limit=2'); let aj = {}; try { aj = JSON.parse(api.text); } catch {}
check('REST API lists schools with metadata', api.r.status === 200 && Array.isArray(aj.data) && typeof aj.meta?.total === 'number', String(api.r.status));
check('REST API sends CORS and cache headers', api.r.headers.get('access-control-allow-origin') === '*' && /s-maxage/.test(api.r.headers.get('cache-control') ?? ''));
check('REST API rejects bad ids cleanly', (await get('/api/v1/schools/not-a-uuid')).r.status === 400);
const leak = (aj.data ?? []).some((s) => ['created_by', 'updated_by', 'verification_notes'].some((k) => k in s));
check('REST API exposes no internal fields', !leak);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll smoke checks passed');
process.exit(failed ? 1 : 0);
