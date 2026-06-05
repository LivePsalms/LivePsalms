// SVG-userspace collapse offsets. Distance each letter travels from its
// settled position to the A's center, in viewBox units (positive = moves
// rightward toward A from the left side; negative = moves leftward toward
// A from the right side). Shared by the intro spread (used as the `from`)
// and both letter-collapse scrubs (used as the `to`).
export const WORDMARK_COLLAPSE = {
  P: 653.3,
  S1: 339.8,
  L: -313.9,
  M: -690.5,
  S2: -1076.4,
} as const;

export interface WordmarkAuraSizes {
  aura: number;
  ringInitial: number;
  ringFinal: number;
}

// Ratios derived from the original 1100px wordmark:
// aura 720px → 0.6545, ring initial 260px → 0.2364, ring final 2800px → 2.5455.
export function wordmarkAuraSizes(wordmarkWidth: number): WordmarkAuraSizes {
  return {
    aura: wordmarkWidth * 0.6545,
    ringInitial: wordmarkWidth * 0.2364,
    ringFinal: wordmarkWidth * 2.5455,
  };
}
