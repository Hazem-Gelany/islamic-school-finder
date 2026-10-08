import { getFacets } from '@/lib/data/public';
import { guard, ok, options } from '@/lib/api';

export const OPTIONS = options;

/** GET /api/v1/facets — the filter options that exist in the data (countries, cities, curricula, grades, facilities, languages, accreditations) with school counts. */
export async function GET() {
  const limited = await guard(); if (limited) return limited;
  return ok(await getFacets(), undefined, 'public, s-maxage=300, stale-while-revalidate=900');
}
