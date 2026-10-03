import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/auth';
import { getLookups } from '@/lib/data/lookups';
import { mediaUrl } from '@/lib/data/public';
import { SchoolForm } from '@/components/admin/SchoolForm';
import { PortalMedia, type Pending } from '@/components/admin/PortalMedia';
import { fromRecord } from '@/components/admin/schoolFormModel';
import { Badge, Flash, STATUS_LABEL } from '@/components/admin/Flash';
import { ConfirmButton } from '@/components/admin/bits';
import { submitPortal, withdrawChanges } from '../../actions';

type R = Record<string, any>;

export default async function PortalSchool({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await requireMember(id);
  const [{ data: rec }, lookups, { data: pending }, { data: decided }] = await Promise.all([
    supabase.rpc('get_school_for_edit', { p_id: id }), getLookups(supabase),
    supabase.from('school_change_requests').select('id, payload, media, summary, updated_at').eq('school_id', id).eq('requested_by', user.id).eq('status', 'pending').maybeSingle(),
    supabase.from('school_change_requests').select('status, review_notes, reviewed_at').eq('school_id', id).eq('requested_by', user.id).neq('status', 'pending').order('reviewed_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!rec) notFound();

  // Show the person's own pending proposal on top of what is published, so nothing they typed is lost
  const merged: R = { ...rec, ...(pending?.payload ?? {}) };
  if (pending?.payload?.translations) {
    const byLang = new Map<string, R>((rec.translations ?? []).map((t: R) => [t.language_code, t]));
    for (const t of pending.payload.translations as R[]) byLang.set(t.language_code, { ...(byLang.get(t.language_code) ?? {}), ...t });
    merged.translations = [...byLang.values()];
  }
  const media = (rec.media ?? []).filter((m: R) => m.storage_path).map((m: R) => ({ id: m.id, kind: m.kind, url: mediaUrl(m.storage_path), alt: m.alt_text_i18n?.en ?? '' }));
  const pendingAdd: Pending[] = ((pending?.media?.add ?? []) as Omit<Pending, 'url'>[]).map((m) => ({ ...m, url: mediaUrl(m.storage_path) }));
  const name = (rec.translations ?? []).find((t: R) => t.language_code === 'en')?.name ?? rec.slug;
  const country = lookups.countries.find((c) => c.id === rec.country_id)?.slug, city = lookups.cities.find((c) => c.id === rec.city_id)?.slug;

  return (
    <>
      <p className="text-sm"><Link href="/portal" className="underline">← My schools</Link></p>
      <div className="mb-4 mt-1 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-3xl font-semibold text-forest-900">{name}</h1><p className="mt-2 flex flex-wrap gap-2"><Badge tone={rec.status === 'active' ? 'good' : 'warn'}>{STATUS_LABEL[rec.status]}</Badge>{pending && <Badge tone="warn">Changes waiting for review</Badge>}</p></div>
        {country && city && <a href={`/en/schools/${country}/${city}/${rec.slug}`} target="_blank" rel="noreferrer" className="flex h-11 items-center rounded-xl border border-[#B9C4BD] px-5 font-semibold hover:bg-mint-100">View public page</a>}
      </div>
      <Flash msg={sp.msg} error={sp.error} />
      {decided?.status === 'rejected' && !pending && <div role="note" className="mb-4 rounded-xl bg-[#FCEDEA] p-4 text-[#8A1F11]"><b>Your last changes were not approved.</b> {decided.review_notes}</div>}
      {decided?.status === 'approved' && !pending && <div role="note" className="mb-4 rounded-xl bg-mint-100 p-4 text-forest-900">Your last changes were approved and are now live.</div>}
      <div className="mb-6 grid gap-3 rounded-2xl border border-line bg-white p-5 text-[15px] md:grid-cols-2">
        <div><p className="font-semibold text-forest-900">Published straight away</p><p className="text-muted">Phone, email, website, admissions page, social links, student capacity, and the yes/no options for Quran, Arabic, Islamic studies, boarding, transport and scholarships.</p></div>
        <div><p className="font-semibold text-bronze">Checked by our team first</p><p className="text-muted">School name and descriptions, fees, address and map location, curricula, grades, facilities, languages and photos. The current profile stays online until your changes are approved.</p></div>
      </div>
      {pending && (
        <form action={withdrawChanges} className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2B95B] bg-[#FFFBEF] p-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm">{pending.summary ?? 'You have changes waiting for review.'} Saving again updates them.</p>
          <ConfirmButton message="Withdraw all pending changes, including uploaded photos?" className="h-10 rounded-lg border border-[#B9C4BD] bg-white px-4 font-semibold">Withdraw pending changes</ConfirmButton>
        </form>)}
      <SchoolForm mode="portal" schoolId={id} initial={fromRecord(merged)} lookups={lookups} canVerify={false} submitAction={submitPortal}
        mediaSlot={<PortalMedia schoolId={id} published={media} pendingAdd={pendingAdd} pendingRemove={pending?.media?.remove ?? []} />} />
    </>
  );
}
