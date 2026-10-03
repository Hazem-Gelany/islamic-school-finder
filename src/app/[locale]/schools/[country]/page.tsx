import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SchoolsExplorer } from '@/features/search/SchoolsExplorer';
import { isFiltered, parseSearch } from '@/features/search/params';
import { altPaths, getFacets, pick } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string; country: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, country } = await params; const sp = parseSearch(await searchParams);
  const c = (await getFacets()).countries.find((x) => x.slug === country);
  if (!c) return {};
  const t = await getTranslations({ locale, namespace: 'Schools' });
  const place = pick(c.name as Record<string, string>, locale);
  return {
    title: t('titleIn', { place }), description: t('metaDescriptionIn', { place }),
    alternates: altPaths(locale, `/schools/${country}${sp.page > 1 && !isFiltered(sp) ? `?page=${sp.page}` : ''}`),
    robots: isFiltered(sp, ['country']) ? { index: false, follow: true } : undefined,
  };
}
export default async function CountryPage({ params, searchParams }: Props) {
  const { locale, country } = await params; setRequestLocale(locale);
  if (!(await getFacets()).countries.some((x) => x.slug === country)) notFound();
  return <SchoolsExplorer locale={locale} search={parseSearch(await searchParams)} preset={{ country }} />;
}
