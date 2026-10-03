import { describe, expect, it } from 'vitest';
import { claimSchema, contactSchema, safeNext, signUpSchema, stripLocale } from './account';

describe('safeNext', () => {
  it('keeps same-site paths', () => expect(safeNext('/en/account?x=1')).toBe('/en/account?x=1'));
  it('rejects other sites and tricks', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', '/ok\nSet-Cookie: a=b', 'javascript:alert(1)', '/a://b', undefined, 42]) expect(safeNext(bad, '/x')).toBe('/x');
  });
});
describe('stripLocale', () => {
  it('removes only a leading locale', () => {
    expect(stripLocale('/ar/schools/a/b')).toBe('/schools/a/b');
    expect(stripLocale('/en')).toBe('/');
    expect(stripLocale('/english')).toBe('/english');
  });
});
describe('sign up', () => {
  it('needs a name, a valid email and 8+ characters', () => {
    expect(signUpSchema.safeParse({ displayName: 'Aisha', email: 'A@X.com', password: '12345678' }).success).toBe(true);
    expect(signUpSchema.safeParse({ displayName: 'A', email: 'a@x.com', password: '12345678' }).success).toBe(false);
    expect(signUpSchema.safeParse({ displayName: 'Aisha', email: 'nope', password: '12345678' }).success).toBe(false);
    expect(signUpSchema.safeParse({ displayName: 'Aisha', email: 'a@x.com', password: '1234567' }).success).toBe(false);
  });
});
describe('contact', () => {
  const ok = { schoolId: '11111111-1111-4111-8111-111111111111', name: 'Aisha Khan', phone: '', message: 'Do you have places in Year 3 for September?', consent: 'on' };
  it('accepts a normal message and drops an empty phone', () => { const r = contactSchema.parse(ok); expect(r.phone).toBeUndefined(); });
  it('requires consent and a real message', () => {
    expect(contactSchema.safeParse({ ...ok, consent: undefined }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, message: 'Hi' }).success).toBe(false);
  });
});
describe('claim', () => {
  const ok = { schoolId: '11111111-1111-4111-8111-111111111111', jobTitle: 'Principal', contactEmail: 'p@school.org', message: '', evidenceUrl: '' };
  it('allows an empty evidence link but not a non-http one', () => {
    expect(claimSchema.safeParse(ok).success).toBe(true);
    expect(claimSchema.safeParse({ ...ok, evidenceUrl: 'https://school.org/staff' }).success).toBe(true);
    expect(claimSchema.safeParse({ ...ok, evidenceUrl: 'javascript:alert(1)' }).success).toBe(false);
  });
});
