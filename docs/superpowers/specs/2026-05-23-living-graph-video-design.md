# Living Graph Video — Section 2 of the Garden of Psalms

**Status:** Approved (2026-05-23)
**Owner:** Notepad landing page

## Purpose

Add a short, looping product video next to the text in the Living Graph station (section 2 of the Garden of Psalms) on the notepad landing page. The video shows the actual Notepad UI rendering the graph view — it is *evidence* for the section's claim ("A map of how God has been speaking"), not decoration.

Source: `reference/Graph_video.mov` (2260×1278, 20.5s, ~60 MB, .mov).

## Affected files

- `src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx` — add the video element next to the existing text.
- `src/notepad-landing/styles/landing.css` — new styles for the video, the 50/50 layout, mobile stack, edge feathering.
- `public/garden/graph-video.mp4` — new, transcoded MP4 (H.264).
- `public/garden/graph-video.webm` — new, transcoded WebM (VP9).
- `public/garden/graph-poster.jpg` — new, poster still.
- `scripts/transcode-graph-video.sh` — one-shot transcoding script committed for repeatability.

## Layout

50/50 side-by-side at desktop. Text holds the left half (existing `garden-station-content--left` rules), video sits on the right half.

The existing station has `display: flex; align-items: center; justify-content: center` inside an absolutely-positioned full-bleed container. We change the Living Graph station to a two-column grid only — the other six stations keep their current single-column layout.

```
┌───────────────────────────────────────────────────────────┐
│  [text halo, 10% margin]            [video, feathered]    │
│   eyebrow                                                  │
│   headline                          ┌─────────────────┐   │
│   body                              │                 │   │
│   supporting                        │  graph-video    │   │
│   caption                           │                 │   │
│                                     └─────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

- Text column: same `max-width: 640px` and styling as today, but inside a grid cell rather than centered.
- Video column: `max-width: 640px`, `aspect-ratio: 16/9`, vertically centered with the text.
- Gap between columns: ~5vw, capped at 64px.
- Total content width: capped at `min(1280px, 90vw)` so the pair stays balanced on ultra-wide screens.

### Mobile (<860px)

Single column. Text first (eyebrow → h2 → body → supporting → caption), then the video below it with `margin-top: 24px`. Re-uses the existing breakpoint at ~860px that already handles `--left` / `--right` flattening (`landing.css:997`).

The station's `baseVh: 125` in `station-meta.ts` is preserved. On mobile the video must fit inside the same allotment without overflow — at 90vw width and 16:9, the video is ~50.6vh tall, which leaves room for the text inside a 125vh pinned section. No change to `STATION_META` or scroll math.

### Video sizing on desktop

- Width: 44% of station width, max 640px.
- Aspect ratio: 16:9 (matches source's 2260:1278 ≈ 16:9.05).
- Position: vertically centered in the station, mirrored to the text.

## Visual treatment — frameless feathered edges

No card chrome, no shadow, no border. The video element is masked with a soft radial gradient so its edges fade into the garden background rather than sitting on it as a UI panel.

```css
.notepad-landing .living-graph-video {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  -webkit-mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
          mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
  /* No border, no box-shadow */
}
```

Rationale: the video already shows the Notepad UI with its own chrome (header tabs, toolbar, side panel). Wrapping it in another card duplicates the framing. Frameless + soft feathering makes the graph feel like it is emerging from the scene rather than overlaid as a screenshot.

## Playback behavior

Active-gated muted loop. Plays only while this station's `isActive` prop is `true`. Resets to `currentTime = 0` when leaving so the next entry shows the loop from the top.

```tsx
useEffect(() => {
  const v = videoRef.current;
  if (!v) return;
  if (isActive) {
    void v.play().catch(() => { /* iOS may reject if not interacted-with; harmless */ });
  } else {
    v.pause();
    v.currentTime = 0;
  }
}, [isActive]);
```

### Element

```tsx
<video
  ref={videoRef}
  className="living-graph-video"
  poster="/garden/graph-poster.jpg"
  preload="metadata"
  muted
  loop
  playsInline
  aria-label="The Notepad Living Graph in motion — nodes representing scriptures and notes connect as the user navigates them."
