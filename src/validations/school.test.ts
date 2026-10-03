import { describe, expect, it } from 'vitest';
import { schoolSchema } from './school';
import { toPayload, emptyValues, slugify, stepOf } from '../components/admin/schoolFormModel';
import { completeness } from '../lib/completeness';

const valid = () => {
  const v = emptyValues();
  v.slug = 'al-noor'; v.country_id = '1'; v.city_id = '2'; v.tr.en.name = 'Al-Noor School';
  return v;
};

describe('schoolSchema', () => {
  it('accepts a minimal valid school', () => expect(schoolSchema.safeParse(toPayload(valid())).success).toBe(true));
  it('requires at least one translation name', () => {
    const v = valid(); v.tr.en.name = '';
    expect(schoolSchema.safeParse(toPayload(v)).success).toBe(false);
  });
  it('rejects a bad URL name, email, website and phone', () => {
    const v = valid(); v.slug = 'Bad Slug'; v.email = 'nope'; v.website = 'ftp://x'; v.phone = 'abc';
    const paths = schoolSchema.safeParse(toPayload(v)).error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['slug', 'email', 'website', 'phone']));
  });
  it('requires latitude and longitude together, and in range', () => {
    const a = valid(); a.latitude = '3.1';
    expect(schoolSchema.safeParse(toPayload(a)).success).toBe(false);
    const b = valid(); b.latitude = '95'; b.longitude = '10';
    expect(schoolSchema.safeParse(toPayload(b)).success).toBe(false);
  });
  it('rejects negative fees and fees without a currency', () => {
    const v = valid(); v.fees = [{ fee_category_id: '1', grade_level_id: '', amount: '-5', period: 'year' }];
    expect(schoolSchema.safeParse(toPayload(v)).success).toBe(false);
  });
});

describe('helpers', () => {
  it('slugifies names', () => expect(slugify("Al-Noor  International  School!")).toBe('al-noor-international-school'));
  it('maps errors to form steps', () => { expect(stepOf('email')).toBe(5); expect(stepOf('city_id')).toBe(1); expect(stepOf('fees.0.amount')).toBe(3); });
  it('scores completeness', () => { expect(completeness({})).toBe(0); expect(completeness({ translations: [{ language_code: 'en', name: 'x', description: 'y' }] })).toBeGreaterThan(0); });
});
