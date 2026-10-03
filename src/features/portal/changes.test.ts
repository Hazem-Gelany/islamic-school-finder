import { describe, expect, it } from 'vitest';
import { computeChanges } from './changes';

const cur = {
  phone: '+60 3 1111 2222', email: null, website: 'https://a.example', social_links: { facebook: 'https://fb.com/a' }, has_boarding: false, student_capacity: 400, address: '1 Road', latitude: 3.1390000000000002, longitude: 101.6869,
  translations: [{ language_code: 'en', name: 'Al-Noor', description: 'Text', admission_information: null }, { language_code: 'ar', name: 'النور' }],
  fees: [{ id: 'x', fee_category_id: 9, grade_level_id: null, amount: '18000.00', currency_code: 'MYR', period: 'year' }], curriculum_ids: [1, 2], currency_code: 'MYR',
};
const same = () => ({ ...cur, email: '', social_links: { facebook: 'https://fb.com/a', x: '' }, latitude: 3.139, translations: cur.translations.map((t) => ({ ...t, admission_information: t.admission_information ?? '' })),
  fees: [{ fee_category_id: 9, grade_level_id: null, amount: 18000, currency_code: 'MYR', period: 'year' }], curriculum_ids: [2, 1] });

describe('computeChanges', () => {
  it('finds nothing when only formatting differs (empty vs null, number types, order, coordinate noise)', () => {
    expect(computeChanges(cur, same())).toEqual({ direct: {}, review: {}, labels: [] });
  });
  it('publishes contact details directly and leaves reviewed fields alone', () => {
    const r = computeChanges(cur, { ...same(), phone: '+60 3 9999 0000', has_boarding: true, email: 'hi@a.example', social_links: {} });
    expect(Object.keys(r.direct).sort()).toEqual(['email', 'has_boarding', 'phone', 'social_links']);
    expect(r.review).toEqual({}); expect(r.direct.phone).toBe('+60 3 9999 0000');
  });
  it('sends names, descriptions, fees, location and categories for review, with only the changed languages', () => {
    const p = same(); p.translations[0] = { ...p.translations[0], description: 'New text' }; p.fees[0].amount = 19500; p.curriculum_ids = [1]; p.address = '2 Road'; p.longitude = 101.7;
    const r = computeChanges(cur, p);
    expect(Object.keys(r.direct)).toEqual([]);
    expect(Object.keys(r.review).sort()).toEqual(['address', 'curriculum_ids', 'fees', 'latitude', 'longitude', 'translations']);
    expect((r.review.translations as unknown[]).length).toBe(1);
    expect(r.labels).toEqual(expect.arrayContaining(['fees', 'curricula', 'text (EN)', 'map location']));
  });
  it('sends a brand-new language for review', () => {
    const p = same(); p.translations.push({ language_code: 'ms', name: 'Al-Noor', description: '', admission_information: '' } as never);
    expect((computeChanges(cur, p).review.translations as { language_code: string }[]).map((t) => t.language_code)).toEqual(['ms']);
  });
});
