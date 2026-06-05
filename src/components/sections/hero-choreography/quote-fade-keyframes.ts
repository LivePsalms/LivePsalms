import type { Keyframe } from './keyframes';

// Psalm 23 quote: three lines rise + unblur on scroll, staggered. Reduced-motion
// holds them all at the final frame (handled via projectFinalFrame at the call site).
export function quoteFadeKeyframes(): Keyframe[] {
  const reveal = { opacity: 1, y: 0, filter: 'blur(0px)' } as const;
  const hidden = { opacity: 0, y: 40, filter: 'blur(10px)' } as const;
  return [
    { target: 'l1', to: { ...hidden }, at: 0, duration: 0 },
    { target: 'l2', to: { ...hidden }, at: 0, duration: 0 },
    { target: 'attr', to: { ...hidden }, at: 0, duration: 0 },
    { target: 'l1', to: { ...reveal }, ease: 'power2.out', at: 0, duration: 1 },
    { target: 'l2', to: { ...reveal }, ease: 'power2.out', at: 0.35, duration: 1 },
    { target: 'attr', to: { ...reveal }, ease: 'power2.out', at: 0.70, duration: 1 },
  ];
}
