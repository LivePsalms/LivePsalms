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
  text1: { enter: 0,    holdStart: 0.10, holdEnd: 0.28, exit: 0.34 },
  text2: { enter: 0.34, holdStart: 0.40, holdEnd: 0.60, exit: 0.66 },
  text3: { enter: 0.66, holdStart: 0.72, holdEnd: 0.95, exit: 1.0  },
} as const;
