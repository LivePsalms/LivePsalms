# Mobile Hero — Pellmell-style Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the mobile hero so the Psalm 23 verse sits directly under the PSALMS wordmark (above the imagery), and replace the static silhouette `<img>` with the existing `/hero_main_video.mp4` sized to ~60vw 16:9, autoplay-looping (with the jungle PNG as poster + reduced-motion fallback).

**Architecture:** Single-component change in `HeroMobile.tsx`. JSX reorder + element swap. Desktop, the viewport dispatcher, the wordmark scroll-collapse timeline, and the bridge copy block are all untouched. Tests live alongside the component in `HeroMobile.test.tsx`.

**Tech Stack:** React 18, TypeScript, Tailwind (`aspect-video`, `w-[60vw]`, `max-w-sm`), GSAP ScrollTrigger (existing wordmark collapse, unchanged), Vitest + @testing-library/react (jsdom).

**Spec:** [`docs/superpowers/specs/2026-05-29-mobile-hero-pellmell-layout-design.md`](../specs/2026-05-29-mobile-hero-pellmell-layout-design.md)

---

## File Structure

**Modified:**
- `src/components/sections/HeroMobile.tsx` — JSX reorder (quote moves above imagery), `<img>` → `<video>`, drop the `SILHOUETTE_SRC` / `SILHOUETTE_ALT` module-level constants, drop the `mt-12` margin on the quote container.
- `src/components/sections/HeroMobile.test.tsx` — flip two existing expectation tests (`<img>` is gone, `<video>` is present), add three new tests (DOM-order quote-before-video, autoplay on when reduced-motion off, autoplay off when reduced-motion on).

**Untouched (consumed unchanged):**
- `src/components/sections/HeroDesktop.tsx` — desktop mask-expand stays.
- `src/components/sections/Hero.tsx` — viewport dispatcher.
- `src/components/sections/hero-bridge-content.ts` — `BRIDGE_COPY` constants.
- `src/notepad-landing/hooks/use-intersection-stage.ts` — `useIntersectionStage` hook.
- `public/tropical_jungle.png` — same asset, now used as `poster` rather than `<img src>`.
- `public/hero_main_video.mp4` — existing asset, now consumed by mobile too.

---

## Task 1: Update the test suite to expect the new layout

**Goal:** Land the test changes first so we can watch them fail before flipping the implementation. Update the two inverted-expectation tests, add three new ones, then run the suite to confirm exactly the expected set fails.

**Files:**
- Modify: `src/components/sections/HeroMobile.test.tsx`

- [ ] **Step 1: Capture green baseline**

Run: `npm run test -- --run src/components/sections/HeroMobile.test.tsx`

Expected: All tests pass. If anything fails, stop and investigate — do not proceed until the baseline is green.

- [ ] **Step 2: Flip the `<video>` absence test to a `<video>` presence test**

In `src/components/sections/HeroMobile.test.tsx`, replace:

```tsx
  it('does NOT render a <video> element', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    expect(container.querySelector('video')).toBeNull();
  });
```

with:

```tsx
  it('renders a <video> with /hero_main_video.mp4 src and /tropical_jungle.png poster', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('/hero_main_video.mp4');
    expect(video?.getAttribute('poster')).toBe('/tropical_jungle.png');
    // Use DOM properties (not hasAttribute) — React may set these as
    // properties rather than attributes on the rendered element.
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
  });
```

- [ ] **Step 3: Flip the silhouette-`<img>` test to assert no `<img>` is rendered**

In the same file, replace:

```tsx
  it('renders the silhouette image as an <img>', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/tropical_jungle.png');
    expect(img?.getAttribute('alt')).toBe('');
  });
```

with:

```tsx
  it('does NOT render the silhouette as an <img> (asset is now a video poster)', async () => {
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    expect(container.querySelector('img[src="/tropical_jungle.png"]')).toBeNull();
  });
```

- [ ] **Step 4: Add a DOM-ordering test (quote precedes video)**

Append this test inside the existing `describe('HeroMobile content', ...)` block in `src/components/sections/HeroMobile.test.tsx`:

