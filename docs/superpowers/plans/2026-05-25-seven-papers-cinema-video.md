# Seven Papers Cinema Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `notepad-cinema.mp4` cinematic template montage next to the existing text in Station V (Seven Papers) of the Garden of Psalms, using the exact same visual + playback pattern as Station II (Living Graph).

**Architecture:** Mirror the Living Graph implementation. Convert the centered text-only `StationSevenPapers` component into a two-column `garden-station-pair` with text on the left and a feathered 16:9 video on the right. Transcode `reference/notepad_template_video/renders/notepad-cinema.mp4` into MP4/WebM/poster outputs under `public/notepad-landing/`. Add scoped CSS adjacent to the existing pair rules in `landing.css`. Gate playback on `isActive` and honor `prefers-reduced-motion` via the existing hook.

**Tech Stack:** React 18 + TypeScript + Vite, vitest + @testing-library/react (jsdom), plain CSS (no preprocessor), ffmpeg (system binary) for asset transcode.

**Spec:** [docs/superpowers/specs/2026-05-25-seven-papers-cinema-video-design.md](../specs/2026-05-25-seven-papers-cinema-video-design.md)

---

## File Structure

**Create:**
- `scripts/transcode-templates-video.sh` — one-shot ffmpeg script (mirrors `scripts/transcode-verses-video.sh`)
- `public/notepad-landing/templates.mp4` — transcode output (committed binary, ≤4.5 MB target)
- `public/notepad-landing/templates.webm` — transcode output (committed binary, ≤3 MB target)
- `public/notepad-landing/templates-poster.jpg` — poster frame (committed binary, ≤180 KB target)
- `src/notepad-landing/sections/garden-scene/stations/05-seven-papers.test.tsx` — playback gating tests (mirrors `04-scripture-margin.test.tsx`)

**Modify:**
- `src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx` — convert centered text to a two-column pair with a `<video>`
- `src/notepad-landing/styles/landing.css` — add scoped rules under `.garden-station--seven-papers` (desktop block adjacent to existing pair blocks; mobile rules inside the existing 768px media query)
- `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx` — append a `<GardenScene /> — Seven Papers station layout` describe block

**No changes to:**
- `src/notepad-landing/data/copy.ts` (the unused `papers: [...]` array stays defined but unrendered — explicitly out of scope per the spec)
- Any other garden station

---

## Task 1: Transcode script + assets

**Files:**
- Create: `scripts/transcode-templates-video.sh`
- Create (binary output): `public/notepad-landing/templates.mp4`
- Create (binary output): `public/notepad-landing/templates.webm`
- Create (binary output): `public/notepad-landing/templates-poster.jpg`

- [ ] **Step 1: Verify the source asset exists and ffmpeg is available**

Run:
```bash
ls -la reference/notepad_template_video/renders/notepad-cinema.mp4
which ffmpeg
ffmpeg -version | head -1
```

Expected: file is ~7.7 MB; ffmpeg prints a version (4.x or 6.x both fine). If ffmpeg is missing, install via `brew install ffmpeg` before continuing.

- [ ] **Step 2: Write the transcode script**

Create `scripts/transcode-templates-video.sh` with this exact content:

```bash
#!/usr/bin/env bash
set -euo pipefail

SRC="reference/notepad_template_video/renders/notepad-cinema.mp4"
OUT_DIR="public/notepad-landing"
mkdir -p "$OUT_DIR"

# MP4 (H.264) — universal
ffmpeg -y -i "$SRC" \
  -vf "format=yuv420p" \
  -c:v libx264 -preset slow -crf 26 -movflags +faststart \
  -an \
  "$OUT_DIR/templates.mp4"

# WebM (VP9) — smaller for modern browsers
ffmpeg -y -i "$SRC" \
  -c:v libvpx-vp9 -b:v 0 -crf 32 -row-mt 1 \
  -an \
  "$OUT_DIR/templates.webm"

# Poster JPEG — frame at 9.0s (mid-clip, inside a steady frame, not a crossfade)
ffmpeg -y -ss 9.0 -i "$SRC" \
  -frames:v 1 \
  -q:v 4 \
  "$OUT_DIR/templates-poster.jpg"

echo "Done. Sizes:"
du -h "$OUT_DIR"/templates.mp4 "$OUT_DIR"/templates.webm "$OUT_DIR"/templates-poster.jpg
```

- [ ] **Step 3: Make the script executable and run it**

Run:
```bash
chmod +x scripts/transcode-templates-video.sh
./scripts/transcode-templates-video.sh
```

