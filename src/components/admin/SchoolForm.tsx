'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { schoolSchema } from '@/validations/school';
import { saveSchool, type SaveResult } from '@/app/admin/(panel)/schools/actions';
import type { Lookups } from '@/lib/data/lookups';
import { CONTENT_LANGS, SOCIALS, STEPS, slugify, stepOf, toPayload, type V } from './schoolFormModel';

const inputCls = 'h-12 w-full rounded-[10px] border border-[#7F9288] bg-white px-3 text-base text-ink-900 aria-[invalid=true]:border-[#B3261E]';
const areaCls = 'min-h-28 w-full rounded-[10px] border border-[#7F9288] bg-white p-3 text-base text-ink-900';

function Field({ label, id, error, hint, children }: { label: string; id: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-muted">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-sm text-[#B3261E]">{error}</p>}
    </div>
  );
}
function Checks<T extends string | number>({ legend, options, value, onChange }: { legend: string; options: { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-semibold text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">{options.map((o) => {
        const on = value.includes(o.id);
        return <label key={String(o.id)} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 ${on ? 'border-forest-900 bg-mint-100 font-semibold' : 'border-[#7F9288] bg-white'}`}>
          <input type="checkbox" className="size-4" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])} />{o.label}</label>;
      })}</div>
    </fieldset>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" className="size-5" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;
}

export type FormResult = { ok: true; id?: string; message?: string } | Extract<SaveResult, { ok: false }>;

/** Used by staff (mode "admin") and by approved school representatives (mode "portal"). In the portal the URL name and place are locked and there is no publishing or verification step. */
export function SchoolForm({ schoolId, initial, lookups, canVerify, preview, mediaSlot, mode = 'admin', submitAction }: {
  schoolId: string | null; initial: V; lookups: Lookups; canVerify: boolean; preview?: string; mediaSlot?: React.ReactNode;
  mode?: 'admin' | 'portal'; submitAction?: (id: string | null, payload: unknown, confirmDuplicate?: boolean) => Promise<FormResult>;
}) {
  const portal = mode === 'portal';
  const visible = STEPS.map((_, i) => i).filter((i) => !portal || i !== 7);

  const router = useRouter();
  const [v, setV] = useState<V>(initial);
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<string>('en');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [dups, setDups] = useState<NonNullable<Extract<SaveResult, { ok: false }>['duplicates']>>([]);
  const [slugTouched, setSlugTouched] = useState(!!schoolId);
  const [pending, start] = useTransition();
  const set = <K extends keyof V>(k: K, x: V[K]) => setV((p) => ({ ...p, [k]: x }));
  const setTr = (k: string, x: string) => setV((p) => ({ ...p, tr: { ...p.tr, [lang]: { ...p.tr[lang], [k]: x } } }));
  const err = (p: string) => errors[p];
  const a11y = (id: string, p: string) => ({ id, 'aria-invalid': !!err(p), 'aria-describedby': err(p) ? `${id}-err` : undefined });

  const country = lookups.countries.find((c) => String(c.id) === v.country_id);
  const regions = lookups.regions.filter((r) => String(r.country_id) === v.country_id);
  const cities = lookups.cities.filter((c) => String(c.country_id) === v.country_id && (!v.region_id || String(c.region_id) === v.region_id));
  const trIdx = (code: string) => CONTENT_LANGS.filter(([c]) => v.tr[c].name.trim()).findIndex(([c]) => c === code);
  const L = (name: string) => ({ lang: lang, dir: lang === 'ar' ? 'rtl' as const : 'ltr' as const, name });

  function submit(status: string, confirmDuplicate = false) {
    setBanner(null); setDups([]);
    const partial = CONTENT_LANGS.filter(([c]) => !v.tr[c].name.trim() && Object.values(v.tr[c]).some((x) => x.trim()));
    const payload = toPayload(v, status);
    const parsed = schoolSchema.safeParse(payload);
    const found: Record<string, string> = {};
    if (!parsed.success) parsed.error.issues.forEach((i) => { const k = i.path.join('.'); found[k] ??= i.message; });
    partial.forEach(([c, n]) => { found[`tr.${c}.name`] = `Add the school name in ${n}, or clear this language.`; });
    if (Object.keys(found).length) {
      setErrors(found);
      setBanner({ tone: 'err', text: 'Please fix the highlighted fields.' });
      const first = Object.keys(found)[0];
      setStep(first.startsWith('tr.') ? 0 : stepOf(first));
      return;
    }
    setErrors({});
    start(async () => {
      const res: FormResult = await (submitAction ?? saveSchool)(schoolId, payload, confirmDuplicate);
      if (res.ok) {
        if (!schoolId && res.id) return router.push(`/admin/schools/${res.id}?msg=${encodeURIComponent(status === 'active' ? 'School published.' : 'School saved.')}`);
        if (!portal) set('status', status); setBanner({ tone: 'ok', text: res.message ?? 'Saved.' }); router.refresh();
      } else {
        const fe: Record<string, string> = {};
        res.fieldErrors?.forEach((f) => (fe[f.path] ??= f.message));
        setErrors(fe); setDups(res.duplicates ?? []); setBanner({ tone: 'err', text: res.message });
        if (res.fieldErrors?.length) setStep(stepOf(res.fieldErrors[0].path));
      }
    });
  }

  const tr = v.tr[lang];
  const LangTabs = (
    <div role="group" aria-label="Content language" className="flex flex-wrap gap-2">
      {CONTENT_LANGS.map(([c, n]) => <button key={c} type="button" aria-pressed={lang === c} onClick={() => setLang(c)}
        className={`h-11 rounded-lg border px-4 font-semibold ${lang === c ? 'border-forest-900 bg-forest-900 text-cream-50' : 'border-[#7F9288] bg-white'}`}>{n}{v.tr[c].name.trim() ? ' ✓' : ''}</button>)}
    </div>
  );
  const draftish = v.status === 'draft' || v.status === 'pending';

  return (
    <div>
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Steps">
        {visible.map((i) => {
          const n = STEPS[i];
          const bad = Object.keys(errors).some((k) => (k.startsWith('tr.') ? 0 : stepOf(k)) === i);
          return <li key={n}><button type="button" onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined}
            className={`flex h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${step === i ? 'border-forest-900 bg-forest-900 text-cream-50' : bad ? 'border-[#B3261E] bg-[#FCEDEA] text-[#8A1F11]' : 'border-[#7F9288] bg-white'}`}>
            <span className="grid size-6 place-items-center rounded-full bg-white/20 text-xs">{i + 1}</span>{n}{bad && <span className="sr-only"> (has errors)</span>}</button></li>;
        })}
      </ol>

      {banner && <p role={banner.tone === 'err' ? 'alert' : 'status'} className={`mb-5 rounded-lg p-3 text-sm ${banner.tone === 'err' ? 'bg-[#FCEDEA] text-[#8A1F11]' : 'bg-mint-100 text-forest-900'}`}>{banner.text}</p>}
      {dups.length > 0 && (
        <div role="alert" className="mb-5 rounded-xl border border-[#E2B95B] bg-[#FBF0D9] p-4 text-sm">
          <p className="font-semibold text-bronze">Possible duplicate schools found. Review them before saving.</p>
          <ul className="mt-2 list-disc ps-5">{dups.map((d) => <li key={d.school_id}><Link className="underline" target="_blank" href={`/admin/schools/${d.school_id}`}>{d.matched_name}</Link> <span className="text-muted">({d.reasons.join(', ').replaceAll('_', ' ')})</span></li>)}</ul>
          <button type="button" disabled={pending} onClick={() => submit(v.status, true)} className="mt-3 h-11 rounded-lg border-[1.5px] border-bronze px-4 font-semibold text-bronze">This is a different school, save anyway</button>
        </div>
      )}

      <section aria-labelledby="step-title" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="step-title" className="mb-5 text-xl font-semibold text-forest-900">Step {step + 1}: {STEPS[step]}</h2>

        {step === 0 && <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">{LangTabs}</div>
          <Field label={`School name (${lang.toUpperCase()})`} id="name" error={err(`translations.${trIdx(lang)}.name`) ?? err(`tr.${lang}.name`) ?? (lang === 'en' ? err('translations') : undefined)}>
            <input {...a11y('name', `tr.${lang}.name`)} {...L('name')} className={inputCls} value={tr.name} maxLength={200}
              onChange={(e) => { setTr('name', e.target.value); if (lang === 'en' && !slugTouched) set('slug', slugify(e.target.value)); }} /></Field>
          <Field label="URL name" id="slug" error={err('slug')} hint="Used in the web address, e.g. al-noor-islamic-school. Lowercase letters, numbers and hyphens.">
            <input {...a11y('slug', 'slug')} disabled={portal} className={inputCls} value={v.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }} /></Field>
          <div className="md:col-span-2"><Field label={`Description (${lang.toUpperCase()})`} id="desc" error={err('description')}>
            <textarea id="desc" {...L('description')} className={areaCls} value={tr.description} maxLength={5000} onChange={(e) => setTr('description', e.target.value)} /></Field></div>
          <div className="md:col-span-2"><Field label={`Admission information (${lang.toUpperCase()})`} id="adm">
            <textarea id="adm" {...L('admission_information')} className={areaCls} value={tr.admission_information} maxLength={5000} onChange={(e) => setTr('admission_information', e.target.value)} /></Field></div>
          <Field label="School type" id="type"><select id="type" className={inputCls} value={v.school_type_id} onChange={(e) => set('school_type_id', e.target.value)}><option value="">Not set</option>{lookups.schoolTypes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
          <p className="self-end text-sm text-muted">The logo and photos are added in step 7{schoolId ? '' : ' after the first save'}.</p>
        </div>}

        {step === 1 && <div className="grid gap-5 md:grid-cols-2">
          <Field label="Country" id="country" error={err('country_id')}><select {...a11y('country', 'country_id')} disabled={portal} className={inputCls} value={v.country_id}
            onChange={(e) => { const c = lookups.countries.find((x) => String(x.id) === e.target.value); setV((p) => ({ ...p, country_id: e.target.value, region_id: '', city_id: '', currency_code: p.currency_code || c?.currency || '' })); }}>
            <option value="">Select country</option>{lookups.countries.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
          <Field label="Region / state" id="region" error={err('region_id')}><select id="region" className={inputCls} value={v.region_id} disabled={portal || !regions.length} onChange={(e) => setV((p) => ({ ...p, region_id: e.target.value, city_id: '' }))}>
            <option value="">{regions.length ? 'Not set' : 'No regions for this country'}</option>{regions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
          <Field label="City" id="city" error={err('city_id')} hint="Missing a city? Ask a Super Admin to add it under categories."><select {...a11y('city', 'city_id')} className={inputCls} value={v.city_id} disabled={portal || !v.country_id} onChange={(e) => set('city_id', e.target.value)}>
            <option value="">Select city</option>{cities.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
          <Field label="Postal code" id="zip"><input id="zip" className={inputCls} value={v.postal_code} maxLength={20} onChange={(e) => set('postal_code', e.target.value)} /></Field>
          <div className="md:col-span-2"><Field label="Street address" id="addr"><input id="addr" className={inputCls} value={v.address} maxLength={500} onChange={(e) => set('address', e.target.value)} /></Field></div>
          <Field label="Latitude" id="lat" error={err('latitude')}><input {...a11y('lat', 'latitude')} inputMode="decimal" className={inputCls} value={v.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="e.g. 3.1390" /></Field>
          <Field label="Longitude" id="lng" error={err('longitude')}><input {...a11y('lng', 'longitude')} inputMode="decimal" className={inputCls} value={v.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="e.g. 101.6869" /></Field>
          {v.latitude && v.longitude && !isNaN(+v.latitude) && !isNaN(+v.longitude) && Math.abs(+v.latitude) <= 90 && Math.abs(+v.longitude) <= 180 && (
            <div className="md:col-span-2"><iframe title="Map preview" loading="lazy" className="h-64 w-full rounded-xl border border-line"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${+v.longitude - 0.01},${+v.latitude - 0.006},${+v.longitude + 0.01},${+v.latitude + 0.006}&layer=mapnik&marker=${v.latitude},${v.longitude}`} /></div>)}
        </div>}

        {step === 2 && <div className="grid gap-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Gender" id="gender"><select id="gender" className={inputCls} value={v.gender_policy} onChange={(e) => set('gender_policy', e.target.value)}><option value="">Not set</option><option value="mixed">Mixed</option><option value="boys">Boys only</option><option value="girls">Girls only</option></select></Field>
          </div>
          <Checks legend="Grade levels" options={lookups.gradeLevels} value={v.grade_level_ids} onChange={(x) => set('grade_level_ids', x)} />
          <Checks legend="Curriculum" options={lookups.curricula} value={v.curriculum_ids} onChange={(x) => set('curriculum_ids', x)} />
          <Checks legend="Languages of instruction" options={lookups.languages.map((l) => ({ id: l.code, label: l.label }))} value={v.language_codes} onChange={(x) => set('language_codes', x)} />
          <div className="grid gap-1 md:grid-cols-3"><Toggle label="Islamic studies" checked={v.offers_islamic_studies} onChange={(b) => set('offers_islamic_studies', b)} /><Toggle label="Quran programme" checked={v.offers_quran} onChange={(b) => set('offers_quran', b)} /><Toggle label="Arabic language" checked={v.offers_arabic} onChange={(b) => set('offers_arabic', b)} /></div>
          <div className="grid gap-5">{LangTabs}
            <Field label={`Islamic studies description (${lang.toUpperCase()})`} id="isl"><textarea id="isl" {...L('islamic_studies_description')} className={areaCls} value={tr.islamic_studies_description} onChange={(e) => setTr('islamic_studies_description', e.target.value)} /></Field>
            <Field label={`Quran description (${lang.toUpperCase()})`} id="qur"><textarea id="qur" {...L('quran_description')} className={areaCls} value={tr.quran_description} onChange={(e) => setTr('quran_description', e.target.value)} /></Field>
            <Field label={`Arabic description (${lang.toUpperCase()})`} id="arb"><textarea id="arb" {...L('arabic_description')} className={areaCls} value={tr.arabic_description} onChange={(e) => setTr('arabic_description', e.target.value)} /></Field>
          </div>
        </div>}

        {step === 3 && <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Currency (3-letter code)" id="cur" error={err('currency_code')} hint="Applies to all fees below, e.g. MYR, GBP, SAR."><input {...a11y('cur', 'currency_code')} className={`${inputCls} uppercase`} maxLength={3} value={v.currency_code} onChange={(e) => set('currency_code', e.target.value.toUpperCase())} /></Field>
            <div className="self-end"><Toggle label="Scholarships available" checked={v.scholarships_available} onChange={(b) => set('scholarships_available', b)} /></div>
          </div>
          {v.fees.map((f, i) => (
            <div key={f.id ?? i} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[1fr_1fr_140px_140px_auto] md:items-end">
              <Field label="Fee type" id={`fc${i}`} error={err(`fees.${i}.fee_category_id`)}><select id={`fc${i}`} className={inputCls} value={f.fee_category_id} onChange={(e) => set('fees', v.fees.map((x, j) => j === i ? { ...x, fee_category_id: e.target.value } : x))}><option value="">Select</option>{lookups.feeCategories.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
              <Field label="Grade (optional)" id={`fg${i}`}><select id={`fg${i}`} className={inputCls} value={f.grade_level_id} onChange={(e) => set('fees', v.fees.map((x, j) => j === i ? { ...x, grade_level_id: e.target.value } : x))}><option value="">All grades</option>{lookups.gradeLevels.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
              <Field label="Amount" id={`fa${i}`} error={err(`fees.${i}.amount`)}><input id={`fa${i}`} inputMode="decimal" className={inputCls} value={f.amount} onChange={(e) => set('fees', v.fees.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} /></Field>
              <Field label="Per" id={`fp${i}`}><select id={`fp${i}`} className={inputCls} value={f.period} onChange={(e) => set('fees', v.fees.map((x, j) => j === i ? { ...x, period: e.target.value } : x))}><option value="year">Year</option><option value="term">Term</option><option value="month">Month</option><option value="one_time">One time</option></select></Field>
              <button type="button" onClick={() => set('fees', v.fees.filter((_, j) => j !== i))} className="h-12 rounded-lg border border-[#7F9288] px-4 font-semibold">Remove</button>
            </div>))}
          <button type="button" onClick={() => set('fees', [...v.fees, { fee_category_id: String(lookups.feeCategories.find((c) => c.label === 'Tuition')?.id ?? ''), grade_level_id: '', amount: '', period: 'year' }])} className="h-11 self-start rounded-lg border-[1.5px] border-forest-900 px-4 font-semibold text-forest-900">Add fee</button>
        </div>}

        {step === 4 && <div className="grid gap-6">
          <Checks legend="Facilities" options={lookups.facilities} value={v.facility_ids} onChange={(x) => set('facility_ids', x)} />
          <div className="grid gap-1 md:grid-cols-2"><Toggle label="Boarding available" checked={v.has_boarding} onChange={(b) => set('has_boarding', b)} /><Toggle label="Transportation available" checked={v.has_transport} onChange={(b) => set('has_transport', b)} /></div>
        </div>}

        {step === 5 && <div className="grid gap-5 md:grid-cols-2">
          <Field label="Phone" id="phone" error={err('phone')}><input {...a11y('phone', 'phone')} type="tel" className={inputCls} value={v.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Email" id="email" error={err('email')}><input {...a11y('email', 'email')} type="email" className={inputCls} value={v.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Website" id="web" error={err('website')}><input {...a11y('web', 'website')} type="url" className={inputCls} value={v.website} placeholder="https://" onChange={(e) => set('website', e.target.value)} /></Field>
          <Field label="Admissions page" id="admurl" error={err('admissions_url')}><input {...a11y('admurl', 'admissions_url')} type="url" className={inputCls} value={v.admissions_url} placeholder="https://" onChange={(e) => set('admissions_url', e.target.value)} /></Field>
          <Field label="Founded (year)" id="year" error={err('founded_year')}><input {...a11y('year', 'founded_year')} inputMode="numeric" className={inputCls} value={v.founded_year} onChange={(e) => set('founded_year', e.target.value)} /></Field>
          <Field label="Student capacity" id="cap" error={err('student_capacity')}><input {...a11y('cap', 'student_capacity')} inputMode="numeric" className={inputCls} value={v.student_capacity} onChange={(e) => set('student_capacity', e.target.value)} /></Field>
          {SOCIALS.map((s) => <Field key={s} label={`${s[0].toUpperCase()}${s.slice(1)} link`} id={`soc-${s}`} error={err(`social_links.${s}`)}><input id={`soc-${s}`} type="url" className={inputCls} placeholder="https://" value={v.social[s] ?? ''} onChange={(e) => set('social', { ...v.social, [s]: e.target.value })} /></Field>)}
        </div>}

        {step === 6 && (mediaSlot ?? <p className="rounded-lg bg-[#F6F4EC] p-4 text-muted">Save the school first (use <b>Save draft</b>), then come back to this step to upload the logo and photos.</p>)}

        {step === 7 && <div className="grid gap-5 md:grid-cols-2">
          <Field label="Publication status" id="status" hint="Only Active schools appear on the public website. Archived schools stay in the database."><select id="status" className={inputCls} value={v.status} onChange={(e) => set('status', e.target.value)}>
            <option value="draft">Draft</option><option value="pending">Pending review</option><option value="active">Active (published)</option><option value="suspended">Suspended</option><option value="archived">Archived</option></select></Field>
          <Field label="Verification level" id="vs" hint={canVerify ? undefined : 'Only verification managers can change this.'}><select id="vs" disabled={!canVerify} className={inputCls} value={v.verification_status} onChange={(e) => set('verification_status', e.target.value)}>
            <option value="community_added">Community added</option><option value="information_checked">Information checked</option><option value="school_verified">School verified</option><option value="school_managed">School managed</option></select></Field>
          <Field label="Verification source" id="vsrc"><input id="vsrc" disabled={!canVerify} className={inputCls} value={v.verification_source} maxLength={300} onChange={(e) => set('verification_source', e.target.value)} placeholder="e.g. School website, phone call, ministry list" /></Field>
          <Field label="Verification notes" id="vnotes"><textarea id="vnotes" disabled={!canVerify} className={areaCls} value={v.verification_notes} maxLength={2000} onChange={(e) => set('verification_notes', e.target.value)} /></Field>
        </div>}
      </section>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-cream-50 py-4">
        <div className="flex gap-2">
          <Link href={portal ? '/portal' : '/admin/schools'} className="flex h-12 items-center rounded-xl border border-[#7F9288] px-5 font-semibold">{portal ? 'Back to my schools' : 'Cancel'}</Link>
          <button type="button" disabled={visible.indexOf(step) <= 0} onClick={() => setStep(visible[visible.indexOf(step) - 1])} className="h-12 rounded-xl border border-[#7F9288] px-5 font-semibold disabled:opacity-40">Back</button>
          <button type="button" disabled={visible.indexOf(step) >= visible.length - 1} onClick={() => setStep(visible[visible.indexOf(step) + 1])} className="h-12 rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900 disabled:opacity-40">Next</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending && <span role="status" className="text-sm text-muted">Saving…</span>}
          {portal && !preview ? null : preview ? <a href={preview} target="_blank" rel="noreferrer" className="flex h-12 items-center rounded-xl border border-[#7F9288] px-5 font-semibold">Preview</a> : <span className="text-xs text-muted">Preview is available after the first save</span>}
          {!portal && draftish && <button type="button" disabled={pending} onClick={() => submit('draft')} className="h-12 rounded-xl border-[1.5px] border-forest-900 px-5 font-semibold text-forest-900">Save draft</button>}
          {!portal && draftish ? <button type="button" disabled={pending} onClick={() => submit('active')} className="h-12 rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">Publish</button>
            : <button type="button" disabled={pending} onClick={() => submit(v.status)} className="h-12 rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 hover:bg-[#14503F]">Save changes</button>}
        </div>
      </div>
    </div>
  );
}
