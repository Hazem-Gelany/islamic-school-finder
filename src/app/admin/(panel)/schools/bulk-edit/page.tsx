import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { getLookups, type Opt } from '@/lib/data/lookups';
import { Flash } from '@/components/admin/Flash';
import { applyBulkEdit } from '../actions';

function Pair({ title, name, options }: { title: string; name: string; options: { id: string | number; label: string }[] }) {
  const box = (prefix: string) => (
    <fieldset className="rounded-xl border border-line p-3"><legend className="px-1 text-sm font-semibold text-muted">{prefix === 'add' ? 'Add' : 'Remove'}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">{options.map((o) => <label key={o.id} className="flex min-h-9 items-center gap-2 text-[15px]"><input type="checkbox" className="size-4" name={`${prefix}_${name}`} value={o.id} />{o.label}</label>)}</div></fieldset>);
  return <section aria-label={title}><h2 className="mb-2 text-lg font-semibold">{title}</h2><div className="grid gap-3 md:grid-cols-2">{box('add')}{box('remove')}</div></section>;
}

export default async function BulkEdit({ searchParams }: { searchParams: Promise<{ ids?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePermission('schools.write');
  const ids = (sp.ids ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  const L = await getLookups(supabase);
  const countryOf = new Map(L.countries.map((c) => [c.id, c.label]));
  const sel = 'mt-1 block h-11 w-full max-w-md rounded-[10px] border border-[#B9C4BD] bg-white px-3 font-normal';
  return (
    <>
      <p className="text-sm"><Link href="/admin/schools" className="underline">← Schools</Link></p>
      <h1 className="mb-1 mt-1 text-3xl font-semibold text-forest-900">Bulk edit</h1>
      <p className="mb-6 text-muted">{ids.length} school(s) selected. Only the changes you choose below are applied, all together or not at all. Everything is recorded in the audit log.</p>
      <Flash error={sp.error} />
      {ids.length === 0 ? <p className="rounded-lg bg-[#F6F4EC] p-4">No schools selected. Go back and tick some schools.</p> : (
        <form action={applyBulkEdit} className="space-y-8 rounded-2xl border border-line bg-white p-6">
          {ids.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-muted">School type<select name="school_type_id" className={sel} defaultValue=""><option value="">No change</option>{L.schoolTypes.map((o: Opt) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
            <label className="text-sm font-semibold text-muted">Move to city<select name="city_id" className={sel} defaultValue=""><option value="">No change</option>{L.cities.map((c) => <option key={c.id} value={c.id}>{c.label} ({countryOf.get(c.country_id)})</option>)}</select>
              <span className="mt-1 block text-xs font-normal">The country follows the city. The URL name must stay unique in the new city.</span></label>
          </div>
          <Pair title="Curricula" name="curricula" options={L.curricula} />
          <Pair title="Grade levels" name="grade_levels" options={L.gradeLevels} />
          <Pair title="Facilities" name="facilities" options={L.facilities} />
          <Pair title="Languages of instruction" name="languages" options={L.languages.map((l) => ({ id: l.code, label: l.label }))} />
          <button className="h-12 rounded-xl bg-forest-900 px-6 font-semibold text-cream-50 hover:bg-[#14503F]">Apply to {ids.length} school(s)</button>
        </form>)}
    </>
  );
}
