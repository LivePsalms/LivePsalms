import { describe, it, expect } from 'vitest';
import { findAsset, filterAssets } from './asset-helpers';
import type { StyleAsset } from './manifest';

const A: StyleAsset[] = [
  { id: 'arrow-01', category: 'arrow', thumbUrl: 't1', displayUrl: 'd1', aspectRatio: 1 },
  { id: 'arrow-02', category: 'arrow', thumbUrl: 't2', displayUrl: 'd2', aspectRatio: 1 },
  { id: 'shape-01', category: 'shape', thumbUrl: 't3', displayUrl: 'd3', aspectRatio: 1 },
];

describe('findAsset', () => {
  it('returns the matching asset', () => {
    expect(findAsset(A, 'shape-01')?.id).toBe('shape-01');
  });
  it('returns undefined when missing', () => {
    expect(findAsset(A, 'nope')).toBeUndefined();
  });
});

describe('filterAssets', () => {
  it('filters by category', () => {
    expect(filterAssets(A, 'arrow', '').map((a) => a.id)).toEqual(['arrow-01', 'arrow-02']);
  });
  it("category 'all' returns everything", () => {
    expect(filterAssets(A, 'all', '')).toHaveLength(3);
  });
  it('search matches the id substring, case-insensitively', () => {
    expect(filterAssets(A, 'all', 'SHAPE').map((a) => a.id)).toEqual(['shape-01']);
  });
  it('combines category and search', () => {
    expect(filterAssets(A, 'arrow', '02').map((a) => a.id)).toEqual(['arrow-02']);
  });
});
