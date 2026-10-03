export const MAX_COMPARE = 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads /compare?schools=id1,id2,id3 safely: valid UUIDs only, no duplicates, at most four. */
export function parseCompareIds(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v.join(',') : v ?? '';
  return [...new Set(s.split(',').map((x) => x.trim().toLowerCase()).filter((x) => UUID.test(x)))].slice(0, MAX_COMPARE);
}
