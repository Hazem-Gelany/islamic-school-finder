'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname().startsWith(href);
  return <Link href={href} aria-current={active ? 'page' : undefined}
    className={`flex h-11 items-center rounded-lg px-3 text-[15px] font-medium ${active ? 'bg-gold-400 text-forest-900' : 'text-cream-50 hover:bg-white/10'}`}>{children}</Link>;
}
