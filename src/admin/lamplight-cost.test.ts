import { describe, it, expect } from 'vitest';
import { estCostCents, formatCents } from './lamplight-cost';

describe('lamplight-cost', () => {
  it('voyage-3-large: 1M in tokens → 18 cents', () => {
    expect(estCostCents('voyage-3-large', 1_000_000, 0)).toBe(18);
  });

  it('voyage-context-3: 1M in tokens → 18 cents', () => {
    expect(estCostCents('voyage-context-3', 1_000_000, 0)).toBe(18);
  });

  it('claude-sonnet-4-6: 1M in + 500k out → 1050 cents', () => {
    expect(estCostCents('claude-sonnet-4-6', 1_000_000, 500_000)).toBe(1050);
  });

  it('unknown model defaults to 0 cents', () => {
    expect(estCostCents('mystery-model', 9_999_999, 9_999_999)).toBe(0);
  });

  it('formatCents renders dollars with two decimals', () => {
    expect(formatCents(1050)).toBe('$10.50');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(7)).toBe('$0.07');
  });

  it('claude-haiku-4-5-20251001 alias resolves to the same rates as claude-haiku-4-5', () => {
    expect(estCostCents('claude-haiku-4-5-20251001', 1_000_000, 500_000))
      .toBe(estCostCents('claude-haiku-4-5', 1_000_000, 500_000));
  });
});
