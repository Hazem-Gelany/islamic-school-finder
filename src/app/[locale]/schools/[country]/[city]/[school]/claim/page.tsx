import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Notice, btnCls, fieldCls } from '@/components/auth/AuthCard';
import { getSchoolPublic } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';
import { submitClaim } from '@/features/claims/actions';

type Props = { params: Promise<{ locale: string; country: string; city: string; school: string }>; searchParams: Promise<{ error?: string; detail?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { locale } = await params; return { title: (await getTranslations({ locale, namespace: 'Claim' }))('title'), robots: { index: false } }; }

export default async function ClaimSchool({ params, searchParams }: Props) {
  const { locale, country, city, school } = await params; setRequestLocale(locale);
  const sp = await searchParams;
  const rec = await getSchoolPublic(country, city, school);
  if (!rec) notFound();
  const here = `/${locale}/schools/${country}/${city}/${school}/claim`;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(here)}`);
  const t = await getTranslations({ locale, namespace: 'Claim' });
  const name = (rec.translations[locale] ?? rec.translations.en ?? Object.values(rec.translations)[0] as { name: string }).name as string;
  const { data: mine } = await supabase.rpc('my_claims', { p_locale: locale });
  const existing = (mine as { status: string; school_slug: string; city_slug: string }[] | null)?.find((c) => c.school_slug === school && c.city_slug === city && ['pending', 'approved'].includes(c.status));
  const errKey = sp.error && ['invalid', 'duplicate', 'unavailable', 'limit'].includes(sp.error) ? sp.error : null;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm"><Link className="underline" href={`/schools/${country}/${city}/${school}`}>← {name}</Link></p>
        <h1 className="mt-2 font-display text-4xl font-medium text-forest-900">{t('formTitle', { name })}</h1>
        {existing ? <div className="mt-6"><Notice tone="ok">{t(existing.status === 'approved' ? 'alreadyApproved' : 'alreadyPending')}</Notice><Link href="/account" className="mt-4 inline-block font-semibold underline">{t('goAccount')}</Link></div> : (
          <>
            <p className="mt-3 text-muted">{t('reviewNote')}</p>
            {errKey && <div className="mt-5"><Notice tone="err">{errKey === 'limit' && sp.detail ? sp.detail : t(`err_${errKey}` as never)}</Notice></div>}
            <form action={submitClaim} className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-6">
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="school_id" value={rec.id} /><input type="hidden" name="return" value={here} />
              <label className="block text-sm font-semibold text-muted">{t('jobTitle')}<input name="job_title" required minLength={2} maxLength={120} className={fieldCls} placeholder={t('jobTitleHint')} /></label>
              <label className="block text-sm font-semibold text-muted">{t('contactEmail')}<input name="contact_email" type="email" required defaultValue={user.email ?? ''} className={fieldCls} /><span className="mt-1 block text-xs font-normal">{t('contactEmailHint')}</span></label>
              <label className="block text-sm font-semibold text-muted">{t('evidence')}<input name="evidence_url" type="url" placeholder="https://" className={fieldCls} /><span className="mt-1 block text-xs font-normal">{t('evidenceHint')}</span></label>
              <label className="block text-sm font-semibold text-muted">{t('message')}<textarea name="message" rows={4} maxLength={2000} className="mt-1.5 w-full rounded-[10px] border border-[#B9C4BD] p-3 text-base font-normal" /></label>
              <button className={btnCls}>{t('submit')}</button>
            </form>
          </>)}
      </main>
      <SiteFooter />
    </>
  );
}
