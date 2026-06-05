# Mobile Hero — Masked Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the mobile hero's `<video>` in a div carrying the desktop's `hero-mask-clip` silhouette, widen the wrapper to 88vw 5:3, and mount `<HeroMaskClipDef />` so the clipPath resolves.

**Architecture:** Single-component change in `HeroMobile.tsx`. The wrapper is a presentational div — no refs, no GSAP, no event handlers. The SVG mask def already exists; this plan just mounts it on the mobile leaf too. Test file gets two new assertions.

**Tech Stack:** React 18, TypeScript, Tailwind (`w-[88vw]`, `max-w-md`, `aspect-[5/3]`, `overflow-hidden`, `object-cover`), SVG clipPath (existing), Vitest + @testing-library/react.

**Spec:** [`docs/superpowers/specs/2026-05-30-mobile-hero-masked-video-design.md`](../specs/2026-05-30-mobile-hero-masked-video-design.md)

---

## File Structure

**Modified:**
- `src/components/sections/HeroMobile.tsx` — add `HeroMaskClipDef` import, mount it near top of return, wrap the `<video>` in a clip-pathed div, update className on the inner `<video>`.
- `src/components/sections/HeroMobile.test.tsx` — two new tests (mask def mount, wrapper presence).

**Untouched (consumed unchanged):**
- `src/components/ui-custom/HeroMaskClipDef.tsx` — the SVG clipPath def.
- `src/components/sections/HeroDesktop.tsx` — desktop unchanged.
- `src/components/sections/Hero.tsx` — viewport dispatcher unchanged.

---

## Task A: Add failing tests for the mask + wrapper

**Goal:** Land two new tests describing the masked-video structure. Both must fail against the current code (no wrapper, no mask def on mobile).

**Files:**
- Modify: `src/components/sections/HeroMobile.test.tsx`

- [ ] **Step 1: Capture green baseline**

Run: `npm run test -- --run src/components/sections/HeroMobile.test.tsx`

Expected: 16 tests pass, 0 fail.

- [ ] **Step 2: Add the mask-def-mount test**

Append inside the existing `describe('HeroMobile content', ...)` block (after the `marks the decorative video as aria-hidden` test, at the end of the block):

```tsx
  it('mounts the hero-mask-clip SVG def', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const clipPath = container.querySelector('clipPath#hero-mask-clip');
    expect(clipPath).not.toBeNull();
  });
```

- [ ] **Step 3: Add the wrapper test**

Immediately after the test from Step 2, append:

```tsx
  it('wraps the video in a clip-pathed container at 88vw aspect-[5/3]', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { container } = render(<Hero introActive={false} />);
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    const parent = video?.parentElement;
    expect(parent).not.toBeNull();
    expect(parent?.style.clipPath).toBe('url(#hero-mask-clip)');
    expect(parent?.className).toContain('w-[88vw]');
    expect(parent?.className).toContain('aspect-[5/3]');
    expect(parent?.className).toContain('overflow-hidden');
    // The video itself now fills the wrapper rather than carrying its own size.
    expect(video?.className).toContain('w-full');
    expect(video?.className).toContain('h-full');
    expect(video?.className).toContain('object-cover');
    expect(video?.className).not.toContain('w-[60vw]');
    expect(video?.className).not.toContain('aspect-video');
  });
```

- [ ] **Step 4: Run the test file — expect 2 failures**

Run: `npm run test -- --run src/components/sections/HeroMobile.test.tsx`

