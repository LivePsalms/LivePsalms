# Two-Path Interlude — Design Spec

**Date:** 2026-05-17
**Branch:** deepen-architecture
**Status:** Approved (awaiting user spec review)

## Purpose

A quiet, contemplative band that sits between the cinematic WebGPU mid-section
and the purpose grid on the home page. It offers the reader two paths forward:
keep reading (scroll down to the purpose grid) or open the Notepad to write.

This is not a marketing CTA section — it is a moment of stillness between two
visually heavy sections. The pacing, typography, and motion all serve that
"held breath" feeling.

## Placement

Home route only (`/`). Rendered inside the `<main>` block in
`src/App.tsx`, sitting between `<MidSectionMotion />` and
`<PurposeGrid …/>`:

```
Hero → MidSectionMotion → TwoPathInterlude → PurposeGrid
```

## Content

Two short statements, displayed horizontally as left/right columns.

- **Left:** *Let's take a journey through God's word and find the peace that
  returns your joy. Let restoration guide you to serenity.*
- **Right:** *Take a moment to write about where you're at and see how God
  meets you there.*

Each column has a CTA below the statement:

- **Left CTA:** *Read Below* — smooth-scrolls the viewport to the purpose
  grid (target id `#projects`, which already exists on
  `PurposeGrid.tsx:418`).
- **Right CTA:** *Go to Notepad* — navigates to the `/notepad` route via
  react-router's `useNavigate`.

## Layout

- **Height:** 100vh — the section is a full screen of stillness on first view.
- **Background:** `var(--app-bg)` — the warm taupe used elsewhere on the page.
- **Grid:** two equal columns (`grid-template-columns: 1fr 1fr`), aligned
  center vertically.
- **Gap:** `12vw` between the columns, so the hairline sits in real negative
  space rather than a tight gutter.
- **Column width:** `max-width: 380px` each, text centered, padding `0 16px`
  to keep the prose from touching mobile edges.
- **Hairline:** thin 1px vertical rule at the horizontal center of the
  section, color `rgba(58, 47, 36, 0.22)`. It does not extend to the top or
  bottom edges — its top is 28% down the section, its bottom is 28% up. The
  surrounding negative space is the breath.

### Responsive

- **Desktop / tablet ≥ 768px:** two columns side-by-side as described.
- **Mobile < 768px:** columns stack vertically; the vertical hairline becomes
  a short horizontal hairline (`width: 1px → 64px`, `height: 1px`,
  `rotate(0)`) between them. Vertical gap `64px`. Section height becomes
  `auto`, with `padding: 12vh 24px` so the breath remains.

## Typography

Both statements:

- Family: `'Cormorant Garamond', serif`
- Style: italic
- Weight: 300
- Color: `var(--deep-umber)`
- Size: `clamp(22px, 2.4vw, 28px)`
- Line-height: 1.55
- Margin: 0 (centered, no indent)

Both CTAs (matching the statement voice):

- Family: `'Cormorant Garamond', serif`
- Style: italic
- Weight: 400 (one stop heavier than the statement, so it reads as a
  separate beat without breaking voice)
- Color: `var(--deep-umber)`
- Size: ~17px

The CTA is one block: the label sits above its arrow / underline ornament,
gap `14px` between them. The two are part of a single clickable target.

### Arrow & Underline Ornaments

- **Read Below (left):** a 1px-wide vertical line, 28px tall, drawn down from
  the label baseline, with a 6px chevron at the bottom (two 1px borders
  rotated 45°). Continuous animation: translateY(-4px) → translateY(+4px) and
  opacity 0.55 → 1, ease-in-out, 2.6s, infinite. The bob is paused while the
  entrance animation is still running, then starts.