Expected: ffmpeg prints progress for each output; final line lists the three file sizes. The .webm transcode (VP9) takes longer than the .mp4 (1–3 minutes is normal).

- [ ] **Step 4: Verify outputs are within size budgets**

Run:
```bash
du -h public/notepad-landing/templates.mp4 \
      public/notepad-landing/templates.webm \
      public/notepad-landing/templates-poster.jpg
```

Expected:
- `templates.mp4` ≤ 4.5 MB
- `templates.webm` ≤ 3.0 MB
- `templates-poster.jpg` ≤ 180 KB

If any output exceeds budget by more than 20%, raise its CRF by 2 in the script (mp4: 26 → 28; webm: 32 → 34) and re-run. Do NOT lower CRF below the script defaults — that produces larger files and visible compression on the slow crossfades.

- [ ] **Step 5: Sanity-check the poster frame is not mid-crossfade**

Run:
```bash
open public/notepad-landing/templates-poster.jpg
```

Expected: a single notepad paper template in clear focus, not a half-faded blur. If it lands on a crossfade (~5s, ~7s, ~10s, ~13s, ~16s are crossfade windows per the source DESIGN.md), change `-ss 9.0` in the script to `-ss 11.5` and re-run Step 3 + Step 4 + Step 5.

- [ ] **Step 6: Verify the .mp4 plays end-to-end in a browser**

Run:
```bash
open public/notepad-landing/templates.mp4
```

Expected: plays from 0:00 to ~0:18 without dropped frames; blur crossfades look smooth, no banding in the dark backdrop.

- [ ] **Step 7: Commit the script and assets together**

```bash
git add scripts/transcode-templates-video.sh \
        public/notepad-landing/templates.mp4 \
        public/notepad-landing/templates.webm \
        public/notepad-landing/templates-poster.jpg
git commit -m "$(cat <<'EOF'
chore(seven-papers): add transcode script + cinema video assets

Three deliverables for Station V cinema video. Transcode script is
idempotent and matches the verses-video pattern. Assets sized for
≤640px display width at retina; poster is a mid-clip steady frame
(not a crossfade window).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Failing structural test for the new pair

**Files:**
- Modify: `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx` (append after the existing Scripture Margin describe block, around line 123)

- [ ] **Step 1: Write the failing test block**

Append this exact block at the end of `garden-scene.test.tsx`:

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

- [ ] **Step 2: Run only this describe block to confirm it fails as expected**

Run:
```bash
npx vitest run src/notepad-landing/sections/garden-scene/garden-scene.test.tsx -t "Seven Papers station layout"
```

Expected: 2 tests, both FAIL.
- Test 1 fails because the current `05-seven-papers.tsx` renders a `garden-station-content--center` div with no `.garden-station-pair` wrapper.
- Test 2 fails because no `.seven-papers-video` element exists yet.

Exact failure messages should mention `.garden-station-pair` and `.seven-papers-video` not being found.

- [ ] **Step 3: Do NOT commit yet** — failing tests stay uncommitted until Task 4 makes them pass. Move to Task 3.

---

## Task 3: Failing playback test file

**Files:**
- Create: `src/notepad-landing/sections/garden-scene/stations/05-seven-papers.test.tsx`

- [ ] **Step 1: Create the test file**

Create `src/notepad-landing/sections/garden-scene/stations/05-seven-papers.test.tsx` with this exact content:

```tsx
// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StationSevenPapers } from './05-seven-papers';

type Listener = (event: { matches: boolean }) => void;
function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const mql = {
    get matches() { return matches; },
    addEventListener: (_e: 'change', l: Listener) => { listeners.add(l); },
    removeEventListener: (_e: 'change', l: Listener) => { listeners.delete(l); },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return { fire: (n: boolean) => { matches = n; listeners.forEach((l) => l({ matches: n })); } };
}

