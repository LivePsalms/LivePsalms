# Seven Papers Cinema Video — Station V of the Garden of Psalms

**Status:** Approved (2026-05-25)
**Owner:** Notepad landing page
**Companion specs:** `2026-05-23-living-graph-video-design.md` (this spec mirrors that pattern exactly with new asset + class names), `2026-05-23-scripture-margin-video-design.md` (sibling station IV)

## Purpose

Add a looping cinematic video next to the text in the Seven Papers station — Station V of the Garden of Psalms (`05-seven-papers.tsx`, copy key `section06`). The station today is text-only and centered; the video gives the "seven paper styles" line a visual that *is* a slow drift through five paper templates joined by cinematic blur crossfades. The footage carries the meaning the words describe.

The user's instruction was direct: **"make it the same as the Living Graph video."** This spec therefore mirrors `2026-05-23-living-graph-video-design.md` with only the differences a different station requires.

## Differences from the Living Graph spec

| Concern | Living Graph (Station II) | Seven Papers (Station V) |
|---|---|---|
| **Side** | text left, video right | text left, video right *(identical)* |
| **Aspect ratio** | 16:9 | 16:9 *(identical — source is 1920×1080)* |
| **Source asset** | `reference/.../graph_video.mov` → `/notepad-landing/graph.{mp4,webm}` | `reference/notepad_template_video/renders/notepad-cinema.mp4` → `/notepad-landing/templates.{mp4,webm,jpg}` |
| **Station class** | `.garden-station--living-graph` | `.garden-station--seven-papers` |
| **Video class** | `.living-graph-video` (collides with the PRM fallback hero rule — required a `position: static` reset block) | `.seven-papers-video` (new — no collisions, no reset needed) |
| **Component file** | `02-living-graph.tsx` | `05-seven-papers.tsx` |
| **Test file** | `02-living-graph.test.tsx` | new `05-seven-papers.test.tsx` (mirrors `04-scripture-margin.test.tsx`) |

Everything else — playback gating, prefers-reduced-motion behavior, mask shape, mobile breakpoint, frameless treatment, grid sizing — is identical to Living Graph.

## Why the Living Graph pattern (not Scripture Margin)

Station IV (Scripture Margin) recently removed the radial mask (commit `3a8cf8f — "let video have crisp edges"`). The rule that fell out of that decision: **square close-up product captures get crisp edges; cinematic 16:9 footage keeps the feathered mask.** The new asset is the latter — a "premium cinematic montage" per its own `DESIGN.md` — so it lives with Living Graph. This spec does not alter the Scripture Margin decision.

## Affected files

- `src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx` — modify (becomes a pair with video)
- `src/notepad-landing/styles/landing.css` — modify (add scoped rules adjacent to the existing Living Graph and Scripture Margin pair blocks; touch nothing else)
- `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx` — extend (structural test for the new pair)
- `src/notepad-landing/sections/garden-scene/stations/05-seven-papers.test.tsx` — new file (playback gating tests)
- `public/notepad-landing/templates.mp4` — new asset
- `public/notepad-landing/templates.webm` — new asset
- `public/notepad-landing/templates-poster.jpg` — new asset
- `scripts/transcode-templates-video.sh` — new one-shot script, committed for repeatability

The unused `papers: [...]` array of seven named papers in `copy.ts` `section06` stays in place but stays unrendered. Removing it is out of scope; keeping it preserves the option to surface the seven names below the video in a future iteration.

## Layout

50/50 grid at desktop, text on left, video on right. Identical to the Living Graph layout — no `--video-left` modifier is needed because we're not swapping sides.

