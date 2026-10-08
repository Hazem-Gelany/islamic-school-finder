import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Breadcrumbs } from '@/components/public/Breadcrumbs';
import { VerificationBadge } from '@/components/public/VerificationBadge';
import { CompareToggle } from '@/components/public/CompareToggle';
import { SchoolCard } from '@/components/public/SchoolCard';
import { SITE_URL, altPaths, getSchoolPublic, mediaUrl, money, pick, runSearch } from '@/lib/data/public';
import { parseSearch } from '@/features/search/params';

type Props = { params: Promise<{ locale: string; country: string; city: string; school: string }>; searchParams: Promise<{ preview?: string }> };
type I18n = Record<string, string>;

/** Chooses the best translation for the page language and says which language was actually used. */
function content(rec: Record<string, any>, locale: string) {
  const tr = rec.translations as Record<string, any>;
  const lang = tr[locale] ? locale : tr.en ? 'en' : Object.keys(tr)[0];
  return { lang, fallback: lang !== locale, t: (tr[lang] ?? {}) as Record<string, string | null> };
}
const safeUrl = (u: unknown) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);
const json = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, country, city, school } = await params; const preview = (await searchParams).preview === '1';
  const rec = await getSchoolPublic(country, city, school, preview);
  if (!rec) return { robots: { index: false } };
  const t = await getTranslations({ locale, namespace: 'School' });
  const { t: c } = content(rec, locale);
  const place = `${pick(rec.city.name, locale)}, ${pick(rec.country.name, locale)}`;
  const description = (c.description ?? '').replace(/\s+/g, ' ').slice(0, 155) || t('metaFallback', { name: c.name ?? '', place });
  const image = rec.media.find((m: any) => m.kind === 'photo') ?? rec.media[0];
  const path = `/schools/${country}/${city}/${school}`;
  return {
    title: `${c.name} – ${place}`, description, alternates: altPaths(locale, path),
    robots: preview || rec.status !== 'active' ? { index: false, follow: false } : undefined,
    openGraph: { type: 'website', title: `${c.name} – ${place}`, description, url: `/${locale}${path}`, locale, ...(image ? { images: [mediaUrl(image.path)] } : {}) },
  };
}

