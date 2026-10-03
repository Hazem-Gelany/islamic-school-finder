import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StaticPage } from '@/components/public/StaticPage';
import { altPaths } from '@/lib/data/public';

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: 'ContactPage' });
  return { title: t('title'), alternates: altPaths(locale, '/contact') };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'ContactPage' });
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <StaticPage locale={locale} namespace="ContactPage">
      <section aria-labelledby="mail" className="rounded-2xl bg-sand-100 p-6">
        <h2 id="mail" className="mb-2 font-display text-2xl font-semibold">{t('emailTitle')}</h2>
        {email ? <a dir="ltr" href={`mailto:${email}`} className="text-lg font-semibold underline">{email}</a> : <p className="text-muted">{t('emailMissing')}</p>}
      </section>
    </StaticPage>
  );
}