>
  <source src="/garden/graph-video.webm" type="video/webm" />
  <source src="/garden/graph-video.mp4"  type="video/mp4"  />
</video>
```

Notes:
- `preload="metadata"` — fetches just enough to know duration + show poster, defers the bytes until needed.
- `muted` + `playsInline` — required for autoplay on mobile Safari.
- `loop` — built-in loop; no JS timer needed.
- `aria-label` — describes the video for assistive tech since there's no audio narration.

### Reduced motion

Users with `prefers-reduced-motion: reduce` see only the poster image. We do not attempt to play.

Use the existing hook at `src/notepad-landing/hooks/use-prefers-reduced-motion.ts`:

```tsx
import { usePrefersReducedMotion } from '../../../hooks/use-prefers-reduced-motion';

const prefersReducedMotion = usePrefersReducedMotion();
useEffect(() => {
  const v = videoRef.current;
  if (!v) return;
  if (prefersReducedMotion) {
    v.pause();
    return; // never play, regardless of isActive
  }
  if (isActive) void v.play().catch(() => {});
  else { v.pause(); v.currentTime = 0; }
}, [isActive, prefersReducedMotion]);
```

## Assets — transcoding

Run once and commit the outputs. Script: `scripts/transcode-graph-video.sh`. It is idempotent and safe to re-run.

### Targets

| File | Codec | Resolution | Target size | Notes |
|------|-------|------------|-------------|-------|
| `public/garden/graph-video.mp4` | H.264 (libx264) | 1280×720 | ~1.5–2.0 MB | Universal baseline. CRF 28, slow preset. `+faststart` for streaming start. |
| `public/garden/graph-video.webm` | VP9 (libvpx-vp9) | 1280×720 | ~1.0–1.5 MB | Modern browsers prefer this. CRF 34, `-b:v 0`. |
| `public/garden/graph-poster.jpg` | JPEG (mozjpeg via ffmpeg) | 1280×720 | ~60–100 KB | Single representative frame, taken at ~5s in. |

Source is 2260×1278. We display at most ~640px wide on desktop, so 1280×720 is 2× retina coverage and sufficient. Audio is stripped (`-an`) since the video is muted.

### Script

`scripts/transcode-graph-video.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SRC="reference/Graph_video.mov"
OUT_DIR="public/garden"
mkdir -p "$OUT_DIR"

# MP4 (H.264) — universal
ffmpeg -y -i "$SRC" \
  -vf "scale=1280:-2,format=yuv420p" \
  -c:v libx264 -preset slow -crf 28 -movflags +faststart \
  -an \
  "$OUT_DIR/graph-video.mp4"

# WebM (VP9) — smaller for modern browsers
ffmpeg -y -i "$SRC" \
  -vf "scale=1280:-2" \
  -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 \
  -an \
  "$OUT_DIR/graph-video.webm"

# Poster JPEG
ffmpeg -y -ss 5 -i "$SRC" \
  -frames:v 1 \
  -vf "scale=1280:-2" \
  -q:v 4 \
  "$OUT_DIR/graph-poster.jpg"

echo "Done. Sizes:"
du -h "$OUT_DIR"/graph-video.mp4 "$OUT_DIR"/graph-video.webm "$OUT_DIR"/graph-poster.jpg
```

The script requires `ffmpeg` (already installed; verified via `ffprobe` during brainstorming). If the resulting files are over ~2.5 MB each, raise CRF by 2 and re-run. If under ~1 MB and quality is suffering, lower CRF by 2.

### Loop quality

If the source has dead frames at the start or end that make the loop jarring, trim with `-ss <start> -to <end>` on both encodes before shipping. Watch the loop boundary once after generating to decide.

## Component changes

### `02-living-graph.tsx`

```tsx
import { useEffect, useRef } from 'react';
import { copy } from '../../../data/copy';
import { usePrefersReducedMotion } from '../../../hooks/use-prefers-reduced-motion';

