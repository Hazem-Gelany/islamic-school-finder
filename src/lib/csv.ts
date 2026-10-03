/** Minimal RFC 4180 reader/writer (comma separated, UTF-8, quotes, embedded newlines). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Spreadsheet programs run cells that start with = + - @ as formulas. Prefix them so exported data can never execute. */
export const guardCell = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
export const unguardCell = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

export type Cell = string | number | boolean | null | undefined;
export function toCsv(rows: Cell[][]): string {
  const esc = (c: Cell) => {
    if (c === null || c === undefined) return '';
    const s = typeof c === 'string' ? guardCell(c) : String(c);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}
