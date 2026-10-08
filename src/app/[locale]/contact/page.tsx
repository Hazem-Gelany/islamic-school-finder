import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { InfoPage } from '@/components/public/InfoPage';
import { altPaths } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Contact' });
  return { title: t('title'), description: t('intro'), alternates: altPaths(locale, '/contact') };
}
export default async function ContactPage({ params }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Contact' });
  const email = process.env.CONTACT_EMAIL ?? 'hello@example.org';
  return (
    <InfoPage title={t('title')} intro={t('intro')} sections={t.raw('sections') as { h: string; p: string }[]}>
      <p><a className="inline-flex h-12 items-center rounded-xl bg-forest-900 px-6 font-semibold text-cream-50 hover:bg-[#14503F]" href={`mailto:${email}`}>{t('emailUs')}: <span dir="ltr" className="ms-2">{email}</span></a></p>
      <p className="text-muted">{t('claimHint')} <Link className="font-semibold text-forest-900 underline" href="/claim">{t('claimLink')}</Link></p>
    </InfoPage>
  );
}
