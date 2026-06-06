import type { Keyframe } from '../motion-keyframes';

// Scroll progress at which the video element starts playing — slightly before
// its visual crossfade (0.70) so the first visible frame is already in motion.
export const VIDEO_PLAY_AT = 0.65;

// Mask-expand scene: the silhouette clip grows to fill the viewport while the
// image de-zooms, then the video crossfades in inside the silhouette. The video
// element's initial opacity:0 is its `set` keyframe; `.play()` is fired by the
// component at VIDEO_PLAY_AT (separate ScrollTrigger.onUpdate, not tweenable data).
export function maskExpandKeyframes(): Keyframe[] {
  return [
    // Phase 1 — Expansion (0.00 → 0.55).
    { target: 'clip', from: { width: '75%', height: '45%' },
      to: { width: '100%', height: '100%' }, ease: 'none', at: 0, duration: 0.55 },
    { target: 'img', from: { scale: 1.15 }, to: { scale: 1 }, ease: 'none', at: 0, duration: 0.55 },

    // Phase 2 — Image → video crossfade (0.70 → 0.90).
    { target: 'video', to: { opacity: 0 }, at: 0, duration: 0 },
    { target: 'video', to: { opacity: 1 }, ease: 'power1.inOut', at: 0.70, duration: 0.2 },
  ];
}