Expected:
- `mounts the hero-mask-clip SVG def` — FAIL (mobile doesn't render `<HeroMaskClipDef />` yet).
- `wraps the video in a clip-pathed container at 88vw aspect-[5/3]` — FAIL (the video's parent is currently the column wrapper, not a clip-pathed div).
- 16 prior tests — PASS.

Total: 16 pass, 2 fail.

If any prior test fails, stop and investigate — do not proceed.

- [ ] **Step 5: Commit the failing tests**

```bash
git add src/components/sections/HeroMobile.test.tsx
git commit -m "$(cat <<'EOF'
test(hero-mobile): expect silhouette-masked video wrapper

Adds two failing tests: hero-mask-clip SVG def must mount on mobile,
and the <video> must be wrapped in a clip-pathed div sized 88vw with
aspect-[5/3] / overflow-hidden. Implementation follows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task B: Implement the wrapper + mask def mount

**Goal:** Add the import, mount `<HeroMaskClipDef />`, wrap the `<video>`, update video className. All 18 tests pass after this task.

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx`

- [ ] **Step 1: Add the HeroMaskClipDef import**

In `src/components/sections/HeroMobile.tsx`, add this import alongside the existing imports near the top of the file (after the existing `import type { HeroProps } from './HeroDesktop';` line, before `gsap.registerPlugin(...)`):

```tsx
import { HeroMaskClipDef } from '@/components/ui-custom/HeroMaskClipDef';
```

- [ ] **Step 2: Mount `<HeroMaskClipDef />` near the top of the return**

The return currently looks like:

```tsx
  return (
    <div
      data-testid="hero-mobile"
      data-intro-active={introActive ? 'true' : 'false'}
      className="relative w-full min-h-[100svh]"
      style={{ backgroundColor: 'var(--app-bg)' }}
    >
      <div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
        ...
      </div>
    </div>
  );
```

Add `<HeroMaskClipDef />` as the FIRST child of the root `<div data-testid="hero-mobile">`, before the column wrapper:

```tsx
  return (
    <div
      data-testid="hero-mobile"
      data-intro-active={introActive ? 'true' : 'false'}
      className="relative w-full min-h-[100svh]"
      style={{ backgroundColor: 'var(--app-bg)' }}
    >
      <HeroMaskClipDef />
      <div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
        ...
      </div>
    </div>
  );
```

The `HeroMaskClipDef` component is a hidden SVG positioned off-screen — it does not affect layout.

- [ ] **Step 3: Wrap the `<video>` in a clip-pathed div**

Locate the `<video>` element in the column wrapper. It currently looks like:

```tsx
        <video
          data-testid="hero-mobile-video"
          aria-hidden="true"
          src="/hero_main_video.mp4"
          poster="/tropical_jungle.png"
          autoPlay={!prefersReducedMotion}
          muted
          playsInline
          loop
          preload="auto"
          className="w-[60vw] max-w-sm aspect-video object-cover"
        />
```

Replace it with the wrapped form:

```tsx
        <div
          data-testid="hero-mobile-video-mask"
          className="w-[88vw] max-w-md aspect-[5/3] overflow-hidden"
          style={{ clipPath: 'url(#hero-mask-clip)' }}
        >
          <video
            data-testid="hero-mobile-video"
            aria-hidden="true"
            src="/hero_main_video.mp4"
            poster="/tropical_jungle.png"
            autoPlay={!prefersReducedMotion}
            muted
            playsInline
            loop
            preload="auto"
            className="w-full h-full object-cover"
          />
        </div>
```

Changes summarized:

1. The `<video>` is now wrapped by a `<div data-testid="hero-mobile-video-mask">`.
2. The wrapper carries the sizing classes (`w-[88vw] max-w-md aspect-[5/3] overflow-hidden`) plus the inline `clipPath` style.
3. The `<video>` className changes from `w-[60vw] max-w-sm aspect-video object-cover` to `w-full h-full object-cover` so it fills the wrapper.
4. Every other `<video>` attribute is unchanged.

- [ ] **Step 4: Run the test file**

Run: `npm run test -- --run src/components/sections/HeroMobile.test.tsx`

Expected: ALL 18 tests pass. If anything fails, read the failure and fix the implementation (not the test).

Common pitfalls:

- If `parent?.style.clipPath` is `undefined` in the test, the inline style may have been camel-cased differently. Verify the JSX uses `style={{ clipPath: 'url(#hero-mask-clip)' }}` — React serializes camelCase to kebab-case (`clip-path`) but exposes both via the DOM `style` API.
- If the video's parentElement is the column wrapper (not the new mask div), the JSX wasn't actually wrapped — double-check the indentation.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm run test -- --run`

Expected: all tests pass except the pre-existing `garden-scene.test.tsx` failure noted in earlier sessions (not introduced by this task).

- [ ] **Step 6: Commit the implementation**

```bash
git add src/components/sections/HeroMobile.tsx
git commit -m "$(cat <<'EOF'
feat(hero-mobile): wrap video in silhouette mask at 88vw 5:3

Mounts the existing hero-mask-clip SVG def on mobile and wraps the
hero video in a clip-pathed container, matching the desktop's
silhouette framing at a deliberately larger mobile size (88vw
matches the wordmark width). Video fills the wrapper via
object-cover; reduced-motion users see the same poster image
clipped to the silhouette.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task C: Lint + build validation

**Goal:** Verify the changes are lint-clean and type-clean.

- [ ] **Step 1: Run lint, filter to hero files**

Run: `npm run lint 2>&1 | grep -B1 "HeroMobile\|HeroDesktop\|Hero\.tsx" | head -30`

Expected: no output mentioning `HeroMobile.tsx` or `HeroMobile.test.tsx`. Pre-existing issues in other files (e.g. `HeroLoadingOverlay.tsx`) are not in scope.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "HeroMobile|HeroDesktop" || echo "NO TS ERRORS IN HERO FILES"`

Expected: `NO TS ERRORS IN HERO FILES`. Pre-existing TS errors in unrelated files (like `PurposeGrid.tsx`) are not in scope.

- [ ] **Step 3: Nothing to commit if Steps 1-2 are clean**

The implementation commits from Tasks A and B are the deliverable.

---

## Self-Review Notes

- **Spec coverage:** Every spec section maps to a step. Import + mount → Task B Step 1-2. Wrapper structure + sizing → Task B Step 3. Tests → Task A. Lint/build → Task C.
- **No new identifiers introduced beyond `HeroMaskClipDef`** (already exists, just newly imported).
- **No changes to video attributes other than className** — confirmed in Task B Step 3.
- **Commit pattern:** `test(hero-mobile):` → `feat(hero-mobile):` mirrors the prior shipped feature's commit cadence.
