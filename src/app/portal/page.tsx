import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Badge, Flash, STATUS_LABEL } from '@/components/admin/Flash';

type S = { id: string; name: string; slug: string; country_slug: string; city_slug: string; status: string; pending_requests: number };

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser('/portal');
  const { data } = await supabase.rpc('my_schools', { p_locale: 'en' });
  const schools = (data ?? []) as S[];
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">My schools</h1>
      <p className="mb-6 max-w-2xl text-muted">Keep your school's profile accurate. Contact details publish straight away; other changes are checked by our team before they appear.</p>
      <Flash msg={sp.msg} error={sp.error === 'forbidden' ? 'You do not manage that school.' : undefined} />
      {schools.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <p className="text-lg font-semibold">You do not manage a school yet.</p>
          <p className="mt-1 text-muted">Find your school and send a claim. We will review it.</p>
          <Link href="/en/claim" className="mt-4 inline-flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50">Claim a school</Link>
        </div>
      ) : (
        <ul className="space-y-4">{schools.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5">
            <div><p className="text-lg font-semibold">{s.name}</p>
              <p className="mt-1 flex flex-wrap gap-2"><Badge tone={s.status === 'active' ? 'good' : 'warn'}>{STATUS_LABEL[s.status]}</Badge>{s.pending_requests > 0 && <Badge tone="warn">Changes waiting for review</Badge>}</p></div>
            <div className="flex flex-wrap gap-3">
              <a href={`/en/schools/${s.country_slug}/${s.city_slug}/${s.slug}`} className="flex h-11 items-center rounded-xl border border-[#B9C4BD] px-5 font-semibold hover:bg-mint-100">View public page</a>
              <Link href={`/portal/schools/${s.id}`} className="flex h-11 items-center rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">Edit profile</Link>
            </div>
          </li>))}</ul>)}
    </>
  );
}
