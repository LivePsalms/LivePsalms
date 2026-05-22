// Pure helpers + constants for the mid-section's symmetric bookend.
// The WebGPU pinned timeline is divided into three bands:
//   intro     p ∈ [0, INTRO_END]            — 100vh, bright + low-fps crawl
//   reading   p ∈ [INTRO_END, OUTRO_START]  — 500vh, normal + steady fps
//   outro    p ∈ [OUTRO_START, 1]           — 100vh, normal+steady → bright+crawl
// Brightness and sim-speed move on the same cubic ease-in within each band,
// so the dramatic end-state lingers and the resolution snaps near the boundary.

import type { CurlLinesIntensity } from './mid-section-webgpu-scene';

/** End of the intro band as a fraction of the pinned timeline (1/7 of 700vh = 100vh). */
export const INTRO_END = 1 / 7;
/** Start of the outro band as a fraction of the pinned timeline. */
export const OUTRO_START = 6 / 7;
/** Width of the reading band (5/7 of the timeline = 500vh). */
export const READING_SCALE = OUTRO_START - INTRO_END;

/** FPS the curl-noise simulation runs at during the bright/dramatic end-state. */
export const FPS_FLOOR = 3;
/** FPS the curl-noise simulation runs at during the calm reading window. */
export const FPS_STEADY = 39;

/** Visual intensity at the bright/dramatic end-state (pin engage; just before pin release).
 *  Sim-speed is intentionally tracked separately as `FPS_FLOOR` — these objects
 *  hold only the visual fields that share the same brightness/bloom interpolation. */
export const INTENSITY_BRIGHT = {
  brightness: 3.45,
  bloomStrength: 3.30,
  bloomThreshold: 0.14,
} as const;

/** Visual intensity during the calm reading window. Pair with `FPS_STEADY` for sim-speed. */
export const INTENSITY_NORMAL = {
  brightness: 1.20,
  bloomStrength: 2.20,
  bloomThreshold: 0.15,
} as const;

/** Cubic ease-in (`t³`): slow start, fast finish. Caller chooses the value direction —
 *  in this module `t=0` maps to the dramatic end-state (bright + low FPS) and `t=1`
 *  maps to the calm end-state (normal + steady FPS), so "slow start" means the
 *  dramatic look dwells before snapping to calm. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Field shape the React component assigns onto the live `CurlLinesIntensity` object. */
export type IntensityState = Pick<
  CurlLinesIntensity,
  'brightness' | 'bloomStrength' | 'bloomThreshold' | 'simSpeed'
>;