- **Go to Notepad (right):** a 24px horizontal underline, 1px tall, opacity
  0.5. Static (no bob — it's a link, not a scroll cue). On hover, opacity
  ramps to 1 over 200ms.

## Entrance Motion

Triggered by GSAP `ScrollTrigger` once the band is ~30% in view (`start: "top
70%"`, `once: true`). The arrow's continuous bob is paused during entrance
via a class on the section root (e.g. `data-entered="false"`) and starts when
entrance completes.

Sequence:

1. **0.0s** — hairline begins `scaleY(0) → 1` from the center outward, 0.9s,
   `cubic-bezier(0.4, 0, 0.2, 1)`.
2. **0.6s** — both columns fade in and drift inward to settle: left from
   `translateX(+20px)`, right from `translateX(-20px)`, both to
   `translateX(0)` and `opacity 0 → 1`, 1.2s, `cubic-bezier(0.25, 0.7, 0.25,
   1)`.
3. **~1.8s** — entrance complete. `data-entered="true"` is set on the
   section root, which un-pauses the arrow's bob loop.

Initial state (before entrance fires):

- Hairline `transform: scaleY(0); transform-origin: center;`
- Left column `opacity: 0; transform: translateX(20px);`
- Right column `opacity: 0; transform: translateX(-20px);`
- Arrow bob animation `animation-play-state: paused;`

Entrance is one-shot — does not re-fire if the user scrolls away and back.

## Reduced Motion

When `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is true:

- No hairline draw-in. Hairline is present at full scale from the start.
- No radiate-inward drift. Columns are at their final positions from the
  start.
- A single 600ms opacity cross-fade for the whole section, triggered by
  `IntersectionObserver` at `threshold: 0.4` (mirrors the pattern in
  `MidSectionMotion`'s reduced-motion path).
- Arrow `animation` is `none` — rendered static.

The hover-fade on the right underline is kept (it's a 200ms color cue, not
motion that triggers vestibular concerns).

## Interactions

### Read Below (left CTA)

- Element: `<button type="button">` (it's an in-page action, not a
  destination link, so `<button>` is correct).
- Click handler: smooth-scrolls to the purpose grid using
  `document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth',
  block: 'start' })`. The id `projects` already exists on the
  `PurposeGrid.tsx` root section.
- The button is keyboard-focusable; <kbd>Enter</kbd> and <kbd>Space</kbd>
  trigger the same handler.
- Focus-visible: 2px outline in `var(--deep-umber)` with 4px offset, no
  outline on mouse focus.
- `aria-label="Read below — scroll to the purpose grid"`.

### Go to Notepad (right CTA)

- Element: `<Link to="/notepad">` from `react-router-dom`. This is a pure
  navigation (no pre-navigation side effects), so a real anchor is correct:
  it preserves middle-click / Cmd-click / Ctrl-click "open in new tab"
  behavior that buttons would break. Other places in this repo use
  `useNavigate` because they navigate after auth side effects — that pattern
  doesn't fit a static destination link.
- Focus-visible: same treatment as the left button (2px outline in
  `var(--deep-umber)`, 4px offset).
- `aria-label="Go to Notepad"`.

### Scroll target

The purpose grid root `<section>` already has `id="projects"` at
`PurposeGrid.tsx:418`. We reuse that id — **no edit to PurposeGrid
required**. The smooth-scroll handler tolerates the element being absent
(no-op, no throw) so the section degrades gracefully if PurposeGrid is ever
removed.

The header is fixed (`Header.tsx:279`, `position: fixed; top: 0`), but the
purpose grid section already has `pt-44 md:pt-64` (176px / 256px) which
provides ample clearance below the fixed header. No `scroll-margin-top` is
needed — the existing section padding naturally absorbs the header offset.

## File Layout

### New

- `src/components/sections/TwoPathInterlude.tsx` — the component.
- `src/components/sections/two-path-interlude.test.ts` — small unit test
  covering: (a) the component renders both statements, (b) clicking "Read
  Below" calls the scroll function with the right id, (c) clicking "Go to
  Notepad" navigates to `/notepad`, (d) reduced-motion path renders without
  the entrance refs.

### Edited

- `src/App.tsx` — import `TwoPathInterlude`, render between
  `<MidSectionMotion />` and `<PurposeGrid …/>`.
- `src/index.css` — append a `/* ── Two-Path Interlude ── */` block with all
  styles. Mirrors how `MidSectionMotion` styles live in this file.

## Technical Notes

- **GSAP / ScrollTrigger** are already in the project (used by
  `MidSectionMotion`) — reuse, don't add a new motion library.
- **react-router-dom** is already in use (see `App.tsx`). We use its `<Link>`
  for the Notepad CTA, since this is a pure navigation. `useNavigate` is
  used elsewhere in the repo only for post-side-effect navigation (auth
  flows).
- The entrance ScrollTrigger should call `kill()` in the component's cleanup
  to avoid stale refs across hot reloads, matching the pattern at
  `MidSectionMotion.tsx:234`.
- The arrow bob is a pure CSS `@keyframes` animation, not a GSAP tween —
  it's a continuous decorative loop, no scroll dependency. CSS is cheaper
  and easier to gate with `animation-play-state`.

## Out of Scope

- No analytics / event tracking on the CTAs (can be added later if needed).
- No A/B testing harness.
- No additional copy variants (the two statements are final per user
  approval on 2026-05-17).
- No background imagery or texture — solid `--app-bg` only.

## Acceptance Criteria

1. The section renders between the WebGPU mid-section and the purpose grid
   on `/`.
2. Both statements display in Cormorant italic at the correct sizes on
   desktop and mobile.
3. The vertical hairline is visible on desktop and converts to a horizontal
   stub on mobile.
4. On scroll into view, the entrance motion fires once: hairline radiates,
   then both columns settle inward.
5. The arrow under "Read Below" continuously bobs once entrance completes.
6. Clicking "Read Below" smooth-scrolls to the purpose grid.
7. Clicking "Go to Notepad" navigates to `/notepad` via the SPA router (no
   full page reload). Cmd/Ctrl-click and middle-click open `/notepad` in a
   new tab (free with `<Link>`).
8. With `prefers-reduced-motion: reduce`, no motion fires — only a static
   cross-fade on intersection. Arrow is static.
9. Both CTAs are keyboard-focusable with visible focus rings.
10. No console errors or warnings.
