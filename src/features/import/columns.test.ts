import { describe, expect, it } from 'vitest';
import { rowToPayload, type ImportLookups } from './columns';

const L: ImportLookups = {
  countries: [{ id: 1, slug: 'malaysia', iso2: 'MY', name: 'Malaysia', currency: 'MYR' }],
  regions: [{ id: 5, country_id: 1, slug: 'selangor', name: 'Selangor' }],
  cities: [{ id: 2, country_id: 1, slug: 'kuala-lumpur', name: 'Kuala Lumpur' }],
  schoolTypes: { day_school: 3 }, curricula: { british: 7 }, gradeLevels: { primary: 9 }, facilities: { library: 4 }, languages: ['en', 'ar', 'ms'], tuitionCategoryId: 11,
};
const ok = { country: 'Malaysia', city: 'Kuala Lumpur', name_en: 'Al-Noor School' };

describe('rowToPayload', () => {
  it('builds a payload, deriving slug, status, currency and a tuition fee', () => {
    const r = rowToPayload({ ...ok, tuition_annual: '12,000', curricula: 'british', grade_levels: 'primary', has_boarding: 'Yes', name_ar: 'مدرسة النور' }, L, 'f.csv');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload).toMatchObject({ slug: 'al-noor-school', status: 'draft', country_id: 1, city_id: 2, has_boarding: true, currency_code: 'MYR', curriculum_ids: [7], verification_status: 'community_added' });
      expect(r.payload.fees).toEqual([{ fee_category_id: 11, amount: 12000, currency_code: 'MYR', period: 'year' }]);
      expect((r.payload.translations as unknown[]).length).toBe(2);
      expect(r.name_primary).toBe('Al-Noor School');
    }
  });
  it('accepts country by ISO code and city by slug', () => expect(rowToPayload({ ...ok, country: 'my', city: 'kuala-lumpur' }, L, 'f.csv').ok).toBe(true));
  it('reports every problem in the parent’s own column names', () => {
    const r = rowToPayload({ country: 'Atlantis', city: 'x', name_en: '' }, L, 'f.csv');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['country', 'name_en']));
  });
  it('flags unknown categories, bad numbers, emails and booleans', () => {
    const r = rowToPayload({ ...ok, curricula: 'british;klingon', latitude: 'abc', email: 'nope', offers_quran: 'maybe', gender: 'robots' }, L, 'f.csv');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['curricula', 'latitude', 'offers_quran', 'gender']));
  });
  it('catches an unknown city with a helpful message and a bad email via the shared schema', () => {
    const a = rowToPayload({ ...ok, city: 'Springfield' }, L, 'f.csv');
    expect(!a.ok && a.errors[0].message).toContain('Add it under Places');
    const b = rowToPayload({ ...ok, email: 'nope' }, L, 'f.csv');
    expect(!b.ok && b.errors.some((e) => e.field === 'email')).toBe(true);
  });
  it('restores phone numbers that the exporter protected against formulas', () => {
    const r = rowToPayload({ ...ok, phone: "'+60 3 1234 5678" }, L, 'f.csv');
    expect(r.ok && r.payload.phone).toBe('+60 3 1234 5678');
  });
  it('requires a slug when the name is not in Latin letters', () => {
    const r = rowToPayload({ country: 'Malaysia', city: 'Kuala Lumpur', name_ar: 'مدرسة النور' }, L, 'f.csv');
    expect(!r.ok && r.errors[0].field).toBe('slug');
  });
});