```tsx
  it('renders the quote DOM-before the video', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia(true);
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container, getByTestId } = render(<Hero introActive={false} />);
    const quote = getByTestId('hero-mobile-quote');
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING (4) means video appears AFTER quote in the DOM.
    expect(quote.compareDocumentPosition(video!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
```

- [ ] **Step 5: Add an autoplay-on test (no reduced-motion)**

Append this test inside the same `describe('HeroMobile content', ...)` block:

```tsx
  it('sets autoplay on the video when prefers-reduced-motion is NOT set', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia(true);
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    expect(video?.autoplay).toBe(true);
  });
```

Note: the `setMatchMedia(true)` here matches the existing tests in this block — it makes the `(max-width: 767px)` query match so `useIsMobile()` returns `true`. The `prefers-reduced-motion` query also gets `matches: true` from this helper, BUT the existing `setMatchMedia` is naive (returns `matches: true` for every query). That's a problem for the next test. Step 6 fixes both this test and the reduced-motion test by using a query-aware matchMedia helper.

- [ ] **Step 6: Replace the global `setMatchMedia` helper with a query-aware one**

At the top of `src/components/sections/HeroMobile.test.tsx`, replace the existing `setMatchMedia` helper:

```tsx
function setMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
```

with a query-aware version that distinguishes the viewport query from the reduced-motion query:

```tsx
function setMatchMedia(opts: { mobile: boolean; reducedMotion?: boolean }) {
  const { mobile, reducedMotion = false } = opts;
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const matches =
      query.includes('reduce') ? reducedMotion :
      query.includes('max-width') ? mobile :
      false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  }) as unknown as typeof window.matchMedia;
}
```

Then update **every existing call site** in this file:

- Run `grep -n "setMatchMedia" src/components/sections/HeroMobile.test.tsx` to enumerate them.
- Replace each `setMatchMedia(true)` with `setMatchMedia({ mobile: true })` and each `setMatchMedia(false)` with `setMatchMedia({ mobile: false })`.
- The `mounts and unmounts cleanly when prefers-reduced-motion is set` test (currently around line 84-95) inlines its own `window.matchMedia = vi.fn().mockImplementation(...)` block instead of calling the helper. Replace that entire inline mock with a single `setMatchMedia({ mobile: true, reducedMotion: true });` call.

After all replacements, re-run `grep -n "setMatchMedia" src/components/sections/HeroMobile.test.tsx` and verify every call uses the new object-arg form. Also `grep -n "window.matchMedia = vi.fn" src/components/sections/HeroMobile.test.tsx` should return zero hits (the inline mock is gone).

- [ ] **Step 7: Add the reduced-motion autoplay-off test**

Append this test inside the same `describe('HeroMobile content', ...)` block, AFTER the autoplay-on test from Step 5:

```tsx
  it('does NOT set autoplay on the video when prefers-reduced-motion IS set', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true, reducedMotion: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    expect(video?.autoplay).toBe(false);
  });
```

- [ ] **Step 8: Run the test suite to confirm the expected failures**

Run: `npm run test -- --run src/components/sections/HeroMobile.test.tsx`

Expected: the following tests FAIL with reasons matching the new layout:

- `renders a <video> with /hero_main_video.mp4 src and /tropical_jungle.png poster` — FAIL (no `<video>` rendered yet).
- `does NOT render the silhouette as an <img> ...` — FAIL (the `<img>` is still there).
- `renders the quote DOM-before the video` — FAIL (no `<video>` element).
- `sets autoplay on the video when prefers-reduced-motion is NOT set` — FAIL (no `<video>`).
- `does NOT set autoplay on the video when prefers-reduced-motion IS set` — FAIL (no `<video>`).

All other tests in the file MUST still pass. If any unrelated test fails, the matchMedia rewrite in Step 6 missed a call site — go back and fix.

- [ ] **Step 9: Commit the failing tests**

```bash
git add src/components/sections/HeroMobile.test.tsx
git commit -m "$(cat <<'EOF'
test(hero-mobile): expect quote-above-video layout with autoplay video

Flip the no-<video> assertion to a video-with-poster assertion, flip
the silhouette-<img> assertion to its inverse, and add three new tests:
DOM ordering (quote precedes video), autoplay-on when reduced-motion
is off, autoplay-off when reduced-motion is on. Replace the global
setMatchMedia helper with a query-aware variant so the same suite can
toggle viewport and reduced-motion independently.

Implementation (the JSX reorder + <img>→<video> swap) lands in the
next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Implement the JSX reorder + video element

**Goal:** Make the production code change. After this task all tests should pass.

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx`

