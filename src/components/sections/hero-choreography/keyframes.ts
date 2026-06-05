export type GsapVars = Record<string, unknown>;

// A single tween/set in a scene "score". `from` present → fromTo; duration 0
// with no `from` → set; otherwise → to. `at` is the absolute timeline position.
export interface Keyframe {
  target: string;
  from?: GsapVars;
  to: GsapVars;
  at: number;
  duration: number;
  ease?: string;
}

// The narrow slice of the GSAP timeline API that applyKeyframes touches. The
// real `gsap.timeline()` satisfies this; tests pass a recording fake.
export interface KeyframeTimeline {
  set(target: unknown, vars: GsapVars, at: number): unknown;
  to(target: unknown, vars: GsapVars, at: number): unknown;
  fromTo(target: unknown, from: GsapVars, to: GsapVars, at: number): unknown;
}

// The only GSAP-coupled step in HeroChoreography. Walks declarative keyframe
// data into a timeline, resolving abstract target names to DOM elements via
// `targets`. Null/absent targets are skipped (callers guard their refs).
export function applyKeyframes(
  tl: KeyframeTimeline,
  keyframes: Keyframe[],
  targets: Record<string, unknown>,
): void {
  for (const kf of keyframes) {
    const el = targets[kf.target];
    if (el == null) continue;

    if (kf.duration === 0 && !kf.from) {
      tl.set(el, kf.to, kf.at);
      continue;
    }

    const toVars: GsapVars = { ...kf.to, duration: kf.duration };
    if (kf.ease !== undefined) toVars.ease = kf.ease;

    if (kf.from) {
      tl.fromTo(el, kf.from, toVars, kf.at);
    } else {
      tl.to(el, toVars, kf.at);
    }
  }
}

// Reduced-motion projection: each target's final visual state = its `to` vars
// merged in timeline order (later keyframes override earlier keys). Used by the
// fade-only reduced paths (quote, mask) and by invariant tests that assert a
// scene's reduced state equals its scrub's last frame.
export function projectFinalFrame(keyframes: Keyframe[]): Record<string, GsapVars> {
  const result: Record<string, GsapVars> = {};
  for (const kf of keyframes) {
    result[kf.target] = { ...(result[kf.target] ?? {}), ...kf.to };
  }
  return result;
}
