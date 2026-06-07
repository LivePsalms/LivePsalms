import { describe, it, expect } from 'vitest';
import { DENSITIES, isPrettifyDensity } from './prettify-types';

describe('prettify-types', () => {
  it('lists the three densities', () => {
    expect(DENSITIES).toEqual(['light', 'balanced', 'rich']);
  });
  it('guards density strings', () => {
    expect(isPrettifyDensity('balanced')).toBe(true);
    expect(isPrettifyDensity('nope')).toBe(false);
  });
});
