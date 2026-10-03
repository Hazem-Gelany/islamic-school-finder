import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AuthShell, fieldClass, primaryBtn } from '@/components/AuthShell';
import { requestPasswordReset } from '@/features/account/actions';
import { altPaths } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string; sent?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('forgotTitle'), alternates: altPaths(locale, '/forgot-password'), robots: { index: false, follow: true } };
}

export default async function ForgotPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const sp = await searchParams; const t = await getTranslations({ locale, namespace: 'Auth' });
  return (
    <AuthShell title={t('forgotTitle')} intro={t('forgotIntro')} error={sp.error === 'invalid' ? t('error_invalid_email') : sp.error === 'expired' ? t('error_expired') : undefined} notice={sp.sent ? t('resetSent') : undefined}>
      <form action={requestPasswordReset} className="space-y-5">
        <input type="hidden" name="locale" value={locale} />
        <label className="block text-sm font-semibold text-muted">{t('email')}<input name="email" type="email" required autoComplete="email" dir="ltr" className={fieldClass} /></label>
        <button className={primaryBtn}>{t('sendLink')}</button>
      </form>
      <p className="text-sm"><Link href="/login" className="font-semibold underline">{t('backToLogin')}</Link></p>
    </AuthShell>
  );
}
