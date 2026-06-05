export type HandoffEntrancePlan = 'snap' | 'reducedFade' | 'fullMotion';

/**
 * Concentrates the entrance effect's 4-way branch decision into 3 outcomes.
 * Branches A (in-track desktop) and C (mobile) both resolve to 'snap' — this
 * reveals that duplication.
 *
 * Precedence MUST mirror the original branch order exactly:
 *  1. in-track desktop → 'snap'      (beats reducedMotion)
 *  2. reducedMotion    → 'reducedFade' (beats mobile)
 *  3. mobile           → 'snap'
 *  4. otherwise        → 'fullMotion'
 * So desktop+inTrack+reducedMotion = 'snap'; mobile+reducedMotion = 'reducedFade'.
 */
export function decideHandoffEntrance(args: {
  reducedMotion: boolean;
  variant: 'desktop' | 'mobile';
  inHorizontalTrack: boolean;
}): HandoffEntrancePlan {
  const { reducedMotion, variant, inHorizontalTrack } = args;
  if (inHorizontalTrack && variant === 'desktop') return 'snap'; // A
  if (reducedMotion) return 'reducedFade'; // B
  if (variant === 'mobile') return 'snap'; // C
  return 'fullMotion'; // D
}
