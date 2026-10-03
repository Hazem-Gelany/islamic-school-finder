import { requirePermission } from '@/lib/auth';
import { Flash } from '@/components/admin/Flash';
import { ConfirmButton } from '@/components/admin/bits';
import { CATEGORY_TABLES } from '@/features/settings/constants';
import { deleteCategory, saveCategory } from './actions';

const inp = 'h-10 w-full rounded-lg border border-[#B9C4BD] px-2 text-[15px]';

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePermission('categories.manage');
  const tables = Object.keys(CATEGORY_TABLES) as (keyof typeof CATEGORY_TABLES)[];
  const data = await Promise.all(tables.map((t) => supabase.from(t).select('id, code, name_i18n, sort_order, is_active').order('sort_order').order('code')));
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-forest-900">Categories</h1>
      <p className="mb-6 max-w-2xl text-muted">These lists feed the school form, the filters and the comparison. Names can be given in English, Arabic and Malay. An item that schools already use can be hidden (untick Active) but not deleted.</p>
      <Flash msg={sp.msg} error={sp.error} />
      <div className="space-y-10">
        {tables.map((t, i) => (
          <section key={t} aria-labelledby={`h-${t}`}>
            <h2 id={`h-${t}`} className="mb-3 text-xl font-semibold">{CATEGORY_TABLES[t]}</h2>
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-[860px] text-sm">
                <caption className="sr-only">{CATEGORY_TABLES[t]}</caption>
                <thead className="border-b border-line bg-[#F6F4EC] text-muted"><tr>{['Code', 'English', 'العربية', 'Malay', 'Order', 'Active', ''].map((h) => <th key={h} scope="col" className="px-2 py-2 text-start font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {(data[i].data ?? []).map((r: any) => (
                    <tr key={r.id}>
                      <td colSpan={7} className="p-0">
                        <form action={saveCategory} className="grid grid-cols-[1.1fr_1.3fr_1.3fr_1.3fr_70px_60px_150px] items-center gap-2 p-2">
                          <input type="hidden" name="table" value={t} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="code" value={r.code} />
                          <code className="truncate">{r.code}</code>
                          <input aria-label="English name" name="en" defaultValue={r.name_i18n.en} className={inp} required />
                          <input aria-label="Arabic name" name="ar" dir="rtl" lang="ar" defaultValue={r.name_i18n.ar ?? ''} className={inp} />
                          <input aria-label="Malay name" name="ms" defaultValue={r.name_i18n.ms ?? ''} className={inp} />
                          <input aria-label="Order" name="sort_order" type="number" min={0} defaultValue={r.sort_order} className={inp} />
                          <input aria-label="Active" name="is_active" type="checkbox" defaultChecked={r.is_active} className="size-5 justify-self-center" />
                          <span className="flex gap-2"><button className="h-10 rounded-lg border-[1.5px] border-forest-900 px-3 font-semibold text-forest-900 hover:bg-mint-100">Save</button>
                            <ConfirmButton message="Delete this item?" formAction={deleteCategory} className="h-10 rounded-lg border border-[#B9C4BD] px-3 hover:bg-[#FCEDEA]">Delete</ConfirmButton></span>
                        </form>
                      </td>
                    </tr>))}
                  <tr className="bg-[#FBFAF5]">
                    <td colSpan={7} className="p-0">
                      <form action={saveCategory} className="grid grid-cols-[1.1fr_1.3fr_1.3fr_1.3fr_70px_60px_150px] items-center gap-2 p-2">
                        <input type="hidden" name="table" value={t} />
                        <input aria-label="New code" name="code" placeholder="new_code" className={inp} required pattern="[a-z0-9_]+" title="Lowercase letters, numbers and underscores" />
                        <input aria-label="English name" name="en" placeholder="English name" className={inp} required />
                        <input aria-label="Arabic name" name="ar" dir="rtl" lang="ar" placeholder="الاسم بالعربية" className={inp} />
                        <input aria-label="Malay name" name="ms" placeholder="Nama Melayu" className={inp} />
                        <input aria-label="Order" name="sort_order" type="number" min={0} defaultValue={0} className={inp} />
                        <input aria-label="Active" name="is_active" type="checkbox" defaultChecked className="size-5 justify-self-center" />
                        <button className="h-10 rounded-lg bg-forest-900 px-3 font-semibold text-cream-50">Add</button>
                      </form>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>))}
      </div>
    </>
  );
}
