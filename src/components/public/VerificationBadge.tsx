import { useTranslations } from 'next-intl';
import { ShieldIcon } from '@/components/icons';

const tone: Record<string, string> = {
  school_managed: 'bg-forest-900 text-cream-50', school_verified: 'bg-mint-100 text-forest-900',
  information_checked: 'bg-[#FBF0D9] text-bronze', community_added: 'bg-[#EEF1EF] text-muted',
};
export function VerificationBadge({ status }: { status: string }) {
  const t = useTranslations('Verif');
  const strong = status === 'school_verified' || status === 'school_managed';
  return (
    <span title={t(`${status}_help` as never)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${tone[status] ?? tone.community_added}`}>
      {strong && <ShieldIcon />}{t(status as never)}
    </span>
  );
}
