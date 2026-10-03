import { requirePermission } from '@/lib/auth';
import { CSV_COLUMNS } from '@/features/import/columns';
import { toCsv } from '@/lib/csv';

const EXAMPLE: Record<string, string> = {
  status: 'draft', country: 'malaysia', city: 'kuala-lumpur', school_type: 'day_school', gender: 'mixed', address: '1 Jalan Contoh', latitude: '3.139', longitude: '101.6869',
  phone: '+60 3 1234 5678', email: 'info@example.org', website: 'https://example.org', has_boarding: 'no', has_transport: 'yes', offers_quran: 'yes', offers_arabic: 'yes', offers_islamic_studies: 'yes',
  scholarships_available: 'no', tuition_annual: '12000', curricula: 'british;cambridge_igcse', grade_levels: 'primary;lower_secondary', languages: 'en;ar', facilities: 'library;prayer_hall',
  name_en: 'Example Islamic School', name_ar: 'مدرسة المثال الإسلامية', description_en: 'A short description of the school.',
};
export async function GET() {
  await requirePermission('imports.manage');
  return new Response(toCsv([[...CSV_COLUMNS], CSV_COLUMNS.map((c) => EXAMPLE[c] ?? '')]), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="schools-import-template.csv"', 'cache-control': 'no-store' } });
}