interface Props { isActive: boolean }

export function StationLivingGraph({ isActive }: Props) {
  const { eyebrow, h2, body, supporting, caption } = copy.section03;
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (prefersReducedMotion) { v.pause(); return; }
    if (isActive) {
      void v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive, prefersReducedMotion]);

  return (
    <article
      id="section-03"
      className={`garden-station garden-station--living-graph${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-pair">
        <div className="garden-station-content garden-station-content--left">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
          <p className="caption">{caption}</p>
        </div>
        <div className="living-graph-video-wrap">
          <video
            ref={videoRef}
            className="living-graph-video"
            poster="/garden/graph-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="The Notepad Living Graph in motion — nodes representing scriptures and notes connect as the user navigates them."
          >
            <source src="/garden/graph-video.webm" type="video/webm" />
            <source src="/garden/graph-video.mp4"  type="video/mp4"  />
          </video>
        </div>
      </div>
    </article>
  );
}
```

### CSS additions in `landing.css`

```css
/* Living Graph two-column pair */
.notepad-landing .garden-station--living-graph .garden-station-pair {
  width: 100%;
  max-width: min(1280px, 90vw);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(24px, 5vw, 64px);
  align-items: center;
}

.notepad-landing .garden-station--living-graph .garden-station-content--left {
  margin-left: 0; /* override the global 10% — grid handles position */
  max-width: 640px;
  justify-self: end;
}

.notepad-landing .living-graph-video-wrap {
  width: 100%;
  max-width: 640px;
  justify-self: start;
}

.notepad-landing .living-graph-video {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  -webkit-mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
          mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
  background: transparent;
}

@media (max-width: 860px) {
  .notepad-landing .garden-station--living-graph .garden-station-pair {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .notepad-landing .garden-station--living-graph .garden-station-content--left {
    justify-self: center;
    max-width: 90vw;
  }
  .notepad-landing .living-graph-video-wrap {
    justify-self: center;
    max-width: 90vw;
  }
}
```

The existing `.garden-station-content::before` halo continues to work because the text column still has `.garden-station-content` on it.

## Performance budget

- Total new bytes on first load: 0 (video has `preload="metadata"` so only headers fetch).
- Total bytes when station first plays: ≤ 2 MB (one of mp4/webm depending on browser).
- Poster is fetched on first paint of the station: ≤ 100 KB JPEG.
- Lighthouse expectation: no LCP regression because the hero is unchanged; the Living Graph station is below the fold and lazy-loaded by virtue of `preload="metadata"`.

## Testing

- `garden-scene.test.tsx` already validates station rendering — extend it (or add a sibling test) to assert:
  - The `<video>` element is rendered when the Living Graph station mounts.
  - The video has `muted`, `loop`, `playsInline` attributes set.
  - When `isActive` becomes `false`, `videoRef.current.pause` is called and `currentTime` is reset (mock the ref).
  - When `prefers-reduced-motion: reduce` is matched, `play` is never called.

Run: `npm test`.

Visual verification: start dev server, scroll to the Living Graph station, confirm the video plays muted on entry and pauses on exit, and that mobile (≤860px) stacks correctly.

## Out of scope

- No play/pause controls.
- No scroll-scrubbed timeline.
- No captions/subtitles (video is muted, no spoken content).
- No analytics events for video play.
- No changes to the other six garden stations.

## Open risks

- iOS Safari occasionally rejects programmatic `play()` even on muted+playsInline if the page hasn't been interacted with. Mitigated by `.catch(() => {})` — the poster remains visible and the user sees the static frame if autoplay is denied.
- If the source has a hard cut at frame 0 / end, the loop may flash. Eyeball the loop after transcoding; trim with `-ss/-to` if needed.
