import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AuthCard, Notice, btnCls, fieldCls } from '@/components/auth/AuthCard';
import { signUp } from '@/features/auth/actions';
import { safeNext } from '@/lib/safeNext';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string; next?: string; sent?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { locale } = await params; return { title: (await getTranslations({ locale, namespace: 'Auth' }))('registerTitle'), robots: { index: false } }; }

export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const sp = await searchParams; const t = await getTranslations({ locale, namespace: 'Auth' });
  const next = safeNext(sp.next?.startsWith('/') ? `/${locale}${sp.next}` : sp.next, `/${locale}/account`);
  if (sp.sent) return <AuthCard title={t('registerTitle')}><Notice tone="ok">{t('registerSent')}</Notice><Link className="underline" href="/login">{t('signIn')}</Link></AuthCard>;
  return (
    <AuthCard title={t('registerTitle')} intro={t('registerIntro')}>
      {sp.error && <Notice tone="err">{t(`err_${['weak', 'invalid', 'rate'].includes(sp.error) ? sp.error : 'generic'}` as never)}</Notice>}
      <form action={signUp} className="space-y-5">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold text-muted">{t('displayName')}<input name="name" required maxLength={80} autoComplete="name" className={fieldCls} /></label>
        <label className="block text-sm font-semibold text-muted">{t('email')}<input name="email" type="email" required autoComplete="email" className={fieldCls} /></label>
        <label className="block text-sm font-semibold text-muted">{t('password')}<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={fieldCls} /><span className="mt-1 block text-xs font-normal">{t('passwordHint')}</span></label>
        <button className={btnCls}>{t('signUp')}</button>
      </form>
      <p className="text-sm text-muted">{t('haveAccount')} <Link className="font-semibold text-forest-900 underline" href="/login">{t('signIn')}</Link></p>
    </AuthCard>
  );
}
