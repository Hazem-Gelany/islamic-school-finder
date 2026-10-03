import { describe, expect, it } from 'vitest';
import { guardCell, parseCsv, toCsv, unguardCell } from './csv';

describe('csv', () => {
  it('parses quotes, commas, embedded newlines and a BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x,1","he said ""hi"""\n"line1\nline2",\n')).toEqual([['a', 'b'], ['x,1', 'he said "hi"'], ['line1\nline2', '']]);
  });
  it('handles a missing final newline and blank trailing fields', () => expect(parseCsv('a,b,\n1,2,')).toEqual([['a', 'b', ''], ['1', '2', '']]));
  it('round-trips arabic text and special characters', () => {
    const rows = [['name', 'note'], ['مدرسة النور', 'a "quoted", value\nsecond line']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it('neutralises spreadsheet formulas on export and restores them on import', () => {
    expect(guardCell('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(unguardCell(guardCell('+60 3 1234 5678'))).toBe('+60 3 1234 5678');
    expect(unguardCell("'normal apostrophe")).toBe("'normal apostrophe");
    expect(toCsv([['=1+1', -6.2, true, null]])).toContain(`'=1+1,-6.2,true,`);
  });
});
