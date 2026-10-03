export function Flash({ msg, error }: { msg?: string; error?: string }) {
  if (error) return <p role="alert" className="mb-5 rounded-lg bg-[#FCEDEA] p-3 text-sm text-[#8A1F11]">{error}</p>;
  if (msg) return <p role="status" className="mb-5 rounded-lg bg-mint-100 p-3 text-sm text-forest-900">{msg}</p>;
  return null;
}
export const VERIFICATION_LABEL: Record<string, string> = { community_added: 'Community added', information_checked: 'Information checked', school_verified: 'School verified', school_managed: 'School managed' };
export const STATUS_LABEL: Record<string, string> = { draft: 'Draft', pending: 'Pending', active: 'Active', archived: 'Archived', suspended: 'Suspended' };
export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' }) {
  const c = tone === 'good' ? 'bg-mint-100 text-forest-900' : tone === 'warn' ? 'bg-[#FBF0D9] text-bronze' : 'bg-[#EEF1EF] text-muted';
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${c}`}>{children}</span>;
}