```
┌───────────────────────────────────────────────────────────┐
│  [text, 10% margin]           [video, 16:9, feathered]    │
│                                                            │
│  eyebrow                       ┌─────────────────────┐    │
│  headline                      │                     │    │
│  body                          │  templates video    │    │
│                                │   (16:9)            │    │
│                                │                     │    │
│                                └─────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

- Grid: `grid-template-columns: 1fr 1fr`, gap `clamp(24px, 5vw, 64px)`, vertically centered, max width `min(1280px, 90vw)`.
- Text column: `max-width: 640px`, `justify-self: end`.
- Video column: `max-width: 640px`, `justify-self: start`, `aspect-ratio: 16 / 9`.

### DOM order

Text first, video second — preserves screen-reader reading order (eyebrow → headline → body → video as supporting illustration). Visual order matches DOM order, so no `grid-column` assignments are needed.

### Mobile (≤768px)

Inside the existing `@media (max-width: 768px)` block: collapse to a single column following DOM order — text first, video second, both `justify-self: center`, `max-width: 90vw`. Same shape as the Living Graph mobile rules.

## Visual treatment

Frameless. Same radial-gradient mask as Living Graph: `mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%)`. The ellipse percentages are relative to the box, so they work at 16:9 the same way they work for Living Graph. The video's black cinematic backdrop dissolves into the cream paper at the edges, making it feel "part of the garden" without forcing the surrounding page into a dark stage.

The video element has `background: transparent` so the mask transition is genuine — no opaque rectangle leaks past the soft edge.

## Playback behavior

Identical to Living Graph and Scripture Margin: active-gated muted loop with `currentTime` reset on exit, `usePrefersReducedMotion` short-circuits play. iOS-safe — `play()` is awaited with a swallowed catch so a rejected autoplay leaves the poster visible.

## Assets — transcoding

Run once with `scripts/transcode-templates-video.sh` and commit the outputs. Targets are sized for the ≤640px display width (≈1280px at 2× retina, but we keep `1080p` since the source is already 1080p).

| File | Codec | Resolution | Target size |
|------|-------|------------|-------------|
| `public/notepad-landing/templates.mp4` | H.264 | 1920×1080 | ≤ 4.5 MB |
| `public/notepad-landing/templates.webm` | VP9 | 1920×1080 | ≤ 3.0 MB |
| `public/notepad-landing/templates-poster.jpg` | JPEG | 1920×1080 | ≤ 180 KB |

Source: `reference/notepad_template_video/renders/notepad-cinema.mp4` (1920×1080, 18.5s, H.264, 7.7 MB). Audio stripped (`-an`). Source resolution is kept because the cinematic crossfades preserve detail throughout the run — downscaling further would risk visible compression on the slow fades.

### Script

`scripts/transcode-templates-video.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SRC="reference/notepad_template_video/renders/notepad-cinema.mp4"
OUT_DIR="public/notepad-landing"
mkdir -p "$OUT_DIR"

ffmpeg -y -i "$SRC" \
  -vf "format=yuv420p" \
  -c:v libx264 -preset slow -crf 26 -movflags +faststart \
  -an \
  "$OUT_DIR/templates.mp4"

ffmpeg -y -i "$SRC" \
  -c:v libvpx-vp9 -b:v 0 -crf 32 -row-mt 1 \
  -an \
  "$OUT_DIR/templates.webm"

# Poster frame: take it at 9.0s — roughly the midpoint of the 18.5s run,
# during a crisp clip rather than mid-crossfade.
ffmpeg -y -ss 9.0 -i "$SRC" \
  -frames:v 1 \
  -q:v 4 \
  "$OUT_DIR/templates-poster.jpg"

echo "Done. Sizes:"
du -h "$OUT_DIR"/templates.mp4 "$OUT_DIR"/templates.webm "$OUT_DIR"/templates-poster.jpg
```

Idempotent; safe to re-run. If sizes exceed targets, raise CRF by 2 and re-run.

## Component changes

```tsx
// src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx
import { useEffect, useRef } from 'react';
import { copy } from '../../../data/copy';
import { usePrefersReducedMotion } from '../../../hooks/use-prefers-reduced-motion';

interface Props { isActive: boolean }

