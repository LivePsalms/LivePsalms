import { describe, it, expect } from 'vitest';
import { locateUncertainSpans } from './uncertain-decoration';

describe('locateUncertainSpans', () => {
  it('locates a single word', () => {
    expect(locateUncertainSpans('trust in the Lord', [{ text: 'trust' }]))
      .toEqual([{ from: 0, to: 5 }]);
  });

  it('uses context to pick the right repeated occurrence', () => {
    const text = 'grace and grace abound';
    expect(locateUncertainSpans(text, [{ text: 'grace', context: 'and grace abound' }]))
      .toEqual([{ from: 10, to: 15 }]);
  });

  it('falls back to the first occurrence when context is absent', () => {
    expect(locateUncertainSpans('grace and grace', [{ text: 'grace' }]))
      .toEqual([{ from: 0, to: 5 }]);
  });

  it('drops words it cannot find', () => {
    expect(locateUncertainSpans('hello world', [{ text: 'zzz' }])).toEqual([]);
  });
});
