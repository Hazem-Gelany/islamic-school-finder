import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SchoolsExplorer } from '@/features/search/SchoolsExplorer';
import { isFiltered, parseSearch } from '@/features/search/params';
import { altPaths, getFacets, pick } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string; country: string; city: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, country, city } = await params; const sp = parseSearch(await searchParams);
  const c = (await getFacets()).cities.find((x) => x.slug === city && x.country === country);
  if (!c) return {};
  const t = await getTranslations({ locale, namespace: 'Schools' });
  const place = pick(c.name as Record<string, string>, locale);
  return {
    title: t('titleIn', { place }), description: t('metaDescriptionIn', { place }),
    alternates: altPaths(locale, `/schools/${country}/${city}${sp.page > 1 && !isFiltered(sp) ? `?page=${sp.page}` : ''}`),
    robots: isFiltered(sp, ['country', 'city']) ? { index: false, follow: true } : undefined,
  };
}
export default async function CityPage({ params, searchParams }: Props) {
  const { locale, country, city } = await params; setRequestLocale(locale);
  if (!(await getFacets()).cities.some((x) => x.slug === city && x.country === country)) notFound();
  return <SchoolsExplorer locale={locale} search={parseSearch(await searchParams)} preset={{ country, city }} />;
}
