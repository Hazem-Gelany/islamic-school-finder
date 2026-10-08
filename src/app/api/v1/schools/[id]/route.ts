import type { NextRequest } from 'next/server';
import { getCompare } from '@/lib/data/public';
import { fail, guard, ok, options } from '@/lib/api';

export const OPTIONS = options;

/** GET /api/v1/schools/{id} — one published school, including all translations. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await guard(); if (limited) return limited;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail(400, 'invalid_id', 'The school id must be a UUID.');
  const [school] = await getCompare([id.toLowerCase()]);
  return school ? ok(school) : fail(404, 'not_found', 'No published school has this id.');
}
