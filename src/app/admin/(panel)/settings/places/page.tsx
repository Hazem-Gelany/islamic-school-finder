import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { Flash } from '@/components/admin/Flash';
import { ConfirmButton } from '@/components/admin/bits';
import { deleteCity, deleteCountry, deleteRegion, saveCity, saveCountry, saveRegion } from './actions';

const inp = 'h-10 w-full rounded-lg border border-[#B9C4BD] px-2 text-[15px]';
const lab = 'text-xs font-semibold text-muted';
const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className={lab}>{t}{children}</label>;

export default async function PlacesPage({ searchParams }: { searchParams: Promise<{ country?: string; msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePermission('categories.manage');
  const { data: countries } = await supabase.from('countries').select('id, iso2, slug, name_i18n, currency_code, is_active').order('slug');
  const country = (countries ?? []).find((c) => c.slug === sp.country);
  const ret = country ? `/admin/settings/places?country=${country.slug}` : '/admin/settings/places';

  if (!country) return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">Places</h1>
      <p className="mb-6 max-w-2xl text-muted">Countries, regions and cities used by the school form, the filters and search. Pick a country to manage its regions and cities.</p>
      <Flash msg={sp.msg} error={sp.error} />
      <div className="space-y-3">
        {(countries ?? []).map((c) => (
          <form key={c.id} action={saveCountry} className="grid items-end gap-2 rounded-xl border border-line bg-white p-3 md:grid-cols-[70px_1fr_1fr_1fr_1fr_80px_70px_auto]">
            <input type="hidden" name="id" value={c.id} /><input type="hidden" name="return" value={ret} />
            <L t="Code"><input name="iso2" defaultValue={c.iso2} maxLength={2} className={`${inp} uppercase`} required /></L>
            <L t="URL name"><input name="slug" defaultValue={c.slug} className={inp} required /></L>
            <L t="English"><input name="en" defaultValue={c.name_i18n.en} className={inp} required /></L>
            <L t="العربية"><input name="ar" dir="rtl" lang="ar" defaultValue={c.name_i18n.ar ?? ''} className={inp} /></L>
            <L t="Malay"><input name="ms" defaultValue={c.name_i18n.ms ?? ''} className={inp} /></L>
            <L t="Currency"><input name="currency" defaultValue={c.currency_code ?? ''} maxLength={3} className={`${inp} uppercase`} /></L>
            <label className={`${lab} flex h-10 items-center gap-2`}><input type="checkbox" name="is_active" defaultChecked={c.is_active} className="size-5" />Active</label>
            <span className="flex gap-2"><button className="h-10 rounded-lg border-[1.5px] border-forest-900 px-3 font-semibold text-forest-900 hover:bg-mint-100">Save</button>
              <Link href={`/admin/settings/places?country=${c.slug}`} className="flex h-10 items-center rounded-lg bg-forest-900 px-3 font-semibold text-cream-50">Cities</Link>
              <ConfirmButton message="Delete this country?" formAction={deleteCountry} className="h-10 rounded-lg border border-[#B9C4BD] px-3 hover:bg-[#FCEDEA]">Delete</ConfirmButton></span>
          </form>))}
        <form action={saveCountry} className="grid items-end gap-2 rounded-xl border border-dashed border-[#B9C4BD] bg-[#FBFAF5] p-3 md:grid-cols-[70px_1fr_1fr_1fr_1fr_80px_70px_auto]">
          <input type="hidden" name="return" value={ret} />
          <L t="Code"><input name="iso2" maxLength={2} placeholder="MY" className={`${inp} uppercase`} required /></L><L t="URL name"><input name="slug" placeholder="malaysia" className={inp} required /></L>
          <L t="English"><input name="en" className={inp} required /></L><L t="العربية"><input name="ar" dir="rtl" lang="ar" className={inp} /></L><L t="Malay"><input name="ms" className={inp} /></L>
          <L t="Currency"><input name="currency" maxLength={3} placeholder="MYR" className={`${inp} uppercase`} /></L>
          <label className={`${lab} flex h-10 items-center gap-2`}><input type="checkbox" name="is_active" defaultChecked className="size-5" />Active</label>
          <button className="h-10 rounded-lg bg-forest-900 px-4 font-semibold text-cream-50">Add country</button>
        </form>
      </div>
    </>
  );

  const [{ data: regions }, { data: cities }] = await Promise.all([
    supabase.from('regions').select('id, slug, name_i18n').eq('country_id', country.id).order('slug'),
    supabase.rpc('admin_list_cities', { p_country: country.slug }),
  ]);
  return (
    <>
      <p className="text-sm"><Link href="/admin/settings/places" className="underline">← All countries</Link></p>
      <h1 className="mb-6 mt-1 text-3xl font-semibold text-forest-900">{country.name_i18n.en}</h1>
      <Flash msg={sp.msg} error={sp.error} />

      <section aria-labelledby="regions" className="mb-10">
        <h2 id="regions" className="mb-3 text-xl font-semibold">Regions / states <span className="text-sm font-normal text-muted">(optional)</span></h2>
        <div className="space-y-2">
          {[...(regions ?? []), null].map((r) => (
            <form key={r?.id ?? 'new'} action={saveRegion} className={`grid items-end gap-2 rounded-xl border p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] ${r ? 'border-line bg-white' : 'border-dashed border-[#B9C4BD] bg-[#FBFAF5]'}`}>
              {r && <input type="hidden" name="id" value={r.id} />}<input type="hidden" name="country_id" value={country.id} /><input type="hidden" name="return" value={ret} />
              <L t="URL name"><input name="slug" defaultValue={r?.slug} className={inp} required /></L><L t="English"><input name="en" defaultValue={r?.name_i18n.en} className={inp} required /></L>
              <L t="العربية"><input name="ar" dir="rtl" lang="ar" defaultValue={r?.name_i18n.ar ?? ''} className={inp} /></L><L t="Malay"><input name="ms" defaultValue={r?.name_i18n.ms ?? ''} className={inp} /></L>
              <span className="flex gap-2"><button className={`h-10 rounded-lg px-3 font-semibold ${r ? 'border-[1.5px] border-forest-900 text-forest-900 hover:bg-mint-100' : 'bg-forest-900 text-cream-50'}`}>{r ? 'Save' : 'Add region'}</button>
                {r && <ConfirmButton message="Delete this region?" formAction={deleteRegion} className="h-10 rounded-lg border border-[#B9C4BD] px-3 hover:bg-[#FCEDEA]">Delete</ConfirmButton>}</span>
            </form>))}
        </div>
      </section>

      <section aria-labelledby="cities">
        <h2 id="cities" className="mb-1 text-xl font-semibold">Cities</h2>
        <p className="mb-3 max-w-2xl text-sm text-muted">Coordinates enable distance search. <b>Other names</b> (one per line, e.g. KL) help people find the city when they type it differently.</p>
        <div className="space-y-3">
          {[...(cities ?? []), null].map((c: any) => (
            <form key={c?.id ?? 'new'} action={saveCity} className={`grid items-start gap-2 rounded-xl border p-3 md:grid-cols-[1fr_1fr_1fr_1fr_1fr] ${c ? 'border-line bg-white' : 'border-dashed border-[#B9C4BD] bg-[#FBFAF5]'}`}>
              {c && <input type="hidden" name="id" value={c.id} />}<input type="hidden" name="country_id" value={country.id} /><input type="hidden" name="return" value={ret} />
              <L t="URL name"><input name="slug" defaultValue={c?.slug} className={inp} required /></L><L t="English"><input name="en" defaultValue={c?.name_i18n.en} className={inp} required /></L>
              <L t="العربية"><input name="ar" dir="rtl" lang="ar" defaultValue={c?.name_i18n.ar ?? ''} className={inp} /></L><L t="Malay"><input name="ms" defaultValue={c?.name_i18n.ms ?? ''} className={inp} /></L>
              <L t="Region"><select name="region_id" defaultValue={c?.region_id ?? ''} className={inp}><option value="">None</option>{(regions ?? []).map((r) => <option key={r.id} value={r.id}>{r.name_i18n.en}</option>)}</select></L>
              <L t="Latitude"><input name="lat" inputMode="decimal" defaultValue={c?.latitude ?? ''} className={inp} /></L><L t="Longitude"><input name="lng" inputMode="decimal" defaultValue={c?.longitude ?? ''} className={inp} /></L>
              <div className="md:col-span-2"><L t="Other names (one per line)"><textarea name="aliases" rows={2} defaultValue={(c?.aliases ?? []).join('\n')} className="w-full rounded-lg border border-[#B9C4BD] px-2 py-1 text-[15px]" /></L></div>
              <span className="flex gap-2 md:pt-5"><button className={`h-10 rounded-lg px-3 font-semibold ${c ? 'border-[1.5px] border-forest-900 text-forest-900 hover:bg-mint-100' : 'bg-forest-900 text-cream-50'}`}>{c ? 'Save' : 'Add city'}</button>
                {c && <ConfirmButton message="Delete this city?" formAction={deleteCity} className="h-10 rounded-lg border border-[#B9C4BD] px-3 hover:bg-[#FCEDEA]">Delete</ConfirmButton>}</span>
            </form>))}
        </div>
      </section>
    </>
  );
}
