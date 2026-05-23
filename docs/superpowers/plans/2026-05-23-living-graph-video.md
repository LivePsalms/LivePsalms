# Living Graph Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the existing Notepad graph video next to the Living Graph station's text on the Garden of Psalms scroll experience. Plays only when the station is the active scroll target. Reduced-motion users see the poster image only.

**Architecture:** Single React component edit (`stations/02-living-graph.tsx`), one CSS block (`landing.css`), and a Vitest spec. No new assets — points at `public/notepad-landing/graph.{mp4,webm,jpg}` that the PRM-fallback `LivingGraph` already ships.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + jsdom + @testing-library/react. Existing hook `usePrefersReducedMotion`. No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-23-living-graph-video-design.md`](../specs/2026-05-23-living-graph-video-design.md)

---

## File map

- **Modify** `src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx` — wrap text in a grid pair, add `<video>` element, add `useRef` + `useEffect` to gate playback on `isActive` and `prefersReducedMotion`.
- **Modify** `src/notepad-landing/styles/landing.css` — add `.garden-station--living-graph .garden-station-pair` grid rules, `.living-graph-video-wrap` sizing, `.living-graph-video` styling + radial mask, mobile stack inside the existing `@media (max-width: 860px)` block.
- **Modify** `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx` — add a `describe` block for the Living Graph station's video element.

No new files. No package changes. No new assets.

---

### Task 1: Wrap the Living Graph text in a two-column grid pair (layout shell only)

**Files:**
- Modify: `src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx`
- Modify: `src/notepad-landing/styles/landing.css`
- Test: `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx`

This task adds only the layout container so it can be visually validated before pulling in the video element and its lifecycle logic.

- [ ] **Step 1: Write the failing test**

Append this `describe` block to the end of `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx`:

```tsx
describe('<GardenScene /> — Living Graph station layout', () => {
  it('wraps the Living Graph text and (future) video slot in a .garden-station-pair grid', () => {
    renderScene(false);
    const station = document.querySelector('.garden-station--living-graph');
    expect(station).not.toBeNull();
    const pair = station?.querySelector('.garden-station-pair');
    expect(pair).not.toBeNull();
    expect(pair?.querySelector('.garden-station-content--left')).not.toBeNull();
    expect(pair?.querySelector('.living-graph-video-wrap')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- garden-scene.test`
Expected: the new `wraps the Living Graph text…` test FAILS with "expected null not to be null" on `.garden-station-pair`. Other tests still pass.

- [ ] **Step 3: Modify `stations/02-living-graph.tsx` to add the grid pair and empty video slot**

Replace the entire file contents with:

```tsx
// src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationLivingGraph({ isActive }: Props) {
  const { eyebrow, h2, body, supporting, caption } = copy.section03;
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
          {/* video element added in Task 2 */}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Add CSS for the grid pair + mobile stack**

In `src/notepad-landing/styles/landing.css`, insert the desktop block immediately after the existing `.notepad-landing .garden-station-content--right` rule (around line 776):

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
  margin-left: 0;
  max-width: 640px;
  justify-self: end;
}

.notepad-landing .living-graph-video-wrap {
  width: 100%;
  max-width: 640px;
  justify-self: start;
}
```

Then, inside the existing `@media (max-width: 860px)` block (around line 996-999 where `--left` and `--right` are flattened), append:

```css
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- garden-scene.test`
Expected: all tests including the new `wraps the Living Graph text…` test PASS.

- [ ] **Step 6: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx \
        src/notepad-landing/styles/landing.css \
        src/notepad-landing/sections/garden-scene/garden-scene.test.tsx
git commit -m "feat(living-graph): two-column pair layout shell for the active garden station

Wraps the existing text in a 1fr/1fr grid with an empty video slot on
the right. Mobile stacks. No video element yet — that comes next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Render the video element with the existing transcoded assets

**Files:**
- Modify: `src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx`
- Modify: `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx`

Element only. No playback logic — that's Task 3.

- [ ] **Step 1: Write the failing test**

Append a second test inside the existing `describe('<GardenScene /> — Living Graph station layout', ...)` block:

```tsx
  it('renders a muted, looping, playsInline video pointing at the shared graph assets', () => {
    renderScene(false);
    const video = document.querySelector<HTMLVideoElement>('.living-graph-video');
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.getAttribute('playsinline')).not.toBeNull();
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.getAttribute('poster')).toBe('/notepad-landing/graph-poster.jpg');

    const sources = Array.from(video?.querySelectorAll('source') ?? []);
    const srcs = sources.map((s) => s.getAttribute('src'));
    expect(srcs).toContain('/notepad-landing/graph.webm');
    expect(srcs).toContain('/notepad-landing/graph.mp4');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- garden-scene.test`
Expected: the new test FAILS with `expected null not to be null` on `.living-graph-video`.

- [ ] **Step 3: Add the video element to the component**

In `src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx`, replace the empty `.living-graph-video-wrap` div with:

```tsx
        <div className="living-graph-video-wrap">
          <video
            className="living-graph-video"
            poster="/notepad-landing/graph-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="The Notepad Living Graph in motion — nodes representing scriptures and notes connect as the user navigates them."
          >
            <source src="/notepad-landing/graph.webm" type="video/webm" />
            <source src="/notepad-landing/graph.mp4"  type="video/mp4"  />
          </video>
        </div>
```

(`muted`, `loop`, `playsInline` are React JSX boolean props — they emit the HTML attributes correctly.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- garden-scene.test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx \
        src/notepad-landing/sections/garden-scene/garden-scene.test.tsx
git commit -m "feat(living-graph): render video element pointing at shared graph assets

Reuses public/notepad-landing/graph.{mp4,webm} and graph-poster.jpg —
the same assets the PRM-fallback LivingGraph already ships. Element is
muted+loop+playsInline so it can autoplay on iOS. Playback gating in the
next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Gate playback on `isActive` (play when active, pause + reset otherwise)

**Files:**
- Modify: `src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx`
- Modify: `src/notepad-landing/sections/garden-scene/garden-scene.test.tsx`

- [ ] **Step 1: Write the failing tests**

Playback gating depends on the `isActive` prop, which the parent `GardenScene` derives from scroll position. Driving real scroll in jsdom is brittle — test the station component directly. Create a new test file:

`src/notepad-landing/sections/garden-scene/stations/02-living-graph.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StationLivingGraph } from './02-living-graph';

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

describe('<StationLivingGraph /> playback', () => {
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
    render(<StationLivingGraph isActive={false} />);
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays when isActive=true on mount', () => {
    render(<StationLivingGraph isActive={true} />);
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('pauses and resets currentTime to 0 when isActive transitions to false', () => {
    const { rerender } = render(<StationLivingGraph isActive={true} />);
    expect(playSpy).toHaveBeenCalledTimes(1);
    rerender(<StationLivingGraph isActive={false} />);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    const video = document.querySelector<HTMLVideoElement>('.living-graph-video');
    expect(video?.currentTime).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- 02-living-graph.test`
Expected: the new "plays when isActive=true" and "pauses and resets" tests FAIL because the component does not yet call `play()` / `pause()`.

- [ ] **Step 3: Add the playback effect to the component**

Update `stations/02-living-graph.tsx` to add the ref and the effect. Replace the file with:

```tsx
// src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx
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
            poster="/notepad-landing/graph-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="The Notepad Living Graph in motion — nodes representing scriptures and notes connect as the user navigates them."
          >
            <source src="/notepad-landing/graph.webm" type="video/webm" />
            <source src="/notepad-landing/graph.mp4"  type="video/mp4"  />
          </video>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- 02-living-graph.test`
Expected: all three tests PASS.

Then run the broader test: `npm test -- garden-scene`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx \
        src/notepad-landing/sections/garden-scene/stations/02-living-graph.test.tsx
git commit -m "feat(living-graph): play video only when station is active

Adds useEffect that plays on isActive=true and pauses + resets to 0 on
isActive=false. Honors prefers-reduced-motion by never calling play().
Swallows play() rejection (iOS Safari may reject if no prior interaction).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Feathered edges (radial mask) on the video

**Files:**
- Modify: `src/notepad-landing/styles/landing.css`

CSS-only change. No new tests — the mask is purely presentational and is verified visually + (loosely) by the existence of the `.living-graph-video` class which we already assert.

- [ ] **Step 1: Add the video styling to `landing.css`**

After the `.notepad-landing .living-graph-video-wrap` rule added in Task 1, append:

```css
.notepad-landing .living-graph-video {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  background: transparent;
  -webkit-mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
          mask-image: radial-gradient(ellipse 95% 92% at 50% 50%, #000 60%, transparent 100%);
}
```

- [ ] **Step 2: Visually verify in the dev server**

Run: `npm run dev`
Open the printed URL. Scroll into the Garden of Psalms section until you reach the Living Graph station (the second station, roman numeral II). Confirm:

- Text sits on the left half, video sits on the right.
- Video edges fade softly into the garden background (no hard rectangle).
- Video plays only while the station is the active one (the active fade-in matches the play start).
- Scrolling past the station pauses the video.
- Resize the window narrower than ~860px: layout collapses to a single column with text first, then video.

If anything looks wrong, fix in this task before committing.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/notepad-landing/styles/landing.css
git commit -m "style(living-graph): feather video edges with radial mask

Replaces what would have been a hard rectangle with a soft ellipse fade
so the video reads as a vision emerging from the garden rather than a
UI panel pinned on top.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Reduced-motion verification

**Files:**
- Modify: `src/notepad-landing/sections/garden-scene/stations/02-living-graph.test.tsx`

Already implemented in Task 3 (the effect checks `prefersReducedMotion` first). Add explicit test coverage so it doesn't regress.

- [ ] **Step 1: Add the failing test**

Append to `02-living-graph.test.tsx` inside the existing `describe`:

```tsx
  it('never plays when prefers-reduced-motion is set, even with isActive=true', () => {
    installMatchMedia(true); // user has reduced motion on before mount
    render(<StationLivingGraph isActive={true} />);
    expect(playSpy).not.toHaveBeenCalled();
  });
```

This covers the regression contract — if PRM is on at mount, play is never called. The runtime toggle case (PRM flips while the station is active) is exercised by the hook's own test suite, so we don't need to duplicate it here.

- [ ] **Step 2: Run the tests**

Run: `npm test -- 02-living-graph.test`
Expected: all four tests in the file pass.

- [ ] **Step 3: Commit**

```bash
git add src/notepad-landing/sections/garden-scene/stations/02-living-graph.test.tsx
git commit -m "test(living-graph): cover prefers-reduced-motion never-play path

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Final integration check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: every test passes.

- [ ] **Step 2: Run the lint**

Run: `npm run lint`
Expected: no errors. Warnings unchanged from baseline.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: build succeeds. No new warnings about asset size — we're reusing existing files.

- [ ] **Step 4: Visual final check**

Run: `npm run dev`
Walk through:

- Desktop ≥ 1024px wide: text-left, video-right, balanced. Video plays on entry, pauses on exit, restarts cleanly on re-entry.
- Tablet ~ 900px wide: still side-by-side, narrower.
- Mobile ~ 480px wide: stacks, text first, video second, both centered, video still autoplays muted on entry.
- Toggle the OS "Reduce Motion" preference, refresh, and scroll to the station: video should show poster only, no playback.

- [ ] **Step 5: Report completion**

The work is done when:
- All tests pass.
- Lint passes.
- Build succeeds.
- The four visual conditions above hold.

If any check fails, route the failure back to the appropriate task above before reporting done.

---

## Notes for the executor

- The component receives `isActive` from the parent garden scene scroll machinery — don't try to wire scroll detection yourself.
- The video plays muted, so there is no audio to worry about. iOS Safari's autoplay restrictions are satisfied by `muted` + `playsInline`.
- `preload="metadata"` keeps the first-load weight low — the bytes are only fetched once the station scrolls into view.
- Do not introduce a new media query hook. The project already has `usePrefersReducedMotion`.
- Do not add a play button or controls. The decision is explicit in the spec.
- The existing 7-station scroll math (`STATION_META`, `TOTAL_SPACER_VH`) is unchanged. Do not edit `station-meta.ts`.
