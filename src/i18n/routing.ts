import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({ locales: ['en', 'ar', 'ms'], defaultLocale: 'en' });
export const rtlLocales = ['ar'] as const;
export const dirFor = (locale: string) => ((rtlLocales as readonly string[]).includes(locale) ? 'rtl' : 'ltr');
