import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { submitContact } from '@/features/account/actions';

const input = 'mt-1.5 h-12 w-full rounded-[10px] border border-[#B9C4BD] bg-white px-3 text-base font-normal text-ink-900';

/** "Message this school" box. Needs an account, so the school's reply goes to a verified email and spam stays low. */
export async function ContactSchool({ locale, schoolId, schoolName, back, status, signedIn, defaultName }: {
  locale: string; schoolId: string; schoolName: string; back: string; status?: string; signedIn: boolean; defaultName?: string;
}) {
  const t = await getTranslations({ locale, namespace: 'ContactSchool' });
  const known = ['sent', 'invalid', 'consent', 'limit', 'duplicate', 'failed'];
  const state = status && known.includes(status) ? status : undefined;
  return (
    <section id="message" aria-labelledby="message-h" className="scroll-mt-6 rounded-2xl border border-line bg-white p-6">
      <h2 id="message-h" className="mb-2 font-display text-2xl font-semibold">{t('title')}</h2>
      {state === 'sent' && <p role="status" className="mb-4 rounded-lg bg-mint-100 p-3 text-sm text-forest-900">{t('sent')}</p>}
      {state && state !== 'sent' && <p role="alert" className="mb-4 rounded-lg bg-[#FCEDEA] p-3 text-sm text-[#8A1F11]">{t(`error_${state}` as never)}</p>}
      {!signedIn ? (
        <>
          <p className="mb-4 text-muted">{t('loginFirst')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/login?next=${encodeURIComponent(`/${locale}${back}#message`)}`} className="flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">{t('login')}</Link>
            <Link href={`/signup?next=${encodeURIComponent(`/${locale}${back}#message`)}`} className="flex h-11 items-center rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 hover:bg-mint-100">{t('signup')}</Link>
          </div>
        </>
      ) : (
        <form action={submitContact} className="space-y-4">
          <p className="text-sm text-muted">{t('intro', { name: schoolName })}</p>
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="schoolId" value={schoolId} /><input type="hidden" name="back" value={back} />
          {/* Honeypot: invisible to people, tempting to bots. */}
          <div aria-hidden className="absolute -start-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <label className="block text-sm font-semibold text-muted">{t('name')}<input name="name" required minLength={2} maxLength={120} defaultValue={defaultName} autoComplete="name" className={input} /></label>
          <label className="block text-sm font-semibold text-muted">{t('phone')} <span className="font-normal">({t('optional')})</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" dir="ltr" className={input} /></label>
          <label className="block text-sm font-semibold text-muted">{t('message')}<textarea name="message" required minLength={10} maxLength={2000} rows={5} placeholder={t('messagePlaceholder')} className={`${input} h-auto py-3`} /></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="consent" required className="mt-1 size-5 shrink-0" /><span>{t('consent', { name: schoolName })}</span></label>
          <button className="h-12 w-full rounded-xl bg-forest-900 font-semibold text-cream-50 hover:bg-[#14503F]">{t('send')}</button>
        </form>
      )}
    </section>
  );
}
