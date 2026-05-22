# Mid-Section Symmetric Bookend Design

**Date:** 2026-05-22
**Component:** [src/components/sections/MidSectionMotion.tsx](src/components/sections/MidSectionMotion.tsx)
**Status:** Approved design — pending implementation plan

## Context

The home page mid-section is a pinned 600vh stage (in WebGPU mode) running a five-beat italic slideshow over a live curl-noise canvas. The canvas currently runs two independent visual treatments on top of the simulation:

1. **Intensity (brightness + bloom).** Three-act sequence: bright at pin-engage → drops to normal across the first 0.033 of timeline progress → holds normal during all five beats → ramps back to bright across the last 0.167 of progress (the "outro").
2. **Sim speed (FPS).** Four-waypoint wake-up curve, independent of intensity: 3 → 20 → 35 → 40 fps across progress 0 → 0.75, then settles at 39 fps for the remainder.

The result is asymmetric. The outro has a dramatic bright/streaky look with ~100vh of buildup, but the entry into the section dims almost immediately (~20vh of scroll) before the dramatic visual character has time to land. The FPS wake-up runs on a completely separate timeline from the brightness, so neither reinforces the other — the user perceives the bright moments as a single combined "look," but the code treats them as unrelated.

## Goal

Replace the current overture + independent wake-up with a **symmetric bookend**: the intro and outro look and behave as a matched pair. Brightness and FPS move together on the same eased curve, framing the calm reading window in the middle. The intro is the new wake-up — there is no longer a separate slow-exhale running underneath the reading window.

## Design

### Structure

WebGPU wrapper extends from **600vh → 700vh**. The pinned 100vh stage stays the same. Video and reduced-motion paths are unaffected (see fallbacks below).

| Phase | Progress range | Scroll span | Brightness | FPS |
|---|---|---|---|---|
| Intro | 0 → 1/7 (≈0.143) | 100vh | 3.45 → 1.20 (cubic ease-in) | 3 → 39 (cubic ease-in) |
| Reading | 1/7 → 6/7 | 500vh | hold at 1.20 | hold at 39 |
| Outro | 6/7 → 1.0 (≈0.857 → 1.0) | 100vh | 1.20 → 3.45 (cubic ease-in) | 39 → 3 (cubic ease-in) |

Brightness, bloom, and FPS all move on the same eased progress within each band — they are no longer independent.

The brightness/bloom endpoint values stay drawn from the existing `INTENSITY_BRIGHT` and `INTENSITY_NORMAL` constants (`brightness: 3.45 → 1.20`, `bloomStrength: 3.30 → 2.20`, `bloomThreshold: 0.14 → 0.15`). FPS endpoints are `3` (floor) and `39` (steady).

### Easing characteristic

Both bands use **cubic ease-in** (`t^3`) — slow start, fast finish — so the dramatic end-state lingers and the resolution happens quickly near the boundary with the reading window.

- **Intro:** brightness/FPS dwell at bright/floor (3.45 / 3 fps) for roughly the first half of the 100vh band, then accelerate to normal/steady (1.20 / 39 fps) in the second half. At the midpoint of the intro band, only ~12.5% of the transition is done.
- **Outro:** brightness/FPS dwell at normal/steady (1.20 / 39 fps) for roughly the first half of the 100vh band, then accelerate to bright/floor (3.45 / 3 fps) in the second half. At the midpoint of the outro band, only ~12.5% of the transition is done.

This preserves the "slow exhale" character of the current wake-up curve, compressed, and makes the two bookends visually symmetric — same dwell shape, same resolution snap.

If after preview the dwell feels too short, swap the cubic for a quartic (`^4`) for more lingering at the dramatic end; if too long, drop to quadratic (`^2`).

### Text timing

The `MID_SECTION_PIN_TIMING` constants in [src/components/sections/mid-section-motion-content.ts](src/components/sections/mid-section-motion-content.ts) stay unchanged — they continue to express beat positions in a 0-1 reading-relative form. The consumer in `MidSectionMotion.tsx` does the offset/scale:

```
beat_position_in_timeline = INTRO_END + reading_position * READING_SCALE
                          = (1/7) + p * (5/7)
```

