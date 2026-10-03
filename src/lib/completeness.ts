type R = Record<string, any>;
/** Share of key profile fields that are filled in (0-100). */
export function completeness(s: R) {
  const tr = (code: string) => (s.translations ?? []).find((t: R) => t.language_code === code);
  const checks = [
    !!tr('en')?.name, !!(tr('en')?.description), !!tr('ar')?.name, !!tr('ms')?.name,
    s.latitude != null && s.longitude != null, !!s.address, !!(s.phone || s.email), !!s.website,
    (s.curriculum_ids ?? []).length > 0, (s.grade_level_ids ?? []).length > 0, (s.fees ?? []).length > 0,
    (s.facility_ids ?? []).length > 0, (s.media ?? []).length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