- [ ] **Step 1: Drop the silhouette constants from the module scope**

In `src/components/sections/HeroMobile.tsx`, delete these two lines near the top of the file:

```tsx
const SILHOUETTE_SRC = '/tropical_jungle.png';
const SILHOUETTE_ALT = '';
```

The asset path now lives inline as the `poster` attribute on the `<video>` element.

- [ ] **Step 2: Reorder JSX + replace `<img>` with `<video>` + drop `mt-12` on the quote**

In `src/components/sections/HeroMobile.tsx`, locate the column wrapper (currently lines 106-165):

```tsx
      <div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
        <PsalmsWordmarkSvg ref={svgRef} className="w-[88vw] max-w-md" />
        <img
          src={SILHOUETTE_SRC}
          alt={SILHOUETTE_ALT}
          className="w-[88vw] max-w-md aspect-[4/5] object-cover opacity-90"
          loading="eager"
          decoding="async"
        />
        <div
          ref={quoteRef}
          data-testid="hero-mobile-quote"
          data-visible={quoteVisible ? 'true' : 'false'}
          className={cn(
            'mt-12 text-center px-6 transition-opacity duration-1000 max-w-md',
            quoteVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          <p className="quote-text italic text-[15px] leading-relaxed">
            "He leads me beside still waters.
          </p>
          <p className="quote-text italic text-[15px] leading-relaxed mt-2">
            He restores my soul."
          </p>
          <p className="quote-attr text-xs opacity-60 mt-4">
            Psalm 23:2-3
          </p>
        </div>
        <div
          ref={bridgeRef}
          ...
        >
          ... bridge copy ...
        </div>
      </div>
```

Replace it with this — quote first, then video, bridge copy unchanged:

```tsx
      <div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
        <PsalmsWordmarkSvg ref={svgRef} className="w-[88vw] max-w-md" />
        <div
          ref={quoteRef}
          data-testid="hero-mobile-quote"
          data-visible={quoteVisible ? 'true' : 'false'}
          className={cn(
            'text-center px-6 transition-opacity duration-1000 max-w-md',
            quoteVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          <p className="quote-text italic text-[15px] leading-relaxed">
            "He leads me beside still waters.
          </p>
          <p className="quote-text italic text-[15px] leading-relaxed mt-2">
            He restores my soul."
          </p>
          <p className="quote-attr text-xs opacity-60 mt-4">
            Psalm 23:2-3
          </p>
        </div>
        <video
          data-testid="hero-mobile-video"
          src="/hero_main_video.mp4"
          poster="/tropical_jungle.png"
          autoPlay={!prefersReducedMotion}
          muted
          playsInline
          loop
          preload="auto"
          className="w-[60vw] max-w-sm aspect-video object-cover"
        />
        <div
          ref={bridgeRef}
          data-testid="hero-mobile-bridge"
          data-visible={bridgeVisible ? 'true' : 'false'}
          className="mt-16 mb-24 text-center px-6 flex flex-col gap-8 max-w-md"
        >
          <p
            className={cn(
              'bridge-line-center text-[15px] leading-relaxed transition-opacity duration-700',
              bridgeVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            {BRIDGE_COPY.invitation}
          </p>
          <p
            className={cn(
              'bridge-thesis text-[15px] leading-relaxed transition-opacity duration-700 delay-200',
              bridgeVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            {BRIDGE_COPY.thesis}
          </p>
          <p
            className={cn(
              'bridge-line-center text-[15px] leading-relaxed transition-opacity duration-700 delay-500',
              bridgeVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            {BRIDGE_COPY.assurance}
          </p>
        </div>
      </div>
```

Changes summarized:

1. The `<img>` element is gone.
2. A new `<video>` element sits immediately after the quote container (quote moved up; video took the imagery slot).
3. The quote container's className drops the leading `'mt-12 '` — vertical spacing now comes entirely from the parent's `gap-8`.
4. The bridge `<div>` is unchanged.

