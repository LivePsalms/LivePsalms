# Scripture Margin Video — Section IV of the Garden of Psalms

**Status:** Approved (2026-05-23)
**Owner:** Notepad landing page
**Companion spec:** `2026-05-23-living-graph-video-design.md` (this spec mirrors the same pattern with a few targeted differences)

## Purpose

Add a short, looping product video next to the text in the Scripture Margin station (section IV, file `04-scripture-margin.tsx`, copy key `section05`) on the notepad landing page. The video shows a Notepad note ("Psalm 23 — The Shepherd I Need") with inline scripture references that act as live, clickable links — exactly the product feature the section's text describes.

Source: `reference/verses_video.mov` (1188×1186 — essentially square, 32.7s, ~28 MB).

## Differences from the Living Graph spec

This spec follows the Living Graph pattern (50/50 grid pair, frameless feathered video, active-gated playback, PRM fallback, mobile stack). Four targeted differences:

| Concern | Living Graph (section II) | Scripture Margin (section IV) |
|---|---|---|
| **Side** | text left, video right (text uses `--left`) | text right, video left (text uses `--right`) |
| **Aspect ratio** | 16:9 (source is 2260×1278) | 1:1 (source is 1188×1186) |
| **Assets** | reused existing `/notepad-landing/graph.*` | new transcode → `/notepad-landing/verses.{mp4,webm,jpg}` |
| **Class name** | `.garden-station--living-graph` | `.garden-station--scripture-margin` (already present) |
| **Video class** | `.living-graph-video` (collides with PRM fallback rule — needs reset block) | `.scripture-margin-video` (new, no collisions) |

Everything else — playback behavior, reduced-motion fallback, mobile breakpoint, mask shape — is identical.

## Affected files

- `src/notepad-landing/sections/garden-scene/stations/04-scripture-margin.tsx` — modify
- `src/notepad-landing/styles/landing.css` — modify (add scoped rules; do not touch existing rules)
- `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx` — extend
- `src/notepad-landing/sections/garden-scene/stations/04-scripture-margin.test.tsx` — new file (playback gating tests)
- `public/notepad-landing/verses.mp4` — new asset
- `public/notepad-landing/verses.webm` — new asset
- `public/notepad-landing/verses-poster.jpg` — new asset
- `scripts/transcode-verses-video.sh` — new one-shot script committed for repeatability

## Layout

50/50 grid at desktop, video on left, text on right. Mirror of the Living Graph layout. The text column already has `--right` modifier — we override its `margin-right: 10%` to `0` inside the grid cell, same trick as Living Graph's `--left` override.

```
┌───────────────────────────────────────────────────────────┐
│  [video, square, feathered]      [text halo, 10% margin]  │
│                                                            │
│  ┌──────────────────┐            eyebrow                   │
│  │                  │            headline                  │
│  │  verses-video    │            body                      │
│  │   (1:1)          │            supporting                │
│  │                  │                                      │
│  └──────────────────┘                                      │
└───────────────────────────────────────────────────────────┘
```

- Grid: `grid-template-columns: 1fr 1fr`, gap `clamp(24px, 5vw, 64px)`, vertically centered, max width `min(1280px, 90vw)`.
- Text column: `max-width: 640px`, `justify-self: start`.
- Video column: `max-width: 540px` (smaller cap than Living Graph's 640px because a square 640px video would feel oversized vertically), `justify-self: end`, `aspect-ratio: 1 / 1`.

### DOM order vs visual order

DOM order: text first, video second. This preserves screen-reader reading order (eyebrow → headline → body → video as supporting illustration). Desktop visual swap is handled by grid placement (`grid-column: 1` on the video, `grid-column: 2` on the text). On mobile we collapse to a single column following DOM order — text first, video second — same as Living Graph.

### Mobile (<768px)

Single column, text first, video second, both `justify-self: center`. Re-use the existing `@media (max-width: 768px)` block.

## Visual treatment

Frameless. Same radial-gradient mask as Living Graph, but the video is square so the ellipse parameters stay the same — `ellipse 95% 92% at 50% 50%` works for both shapes because the percentages are relative to the box.

## Playback behavior

Identical to Living Graph: active-gated muted loop with `currentTime` reset on exit, `usePrefersReducedMotion` short-circuits play.

## Assets — transcoding

Run once with `scripts/transcode-verses-video.sh` and commit the outputs.

| File | Codec | Resolution | Target size |
|------|-------|------------|-------------|
| `public/notepad-landing/verses.mp4` | H.264 | 1080×1080 | ≤ 2.0 MB |
| `public/notepad-landing/verses.webm` | VP9 | 1080×1080 | ≤ 1.5 MB |
| `public/notepad-landing/verses-poster.jpg` | JPEG | 1080×1080 | ≤ 100 KB |

Source 1188×1186; 1080×1080 is ~2× retina coverage for a 540px display max. Audio stripped (`-an`).

### Script

`scripts/transcode-verses-video.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SRC="reference/verses_video.mov"
OUT_DIR="public/notepad-landing"
mkdir -p "$OUT_DIR"

ffmpeg -y -i "$SRC" \
  -vf "scale=1080:1080,format=yuv420p" \
  -c:v libx264 -preset slow -crf 28 -movflags +faststart \
  -an \
  "$OUT_DIR/verses.mp4"

ffmpeg -y -i "$SRC" \
  -vf "scale=1080:1080" \
  -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 \
  -an \
  "$OUT_DIR/verses.webm"

ffmpeg -y -ss 5 -i "$SRC" \
  -frames:v 1 \
  -vf "scale=1080:1080" \
  -q:v 4 \
  "$OUT_DIR/verses-poster.jpg"

echo "Done. Sizes:"
du -h "$OUT_DIR"/verses.mp4 "$OUT_DIR"/verses.webm "$OUT_DIR"/verses-poster.jpg
```

Idempotent; safe to re-run. If sizes exceed targets, raise CRF by 2 and re-run.

## Component changes

```tsx
// src/notepad-landing/sections/garden-scene/stations/04-scripture-margin.tsx
import { useEffect, useRef } from 'react';
import { copy } from '../../../data/copy';
import { usePrefersReducedMotion } from '../../../hooks/use-prefers-reduced-motion';

interface Props { isActive: boolean }

export function StationScriptureMargin({ isActive }: Props) {
  const { eyebrow, h2, body, supporting } = copy.section05;
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (prefersReducedMotion) {
      v.pause();
      return;
    }
    if (isActive) {
      void v.play().catch(() => { /* iOS may reject; poster stays visible */ });
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive, prefersReducedMotion]);

  return (
    <article
      id="section-05"
      className={`garden-station garden-station--scripture-margin${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-pair garden-station-pair--video-left">
        <div className="garden-station-content garden-station-content--right">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
        </div>
        <div className="scripture-margin-video-wrap">
          <video
            ref={videoRef}
            className="scripture-margin-video"
            poster="/notepad-landing/verses-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="The Notepad with inline scripture references — typing a verse reference makes it a live, clickable link inside the prose."
          >
            <source src="/notepad-landing/verses.webm" type="video/webm" />
            <source src="/notepad-landing/verses.mp4"  type="video/mp4"  />
          </video>
        </div>
      </div>
    </article>
  );
}
```

The modifier `.garden-station-pair--video-left` is what triggers the desktop visual swap. DOM order stays text-first.

## CSS additions in `landing.css`

Add near the existing Living Graph pair rules (after them, keep all "garden-station-pair" rules adjacent):

```css
/* Scripture Margin two-column pair (mirror of Living Graph with video on the left) */
.notepad-landing .garden-station--scripture-margin .garden-station-pair {
  width: 100%;
  max-width: min(1280px, 90vw);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(24px, 5vw, 64px);
  align-items: center;
}

