import { describe, expect, it } from 'vitest';
import { amountSchema, nonceSchema, xlmToStroops, stroopsToXlm, MAX_AMOUNT } from '@aegispay/shared';

describe('exact financial inputs (TC-018)', () => {
  it('converts decimal XLM without floating point', () => {
    expect(xlmToStroops('0.03')).toBe(300000n);
    expect(stroopsToXlm(300000n)).toBe('0.0300000');
    expect(xlmToStroops(stroopsToXlm(MAX_AMOUNT))).toBe(MAX_AMOUNT);
  });
  it.each(['-1', '0', '1.00000001', '1e2', ' 1', '01.0', '.1'])('rejects invalid positive XLM %s', value => {
    expect(() => xlmToStroops(value)).toThrow();
  });
  it.each([0, 1, '0', '-1', '01', '1.1', (MAX_AMOUNT + 1n).toString()])('rejects invalid amount %s', value => {
    expect(amountSchema.safeParse(value).success).toBe(false);
  });
  it('bounds nonce to uint64 and never coerces a JSON number', () => {
    expect(nonceSchema.parse('18446744073709551615')).toBe('18446744073709551615');
    for (const value of ['18446744073709551616', '-1', 1]) expect(nonceSchema.safeParse(value).success).toBe(false);
  });
});
