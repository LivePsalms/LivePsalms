// src/notepad/prettify/palette.test.ts
import { describe, expect, it } from 'vitest';
import { ROLE_SWATCH, KIND_ASSET, CONNECTOR_ASSET } from './palette';
import { getStyleAsset } from '../styles/manifest';

describe('prettify palette', () => {
  it('maps every highlight role to a curated swatch id', () => {
    expect(ROLE_SWATCH).toEqual({
      'key-point': 'highlight-01',
      topic: 'highlight-02',
      theme: 'highlight-03',
    });
  });

  it('maps every decoration kind to a curated asset id', () => {
    expect(KIND_ASSET).toEqual({
      underline: 'squiggle-01',
      bracket: 'shape-01',
      'margin-arrow': 'arrow-01',
    });
  });

  it('exposes the connector asset id', () => {
    expect(CONNECTOR_ASSET).toBe('line-01');
  });

  it('every mapped asset id resolves in the manifest', () => {
    for (const id of [...Object.values(KIND_ASSET), CONNECTOR_ASSET]) {
      expect(getStyleAsset(id)).toBeTruthy();
    }
  });
});