.notepad-landing .garden-station--scripture-margin .garden-station-content--right {
  margin-right: 0;
  max-width: 640px;
  justify-self: start;
  /* Visually placed in column 2 even though it's first in DOM */
  grid-column: 2;
}

.notepad-landing .scripture-margin-video-wrap {
  width: 100%;
  max-width: 540px;
  justify-self: end;
  /* Visually placed in column 1 even though it's second in DOM */
  grid-column: 1;
}

.notepad-landing .scripture-margin-video {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: block;
  background: transparent;
  -webkit-mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
          mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
}

@media (max-width: 768px) {
  .notepad-landing .garden-station--scripture-margin .garden-station-pair {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .notepad-landing .garden-station--scripture-margin .garden-station-content--right {
    justify-self: center;
    max-width: 90vw;
    /* Restore DOM order on mobile — text first, video second */
    grid-column: auto;
  }
  .notepad-landing .scripture-margin-video-wrap {
    justify-self: center;
    max-width: 90vw;
    grid-column: auto;
  }
}
```

Place the mobile rules INSIDE the existing `@media (max-width: 768px)` block (the same one that holds the Living Graph mobile rules), not in a new query. The block above shows the rules in context — the implementer will splice them in.

The new `.scripture-margin-video` class does NOT collide with any existing unscoped rule (`.living-graph-video` did; this one does not). No reset block is required.

## Tests

### `garden-scene.test.tsx` — structural test

Append to the existing file, after the Living Graph block:

```tsx
describe('<GardenScene /> — Scripture Margin station layout', () => {
  it('wraps the Scripture Margin text and video in a .garden-station-pair grid', () => {
    renderScene(false);
    const station = document.querySelector('.garden-station--scripture-margin');
    expect(station).not.toBeNull();
    const pair = station?.querySelector('.garden-station-pair');
    expect(pair).not.toBeNull();
    expect(pair?.querySelector('.garden-station-content--right')).not.toBeNull();
    expect(pair?.querySelector('.scripture-margin-video-wrap')).not.toBeNull();
  });

  it('renders a muted, looping, playsInline video pointing at the verses assets', () => {
    renderScene(false);
    const video = document.querySelector<HTMLVideoElement>('.scripture-margin-video');
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.getAttribute('playsinline')).not.toBeNull();
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.getAttribute('poster')).toBe('/notepad-landing/verses-poster.jpg');
    const sources = Array.from(video?.querySelectorAll('source') ?? []);
    const srcs = sources.map((s) => s.getAttribute('src'));
    expect(srcs).toContain('/notepad-landing/verses.webm');
    expect(srcs).toContain('/notepad-landing/verses.mp4');
  });
});
```

### `04-scripture-margin.test.tsx` — new file mirroring `02-living-graph.test.tsx`

Same four tests, same `installMatchMedia` helper, same prototype spies. The only differences: import `StationScriptureMargin` and look for `.scripture-margin-video` (the class name distinguishes which station's video is being controlled).

## Performance and a11y

Identical to Living Graph. Same `preload="metadata"`, same iOS autoplay strategy, same PRM honoring, same poster-only fallback.

## Out of scope

- No controls / scrub / captions.
- No analytics.
- No changes to the other six garden stations.
- Source video remains untouched in `reference/` (not shipped to web).
