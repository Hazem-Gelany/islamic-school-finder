import { requirePermission } from '@/lib/auth';
import { getLookups } from '@/lib/data/lookups';
import { SchoolForm } from '@/components/admin/SchoolForm';
import { emptyValues } from '@/components/admin/schoolFormModel';

export default async function NewSchool() {
  const { supabase, perms } = await requirePermission('schools.write');
  const lookups = await getLookups(supabase);
  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold text-forest-900">Add school</h1>
      <SchoolForm schoolId={null} initial={emptyValues()} lookups={lookups} canVerify={perms.includes('verification.write')} />
    </>
  );
}
