import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SchoolsExplorer } from '@/features/search/SchoolsExplorer';
import { isFiltered, parseSearch } from '@/features/search/params';
import { altPaths } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params; const sp = parseSearch(await searchParams);
  const t = await getTranslations({ locale, namespace: 'Schools' });
  const filtered = isFiltered(sp);
  return {
    title: t('metaTitle'), description: t('metaDescription'),
    alternates: altPaths(locale, sp.page > 1 && !filtered ? `/schools?page=${sp.page}` : '/schools'),
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}
export default async function SchoolsPage({ params, searchParams }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  return <SchoolsExplorer locale={locale} search={parseSearch(await searchParams)} />;
}
