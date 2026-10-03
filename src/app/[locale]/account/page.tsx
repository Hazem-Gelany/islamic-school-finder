import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SchoolCard } from '@/components/public/SchoolCard';
import { setContactStatus } from '@/features/account/actions';
import { requireUser } from '@/lib/user';
import { CONTACT_STATUSES } from '@/validations/account';
import type { SchoolRow } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ msg?: string; error?: string }> };
type Msg = { id: string; direction: 'sent' | 'received'; school_name: string | null; school_path: string | null; message: string; status: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null; created_at: string };
type Claim = { id: string; status: string; school_name: string | null; school_path: string | null; job_title: string | null; review_notes: string | null; created_at: string };
type Member = { id: string; name: string | null; country_slug: string; city_slug: string; slug: string; status: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Account' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const { supabase, user } = await requireUser(locale, '/account');
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'Account' });
  const [saved, messages, claims, member] = await Promise.all([
    supabase.rpc('my_saved_schools', { p_locale: locale }), supabase.rpc('my_messages', { p_locale: locale }),
    supabase.rpc('my_claims', { p_locale: locale }), supabase.rpc('my_member_schools', { p_locale: locale }),
  ]);
  const failed = [saved, messages, claims, member].some((r) => r.error);
  if (failed) console.error('[account]', [saved, messages, claims, member].map((r) => r.error?.message).filter(Boolean));
  const savedRows = (saved.data ?? []) as SchoolRow[], all = (messages.data ?? []) as Msg[], claimRows = (claims.data ?? []) as Claim[], schools = (member.data ?? []) as Member[];
  const sent = all.filter((m) => m.direction === 'sent'), received = all.filter((m) => m.direction === 'received');
  const name = (user.user_metadata?.display_name as string | undefined) || user.email;
  const fmt = (d: string) => new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const notes = ['claimSent', 'passwordChanged', 'statusUpdated'];
  const sec = 'rounded-2xl border border-line bg-white p-6';
  const h2 = 'mb-4 font-display text-2xl font-semibold';
  const href = (p: string | null) => (p ? `/schools/${p}` : '/schools');
  const pill = 'inline-block rounded-full bg-[#EEF1EF] px-2.5 py-1 text-xs font-semibold text-muted';

  return (
    <>
      <SiteHeader />
      <div className="bg-forest-900 pb-8 pt-8 text-cream-50"><div className="mx-auto max-w-7xl px-6 lg:px-16">
        <h1 className="font-display text-4xl font-medium tracking-tight">{t('hello', { name: name ?? '' })}</h1>
        <p className="mt-2 text-mist" dir="ltr">{user.email}</p>
      </div></div>
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 lg:px-16">
        {sp.msg && notes.includes(sp.msg) && <p role="status" className="rounded-lg bg-mint-100 p-3 text-forest-900">{t(`msg_${sp.msg}` as never)}</p>}
        {(sp.error || failed) && <p role="alert" className="rounded-lg bg-[#FCEDEA] p-3 text-[#8A1F11]">{t('error')}</p>}

        {schools.length > 0 && (
          <section aria-labelledby="mine" className={sec}>
            <h2 id="mine" className={h2}>{t('mySchools')}</h2>
            <ul className="divide-y divide-line">{schools.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <Link href={href(`${s.country_slug}/${s.city_slug}/${s.slug}`)} className="font-semibold underline">{s.name ?? s.slug}</Link>
                <span className={pill}>{t(`school_${s.status}` as never)}</span>
              </li>))}</ul>
          </section>)}

        {schools.length > 0 && (
          <section id="inbox" aria-labelledby="inbox-h" className={`${sec} scroll-mt-6`}>
            <h2 id="inbox-h" className={h2}>{t('inbox')}</h2>
            <p className="mb-4 text-sm text-muted">{t('inboxHelp')}</p>
            {received.length === 0 ? <p className="text-muted">{t('inboxEmpty')}</p> : (
              <ul className="space-y-4">{received.map((m) => (
                <li key={m.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{m.contact_name ?? '—'} <span className="font-normal text-muted">→ {m.school_name}</span></p>
                    <span className={pill}>{t(`status_${m.status}` as never)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted"><time dateTime={m.created_at}>{fmt(m.created_at)}</time></p>
                  <p className="mt-3 whitespace-pre-line">{m.message}</p>
                  <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    {m.contact_email && <a dir="ltr" className="font-semibold underline" href={`mailto:${m.contact_email}`}>{m.contact_email}</a>}
                    {m.contact_phone && <a dir="ltr" className="font-semibold underline" href={`tel:${m.contact_phone.replace(/[^+\d]/g, '')}`}>{m.contact_phone}</a>}
                  </p>
                  <form action={setContactStatus} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={m.id} />
                    {CONTACT_STATUSES.filter((s) => s !== 'new' && s !== m.status).map((s) => (
                      <button key={s} name="status" value={s} className="min-h-10 rounded-lg border border-[#B9C4BD] px-3 text-sm font-semibold hover:bg-mint-100">{t(`mark_${s}` as never)}</button>))}
                  </form>
                </li>))}</ul>)}
          </section>)}

        <section aria-labelledby="saved-h">
          <h2 id="saved-h" className={h2}>{t('saved')}</h2>
          {savedRows.length === 0 ? (
            <div className={`${sec} text-center`}><p className="text-muted">{t('savedEmpty')}</p><Link href="/schools" className="mt-4 inline-flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50">{t('browse')}</Link></div>
          ) : <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 [&>li]:relative">{savedRows.map((s) => <SchoolCard key={s.id} s={s} save={{ signedIn: true, saved: true }} />)}</ul>}
        </section>

        <section aria-labelledby="sent-h" className={sec}>
          <h2 id="sent-h" className={h2}>{t('sent')}</h2>
          {sent.length === 0 ? <p className="text-muted">{t('sentEmpty')}</p> : (
            <ul className="divide-y divide-line">{sent.map((m) => (
              <li key={m.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><Link href={href(m.school_path)} className="font-semibold underline">{m.school_name ?? t('unknownSchool')}</Link><span className={pill}>{t(`status_${m.status}` as never)}</span></div>
                <p className="text-sm text-muted"><time dateTime={m.created_at}>{fmt(m.created_at)}</time></p>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-[15px]">{m.message}</p>
              </li>))}</ul>)}
        </section>

        <section aria-labelledby="claims-h" className={sec}>
          <h2 id="claims-h" className={h2}>{t('claims')}</h2>
          {claimRows.length === 0 ? <p className="text-muted">{t('claimsEmpty')} <Link href="/claim" className="font-semibold underline">{t('claimLink')}</Link></p> : (
            <ul className="divide-y divide-line">{claimRows.map((c) => (
              <li key={c.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><Link href={href(c.school_path)} className="font-semibold underline">{c.school_name ?? t('unknownSchool')}</Link><span className={pill}>{t(`claim_${c.status}` as never)}</span></div>
                <p className="text-sm text-muted">{c.job_title} · <time dateTime={c.created_at}>{fmt(c.created_at)}</time></p>
                {c.review_notes && c.status !== 'pending' && <p className="mt-2 rounded-lg bg-[#F6F4EC] p-3 text-sm">{c.review_notes}</p>}
              </li>))}</ul>)}
        </section>

        <section aria-labelledby="sec-h" className={sec}>
          <h2 id="sec-h" className={h2}>{t('security')}</h2>
          <Link href="/reset-password" className="inline-flex h-11 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">{t('changePassword')}</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
