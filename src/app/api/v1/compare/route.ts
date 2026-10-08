import type { NextRequest } from 'next/server';
import { getCompare } from '@/lib/data/public';
import { parseCompareIds } from '@/features/compare/ids';
import { fail, guard, ok, options } from '@/lib/api';

export const OPTIONS = options;

/** GET /api/v1/compare?schools=id1,id2,id3 — up to four published schools in the order requested. */
export async function GET(req: NextRequest) {
  const limited = await guard(); if (limited) return limited;
  const ids = parseCompareIds(req.nextUrl.searchParams.get('schools') ?? undefined);
  if (ids.length < 1) return fail(400, 'invalid_request', 'Provide up to 4 school ids: ?schools=id1,id2');
  return ok(await getCompare(ids), { requested: ids.length });
}
