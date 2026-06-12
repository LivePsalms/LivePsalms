const FADE_START = 0.02;
const FADE_END = 0.12;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Desktop opacity for the hero Notepad link.
 * - Hidden (0) until the intro is revealed.
 * - Fully visible at the start of scroll, then fades out across
 *   [FADE_START, FADE_END] so it is gone before the wordmark-collapse
 *   climax and the manifesto below.
 */
export function heroNotepadLinkOpacity(introRevealed: boolean, progress: number): number {
  if (!introRevealed) return 0;
  const t = clamp01((progress - FADE_START) / (FADE_END - FADE_START));
  return 1 - t;
}
