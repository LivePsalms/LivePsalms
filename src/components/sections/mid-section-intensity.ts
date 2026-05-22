// Band edges: scroll progress threshold points
export const INTRO_END = 0.3;
export const OUTRO_START = 0.7;

// Reading scale: scaled intensity during reading phase
export const READING_SCALE = 0.85;

// FPS endpoints: simulation frame rate bounds
export const FPS_FLOOR = 24;
export const FPS_STEADY = 30;

// Intensity states: WebGPU canvas brightness multipliers
export const INTENSITY_BRIGHT = 1.4;
export const INTENSITY_NORMAL = 1.0;

/**
 * Cubic easing function: f(t) = t³
 * Used for smooth acceleration in mid-section animations
 * @param t - Progress value in range [0, 1]
 * @returns Eased value (cubic function of t)
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}
