// Five-beat meditative slideshow shown over the scrubbed mid-section video.
// Same italic Cormorant voice as the Hero bridge and the Psalm 23:2-3 verse —
// this section is spiritually a continuation of the bridge, past the verse.
export const BEATS = [
  'This is a digital space to release the weight of the day, breathe, and reset before life asks anything more of you.',
  'A slow finding of your way back to the wholeness — body, mind, spirit — that has been waiting for you the whole time.',
  'A space that holds a single thought long enough for it to become a prayer — and for the prayer to become a record of what God is teaching you.',
  'Reconnect with yourself. With the One who has been waiting. The threshold between the noise and the sanctuary that has always lived inside you.',
  "No matter what the day is doing. No matter what the news is doing. The peace you've been looking for isn't out there. It's a room inside you have the capability to return to, anytime.",
] as const;

// Reading-relative GSAP timeline progress points for the pinned mid-section stage.
// Values express positions within the 5-beat reading band as a 0..1 range, NOT
// positions on the full pinned timeline. Each beat has:
//   enter      — when its enter tween starts (opacity 0→1, y 20→0)
//   holdStart  — when it reaches full opacity at resting position
//   holdEnd    — when its exit tween starts (opacity 1→0, y 0→−20)
//   exit       — when it has fully exited
// Kiss handoff: beatN.exit === beatN+1.enter, so beat N+1's enter tween
// starts exactly as beat N's exit tween finishes — back-to-back, never a gap.
//
// WebGPU consumer offsets/scales these into the reading band via
// `mapBeatProgressWebGPU` from ./mid-section-intensity (intro/outro bookends).
// Video consumer uses the raw values (no bookends).
export const MID_SECTION_PIN_TIMING = {
  beat1: { enter: 0,    holdStart: 0.04, holdEnd: 0.16, exit: 0.20 },
  beat2: { enter: 0.20, holdStart: 0.24, holdEnd: 0.36, exit: 0.40 },
  beat3: { enter: 0.40, holdStart: 0.44, holdEnd: 0.56, exit: 0.60 },
  beat4: { enter: 0.60, holdStart: 0.64, holdEnd: 0.76, exit: 0.80 },
  beat5: { enter: 0.80, holdStart: 0.84, holdEnd: 0.96, exit: 1.00 },
} as const;

// Exact duration in seconds of public/mid-section-video.mp4 per ffprobe.
// Used as the end-value for the GSAP currentTime tween so scroll progress
// 0..1 maps to a clean 0..duration scrub across all 241 frames at 24 fps.
// If the asset is re-encoded, update this value to match the new ffprobe output.
export const MID_SECTION_VIDEO_DURATION = 10.041667;
