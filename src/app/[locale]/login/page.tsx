import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AuthShell, fieldClass, primaryBtn } from '@/components/AuthShell';
import { signIn } from '@/features/account/actions';
import { getUser } from '@/lib/user';
import { altPaths } from '@/lib/data/public';
import { safeNext } from '@/validations/account';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string; msg?: string; next?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('loginTitle'), alternates: altPaths(locale, '/login'), robots: { index: false, follow: true } };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const sp = await searchParams, next = safeNext(sp.next, `/${locale}/account`);
  if ((await getUser()).user) redirect(next);
  const t = await getTranslations({ locale, namespace: 'Auth' });
  const errors = ['invalid', 'unconfirmed', 'link'];
  const q = `?next=${encodeURIComponent(next)}`;
  return (
    <AuthShell title={t('loginTitle')} intro={t('loginIntro')} error={sp.error && errors.includes(sp.error) ? t(`error_${sp.error}` as never) : undefined} notice={sp.msg === 'checkEmail' ? t('checkEmail') : undefined}>
      <form action={signIn} className="space-y-5">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold text-muted">{t('email')}<input name="email" type="email" required autoComplete="email" dir="ltr" className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-muted">{t('password')}<input name="password" type="password" required autoComplete="current-password" dir="ltr" className={fieldClass} /></label>
        <button className={primaryBtn}>{t('loginButton')}</button>
      </form>
      <p className="text-sm"><Link href="/forgot-password" className="font-semibold underline">{t('forgot')}</Link></p>
      <p className="border-t border-line pt-5 text-sm text-muted">{t('noAccount')} <Link href={`/signup${q}`} className="font-semibold text-forest-900 underline">{t('signupLink')}</Link></p>
    </AuthShell>
  );
}
