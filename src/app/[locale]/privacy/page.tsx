import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StaticPage } from '@/components/public/StaticPage';
import { altPaths } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'Privacy' });
  return { title: t('title'), alternates: altPaths(locale, '/privacy') };
}
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  return <StaticPage locale={locale} namespace="Privacy" />;
}
