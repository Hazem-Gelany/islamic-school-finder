import { describe, expect, it } from 'vitest';
import { activeKeys, evaluate, sortResults, type Candidate } from './engine';
import { parseSearch } from '../search/params';

const school = (o: Partial<Candidate> = {}): Candidate => ({
  id: '1', slug: 's', country_slug: 'malaysia', city_slug: 'kuala-lumpur', name: 'A', country_name: 'Malaysia', city_name: 'Kuala Lumpur', verification_status: 'community_added',
  gender_policy: 'mixed', offers_quran: true, offers_arabic: true, offers_islamic_studies: true, has_boarding: false, has_transport: true,
  tuition_annual_min: 12000, currency_code: 'MYR', grades: ['primary'], curricula: ['british'], languages: ['en', 'ar'], facilities: ['library'], distance_km: 4, ...o,
});
const prefs = (q: Record<string, string | string[]>) => parseSearch(q);

describe('match engine', () => {
  it('only counts the preferences the parent set', () => {
    expect(activeKeys(prefs({}))).toEqual([]);
    expect(activeKeys(prefs({ country: 'malaysia' }))).toEqual([]); // country narrows candidates, it is not a preference
    expect(activeKeys(prefs({ city: 'kuala-lumpur', quran: '1', feeMax: '15000' }))).toEqual(['location', 'budget', 'quran']);
  });
  it('explains the "8 of 10" example', () => {
    const p = prefs({ city: 'kuala-lumpur', lat: '3.1', lng: '101.6', radius: '2', grade: 'primary', feeMax: '15000', curriculum: 'british', gender: 'mixed', quran: '1', arabic: '1', transport: '1', boarding: '1' });
    const r = evaluate(school(), p, { currency: 'MYR' });
    expect(r.total).toBe(10);
    expect(r.matched).toBe(8);
    expect(r.criteria.filter((c) => c.status === 'no').map((c) => c.key).sort()).toEqual(['boarding', 'distance']);
  });
  it('treats missing school information as unknown, not as a failure or a pass', () => {
    const r = evaluate(school({ tuition_annual_min: null, grades: [], gender_policy: null, distance_km: null }), prefs({ feeMax: '9000', grade: 'primary', gender: 'boys', lat: '3', lng: '101' }));
    expect(r.criteria.map((c) => c.status)).toEqual(['unknown', 'unknown', 'unknown', 'unknown']);
    expect(r.matched).toBe(0);
  });
  it('does not compare fees across different currencies', () => {
    expect(evaluate(school({ currency_code: 'GBP' }), prefs({ feeMax: '50000' }), { currency: 'MYR' }).criteria[0].status).toBe('unknown');
  });
  it('requires every selected facility', () => {
    expect(evaluate(school({ facilities: ['library'] }), prefs({ facilities: ['library', 'laboratory'] })).criteria[0].status).toBe('no');
    expect(evaluate(school({ facilities: ['library', 'laboratory'] }), prefs({ facilities: ['library', 'laboratory'] })).criteria[0].status).toBe('match');
  });
  it('sorts by preferences met, then alphabetically, ignoring verification level', () => {
    const p = prefs({ quran: '1' });
    const list = [school({ id: '1', name: 'Zed', verification_status: 'school_managed' }), school({ id: '2', name: 'Alpha', offers_quran: false }), school({ id: '3', name: 'Beta' })]
      .map((c) => ({ c, r: evaluate(c, p) }));
    expect(sortResults(list, 'en').map((x) => x.c.name)).toEqual(['Beta', 'Zed', 'Alpha']);
  });
});
