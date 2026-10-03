import { requirePermission } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { EXPORT_COLUMNS } from '@/features/import/columns';

const CHUNK = 1000, MAX = 50000;

export async function GET(req: Request) {
  const { supabase } = await requirePermission('schools.read_all');
  const u = new URL(req.url);
  const status = ['draft', 'pending', 'active', 'archived', 'suspended'].includes(u.searchParams.get('status') ?? '') ? u.searchParams.get('status') : null;
  const country = /^[a-z0-9-]{1,80}$/.test(u.searchParams.get('country') ?? '') ? u.searchParams.get('country') : null;
  const search = (u.searchParams.get('q') ?? '').trim().slice(0, 120) || null;
  const rows: (string | number | boolean | null)[][] = [[...EXPORT_COLUMNS]];
  for (let off = 0; off < MAX; off += CHUNK) {
    const { data, error } = await supabase.rpc('export_schools', { p_status: status, p_country: country, p_search: search, p_limit: CHUNK, p_offset: off });
    if (error) return new Response('Unable to export right now.', { status: 500 });
    (data as Record<string, string | number | boolean | null>[]).forEach((r) => rows.push(EXPORT_COLUMNS.map((c) => r[c] ?? null)));
    if ((data as unknown[]).length < CHUNK) break;
  }
  return new Response(toCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="schools-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
}
