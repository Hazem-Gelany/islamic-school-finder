import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { getLookups } from '@/lib/data/lookups';
import { completeness } from '@/lib/completeness';
import { SchoolForm } from '@/components/admin/SchoolForm';
import { MediaManager } from '@/components/admin/MediaManager';
import { fromRecord } from '@/components/admin/schoolFormModel';
import { Badge, Flash, STATUS_LABEL, VERIFICATION_LABEL } from '@/components/admin/Flash';

const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));

export default async function EditSchool({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, perms } = await requirePermission('schools.read_all');
  const [{ data: rec }, lookups] = await Promise.all([supabase.rpc('get_school_for_edit', { p_id: id }), getLookups(supabase)]);
  if (!rec) notFound();
  const canEdit = perms.includes('schools.write');
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const media = (rec.media ?? []).filter((m: any) => m.storage_path).map((m: any) => ({ id: m.id, kind: m.kind, url: `${base}/storage/v1/object/public/school-media/${m.storage_path}`, alt: m.alt_text_i18n?.en ?? '' }));
  const en = (rec.translations ?? []).find((t: any) => t.language_code === 'en') ?? rec.translations?.[0];
  const country = lookups.countries.find((c) => c.id === rec.country_id)?.slug;
  const city = lookups.cities.find((c) => c.id === rec.city_id)?.slug;
  const { data: history } = perms.includes('audit.read')
    ? await supabase.from('audit_log').select('id, user_id, entity_type, action, field_name, old_value, new_value, created_at').eq('school_id', id).order('id', { ascending: false }).limit(15)
    : { data: null };
  const { data: who } = rec.updated_by ? await supabase.from('profiles').select('display_name').eq('id', rec.updated_by).maybeSingle() : { data: null };
  const pct = completeness(rec);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm"><Link href="/admin/schools" className="underline">← Schools</Link></p>
          <h1 className="mt-1 text-3xl font-semibold text-forest-900">{en?.name ?? rec.slug}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone={rec.status === 'active' ? 'good' : 'warn'}>{STATUS_LABEL[rec.status]}</Badge><Badge tone={rec.verification_status === 'community_added' ? 'neutral' : 'good'}>{VERIFICATION_LABEL[rec.verification_status]}</Badge></div>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 text-sm">
          <div><dt className="text-muted">Completeness</dt><dd className="font-semibold">{pct}%</dd></div>
          <div><dt className="text-muted">Last updated</dt><dd className="font-semibold"><time dateTime={rec.updated_at}>{new Date(rec.updated_at).toLocaleDateString('en')}</time></dd></div>
          <div><dt className="text-muted">Updated by</dt><dd className="font-semibold">{who?.display_name ?? (rec.updated_by ? 'Staff member' : 'System')}</dd></div>
        </dl>
      </div>
      <Flash msg={sp.msg} error={sp.error} />
      {canEdit ? (
        <SchoolForm schoolId={id} initial={fromRecord(rec)} lookups={lookups} canVerify={perms.includes('verification.write')}
          preview={country && city ? `/en/schools/${country}/${city}/${rec.slug}?preview=1` : undefined}
          mediaSlot={perms.includes('media.write') ? <MediaManager schoolId={id} items={media} /> : undefined} />
      ) : <p className="rounded-lg bg-[#F6F4EC] p-4 text-muted">You have read-only access to this school.</p>}

      {history && (
        <section className="mt-10" aria-labelledby="hist">
          <h2 id="hist" className="mb-3 text-xl font-semibold">Change history</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white text-sm">
            {history.length === 0 && <li className="p-4 text-muted">No changes recorded.</li>}
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 p-4">
                <span><b>{h.action}</b> {h.entity_type}{h.field_name && <> · <b>{h.field_name}</b>: <span className="text-muted">{show(h.old_value)}</span> → {show(h.new_value)}</>}</span>
                <time className="text-muted" dateTime={h.created_at}>{new Date(h.created_at).toLocaleString('en')}</time>
              </li>))}
          </ul>
        </section>)}
    </>
  );
}
