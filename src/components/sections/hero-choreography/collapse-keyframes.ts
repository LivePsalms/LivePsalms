import type { Keyframe } from './keyframes';
import { WORDMARK_COLLAPSE } from './wordmark-geometry';

// Kept in sync with the `--deep-umber` CSS var (#3A3426) — GSAP can't tween a
// CSS variable cleanly, so the literal lives here (see src/index.css).
export const COLLAPSE_COLOR_DEEP_UMBER = '#3A3426';

// One collapse wave for a letter: independent x / opacity / filter eases,
// matching the standalone composition.
function wave(target: string, x: number, at: number, duration: number): Keyframe[] {
  return [
    { target, to: { x }, ease: 'power3.out', at, duration },
    { target, to: { opacity: 0 }, ease: 'power1.out', at, duration },
    { target, to: { filter: 'blur(6px)' }, ease: 'power2.out', at, duration },
  ];
}

// Scroll-collapse scene: bloom → three letter waves → A pulse → ring bloom →
// color flash. Trigger metadata (start/end/scrub/onUpdate/force3D) stays in the
// thin component effect — this is pure timeline data.
export function collapseKeyframes(): Keyframe[] {
  return [
    // Phase 1 — Bloom (0.000 → 0.150): opacity 0.45 → 1.0 + scale 0.98 → 1.0.
    { target: 'svg', from: { opacity: 0.45, scale: 0.98, transformOrigin: '50% 50%' },
      to: { opacity: 1.0, scale: 1.0 }, ease: 'power2.out', at: 0, duration: 0.150 },

    // Phase 2 — Wave 1: S₂ (0.150).
    ...wave('letterS2', WORDMARK_COLLAPSE.S2, 0.150, 0.227),
    // Phase 3 — Wave 2: P + M (0.221).
    ...wave('letterP', WORDMARK_COLLAPSE.P, 0.221, 0.227),
    ...wave('letterM', WORDMARK_COLLAPSE.M, 0.221, 0.227),
    // Phase 4 — Wave 3: S₁ + L (0.292).
    ...wave('letterS1', WORDMARK_COLLAPSE.S1, 0.292, 0.226),
    ...wave('letterL', WORDMARK_COLLAPSE.L, 0.292, 0.226),

    // Phase 5 — A pulse (0.504 → 0.575). Peak 1.06.
    { target: 'letterA', to: { scale: 1.06, transformOrigin: '50% 50%' }, ease: 'power2.out', at: 0.504, duration: 0.071 },
    { target: 'letterA', to: { scale: 1.00, transformOrigin: '50% 50%' }, ease: 'power3.out', at: 0.575, duration: 0.064 },

    // Phase 6.2 — Ring bloom + expand. width/height (not scale) keeps the 1px stroke a true hairline.
    { target: 'ring', from: { opacity: 0, width: 8, height: 8 },
      to: { opacity: 0.85, width: 24, height: 24 }, ease: 'power1.out', at: 0.568, duration: 0.020 },
    { target: 'ring', to: { width: 940, height: 940 }, ease: 'power2.out', at: 0.588, duration: 0.380 },
    { target: 'ring', to: { opacity: 0 }, ease: 'power1.inOut', at: 0.678, duration: 0.290 },

    // Phase 6.3 — A fill warming (tonal flash via the SVG's inherited `color`).
    { target: 'svg', to: { color: '#5A4520' }, ease: 'power2.out', at: 0.568, duration: 0.036 },
    { target: 'svg', to: { color: COLLAPSE_COLOR_DEEP_UMBER }, ease: 'power2.out', at: 0.604, duration: 0.156 },
  ];
}