- [ ] **Step 3: Run the HeroMobile test file**

Run: `npm run test -- --run src/components/sections/HeroMobile.test.tsx`

Expected: ALL tests pass — both the existing tests and the five new/flipped ones from Task 1.

If a test fails, read the failure message and fix the implementation (not the test). Common pitfalls:

- React renders `autoPlay={false}` by omitting the `autoplay` attribute — verify the JSX uses `autoPlay={!prefersReducedMotion}` exactly.
- The `playsinline` attribute name on the rendered DOM element is lowercase — `video?.hasAttribute('playsinline')` should pass with the JSX `playsInline` prop.
- The DOM-order test requires the video to appear AFTER the quote in source order. Double-check the JSX order.

- [ ] **Step 4: Run the full test suite to confirm no regressions elsewhere**

Run: `npm run test -- --run`

Expected: ALL tests in the repo pass. The hero change is local; nothing else should be affected.

If any unrelated test fails, investigate — do not move on.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/components/sections/HeroMobile.tsx
git commit -m "$(cat <<'EOF'
feat(hero-mobile): quote above looping video (Pellmell-style layout)

Move the Psalm 23 verse to sit directly under the PSALMS wordmark and
replace the static silhouette <img> with the desktop's hero video at
60vw 16:9. Reduced-motion users get the same jungle PNG as a poster
with autoplay disabled.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Lint, type-check, and build

**Goal:** Catch any TypeScript or lint issues before declaring the work done.

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: zero errors and zero warnings introduced by the change. The repo may have pre-existing warnings elsewhere; only investigate ones that point to `HeroMobile.tsx` or `HeroMobile.test.tsx`.

- [ ] **Step 2: Run the type-checked build**

Run: `npm run build`

Expected: build succeeds. `npm run build` runs `tsc -b` first, so any TypeScript error in the touched files will fail here.

If the build fails on a file we did not touch (pre-existing breakage), stop and ask before proceeding. If it fails in `HeroMobile.tsx` / `HeroMobile.test.tsx`, fix the error in the source and re-run.

- [ ] **Step 3: Optional — manual visual check**

Boot the dev server and inspect at a mobile viewport (375×667 or similar) to confirm:

- Wordmark sits at top, intact.
- Quote sits directly beneath the wordmark, italic, with `Psalm 23:2-3` attribution.
- Video plays automatically, muted, looping, at roughly 60% of the viewport width.
- Bridge copy renders below the video in the existing three-beat layout.
- Toggling DevTools "prefers-reduced-motion: reduce" emulation and reloading shows the poster image instead of an animated frame.

Run: `npm run dev` and open the URL on a mobile viewport. There is no automated way to assert video playback in jsdom, so this is the only place where playback is actually verified.

- [ ] **Step 4: Nothing to commit if Steps 1-3 are clean**

The implementation commits from Tasks 1 and 2 are the deliverable. This task only validates them.

---

## Self-Review Notes

- **Spec coverage:** Every section of the design doc maps to a step here — the JSX reorder, the `<video>` attributes (autoplay/muted/loop/playsinline/poster/preload), the dropped `mt-12`, the removed module constants, the reduced-motion gating, the test additions (DOM order, autoplay on, autoplay off). The "untouched" list in the spec maps to the "Untouched" list in this plan's File Structure.
- **Method/type names:** `prefersReducedMotion` already exists on `HeroMobile`'s function scope (line 50 of the current source); the `autoPlay={!prefersReducedMotion}` reference reuses that variable directly. No new identifiers introduced.
- **Test helper:** the matchMedia rewrite is necessary because the existing helper returns `matches: true` for every query, which would mean the autoplay-on test (which sets `mobile: true`) would inadvertently also set `reducedMotion: true` and the autoplay attribute would never appear. The rewrite makes the helper query-aware and updates all seven call sites in one step.
- **Commit message scope:** two commits — one for tests (`test(hero-mobile): ...`), one for implementation (`feat(hero-mobile): ...`). Matches the project's `feat(mobile-tile): ...` / `docs(mobile-tile): ...` recent-commit pattern.
