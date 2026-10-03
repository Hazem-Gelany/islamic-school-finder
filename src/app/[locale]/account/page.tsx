import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Notice } from '@/components/auth/AuthCard';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/features/auth/actions';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ msg?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { locale } = await params; return { title: (await getTranslations({ locale, namespace: 'Account' }))('title'), robots: { index: false } }; }

export default async function AccountPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`);
  const [t, sp, claims, schools, profile] = await Promise.all([
    getTranslations({ locale, namespace: 'Account' }), searchParams,
    supabase.rpc('my_claims', { p_locale: locale }), supabase.rpc('my_schools', { p_locale: locale }),
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
  ]);
  const tone: Record<string, string> = { approved: 'bg-mint-100 text-forest-900', pending: 'bg-[#FBF0D9] text-bronze', rejected: 'bg-[#FCEDEA] text-[#8A1F11]', revoked: 'bg-[#EEF1EF] text-muted' };
  const sec = 'rounded-2xl border border-line bg-white p-6';
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
        <h1 className="font-display text-4xl font-medium text-forest-900">{t('title')}</h1>
        {sp.msg && <Notice tone="ok">{t(`msg_${sp.msg === 'password' ? 'password' : 'claimSent'}` as never)}</Notice>}
        <section className={sec}>
          <p className="text-sm text-muted">{t('signedInAs')}</p>
          <p className="text-lg font-semibold">{profile.data?.display_name ?? user.email}</p><p className="text-muted">{user.email}</p>
          <form action={signOut} className="mt-4"><input type="hidden" name="locale" value={locale} /><button className="h-11 rounded-xl border border-[#B9C4BD] px-5 font-semibold hover:bg-mint-100">{t('signOut')}</button></form>
        </section>
        <section aria-labelledby="sch" className={sec}>
          <h2 id="sch" className="mb-3 font-display text-2xl font-semibold">{t('schoolsTitle')}</h2>
          {(schools.data ?? []).length === 0 ? <p className="text-muted">{t('noSchools')}</p> : (
            <ul className="space-y-3">{(schools.data as { id: string; name: string; slug: string; country_slug: string; city_slug: string }[]).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F6F4EC] p-4">
                <Link className="font-semibold underline" href={`/schools/${s.country_slug}/${s.city_slug}/${s.slug}`}>{s.name}</Link>
                <a href={`/portal/schools/${s.id}`} className="flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50">{t('openPortal')}</a>
              </li>))}</ul>)}
          {(schools.data ?? []).length > 0 && <p className="mt-3 text-sm text-muted">{t('portalNote')}</p>}
        </section>
        <section aria-labelledby="clm" className={sec}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 id="clm" className="font-display text-2xl font-semibold">{t('claimsTitle')}</h2><Link href="/claim" className="font-semibold underline">{t('claimNew')}</Link></div>
          {(claims.data ?? []).length === 0 ? <p className="text-muted">{t('noClaims')}</p> : (
            <ul className="space-y-3">{(claims.data as { id: string; status: string; review_notes: string | null; created_at: string; school_name: string | null; school_slug: string | null; country_slug: string | null; city_slug: string | null }[]).map((c) => (
              <li key={c.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{c.school_name ?? '—'}</span>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tone[c.status]}`}>{t(`status_${c.status}` as never)}</span>
                </div>
                <p className="text-sm text-muted"><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleDateString(locale)}</time></p>
                {c.review_notes && c.status !== 'pending' && <p className="mt-2 text-sm"><span className="font-semibold">{t('reviewerNote')}:</span> {c.review_notes}</p>}
              </li>))}</ul>)}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
