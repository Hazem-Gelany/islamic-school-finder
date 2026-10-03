import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { Fraunces, Figtree, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { CompareBar } from '@/components/public/CompareBar';
import { routing, dirFor } from '@/i18n/routing';
import '../globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree', display: 'swap' });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600'], variable: '--font-arabic', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Islamic School Finder', template: '%s | Islamic School Finder' },
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    <html lang={locale} dir={dirFor(locale)} className={`${fraunces.variable} ${figtree.variable} ${arabic.variable}`}>
      <body><NextIntlClientProvider>{children}<CompareBar /></NextIntlClientProvider></body>
    </html>
  );
}