export default async function SchoolPage({ params, searchParams }: Props) {
  const { locale, country, city, school } = await params; setRequestLocale(locale);
  const preview = (await searchParams).preview === '1';
  const rec = await getSchoolPublic(country, city, school, preview);
  if (!rec) notFound();
  const t = await getTranslations({ locale, namespace: 'School' });
  const tc = await getTranslations({ locale, namespace: 'Common' });
  const ts = await getTranslations({ locale, namespace: 'Schools' });
  const { lang, fallback, t: c } = content(rec, locale);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const cityName = pick(rec.city.name, locale), countryName = pick(rec.country.name, locale);
  const photos = rec.media.filter((m: any) => m.kind === 'photo'), logo = rec.media.find((m: any) => m.kind === 'logo');
  const alt = (m: any) => pick(m.alt, locale) || c.name || '';
  const fmt = (d: string) => new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const yes = (b: boolean) => (b ? t('yes') : t('no'));
  const pageUrl = `${SITE_URL}/${locale}/schools/${country}/${city}/${school}`;
  const web = safeUrl(rec.website), adm = safeUrl(rec.admissions_url);
  const socials = Object.entries((rec.social_links ?? {}) as Record<string, string>).filter(([, u]) => safeUrl(u));

  const more = (await runSearch({ ...parseSearch({}), country, city }, locale, 4)).rows.filter((r) => r.id !== rec.id).slice(0, 3);
  const facts: [string, React.ReactNode][] = [
    [t('type'), pick(rec.school_type, locale) || null], [t('gender'), rec.gender_policy ? ts(`gender_${rec.gender_policy}` as never) : null],
    [t('gradeLevels'), rec.grade_levels.map((g: I18n) => pick(g, locale)).join(', ') || null], [t('curriculum'), rec.curricula.map((x: I18n) => pick(x, locale)).join(', ') || null],
    [t('instructionLanguages'), rec.languages.join(', ') || null], [t('founded'), rec.founded_year], [t('capacity'), rec.student_capacity?.toLocaleString(locale)],
  ];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'School', name: c.name, description: c.description || undefined, url: web ?? pageUrl,
      telephone: rec.phone || undefined, email: rec.email || undefined, foundingDate: rec.founded_year ? String(rec.founded_year) : undefined,
      image: photos.slice(0, 5).map((m: any) => mediaUrl(m.path)), logo: logo ? mediaUrl(logo.path) : undefined,
      address: { '@type': 'PostalAddress', streetAddress: rec.address || undefined, postalCode: rec.postal_code || undefined, addressLocality: pick(rec.city.name, 'en'), addressCountry: rec.country.iso2 },
      geo: rec.latitude != null ? { '@type': 'GeoCoordinates', latitude: rec.latitude, longitude: rec.longitude } : undefined,
      sameAs: [web, ...socials.map(([, u]) => u)].filter(Boolean) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { name: tc('home'), path: '' }, { name: tc('schools'), path: '/schools' }, { name: countryName, path: `/schools/${country}` }, { name: cityName, path: `/schools/${country}/${city}` }, { name: c.name, path: `/schools/${country}/${city}/${school}` },
    ].map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: `${SITE_URL}/${locale}${x.path}` })) },
  ];
  const sec = 'rounded-2xl border border-line bg-white p-6';
  const h2 = 'mb-4 font-display text-2xl font-semibold';

  return (
    <>
      <SiteHeader />
      {preview && <p role="status" className="bg-gold-400 px-6 py-2 text-center text-sm font-semibold text-forest-900">{t('previewBanner')}</p>}
      {ld.map((o, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(o) }} />)}
      <div className="bg-forest-900 pb-10 pt-6 text-cream-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-16">
          <Breadcrumbs items={[{ label: tc('home'), href: '/' }, { label: tc('schools'), href: '/schools' }, { label: countryName, href: `/schools/${country}` }, { label: cityName, href: `/schools/${country}/${city}` }, { label: c.name ?? '' }]} />
          <div className="mt-5 flex flex-wrap items-center gap-5">
            {logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(logo.path)} alt={alt(logo)} width={80} height={80} className="size-20 rounded-2xl bg-white object-contain p-1" />}
            <div>
              <h1 lang={lang} dir={dir} className="font-display text-4xl font-medium tracking-tight lg:text-5xl">{c.name}</h1>
              <p className="mt-2 text-lg text-mist">{[rec.address, cityName, countryName].filter(Boolean).join(', ')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3"><VerificationBadge status={rec.verification_status} /><CompareToggle id={rec.id} name={c.name ?? ""} tone="dark" /></div>
            </div>
          </div>
        </div>
      </div>

      <main id="main" tabIndex={-1} className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1fr_340px] lg:px-16">
        <div className="flex min-w-0 flex-col gap-6">
          {fallback && <p role="note" className="rounded-xl bg-[#FBF0D9] p-3 text-sm text-bronze">{t('fallbackNote', { language: lang.toUpperCase() })}</p>}
          {photos.length > 0 && (
            <section aria-label={t('photos')} className="grid gap-3 sm:grid-cols-3">
              {photos.slice(0, 5).map((m: any, i: number) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={m.path} src={mediaUrl(m.path)} alt={alt(m)} loading={i === 0 ? 'eager' : 'lazy'} className={`w-full rounded-2xl object-cover ${i === 0 ? 'aspect-[16/10] sm:col-span-3' : 'aspect-[4/3]'}`} />))}
            </section>)}

          <section aria-labelledby="about" className={sec}>
            <h2 id="about" className={h2}>{t('about')}</h2>
            <div lang={lang} dir={dir} className="space-y-3 leading-relaxed">{c.description ? c.description.split(/\n+/).map((p, i) => <p key={i}>{p}</p>) : <p className="text-muted">{t('notProvided')}</p>}</div>
            <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-sm text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
            </dl>
          </section>

          <section aria-labelledby="islamic" className={sec}>
            <h2 id="islamic" className={h2}>{t('islamicEducation')}</h2>
            <ul className="mb-4 grid gap-2 sm:grid-cols-3">
              {[[ts('islamic'), rec.offers_islamic_studies], [ts('quran'), rec.offers_quran], [ts('arabic'), rec.offers_arabic]].map(([k, v]) => (
                <li key={String(k)} className="flex items-center gap-2 rounded-lg bg-[#F6F4EC] px-3 py-2"><span aria-hidden>{v ? '✓' : '✗'}</span><span className="font-semibold">{k}</span><span className="sr-only">: {yes(v as boolean)}</span></li>))}
            </ul>
            <div lang={lang} dir={dir} className="space-y-3 leading-relaxed">
              {[c.islamic_studies_description, c.quran_description, c.arabic_description].filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>

          <section aria-labelledby="fees" className={sec}>
            <h2 id="fees" className={h2}>{t('fees')}</h2>
            {rec.fees.length === 0 ? <p className="text-muted">{t('notProvided')}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-start">
                  <caption className="sr-only">{t('fees')}</caption>
                  <thead className="text-sm text-muted"><tr><th scope="col" className="py-2 text-start">{t('feeType')}</th><th scope="col" className="py-2 text-start">{t('grade')}</th><th scope="col" className="py-2 text-start">{t('amount')}</th></tr></thead>
                  <tbody className="divide-y divide-line">{rec.fees.map((f: any, i: number) => (
                    <tr key={i}><th scope="row" className="py-3 text-start font-semibold">{pick(f.category, locale)}</th><td className="py-3">{f.grade ? pick(f.grade, locale) : t('allGrades')}</td><td className="py-3 font-semibold">{money(f.amount, f.currency, locale)} <span className="font-normal text-muted">/ {t(`period_${f.period}` as never)}</span></td></tr>))}</tbody>
                </table>
              </div>)}
            {rec.scholarships_available && <p className="mt-4 font-semibold text-forest-900">✓ {t('scholarships')}</p>}
          </section>

          <section aria-labelledby="facilities" className={sec}>
            <h2 id="facilities" className={h2}>{t('facilities')}</h2>
            {rec.facilities.length > 0 && <ul className="mb-4 flex flex-wrap gap-2">{rec.facilities.map((f: I18n, i: number) => <li key={i} className="rounded-lg bg-[#F6F4EC] px-3 py-1.5 text-sm font-semibold">{pick(f, locale)}</li>)}</ul>}
            <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-muted">{t('boarding')}</dt><dd className="font-semibold">{yes(rec.has_boarding)}</dd></div><div><dt className="text-sm text-muted">{t('transport')}</dt><dd className="font-semibold">{yes(rec.has_transport)}</dd></div></dl>
            {rec.accreditations.length > 0 && <><h3 className="mb-2 mt-5 font-semibold">{t('accreditation')}</h3><ul className="list-disc ps-5">{rec.accreditations.map((a: any, i: number) => <li key={i}>{pick(a.name, locale)}{a.reference && <span className="text-muted"> ({a.reference})</span>}</li>)}</ul></>}
          </section>

          <section aria-labelledby="admissions" className={sec}>
            <h2 id="admissions" className={h2}>{t('admissions')}</h2>
            {c.admission_information ? <p lang={lang} dir={dir} className="leading-relaxed">{c.admission_information}</p> : <p className="text-muted">{t('notProvided')}</p>}
            {adm && <a href={adm} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-11 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">{t('admissionsPage')}</a>}
          </section>

          <section aria-labelledby="verif" className="rounded-2xl bg-sand-100 p-6">
            <h2 id="verif" className={h2}>{t('verification')}</h2>
            <p className="mb-3"><VerificationBadge status={rec.verification_status} /></p>
            <p className="text-muted">{t(`verif_${rec.verification_status}` as never)}</p>
            <p className="mt-3 text-sm text-muted">{t('lastUpdated')}: <time dateTime={rec.updated_at}>{fmt(rec.updated_at)}</time>{rec.last_verified_at && <> · {t('lastVerified')}: <time dateTime={rec.last_verified_at}>{fmt(rec.last_verified_at)}</time></>}</p>
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <section aria-labelledby="contact" className={sec}>
            <h2 id="contact" className={h2}>{t('contact')}</h2>
            <ul className="flex flex-col gap-3">
              {rec.phone && <li><span className="block text-sm text-muted">{t('phone')}</span><a dir="ltr" className="font-semibold underline" href={`tel:${String(rec.phone).replace(/[^+\d]/g, '')}`}>{rec.phone}</a></li>}
              {rec.email && <li><span className="block text-sm text-muted">{t('email')}</span><a className="break-all font-semibold underline" href={`mailto:${rec.email}`}>{rec.email}</a></li>}
              {web && <li><span className="block text-sm text-muted">{t('website')}</span><a className="break-all font-semibold underline" href={web} target="_blank" rel="noopener noreferrer">{web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></li>}
              {socials.map(([k, u]) => <li key={k}><a className="font-semibold capitalize underline" href={u} target="_blank" rel="noopener noreferrer nofollow">{k}</a></li>)}
              {!rec.phone && !rec.email && !web && <li className="text-muted">{t('notProvided')}</li>}
            </ul>
            <p className="mt-5 border-t border-line pt-4 text-sm text-muted">{t('claimPrompt')} <Link className="font-semibold text-forest-900 underline" href={`/schools/${country}/${city}/${school}/claim`}>{t('claimLink')}</Link></p>
          </section>
          {rec.latitude != null && (
            <section aria-labelledby="map" className={sec}>
              <h2 id="map" className={h2}>{t('location')}</h2>
              <iframe title={t('mapTitle', { name: c.name ?? '' })} loading="lazy" className="h-56 w-full rounded-xl border border-line"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${rec.longitude - 0.008},${rec.latitude - 0.005},${rec.longitude + 0.008},${rec.latitude + 0.005}&layer=mapnik&marker=${rec.latitude},${rec.longitude}`} />
              <a className="mt-3 inline-block font-semibold underline" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${rec.latitude}&mlon=${rec.longitude}#map=16/${rec.latitude}/${rec.longitude}`}>{t('openMap')}</a>
            </section>)}
        </aside>
      </main>

      {more.length > 0 && (
        <section aria-labelledby="more" className="mx-auto max-w-7xl px-6 pb-14 lg:px-16">
          <h2 id="more" className="mb-5 font-display text-2xl font-semibold">{t('moreIn', { city: cityName })}</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 [&>li]:relative">{more.map((r) => <SchoolCard key={r.id} s={r} />)}</ul>
          <Link href={`/schools/${country}/${city}`} className="mt-5 inline-block font-semibold underline">{t('allIn', { city: cityName })}</Link>
        </section>)}
      <SiteFooter />
    </>
  );
}
