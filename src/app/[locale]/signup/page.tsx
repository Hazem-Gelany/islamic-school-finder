import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AuthShell, fieldClass, primaryBtn } from '@/components/AuthShell';
import { signUp } from '@/features/account/actions';
import { getUser } from '@/lib/user';
import { altPaths } from '@/lib/data/public';
import { safeNext } from '@/validations/account';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string; next?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('signupTitle'), alternates: altPaths(locale, '/signup'), robots: { index: false, follow: true } };
}

export default async function SignupPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const sp = await searchParams, next = safeNext(sp.next, `/${locale}/account`);
  if ((await getUser()).user) redirect(next);
  const t = await getTranslations({ locale, namespace: 'Auth' });
  const errorKey: Record<string, string> = { invalid: 'error_signup_invalid', weak: 'error_weak', failed: 'error_failed' };
  return (
    <AuthShell title={t('signupTitle')} intro={t('signupIntro')} error={sp.error && errorKey[sp.error] ? t(errorKey[sp.error] as never) : undefined}>
      <form action={signUp} className="space-y-5">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold text-muted">{t('displayName')}<input name="displayName" required minLength={2} maxLength={80} autoComplete="name" className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-muted">{t('email')}<input name="email" type="email" required autoComplete="email" dir="ltr" className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-muted">{t('password')}<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" dir="ltr" aria-describedby="pw-hint" className={fieldClass} /><span id="pw-hint" className="mt-1 block text-sm font-normal">{t('passwordHint')}</span></label>
        <button className={primaryBtn}>{t('signupButton')}</button>
      </form>
      <p className="text-sm text-muted">{t('terms')} <Link href="/privacy" className="font-semibold underline">{t('privacyLink')}</Link></p>
      <p className="border-t border-line pt-5 text-sm text-muted">{t('haveAccount')} <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-forest-900 underline">{t('loginLink')}</Link></p>
    </AuthShell>
  );
}
