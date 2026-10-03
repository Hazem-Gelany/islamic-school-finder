import { requirePermission } from '@/lib/auth';
import { toCsv } from '@/lib/csv';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requirePermission('imports.manage');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const { data } = await supabase.from('import_rows').select('row_number, state, raw, errors').eq('job_id', id).in('state', ['invalid', 'duplicate']).order('row_number');
  const out: (string | number)[][] = [['spreadsheet_row', 'type', 'school', 'field', 'problem']];
  for (const r of data ?? []) {
    const src = (r.raw.source ?? {}) as Record<string, string>;
    const name = r.raw.name_primary ?? src.name_en ?? src.name_ar ?? src.name_ms ?? src.slug ?? '';
    for (const e of r.errors as { field: string; message: string }[]) out.push([r.row_number, r.state, name, e.field, e.message]);
  }
  return new Response(toCsv(out), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="import-problems.csv"`, 'cache-control': 'no-store' } });
}
