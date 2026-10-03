import { describe, expect, it } from 'vitest';
import { isFiltered, parseSearch, toQuery, toRpc } from './params';

describe('parseSearch', () => {
  it('parses valid filters', () => {
    const s = parseSearch({ country: 'malaysia', city: 'kuala-lumpur', curriculum: 'british', quran: '1', facilities: ['library', 'prayer_hall'], page: '2' });
    expect(s).toMatchObject({ country: 'malaysia', city: 'kuala-lumpur', curriculum: 'british', quran: true, page: 2 });
    expect(s.facilities).toEqual(['library', 'prayer_hall']);
  });
  it('drops malformed or malicious values', () => {
    const s = parseSearch({ country: "x'; drop table schools;--", gender: 'robots', lat: '999', feeMin: '-5', page: 'abc', sort: 'evil', facilities: ['ok', 'No Good!'] });
    expect(s.country).toBeUndefined(); expect(s.gender).toBeUndefined(); expect(s.lat).toBeUndefined(); expect(s.feeMin).toBeUndefined();
    expect(s.page).toBe(1); expect(s.sort).toBe('relevance'); expect(s.facilities).toEqual(['ok']);
  });
  it('needs both coordinates and defaults the radius', () => {
    expect(parseSearch({ lat: '3.1' }).lat).toBeUndefined();
    expect(parseSearch({ lat: '3.1', lng: '101.6' }).radius).toBe(25);
    expect(parseSearch({ sort: 'distance' }).sort).toBe('relevance');
  });
});

describe('helpers', () => {
  it('builds RPC args with nulls for unset filters', () => {
    const a = toRpc(parseSearch({ q: 'Islamic schools in Kuala Lumpur', page: '3' }), 'ar');
    expect(a).toMatchObject({ p_locale: 'ar', p_q: 'Islamic schools in Kuala Lumpur', p_country: null, p_offset: 24, p_facilities: null });
  });
  it('detects filtered pages', () => {
    expect(isFiltered(parseSearch({}))).toBe(false);
    expect(isFiltered(parseSearch({ page: '4' }))).toBe(false);
    expect(isFiltered(parseSearch({ grade: 'primary' }))).toBe(true);
    expect(isFiltered(parseSearch({ country: 'malaysia' }), ['country'])).toBe(false);
  });
  it('serialises without defaults', () => {
    expect(toQuery({ country: 'malaysia', page: 1, sort: 'relevance', quran: true, facilities: ['library'] })).toBe('country=malaysia&quran=1&facilities=library');
  });
});
