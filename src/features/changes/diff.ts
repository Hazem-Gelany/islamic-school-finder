export type Names = { curricula: Record<number, string>; gradeLevels: Record<number, string>; facilities: Record<number, string>; feeCategories: Record<number, string>; schoolTypes: Record<number, string>; languages: Record<string, string> };
export type DiffRow = { label: string; before: string; after: string };
type R = Record<string, any>;

const FIELDS: [string, string][] = [['name', 'Name'], ['description', 'Description'], ['admission_information', 'Admission information'], ['islamic_studies_description', 'Islamic studies'], ['quran_description', 'Quran'], ['arabic_description', 'Arabic']];
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
const names = (ids: number[] | undefined, map: Record<number, string>) => (ids ?? []).map((i) => map[i] ?? `#${i}`).sort().join(', ') || '—';
const feeLines = (fees: R[] | undefined, n: Names) => (fees ?? []).map((f) => `${n.feeCategories[f.fee_category_id] ?? 'Fee'}${f.grade_level_id ? ` (${n.gradeLevels[f.grade_level_id] ?? '#' + f.grade_level_id})` : ''}: ${Number(f.amount).toLocaleString('en')} ${f.currency_code} / ${f.period}`).sort().join('\n') || '—';

/** Human-readable before/after list for a reviewer. Only fields that really change are returned. */
export function diffChange(cur: R, payload: R, n: Names): DiffRow[] {
  const rows: DiffRow[] = [];
  const push = (label: string, before: string, after: string) => { if (before !== after) rows.push({ label, before, after }); };
  for (const [k, label] of [['address', 'Address'], ['postal_code', 'Postal code'], ['latitude', 'Latitude'], ['longitude', 'Longitude'], ['gender_policy', 'Gender'], ['founded_year', 'Founded'], ['currency_code', 'Currency']] as const)
    if (k in payload) push(label, show(cur[k]), show(payload[k]));
  if ('school_type_id' in payload) push('School type', show(n.schoolTypes[cur.school_type_id]), show(n.schoolTypes[payload.school_type_id]));
  for (const t of (payload.translations ?? []) as R[]) {
    const old = ((cur.translations ?? []) as R[]).find((x) => x.language_code === t.language_code) ?? {};
    for (const [f, label] of FIELDS) if (f in t) push(`${label} (${String(t.language_code).toUpperCase()})`, show(old[f]), show(t[f]));
  }
  if ('fees' in payload) push('Fees', feeLines(cur.fees, n), feeLines(payload.fees, n));
  if ('curriculum_ids' in payload) push('Curricula', names(cur.curriculum_ids, n.curricula), names(payload.curriculum_ids, n.curricula));
  if ('grade_level_ids' in payload) push('Grade levels', names(cur.grade_level_ids, n.gradeLevels), names(payload.grade_level_ids, n.gradeLevels));
  if ('facility_ids' in payload) push('Facilities', names(cur.facility_ids, n.facilities), names(payload.facility_ids, n.facilities));
  if ('language_codes' in payload) push('Languages of instruction', ((cur.language_codes ?? []) as string[]).map((c) => n.languages[c] ?? c).sort().join(', ') || '—', ((payload.language_codes ?? []) as string[]).map((c) => n.languages[c] ?? c).sort().join(', ') || '—');
  return rows;
}
