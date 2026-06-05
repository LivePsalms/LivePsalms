import { describe, it, expect } from 'vitest';
import { collapseKeyframes, COLLAPSE_COLOR_DEEP_UMBER } from './collapse-keyframes';
import { WORDMARK_COLLAPSE } from './wordmark-geometry';
import type { Keyframe } from '../motion-keyframes';

const at = (kfs: Keyframe[], target: string, prop: string): Keyframe =>
  kfs.find((k) => k.target === target && prop in k.to)!;

describe('collapseKeyframes', () => {
  const kfs = collapseKeyframes();

  it('moves each letter to its WORDMARK_COLLAPSE offset', () => {
    expect(at(kfs, 'letterS2', 'x').to.x).toBe(WORDMARK_COLLAPSE.S2);
    expect(at(kfs, 'letterP', 'x').to.x).toBe(WORDMARK_COLLAPSE.P);
    expect(at(kfs, 'letterL', 'x').to.x).toBe(WORDMARK_COLLAPSE.L);
  });

  it('blooms the wordmark first (fromTo at 0)', () => {
    const bloom = kfs.find((k) => k.target === 'svg' && k.from);
    expect(bloom).toMatchObject({ at: 0, from: { opacity: 0.45 }, to: { opacity: 1.0 } });
  });

  it('WAVE-OVERLAP INVARIANT: wave 2 (P+M) starts before wave 1 (S₂) ends', () => {
    const s2 = at(kfs, 'letterS2', 'x');
    const p = at(kfs, 'letterP', 'x');
    expect(p.at).toBeLessThan(s2.at + s2.duration);
  });

  it('WAVE-OVERLAP INVARIANT: wave 3 (S₁+L) starts before wave 2 (P+M) ends', () => {
    const p = at(kfs, 'letterP', 'x');
    const s1 = at(kfs, 'letterS1', 'x');
    expect(s1.at).toBeLessThan(p.at + p.duration);
  });

  it('pulses A after the waves and flashes color to deep umber', () => {
    const pulseUp = kfs.find((k) => k.target === 'letterA' && k.to.scale === 1.06);
    expect(pulseUp?.at).toBe(0.504);
    const flash = kfs.filter((k) => k.target === 'svg' && 'color' in k.to);
    expect(flash.map((k) => k.to.color)).toEqual(['#5A4520', COLLAPSE_COLOR_DEEP_UMBER]);
  });

  it('reduced projection = final opacities (the carve-out drops x/filter at the call site)', () => {
    // Final frame has siblings at opacity 0 and A at scale 1 — the IntersectionObserver
    // carve-out applies these opacities without the x-translate.
    const s2Final = at(kfs, 'letterS2', 'opacity');
    expect(s2Final.to.opacity).toBe(0);
  });
});
