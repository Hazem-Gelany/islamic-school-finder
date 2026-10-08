import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AuthCard, Notice, btnCls, fieldCls } from '@/components/auth/AuthCard';
import { signIn } from '@/features/auth/actions';
import { safeNext } from '@/lib/safeNext';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string; next?: string; msg?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { locale } = await params; return { title: (await getTranslations({ locale, namespace: 'Auth' }))('loginTitle'), robots: { index: false } }; }

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const sp = await searchParams; const t = await getTranslations({ locale, namespace: 'Auth' });
  const next = safeNext(sp.next, `/${locale}/account`);
  return (
    <AuthCard title={t('loginTitle')}>
      {sp.error && <Notice tone="err">{t(`err_${['invalid', 'unconfirmed', 'link', 'rate'].includes(sp.error) ? sp.error : 'generic'}` as never)}</Notice>}
      <form action={signIn} className="space-y-5">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold text-muted">{t('email')}<input name="email" type="email" required autoComplete="email" className={fieldCls} /></label>
        <label className="block text-sm font-semibold text-muted">{t('password')}<input name="password" type="password" required autoComplete="current-password" className={fieldCls} /></label>
        <button className={btnCls}>{t('signIn')}</button>
      </form>
      <p className="text-sm"><Link className="underline" href="/forgot-password">{t('forgot')}</Link></p>
      <p className="text-sm text-muted">{t('noAccount')} <Link className="font-semibold text-forest-900 underline" href={`/register?next=${encodeURIComponent(next.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/account')}`}>{t('signUp')}</Link></p>
    </AuthCard>
  );
}
