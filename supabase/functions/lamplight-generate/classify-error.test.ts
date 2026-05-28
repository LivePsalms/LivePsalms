import { describe, it, expect } from 'vitest';
import { classifyGenerateError } from './classify-error';

describe('classifyGenerateError', () => {
  it('classifies validators_failed', () => {
    expect(classifyGenerateError(new Error('validators_failed: cite invalid'))).toBe('validators_failed');
  });
  it('classifies no_embedding', () => {
    expect(classifyGenerateError(new Error('no_embedding for note'))).toBe('no_embedding');
  });
  it('classifies not_neighbor', () => {
    expect(classifyGenerateError(new Error('not_neighbor: similarity too low'))).toBe('not_neighbor');
  });
  it('classifies network', () => {
    expect(classifyGenerateError(new Error('network error'))).toBe('network');
  });
  it('falls back to unknown', () => {
    expect(classifyGenerateError(new Error('something else'))).toBe('unknown');
  });
});
