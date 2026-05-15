// Three-beat manifesto for the hero bridge section.
// Same italic Cormorant voice as the Psalm 23 quote below the mask.
export const BRIDGE_COPY = {
  invitation: 'Come here to pause. To refill. To reflect. To reconnect.',
  thesis: 'Restoration is a returning.',
  assurance: 'Your life with God is not slipping away. It is being kept.',
} as const;

// GSAP timeline positions for the cascade reveal. Match the Psalm 23 cascade
// stagger in Hero.tsx so the two passages bookend each other in motion shape.
export const BRIDGE_CASCADE_TIMING = {
  invitation: 0,
  thesis: 0.35,
  assurance: 0.7,
} as const;
