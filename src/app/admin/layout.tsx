import '../globals.css';
export const metadata = { title: 'Admin | Islamic School Finder', robots: { index: false, follow: false } };
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}><a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-gold-400 focus:px-4 focus:py-3 focus:font-semibold focus:text-forest-900">Skip to main content</a>{children}</body></html>;
}
