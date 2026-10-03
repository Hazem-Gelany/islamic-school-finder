type R = Record<string, any>;

/** Fields a school representative may publish directly (also enforced by a database trigger). Everything else is reviewed first. */
export const DIRECT = ['phone', 'email', 'website', 'admissions_url', 'social_links', 'scholarships_available', 'has_boarding', 'has_transport', 'offers_quran', 'offers_arabic', 'offers_islamic_studies', 'student_capacity'] as const;
const SCALARS = ['address', 'postal_code', 'gender_policy', 'school_type_id', 'founded_year'] as const;
const TR_FIELDS = ['name', 'description', 'admission_information', 'islamic_studies_description', 'quran_description', 'arabic_description'] as const;

const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const coord = (v: unknown) => (v === null || v === undefined || v === '' ? '' : Number(v).toFixed(6));
const clean = (o: R | null | undefined) => JSON.stringify(Object.entries(o ?? {}).filter(([, x]) => x !== '' && x != null).sort(([a], [b]) => a.localeCompare(b)));
const set = (a: unknown[] | undefined) => JSON.stringify([...(a ?? [])].map(String).sort());
const feeKey = (f: R) => `${f.fee_category_id}|${f.grade_level_id ?? ''}|${Number(f.amount)}|${f.currency_code}|${f.period}`;
const feeSet = (a: R[] | undefined) => JSON.stringify((a ?? []).map(feeKey).sort());

export type Changes = { direct: R; review: R; labels: string[] };

/** Compares the submitted form with the published school and sorts every difference into "publish now" or "needs review". */
export function computeChanges(cur: R, p: R): Changes {
  const direct: R = {}, review: R = {}, labels: string[] = [];
  for (const k of DIRECT) {
    const same = k === 'social_links' ? clean(cur[k]) === clean(p[k]) : norm(cur[k]) === norm(p[k]);
    if (!same) direct[k] = typeof p[k] === 'string' && p[k] === '' ? null : p[k];
  }
  for (const k of SCALARS) if (norm(cur[k]) !== norm(p[k])) { review[k] = typeof p[k] === 'string' && p[k] === '' ? null : p[k]; labels.push(k.replace('_', ' ')); }
  if (coord(cur.latitude) !== coord(p.latitude) || coord(cur.longitude) !== coord(p.longitude)) { review.latitude = p.latitude; review.longitude = p.longitude; labels.push('map location'); }

  const changedTr = ((p.translations ?? []) as R[]).filter((t) => {
    const old = ((cur.translations ?? []) as R[]).find((x) => x.language_code === t.language_code) ?? {};
    return TR_FIELDS.some((f) => norm(old[f]) !== norm(t[f]));
  });
  if (changedTr.length) { review.translations = changedTr; labels.push(...changedTr.map((t) => `text (${String(t.language_code).toUpperCase()})`)); }

  for (const [k, label] of [['curriculum_ids', 'curricula'], ['grade_level_ids', 'grade levels'], ['facility_ids', 'facilities'], ['language_codes', 'languages']] as const)
    if (set(cur[k]) !== set(p[k])) { review[k] = p[k]; labels.push(label); }
  if (feeSet(cur.fees) !== feeSet(p.fees)) { review.fees = p.fees; labels.push('fees'); if (norm(cur.currency_code) !== norm(p.currency_code)) review.currency_code = p.currency_code; }
  return { direct, review, labels };
}
