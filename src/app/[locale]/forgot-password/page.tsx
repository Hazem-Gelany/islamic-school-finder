import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard, Notice, btnCls, fieldCls } from '@/components/auth/AuthCard';
import { requestReset } from '@/features/auth/actions';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string; sent?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { locale } = await params; return { title: (await getTranslations({ locale, namespace: 'Auth' }))('forgot'), robots: { index: false } }; }

export default async function ForgotPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const sp = await searchParams; const t = await getTranslations({ locale, namespace: 'Auth' });
  return (
    <AuthCard title={t('forgot')} intro={t('resetIntro')}>
      {sp.sent && <Notice tone="ok">{t('resetSent')}</Notice>}
      {sp.error && <Notice tone="err">{t('err_invalid')}</Notice>}
      <form action={requestReset} className="space-y-5">
        <input type="hidden" name="locale" value={locale} />
        <label className="block text-sm font-semibold text-muted">{t('email')}<input name="email" type="email" required autoComplete="email" className={fieldCls} /></label>
        <button className={btnCls}>{t('sendLink')}</button>
      </form>
    </AuthCard>
  );
}
