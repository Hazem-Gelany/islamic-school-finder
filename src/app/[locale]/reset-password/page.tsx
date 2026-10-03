import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AuthCard, Notice, btnCls, fieldCls } from '@/components/auth/AuthCard';
import { updatePassword } from '@/features/auth/actions';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { locale } = await params; return { title: (await getTranslations({ locale, namespace: 'Auth' }))('resetTitle'), robots: { index: false } }; }

export default async function ResetPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect(`/${locale}/login?error=link`);
  const sp = await searchParams; const t = await getTranslations({ locale, namespace: 'Auth' });
  return (
    <AuthCard title={t('resetTitle')}>
      {sp.error && <Notice tone="err">{t(`err_${sp.error === 'weak' ? 'weak' : 'generic'}` as never)}</Notice>}
      <form action={updatePassword} className="space-y-5">
        <input type="hidden" name="locale" value={locale} />
        <label className="block text-sm font-semibold text-muted">{t('newPassword')}<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={fieldCls} /><span className="mt-1 block text-xs font-normal">{t('passwordHint')}</span></label>
        <button className={btnCls}>{t('savePassword')}</button>
      </form>
    </AuthCard>
  );
}
