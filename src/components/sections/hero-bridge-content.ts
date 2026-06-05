import type { Keyframe } from './hero-choreography/keyframes';

// Three-beat manifesto for the hero bridge section.
// Same italic Cormorant voice as the Psalm 23 quote below the mask.
export const BRIDGE_COPY = {
  invitation: 'Come here to pause. To refill. To reflect. To reconnect.',
  thesis: 'Restoration is a returning.',
  assurance: 'Your life with God is not slipping away. It is being kept.',
} as const;

// GSAP timeline progress points for the pinned bridge stage.
// Each beat has an enter window (enter → holdStart), a hold plateau (holdStart → holdEnd),
// and an exit window (holdEnd → exit). Kiss handoff: textN.exit === text(N+1).enter,
// so the screen always has exactly one beat in flight or held — never two, never zero
// (except the very first 0%, before text1 enters, and the very last 0%, after text3 exits).
export const BRIDGE_PIN_TIMING = {
  text1: { enter: 0,    holdStart: 0.10, holdEnd: 0.32, exit: 0.40 },
  text2: { enter: 0.40, holdStart: 0.50, holdEnd: 0.64, exit: 0.70 },
  text3: { enter: 0.70, holdStart: 0.80, holdEnd: 0.95, exit: 1.0  },
} as const;

// Builds the shared three-beat bridge cascade as keyframe data. Desktop and
// mobile call this with their own text-2 enter offset (`enterX2`: 120 desktop,
// 30 mobile — proportional to viewport). Scrub speed stays component-level
// trigger metadata (mobile multiplies by MOBILE_TIME_SCALE); the timeline
// positions are identical across platforms, driven by BRIDGE_PIN_TIMING.
export function bridgeCascadeKeyframes({ enterX2 }: { enterX2: number }): Keyframe[] {
  const { text1, text2, text3 } = BRIDGE_PIN_TIMING;
  return [
    // Initial states (t=0): t1 rises from below, t2 slides from off-right, t3 rises further.
    { target: 't1', to: { opacity: 0, y: 40, filter: 'blur(10px)' }, at: 0, duration: 0 },
    { target: 't2', to: { opacity: 0, x: enterX2, filter: 'blur(10px)' }, at: 0, duration: 0 },
    { target: 't3', to: { opacity: 0, y: 80, filter: 'blur(10px)' }, at: 0, duration: 0 },

    // Text 1 — enter (rise + blur clear), then exit (opacity only).
    { target: 't1', to: { opacity: 1, y: 0, filter: 'blur(0px)' }, ease: 'power2.out',
      at: text1.enter, duration: text1.holdStart - text1.enter },
    { target: 't1', to: { opacity: 0 }, ease: 'power1.in',
      at: text1.holdEnd, duration: text1.exit - text1.holdEnd },

    // Text 2 — horizontal slide in, then exit.
    { target: 't2', to: { opacity: 1, x: 0, filter: 'blur(0px)' }, ease: 'power2.out',
      at: text2.enter, duration: text2.holdStart - text2.enter },
    { target: 't2', to: { opacity: 0 }, ease: 'power1.in',
      at: text2.holdEnd, duration: text2.exit - text2.holdEnd },

    // Text 3 — long hold, exits in the last 5%.
    { target: 't3', to: { opacity: 1, y: 0, filter: 'blur(0px)' }, ease: 'power2.out',
      at: text3.enter, duration: text3.holdStart - text3.enter },
    { target: 't3', to: { opacity: 0 }, ease: 'power1.in',
      at: text3.holdEnd, duration: text3.exit - text3.holdEnd },
  ];
}
