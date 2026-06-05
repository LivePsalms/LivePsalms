import type { Keyframe } from './motion-keyframes';
import { MID_SECTION_PIN_TIMING } from './mid-section-motion-content';
import { mapBeatProgressWebGPU } from './mid-section-intensity';

// Declarative beat-timeline data for the mid-section's pinned 5-beat slideshow.
// Mirrors the HeroChoreography keyframe-builder pattern: a pure function returning
// `Keyframe[]`, with timeline/trigger/pin/scrub metadata staying in the component.
//
// Targets are the abstract names 'beat1'..'beat5'; the harness maps them to the
// five beat <p> elements via applyKeyframes' `targets` arg.
//
// webgpu mode offsets/scales beat positions into the reading band via
// mapBeatProgressWebGPU (intro/outro bookends); video mode uses raw positions.
export function buildMidSectionBeatKeyframes(mode: 'webgpu' | 'video'): Keyframe[] {
  const mapPos = (raw: number) => (mode === 'webgpu' ? mapBeatProgressWebGPU(raw) : raw);

  const beatKeys = ['beat1', 'beat2', 'beat3', 'beat4', 'beat5'] as const;
  const keyframes: Keyframe[] = [];

  for (const key of beatKeys) {
    const raw = MID_SECTION_PIN_TIMING[key];
    const enter = mapPos(raw.enter);
    const holdStart = mapPos(raw.holdStart);
    const holdEnd = mapPos(raw.holdEnd);
    const exit = mapPos(raw.exit);

    // Enter — fade in + rise from y:20 to y:0. The hidden state is folded into the
    // `from` (replacing the original up-front gsap.set); equivalent because on a
    // scrub timeline inactive fromTo targets sit at `from` and beats never overlap.
    if (enter < holdStart) {
      keyframes.push({
        target: key,
        from: { opacity: 0, y: 20 },
        to: { opacity: 1, y: 0 },
        ease: 'power2.out',
        at: enter,
        duration: holdStart - enter,
      });
    } else {
      // No-rise branch: original used `tl.set(beat, {opacity:1, y:0}, enter)`.
      // duration 0 + no `from` makes applyKeyframes emit a `set`. Unreachable with
      // the current MID_SECTION_PIN_TIMING (every beat has enter < holdStart), but
      // kept faithful to the harness it replaces.
      keyframes.push({
        target: key,
        to: { opacity: 1, y: 0 },
        at: enter,
        duration: 0,
      });
    }

    // Exit — fade out + lift to y:-20.
    if (holdEnd < exit) {
      keyframes.push({
        target: key,
        to: { opacity: 0, y: -20 },
        ease: 'power1.in',
        at: holdEnd,
        duration: exit - holdEnd,
      });
    }
  }

  return keyframes;
}