describe('<StationSevenPapers /> playback', () => {
  const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => Promise.resolve());
  const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => {});

  beforeEach(() => {
    installMatchMedia(false);
    playSpy.mockClear();
    pauseSpy.mockClear();
  });
  afterEach(() => cleanup());

  it('does not play on mount when isActive=false', () => {
    render(<StationSevenPapers isActive={false} />);
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays when isActive=true on mount', () => {
    render(<StationSevenPapers isActive={true} />);
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('pauses and resets currentTime to 0 when isActive transitions to false', () => {
    const { rerender } = render(<StationSevenPapers isActive={true} />);
    expect(playSpy).toHaveBeenCalledTimes(1);
    rerender(<StationSevenPapers isActive={false} />);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    const video = document.querySelector<HTMLVideoElement>('.seven-papers-video');
    expect(video?.currentTime).toBe(0);
  });

  it('never plays when prefers-reduced-motion is set, even with isActive=true', () => {
    installMatchMedia(true); // user has reduced motion on before mount
    render(<StationSevenPapers isActive={true} />);
    expect(playSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the new test file to confirm all four tests fail as expected**

Run:
```bash
npx vitest run src/notepad-landing/sections/garden-scene/stations/05-seven-papers.test.tsx
```

Expected: 4 tests, all FAIL — the current component has no video, so `playSpy` is never called (test 2 fails on the `toHaveBeenCalledTimes(1)` assertion), and `.seven-papers-video` doesn't exist (test 3 fails on the currentTime query).

- [ ] **Step 3: Do NOT commit yet** — failing tests stay uncommitted until Task 4 makes them pass. Move to Task 4.

---

## Task 4: Implement the component to make Tasks 2 + 3 tests pass

**Files:**
- Modify: `src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx` (full rewrite)

- [ ] **Step 1: Replace the file contents**

Overwrite `src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx` with:

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

- [ ] **Step 2: Run the structural tests (Task 2) to confirm they pass**

Run:
```bash
npx vitest run src/notepad-landing/sections/garden-scene/garden-scene.test.tsx -t "Seven Papers station layout"
```

Expected: 2 tests PASS.

- [ ] **Step 3: Run the playback tests (Task 3) to confirm they pass**

Run:
```bash
npx vitest run src/notepad-landing/sections/garden-scene/stations/05-seven-papers.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 4: Run the entire garden-scene test directory to confirm no regressions**

Run:
```bash
npx vitest run src/notepad-landing/sections/garden-scene/
```

Expected: every test in the directory passes — including the existing Living Graph, Scripture Margin, GardenScene structural, and PRM fallback tests.

If the `<GardenScene /> — PRM mode` test "renders all seven section components from FallbackStack" still passes, that confirms the heading `/choose the paper that asks/i` still matches (we kept the `h2` text unchanged).

- [ ] **Step 5: Commit component + tests together**

```bash
git add src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx \
        src/notepad-landing/sections/garden-scene/stations/05-seven-papers.test.tsx \
        src/notepad-landing/sections/garden-scene/garden-scene.test.tsx
git commit -m "$(cat <<'EOF'
feat(seven-papers): pair the text with the cinema template video

Station V (Seven Papers) was text-only and centered. Wrap the existing
copy in a garden-station-pair grid with text on the left and a 16:9
video on the right, pointing at the templates assets transcoded in the
prior commit. Playback is gated on isActive and short-circuits under
prefers-reduced-motion, mirroring StationLivingGraph and
StationScriptureMargin exactly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add the scoped CSS

**Files:**
- Modify: `src/notepad-landing/styles/landing.css` (add desktop block after the Scripture Margin block around line 849; add mobile rules inside the existing `@media (max-width: 768px)` block around line 1105)

- [ ] **Step 1: Add the desktop pair rules**

Open `src/notepad-landing/styles/landing.css`. Locate the existing block that ends with `.scripture-margin-video` (around line 845–849, ending with `aspect-ratio: 1 / 1;` and `display: block;`). Immediately after the closing brace of `.scripture-margin-video`, insert:

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

- [ ] **Step 2: Add the mobile rules inside the existing 768px media query**

Locate the existing `@media (max-width: 768px)` block (around line 1075). Inside it, immediately after the existing Scripture Margin mobile rules (the block ending with `.scripture-margin-video-wrap { justify-self: center; max-width: 90vw; }`), insert:

```css
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
```

The indentation must match the rules already inside the media query (two-space indent). Do NOT open a new `@media` block — these rules go inside the existing one.

- [ ] **Step 3: Verify the file still parses (no stray braces) by running the dev server briefly**

Run:
```bash
npm run dev
```

Wait for `VITE … ready in …ms` (≈1–2 seconds). If Vite reports a CSS parse error, the new block has a misplaced or missing brace — fix it before continuing. Stop the dev server with Ctrl+C once you see the ready message.

- [ ] **Step 4: Run the entire test suite to confirm no regressions from CSS additions**

CSS doesn't affect jsdom tests directly, but run the full suite anyway to catch any accidental file corruption:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Build to confirm the production bundle compiles**

Run:
```bash
npm run build
```

Expected: `tsc -b` passes (no TypeScript errors from Task 4), `vite build` produces `dist/` with no warnings about unresolved imports or missing assets. The build output should list `templates.mp4`, `templates.webm`, and `templates-poster.jpg` as copied static assets under `dist/notepad-landing/`.

- [ ] **Step 6: Commit the CSS**

```bash
git add src/notepad-landing/styles/landing.css
git commit -m "$(cat <<'EOF'
style(seven-papers): scope two-column pair + feathered 16:9 video rules

Adds the desktop grid and mobile stack rules for Station V, identical
in shape to the Living Graph block (16:9 aspect, radial-mask feather,
transparent background). New .seven-papers-video class does not collide
with any existing rule, so no reset block is needed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Visual verification in a browser

**Files:** none (manual visual check)

- [ ] **Step 1: Start the dev server**

Run:
```bash
npm run dev
```

Wait for the `VITE … ready` line. Note the local URL (typically `http://localhost:5173`).

- [ ] **Step 2: Open the notepad landing page and scroll to Station V**

Open the URL printed by Vite. Navigate to the notepad landing route (whatever your local routing exposes — typically `/notepad-landing` or the path shown on the home page). Scroll through the Garden of Psalms until Station V (Seven Papers — eyebrow reads "— SEVEN PAPERS —") is the active station.

Expected on a viewport ≥769px:
- Text column on the left (eyebrow / headline / body) with right-justified column placement.
- Video column on the right showing the templates montage, autoplaying when the station becomes active.
- Video edges are softly feathered (no hard rectangle) and dissolve into the cream paper background.
- Video aspect is 16:9 (clearly wider than tall).
- Scrolling away from Station V pauses the video and rewinds it to frame 0; scrolling back resumes from the poster.

- [ ] **Step 3: Confirm prefers-reduced-motion behavior**

In macOS System Settings → Accessibility → Display → "Reduce motion": toggle ON. Reload the page. Scroll to Station V.

Expected: the video does NOT autoplay. The poster frame stays visible. (Toggle Reduce motion back OFF when done.)

- [ ] **Step 4: Confirm mobile stack**

Open Chrome DevTools → device toolbar → set viewport to 375×667 (iPhone SE). Scroll to Station V.

Expected: single column, text first, video below, both centered, video occupies ~90vw width.

- [ ] **Step 5: Confirm Station IV (Scripture Margin) is unchanged**

Scroll up one station. Verify the Scripture Margin square video still has crisp (non-feathered) edges — confirming Task 5's CSS additions did not leak into adjacent stations.

- [ ] **Step 6: Stop the dev server**

Ctrl+C in the terminal running `npm run dev`.

- [ ] **Step 7: No commit required for this task** — it is verification-only. If any of Steps 2–5 failed, the failure points back to a specific earlier task (transcoding for video issues, Task 4 for component structure, Task 5 for layout/blend issues). Fix at the source, re-run the relevant test from that task, and re-do Task 6 verification.

---

## Self-Review Checklist

- **Spec coverage:**
  - Affected files (spec §"Affected files") → Tasks 1, 2, 3, 4, 5 ✓
  - Layout grid + sizing (spec §"Layout") → Task 5 desktop CSS ✓
  - Mobile breakpoint (spec §"Layout / Mobile") → Task 5 Step 2 ✓
  - Feathered mask treatment (spec §"Visual treatment") → Task 5 `.seven-papers-video` rule ✓
  - Active-gated playback + PRM (spec §"Playback behavior") → Task 4 component + Task 3 tests ✓
  - Transcoding script + asset budgets (spec §"Assets — transcoding") → Task 1 ✓
  - Component code (spec §"Component changes") → Task 4 Step 1 ✓
  - CSS additions (spec §"CSS additions in `landing.css`") → Task 5 ✓
  - Structural test + playback tests (spec §"Tests") → Tasks 2 and 3 ✓
  - Out-of-scope items (no controls, no analytics, no copy.ts edits, source stays in reference/) → not implemented (correct) ✓

- **No placeholders:** every code block is complete; every command is exact; no "TBD" or "similar to above."

- **Type consistency:** `StationSevenPapers` exported from `05-seven-papers.tsx` (Task 4) is imported by `05-seven-papers.test.tsx` (Task 3) with matching name. Class names `garden-station--seven-papers`, `garden-station-content--left`, `seven-papers-video-wrap`, `seven-papers-video` are identical across the component (Task 4), the CSS (Task 5), and both test files (Tasks 2 + 3). Asset paths `/notepad-landing/templates.{mp4,webm}` and `/notepad-landing/templates-poster.jpg` are identical across the transcode script (Task 1), the component (Task 4), and the structural tests (Task 2).
