import type { Keyframe } from './motion-keyframes';

// Desktop full-motion handoff choreography as declarative data. Targets are
// abstract names 'left' | 'right' | 'fill' | 'content', resolved to DOM nodes
// by applyKeyframes at the call site. Trigger/pin metadata stays in the harness.

// ACT 1: scrubbed entrance — panels slide to rest, fill scales out, content fades in.
export function actOneKeyframes(): Keyframe[] {
  return [
    { target: 'left', from: { yPercent: -100 }, to: { yPercent: 0 }, ease: 'power3.out', at: 0, duration: 1.0 },
    { target: 'right', from: { yPercent: 100 }, to: { yPercent: 0 }, ease: 'power3.out', at: 0, duration: 1.0 },
    {
      target: 'fill',
      from: { scaleX: 0, transformOrigin: '50% 50%' },
      to: { scaleX: 1, transformOrigin: '50% 50%' },
      ease: 'power3.out',
      at: 0,
      duration: 1.0,
    },
    { target: 'content', to: { opacity: 1 }, ease: 'power2.out', at: 0.6, duration: 0.4 },
  ];
}

// ACT 2: scrubbed exit then re-enter. Named-target tweens only — the inert
// `.to({}, ...)` timeline spacer stays in the harness for fidelity.
export function actTwoKeyframes(): Keyframe[] {
  return [
    { target: 'left', from: { yPercent: 0 }, to: { yPercent: -100 }, ease: 'power2.in', at: 0, duration: 0.4 },
    { target: 'right', from: { yPercent: 0 }, to: { yPercent: 100 }, ease: 'power2.in', at: 0, duration: 0.4 },
    {
      target: 'fill',
      from: { scaleX: 1, transformOrigin: '50% 50%' },
      to: { scaleX: 0, transformOrigin: '50% 50%' },
      ease: 'power2.in',
      at: 0,
      duration: 0.3,
    },
    { target: 'content', from: { opacity: 1 }, to: { opacity: 0 }, ease: 'power2.in', at: 0, duration: 0.3 },
    { target: 'left', to: { yPercent: 0 }, ease: 'power3.out', at: 0.6, duration: 0.4 },
    { target: 'right', to: { yPercent: 0 }, ease: 'power3.out', at: 0.6, duration: 0.4 },
  ];
}

// Auto-navigate fence: Act 2 hands off to the next devotion once its scrub
// reaches the tail, firing exactly once.
export const AUTO_NAV_PROGRESS = 0.98;

export function shouldAutoNavigate(progress: number, alreadyNavigated: boolean): boolean {
  return progress >= AUTO_NAV_PROGRESS && !alreadyNavigated;
}
