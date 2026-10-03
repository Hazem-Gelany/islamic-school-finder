import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell, fieldClass, primaryBtn } from '@/components/AuthShell';
import { updatePassword } from '@/features/account/actions';
import { requireUser } from '@/lib/user';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('resetTitle'), robots: { index: false, follow: false } };
}

/** Reached from the email link (which signs the visitor in first) or from the account page. */
export default async function ResetPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  await requireUser(locale, '/reset-password');
  const sp = await searchParams; const t = await getTranslations({ locale, namespace: 'Auth' });
  return (
    <AuthShell title={t('resetTitle')} intro={t('resetIntro')} error={sp.error ? t(sp.error === 'weak' ? 'error_weak' : 'error_failed') : undefined}>
      <form action={updatePassword} className="space-y-5">
        <input type="hidden" name="locale" value={locale} />
        <label className="block text-sm font-semibold text-muted">{t('newPassword')}<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" dir="ltr" aria-describedby="pw-hint" className={fieldClass} /><span id="pw-hint" className="mt-1 block text-sm font-normal">{t('passwordHint')}</span></label>
        <button className={primaryBtn}>{t('resetButton')}</button>
      </form>
    </AuthShell>
  );
}
