import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InfoPage } from '@/components/public/InfoPage';
import { altPaths } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'About' });
  return { title: t('title'), description: t('intro'), alternates: altPaths(locale, '/about') };
}
export default async function Page({ params }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'About' });
  return <InfoPage title={t('title')} intro={t('intro')} sections={t.raw('sections') as { h: string; p: string }[]} />;
}