export function StationSevenPapers({ isActive }: Props) {
  const { eyebrow, h2, body } = copy.section06;
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
      id="section-06"
      className={`garden-station garden-station--seven-papers${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-pair">
        <div className="garden-station-content garden-station-content--left">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{h2}</h2>
          <p className="body">{body}</p>
        </div>
        <div className="seven-papers-video-wrap">
          <video
            ref={videoRef}
            className="seven-papers-video"
            poster="/notepad-landing/templates-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="A cinematic drift through the seven paper styles available in the Notepad — Linen, Vellum, Margin, Dotted Crème, Ruled Walnut, Communion, and Folio."
          >
            <source src="/notepad-landing/templates.webm" type="video/webm" />
            <source src="/notepad-landing/templates.mp4"  type="video/mp4"  />
          </video>
        </div>
      </div>
    </article>
  );
}
```

Note: the previous version of this component used `garden-station-content--center`; this change moves it to `--left` and wraps it in the `garden-station-pair` grid. No props change.

## CSS additions in `landing.css`

Add immediately after the existing Scripture Margin pair rules, keeping all "garden-station-pair" rules adjacent for grep-ability:

```css
/* Seven Papers two-column pair (same shape as Living Graph; cinematic 16:9, feathered) */
.notepad-landing .garden-station--seven-papers .garden-station-pair {
  width: 100%;
  max-width: min(1280px, 90vw);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(24px, 5vw, 64px);
  align-items: center;
}

.notepad-landing .garden-station--seven-papers .garden-station-content--left {
  margin-left: 0;
  max-width: 640px;
  justify-self: end;
}

.notepad-landing .seven-papers-video-wrap {
  width: 100%;
  max-width: 640px;
  justify-self: start;
}

.notepad-landing .seven-papers-video {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  object-fit: cover;
  background: transparent;
  -webkit-mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
          mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
}
```

The corresponding mobile rules go INSIDE the existing `@media (max-width: 768px)` block (the one already holding Living Graph and Scripture Margin mobile rules), not a new query:

```css
@media (max-width: 768px) {
  /* …existing Living Graph and Scripture Margin mobile rules… */

  .notepad-landing .garden-station--seven-papers .garden-station-pair {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .notepad-landing .garden-station--seven-papers .garden-station-content--left {
    justify-self: center;
    max-width: 90vw;
  }
  .notepad-landing .seven-papers-video-wrap {
    justify-self: center;
    max-width: 90vw;
  }
}
```

The new `.seven-papers-video` class does not collide with any existing rule. No reset block is required (unlike Living Graph, which needed one because of the PRM-fallback hero collision).

## Tests

### `garden-scene.test.tsx` — structural test

Append after the existing Scripture Margin block:

```tsx
describe('<GardenScene /> — Seven Papers station layout', () => {
  it('wraps the Seven Papers text and video in a .garden-station-pair grid', () => {
    renderScene(false);
    const station = document.querySelector('.garden-station--seven-papers');
    expect(station).not.toBeNull();
    const pair = station?.querySelector('.garden-station-pair');
    expect(pair).not.toBeNull();
    expect(pair?.querySelector('.garden-station-content--left')).not.toBeNull();
    expect(pair?.querySelector('.seven-papers-video-wrap')).not.toBeNull();
  });

  it('renders a muted, looping, playsInline video pointing at the templates assets', () => {
    renderScene(false);
    const video = document.querySelector<HTMLVideoElement>('.seven-papers-video');
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.getAttribute('playsinline')).not.toBeNull();
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.getAttribute('poster')).toBe('/notepad-landing/templates-poster.jpg');
    const sources = Array.from(video?.querySelectorAll('source') ?? []);
    const srcs = sources.map((s) => s.getAttribute('src'));
    expect(srcs).toContain('/notepad-landing/templates.webm');
    expect(srcs).toContain('/notepad-landing/templates.mp4');
  });
});
```

### `05-seven-papers.test.tsx` — new file

Mirror of `04-scripture-margin.test.tsx`: same `installMatchMedia` helper, same `playSpy`/`pauseSpy` prototype mocks, same four tests:

1. Does not play on mount when `isActive=false`.
2. Plays when `isActive=true` on mount.
3. Pauses and resets `currentTime` to 0 when `isActive` transitions to false.
4. Never plays when prefers-reduced-motion is set, even with `isActive=true`.

Only differences: import `StationSevenPapers` from `./05-seven-papers`, and look for `.seven-papers-video` in test 3's `currentTime` assertion.

## Performance and a11y

Identical to Living Graph. Same `preload="metadata"` (no full download until the user reaches the station), same iOS autoplay strategy (muted + playsInline + swallowed promise rejection), same PRM honoring (the video never plays, the poster carries the visual), same active-gating (when the station scrolls out, playback pauses and rewinds so we never burn cycles on offscreen video).

The `aria-label` on the video describes the seven paper styles by name so screen-reader users know what the silent montage is showing.

## Out of scope

- No controls / scrub / captions.
- No analytics.
- No changes to any other garden station.
- No surfacing of the seven paper names below the video (the `papers: [...]` array in `copy.ts` stays defined but unrendered, as it is today).
- Source file remains in `reference/notepad_template_video/` (not shipped to web).
- No new `.webm` companion strategy beyond the one this script produces — same approach as the existing two videos.