So:
- Beat 1 enter: was at 0, becomes 1/7 ≈ 0.143 (kisses end of intro)
- Beat 1 hold-start: was at 0.04, becomes 0.143 + 0.04 × 5/7 ≈ 0.172
- Beat 5 exit: was at 1.0, becomes 1/7 + 1.0 × 5/7 = 6/7 ≈ 0.857 (kisses start of outro)

Kiss handoff between beats is preserved (still relative to the reading-window scale). Kiss handoff at the band boundaries is preserved as well — beat 1 enter starts exactly at intro end, beat 5 exit ends exactly at outro start.

### Trigger model

The existing intensity ScrollTrigger keeps `start: 'top top'` and `end: 'bottom bottom'`. **No separate pre-pin trigger.** The intro band IS the buildup — when pin engages, brightness and FPS are at their bright/floor values and the user sees the dramatic look immediately. The 100vh of scroll between pin-engage and beat 1's enter gives the buildup its breathing room.

The intensity ScrollTrigger's `onUpdate` callback computes brightness, bloom, and FPS from the current progress using a single helper that switches on band (intro / reading / outro). One code path, one source of truth for the three-band animation.

### Code changes

**[src/components/sections/MidSectionMotion.tsx](src/components/sections/MidSectionMotion.tsx):**

1. New constants replace the current bookkeeping:
   ```ts
   const INTRO_END = 1 / 7;
   const OUTRO_START = 6 / 7;
   const READING_SCALE = OUTRO_START - INTRO_END; // 5/7
   const FPS_FLOOR = 3;
   const FPS_STEADY = 39;
   ```

2. Remove `WEBGPU_TEXT_SCALE`, `OVERTURE_END`, `OUTRO_START` (old value), `WAKEUP_END`, `WAKEUP_FPS_WAYPOINTS`, `STEADY_FPS`, and the `wakeUpFps` function.

3. Add a single helper that returns the full intensity state from a progress value:
   ```ts
   function easeInCubic(t: number): number { return t * t * t; }

   function computeIntensityState(p: number): {
     brightness: number;
     bloomStrength: number;
     bloomThreshold: number;
     simSpeed: number;
   } {
     if (p <= INTRO_END) {
       const t = easeInCubic(p / INTRO_END);
       return {
         brightness: lerp(INTENSITY_BRIGHT.brightness, INTENSITY_NORMAL.brightness, t),
         bloomStrength: lerp(INTENSITY_BRIGHT.bloomStrength, INTENSITY_NORMAL.bloomStrength, t),
         bloomThreshold: lerp(INTENSITY_BRIGHT.bloomThreshold, INTENSITY_NORMAL.bloomThreshold, t),
         simSpeed: lerp(FPS_FLOOR, FPS_STEADY, t) / 60,
       };
     }
     if (p >= OUTRO_START) {
       const t = easeInCubic((p - OUTRO_START) / (1 - OUTRO_START));
       return {
         brightness: lerp(INTENSITY_NORMAL.brightness, INTENSITY_BRIGHT.brightness, t),
         bloomStrength: lerp(INTENSITY_NORMAL.bloomStrength, INTENSITY_BRIGHT.bloomStrength, t),
         bloomThreshold: lerp(INTENSITY_NORMAL.bloomThreshold, INTENSITY_BRIGHT.bloomThreshold, t),
         simSpeed: lerp(FPS_STEADY, FPS_FLOOR, t) / 60,
       };
     }
     return {
       brightness: INTENSITY_NORMAL.brightness,
       bloomStrength: INTENSITY_NORMAL.bloomStrength,
       bloomThreshold: INTENSITY_NORMAL.bloomThreshold,
       simSpeed: FPS_STEADY / 60,
     };
   }
   ```

4. The intensity ScrollTrigger's `onUpdate` becomes a thin shell that calls `computeIntensityState(self.progress)` and assigns the four returned fields onto `intensity`.

5. Wrapper height:
   ```ts
   const wrapperHeight = renderMode === 'webgpu' ? '700vh' : '500vh';
   ```
   Video mode stays at 500vh.

