'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('Errors');
  useEffect(() => { console.error(error.digest ?? error.message); }, [error]);
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-display text-4xl font-medium text-forest-900">{t('title')}</h1>
      <p className="mt-3 text-lg text-muted">{t('text')}</p>
      {error.digest && <p className="mt-2 text-sm text-muted">{t('reference')}: <code>{error.digest}</code></p>}
      <div className="mt-8 flex justify-center gap-3">
        <button onClick={reset} className="h-12 rounded-xl bg-forest-900 px-6 font-semibold text-cream-50">{t('retry')}</button>
        <Link href="/" className="flex h-12 items-center rounded-xl border-[1.5px] border-forest-900 px-6 font-semibold text-forest-900">{t('home')}</Link>
      </div>
    </main>
  );
}
