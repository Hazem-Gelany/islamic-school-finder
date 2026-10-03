import '../globals.css';
export const metadata = { title: 'Admin | Islamic School Finder', robots: { index: false, follow: false } };
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>{children}</body></html>;
}