6. Beat tween positions branch on `renderMode`:
   - WebGPU: enter / holdStart / holdEnd / exit each computed as `INTRO_END + raw * READING_SCALE`
   - Video: enter / holdStart / holdEnd / exit each computed as `raw` (unchanged from current `textScale = 1`)

7. The phantom `tl.set({}, {}, 1)` padding in WebGPU mode stays — beat 5 still exits at timeline position 6/7, so without padding the timeline `totalDuration` would only reach 6/7 of the scroll range. Padding keeps the outro band scroll-driven.

**[src/components/sections/mid-section-motion-content.ts](src/components/sections/mid-section-motion-content.ts):** no functional changes. The comment on `MID_SECTION_PIN_TIMING` should be updated to note that the WebGPU consumer applies an offset/scale (intro and outro bands), while the video consumer uses the raw values.

### Video fallback

Video mode (no WebGPU available, not reduced-motion) **stays at 500vh** and uses the **original** (non-scaled) beat timing. The bookend choreography is meaningless without a scene to drive — there's no brightness or FPS to modulate on a looping MP4. Extending the wrapper would add 200vh of "nothing happens" scroll for users without WebGPU, which is a worse experience than the current tight version. Beats fire at the raw `MID_SECTION_PIN_TIMING` positions.

### Reduced-motion fallback

Unchanged. The five stacked blocks fade in via IntersectionObserver. No canvas, no brightness/FPS, no scroll choreography.

## What this replaces

- `WEBGPU_TEXT_SCALE = 5/6` → `INTRO_END = 1/7`, `OUTRO_START = 6/7`, `READING_SCALE = 5/7`
- `OVERTURE_END = 0.0333` → eliminated; replaced by the eased intro band (1/7 of timeline ≈ 100vh)
- `WAKEUP_END = 0.75`, `WAKEUP_FPS_WAYPOINTS = [3, 20, 35, 40, 39]`, `wakeUpFps()` → eliminated; replaced by FPS riding the intro/outro ease alongside brightness
- Three-act intensity onUpdate logic → replaced by a single `computeIntensityState(progress)` helper that returns all four fields

## Risks and open items

- **Post-section state.** When the user scrolls past progress 1.0, the canvas is left at FPS floor 3 and bright values because ScrollTrigger's `onUpdate` only fires while progress is in [0, 1]. If the user then scrolls back up before the route changes, the section briefly looks "stuck bright." Mitigation: add an `onLeave` / `onLeaveBack` handler on the same ScrollTrigger that snaps `simSpeed`, `brightness`, `bloomStrength`, `bloomThreshold` back to the steady-state values when progress leaves the [0, 1] range. Worth verifying live before committing to this fix — the user may not scroll back up often enough for it to matter.
- **Cubic ease specifics.** `easeInCubic` (`t^3`) was chosen as the simplest cubic ease that lingers enough at the dramatic end-state for a 100vh band. After first preview, swap to quartic (`t^4`) for more dwell or quadratic (`t^2`) for less.
- **Reading pacing.** Five beats spread across 500vh of reading window = ~100vh per beat. Unchanged from current pacing. Should still feel right.
- **Pre-pin trigger deferred.** "Split second before" pre-pin signaling was discussed and ruled out: the 100vh intro band IS the buildup. If the bright look feels too sudden at pin-engage after preview, revisit with a second ScrollTrigger starting at `top bottom-=20%` driving brightness from normal up to bright as the section approaches.

## Acceptance criteria

1. **WebGPU path.** Wrapper is 700vh. Pin engages at top of section. Brightness and FPS at pin-engage are at bright/floor (3.45 / 3 fps). Both ease together along a cubic ease-in, reaching normal/steady (1.20 / 39 fps) at progress 1/7 just as beat 1 begins entering. Both hold at normal/steady through the reading window. Both ease back to bright/floor along a cubic ease-in across progress 6/7 → 1.0. Beat 5 finishes exiting at exactly progress 6/7. Visual character of intro and outro is recognizably symmetric — same dwell at the dramatic end-state, same speed of resolution.
2. **Video path.** Wrapper is 500vh. Beats fire at the original (non-scaled) `MID_SECTION_PIN_TIMING` positions. No intensity work. No regression from current behavior.
3. **Reduced-motion path.** Unchanged. Stacked blocks fade in via IntersectionObserver.
