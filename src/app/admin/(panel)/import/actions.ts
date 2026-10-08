'use server';
import { requirePermission } from '@/lib/auth';
import { parseCsv } from '@/lib/csv';
import { done, fail } from '@/lib/flash';
import { isLimited } from '@/lib/rateLimit';
import { friendlyError } from '@/lib/errors';
import { getImportLookups } from '@/lib/data/importLookups';
import { REQUIRED_COLUMNS, rowToPayload } from '@/features/import/columns';

const MAX_BYTES = 2 * 1024 * 1024, MAX_ROWS = 2000, BATCH = 200;

export async function startImport(fd: FormData) {
  const { supabase, user } = await requirePermission('imports.manage');
  const back = '/admin/import';
  if (await isLimited([[`import:user:${user.id}`, 20, 3600]])) return fail(back, 'Too many imports in the last hour. Please wait and try again.');
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return fail(back, 'Choose a CSV file first.');
  if (!/\.csv$/i.test(file.name)) return fail(back, 'The file must be a .csv file (in Excel: Save as CSV UTF-8).');
  if (file.size > MAX_BYTES) return fail(back, 'The file is larger than 2 MB. Split it into smaller files.');

  const table = parseCsv(await file.text());
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length || !header.some((h) => h.startsWith('name_'))) return fail(back, `The first row must contain these column names: ${[...missing, ...(header.some((h) => h.startsWith('name_')) ? [] : ['name_en'])].join(', ')}. Download the template to see all columns.`);
  const lines = table.slice(1).map((r, i) => ({ n: i + 2, r })).filter(({ r }) => r.some((c) => c.trim()));
  if (!lines.length) return fail(back, 'The file has no data rows.');
  if (lines.length > MAX_ROWS) return fail(back, `The file has ${lines.length} rows. The limit is ${MAX_ROWS} per import.`);

  const lookups = await getImportLookups(supabase);
  const { data: job, error } = await supabase.from('import_jobs').insert({ filename: file.name.slice(0, 200), created_by: user.id }).select('id').single();
  if (error || !job) return fail(back, friendlyError(error, 'Unable to start the import.'));

  const staged = lines.map(({ n, r }) => {
    const obj = Object.fromEntries(header.map((h, j) => [h, r[j] ?? '']));
    const res = rowToPayload(obj, lookups, file.name);
    return res.ok
      ? { job_id: job.id, row_number: n, state: 'valid', raw: { ...res.payload, name_primary: res.name_primary }, errors: [] }
      : { job_id: job.id, row_number: n, state: 'invalid', raw: { source: obj }, errors: res.errors };
  });
  for (let i = 0; i < staged.length; i += BATCH) {
    const { error: e } = await supabase.from('import_rows').insert(staged.slice(i, i + BATCH));
    if (e) { await supabase.from('import_jobs').delete().eq('id', job.id); return fail(back, friendlyError(e, 'Unable to read the file. Nothing was imported.')); }
  }
  const { error: dupErr } = await supabase.rpc('import_mark_duplicates', { p_job: job.id });
  if (dupErr) { await supabase.from('import_jobs').delete().eq('id', job.id); return fail(back, friendlyError(dupErr, 'Unable to check for duplicates. Nothing was imported.')); }
  return done(`/admin/import/${job.id}`, 'File checked. Nothing has been imported yet.');
}

export async function commitImport(fd: FormData) {
  const { supabase } = await requirePermission('imports.manage');
  const id = String(fd.get('id') ?? ''), to = `/admin/import/${id}`;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('/admin/import', 'Import not found.');
  const { data, error } = await supabase.rpc('commit_import', { p_job: id });
  if (error) {
    const row = error.message.match(/^Row (\d+):/)?.[1];
    const text = row ? `Nothing was imported. Spreadsheet row ${row} could not be saved: ${friendlyError(error)}` : friendlyError(error, 'Nothing was imported. Please try again.');
    await supabase.from('import_jobs').update({ error_message: text }).eq('id', id);
    return fail(to, text);
  }
  return done(to, `${data} schools imported.`, ['/admin/schools', '/admin/dashboard']);
}

export async function discardImport(fd: FormData) {
  const { supabase } = await requirePermission('imports.manage');
  const id = String(fd.get('id') ?? '');
  const { error } = await supabase.from('import_jobs').delete().eq('id', id).neq('status', 'committed');
  if (error) return fail('/admin/import', friendlyError(error));
  return done('/admin/import', 'Import discarded.');
}
