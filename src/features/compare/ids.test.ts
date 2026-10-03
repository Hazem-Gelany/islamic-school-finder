import { describe, expect, it } from 'vitest';
import { parseCompareIds } from './ids';

const a = '11111111-1111-1111-1111-111111111111', b = '22222222-2222-2222-2222-222222222222';
describe('parseCompareIds', () => {
  it('keeps valid ids in order and removes duplicates', () => expect(parseCompareIds(`${a},${b},${a}`)).toEqual([a, b]));
  it('drops anything that is not a uuid', () => expect(parseCompareIds(`${a},1;drop table schools,,abc`)).toEqual([a]));
  it('limits to four', () => expect(parseCompareIds(Array.from({ length: 6 }, (_, i) => `${i}${i}${i}${i}${i}${i}${i}${i}-1111-1111-1111-111111111111`).join(','))).toHaveLength(4));
  it('handles missing input', () => expect(parseCompareIds(undefined)).toEqual([]));
});
