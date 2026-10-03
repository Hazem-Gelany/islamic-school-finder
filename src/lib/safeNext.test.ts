import { describe, expect, it } from 'vitest';
import { safeNext } from './safeNext';

describe('safeNext', () => {
  it('keeps same-site paths with queries', () => expect(safeNext('/en/schools?country=malaysia')).toBe('/en/schools?country=malaysia'));
  it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/en\r\nSet-Cookie: x', '', null, undefined, 'evil.com/path'])('rejects %s', (v) => expect(safeNext(v as string)).toBe('/en'));
  it('uses the fallback you give it', () => expect(safeNext('//x', '/ar/account')).toBe('/ar/account'));
});
