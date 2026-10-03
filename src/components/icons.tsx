const base = { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
export const SearchIcon = () => <svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>;
export const CompareIcon = () => <svg {...base}><rect x="3" y="5" width="7" height="14" rx="1.5" /><rect x="14" y="5" width="7" height="14" rx="1.5" /></svg>;
export const MatchIcon = () => <svg {...base}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
export const MailIcon = () => <svg {...base}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 8l9 6 9-6" /></svg>;
export const ShieldIcon = () => <svg {...base} width={18} height={18} strokeWidth={2}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>;
export const StarIcon = () => <svg {...base} width={34} height={34} className="text-gold-400"><path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.3l5-.7z" /><path d="M4 21h16" /></svg>;
