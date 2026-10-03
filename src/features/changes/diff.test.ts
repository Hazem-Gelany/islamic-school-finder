import { describe, expect, it } from 'vitest';
import { diffChange, type Names } from './diff';

const N: Names = { curricula: { 1: 'British', 2: 'IB' }, gradeLevels: { 5: 'Primary' }, facilities: {}, feeCategories: { 9: 'Tuition' }, schoolTypes: {}, languages: { en: 'English' } };
const cur = { address: '1 Old Rd', translations: [{ language_code: 'en', name: 'Al-Noor', description: 'Old text' }], fees: [{ fee_category_id: 9, amount: 18000, currency_code: 'MYR', period: 'year' }], curriculum_ids: [1] };

describe('diffChange', () => {
  it('lists only what really changes, with readable labels', () => {
    const rows = diffChange(cur, { address: '1 Old Rd', translations: [{ language_code: 'en', name: 'Al-Noor', description: 'New text' }, { language_code: 'ar', name: 'النور' }],
      fees: [{ fee_category_id: 9, amount: 19500, currency_code: 'MYR', period: 'year' }], curriculum_ids: [1, 2] }, N);
    expect(rows.map((r) => r.label)).toEqual(['Description (EN)', 'Name (AR)', 'Fees', 'Curricula']);
    expect(rows[0]).toMatchObject({ before: 'Old text', after: 'New text' });
    expect(rows[2]).toMatchObject({ before: 'Tuition: 18,000 MYR / year', after: 'Tuition: 19,500 MYR / year' });
    expect(rows[3]).toMatchObject({ before: 'British', after: 'British, IB' });
  });
  it('shows a dash for empty values and ignores identical payloads', () => {
    expect(diffChange(cur, { address: '9 New St', postal_code: '' }, N)).toEqual([{ label: 'Address', before: '1 Old Rd', after: '9 New St' }]);
    expect(diffChange(cur, { address: '1 Old Rd' }, N)).toEqual([]);
  });
});
