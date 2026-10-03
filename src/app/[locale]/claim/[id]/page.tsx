import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Breadcrumbs } from '@/components/public/Breadcrumbs';
import { fieldClass, primaryBtn } from '@/components/AuthShell';
import { submitClaim } from '@/features/account/actions';
import { getCompare, pick, schoolName } from '@/lib/data/public';
import { requireUser } from '@/lib/user';

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ error?: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ClaimForm({ params, searchParams }: Props) {
  const { locale, id } = await params; setRequestLocale(locale);
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await requireUser(locale, `/claim/${id}`);
  const rec = (await getCompare([id]))[0];
  if (!rec) notFound();
  const t = await getTranslations({ locale, namespace: 'Claim' }); const tc = await getTranslations({ locale, namespace: 'Common' });
  const name = schoolName(rec, locale), place = `${pick(rec.city.name, locale)}, ${pick(rec.country.name, locale)}`;
  const profile = `/schools/${rec.country.slug}/${rec.city.slug}/${rec.slug}`;
  const [{ data: pending }, { data: member }] = await Promise.all([
    supabase.from('school_claims').select('id').eq('school_id', id).eq('user_id', user.id).eq('status', 'pending').maybeSingle(),
    supabase.from('school_members').select('school_id').eq('school_id', id).eq('user_id', user.id).maybeSingle(),
  ]);
  const sp = await searchParams;
  const errors = ['invalid', 'url', 'duplicate', 'member', 'unavailable', 'limit', 'failed'];
  return (
    <>
      <SiteHeader />
      <div className="bg-forest-900 pb-8 pt-6 text-cream-50"><div className="mx-auto max-w-7xl px-6 lg:px-16">
        <Breadcrumbs items={[{ label: tc('home'), href: '/' }, { label: t('title'), href: '/claim' }, { label: name }]} />
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight">{t('formTitle', { name })}</h1>
        <p className="mt-2 text-mist">{place}</p>
      </div></div>
      <main className="mx-auto max-w-2xl px-6 py-10">
        {member ? <p role="status" className="rounded-xl bg-mint-100 p-5 text-forest-900">{t('alreadyMember')} <Link href="/account" className="font-semibold underline">{t('goAccount')}</Link></p>
        : pending ? <p role="status" className="rounded-xl bg-[#FBF0D9] p-5 text-bronze">{t('alreadyPending')} <Link href="/account" className="font-semibold underline">{t('goAccount')}</Link></p>
        : (
          <form action={submitClaim} className="space-y-5 rounded-2xl border border-line bg-white p-8">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="schoolId" value={id} />
            <p className="text-muted">{t('formIntro')}</p>
            {sp.error && errors.includes(sp.error) && <p role="alert" className="rounded-lg bg-[#FCEDEA] p-3 text-sm text-[#8A1F11]">{t(`error_${sp.error}` as never)}</p>}
            <label className="block text-sm font-semibold text-muted">{t('jobTitle')}<input name="jobTitle" required minLength={2} maxLength={120} placeholder={t('jobTitlePlaceholder')} className={fieldClass} /></label>
            <label className="block text-sm font-semibold text-muted">{t('contactEmail')}<input name="contactEmail" type="email" required defaultValue={user.email ?? ''} dir="ltr" className={fieldClass} /><span className="mt-1 block text-sm font-normal">{t('contactEmailHint')}</span></label>
            <label className="block text-sm font-semibold text-muted">{t('evidence')} <span className="font-normal">({t('optional')})</span><input name="evidenceUrl" type="url" maxLength={500} placeholder="https://" dir="ltr" className={fieldClass} /><span className="mt-1 block text-sm font-normal">{t('evidenceHint')}</span></label>
            <label className="block text-sm font-semibold text-muted">{t('message')} <span className="font-normal">({t('optional')})</span><textarea name="message" maxLength={2000} rows={4} className={`${fieldClass} h-auto py-3`} /></label>
            <button className={primaryBtn}>{t('submit')}</button>
            <p className="text-sm text-muted"><Link href={profile} className="underline">{t('backToProfile')}</Link></p>
          </form>)}
      </main>
      <SiteFooter />
    </>
  );
}
