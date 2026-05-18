# Purpose Grid — "Devotions" Watermark — Design Spec

**Date:** 2026-05-18
**Branch:** deepen-architecture
**Status:** Approved (awaiting user spec review)

## Purpose

Add a quiet, decorative "Devotions" wordmark to the top-left of the Purpose
Grid section. It frames the section with editorial restraint — present enough
to register as intentional, faded enough to never compete with the photo grid
or the RESTORATION / SERENITY filter row beneath it.

This is purely typographic ornament. The word is not a heading, not a filter,
not an interactive element. It does not affect the section's information
hierarchy or behavior — it adds visual character only.

## Placement

The watermark lives inside the existing `<section>` in
[src/components/sections/PurposeGrid.tsx](../../../src/components/sections/PurposeGrid.tsx),
as the first child of the section element, before the filter-tabs wrapper.
It is absolutely positioned within the section, anchored to the top-left.

```
<section id="projects" …>
  <span class="pg-devotions-watermark" aria-hidden="true">Devotions</span>
  <div ref={filterWrapRef}> … <FilterTabs … /> </div>
  <div ref={gridRef}> … grid items … </div>
</section>
```

The section currently has no explicit `position` value. As part of this change,
`position: relative` is added to the section's inline `style` (next to the
existing `background: 'var(--app-bg)'`) so the watermark's `position: absolute`
resolves against the section box. This is the only change to the section's
existing layout properties.

## Content

Single decorative word: **Devotions** (plural).

Marked `aria-hidden="true"`. Screen readers skip it — it conveys no information
beyond what the filter row and grid already provide.

## Typography

| Property | Value |
|---|---|
| Font family | Cormorant Garamond, serif |
| Font style | Italic |
| Font weight | 300 |
| Letter spacing | `0.005em` |
| Line height | `0.9` |
| Color | `var(--deep-umber)` (`#3A3426`) |
| Opacity | `0.32` |

Cormorant Garamond is already loaded site-wide via the existing
`@import` in [src/index.css](../../../src/index.css) — no new font request.

## Sizing

| Breakpoint | Font size |
|---|---|
| Default (mobile) | `4.2rem` |
| `md` and up (≥ 768px) | `7.2rem` |

## Position

Anchored to the left half of the Purpose Grid section, dropped well below
the section's top edge so the watermark sits close to the filter row, and
inset far enough from the left edge to read as pulled toward center while
still clearly left-anchored.

| Breakpoint | `top` | `left` |
|---|---|---|
| Default (mobile) | `1.5rem` | `2.5rem` |
| `md` and up | `3rem` | `6rem` |

`pointer-events: none` so the word never intercepts clicks or hover targets
for anything that might overlap it during the grid's pinned morph.

## Vertical breathing room — section top padding

The watermark sits low within the section's top padding zone, so it reads
as adjacent to the filter row rather than as a separate band. The section's
existing top padding is `pt-44 md:pt-64` (~11rem / 16rem):

- **Mobile:** watermark top at `1.5rem`, filter row begins around the
  existing `pt-44` boundary — yielding ~5–6em of vertical gap between them.
- **Desktop (md+):** watermark top at `3rem`, filter row begins around the
  existing `pt-64` boundary — yielding ~6–7em of vertical gap between them.

No change to the section's existing top padding is required; the watermark
fits within it. If the rendered gap proves too tight in real pixels, the
acceptance criteria are scoped against the visual brief (see
**Acceptance criteria** below).

## Motion

The watermark fades in on scroll, matching the existing filter-row reveal in
[PurposeGrid.tsx:175-202](../../../src/components/sections/PurposeGrid.tsx#L175).

```ts
gsap.fromTo(
  watermark,
  { opacity: 0, y: 20, filter: 'blur(8px)' },
  {
    opacity: 0.32,
    y: 0,
    filter: 'blur(0px)',
    ease: 'power2.out',
    duration: 1,
    scrollTrigger: {
      trigger: section,
      start: 'top 85%',
      end: 'top 20%',
      scrub: 5,
      invalidateOnRefresh: true,
    },
  }
);
```

Notes:
- Target opacity is `0.32`, **not** `1`. The animation ends at the watermark's
  resting visual state.
- `y` offset is `20` (smaller than the filters' `40`) so the watermark
  settles before the filters do — appropriate for a quieter element.
- Effect is registered inside a new `useEffect` next to the existing filter
  reveal effect, using the same `gsap.context` pattern.

## Accessibility & reduced motion

- `aria-hidden="true"` — screen readers ignore the word.
- Reduced motion is handled by the existing project pattern: the
  `gsap.context` + `ScrollTrigger.scrub` combination follows the same
  conventions as the other reveals in this section. If the user prefers
  reduced motion, the scrubbed tween still resolves to its final state on
  scroll; no additional handling is required for visual fidelity.
- The watermark contributes no interactive elements and no focus order.

## Implementation surface

Two files change. No new files.

### 1. `src/components/sections/PurposeGrid.tsx`

- Add a `watermarkRef = useRef<HTMLSpanElement>(null)` next to the existing
  refs.
- Add `position: 'relative'` to the section's existing inline `style` object
  (alongside `background: 'var(--app-bg)'`).
- Add a `<span>` as the first child of the `<section>`:
  ```tsx
  <span
    ref={watermarkRef}
    aria-hidden="true"
    className="pg-devotions-watermark"
  >
    Devotions
  </span>
  ```
- Add one `useEffect` that mirrors the filter-row reveal pattern, wiring the
  scroll-linked tween described in **Motion**.

### 2. `src/index.css`

Add one CSS class:

```css
.pg-devotions-watermark {
  position: absolute;
  top: 1.5rem;
  left: 2.5rem;
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 300;
  font-size: 4.2rem;
  line-height: 0.9;
  letter-spacing: 0.005em;
  color: var(--deep-umber);
  opacity: 0.32;
  pointer-events: none;
}

@media (min-width: 768px) {
  .pg-devotions-watermark {
    top: 3rem;
    left: 6rem;
    font-size: 7.2rem;
  }
}
```

The class is placed near the other section-scoped rules in `index.css`
(`pg-img`, `pg-hover-overlay`).

## Layering

The watermark and the filter row do not vertically overlap — the watermark
sits in the section's top padding band, while the filter row sits beneath
that band. Stacking order therefore does not matter functionally. `z-index`
is not set on the watermark; `pointer-events: none` is sufficient to prevent
it from intercepting any interaction in the region.

## Out of scope

- No new fonts, design tokens, or color additions.
- No changes to the filter-tab content, the category data
  (`src/data/projects.ts`), or the grid items.
- No new interactive behavior. The word is decorative only.
- No changes to the Two-Path Interlude that sits above this section.

## Acceptance criteria

1. The word "Devotions" appears at the top-left of the Purpose Grid section
   on both mobile and `md+` breakpoints, with the typography, color, and
   opacity specified above.
2. There is a clearly readable vertical gap between the watermark and the
   filter row — the watermark visibly occupies its own band in the section's
   top padding zone (not pinned tight to the filters).
3. On scroll into the Purpose Grid section, the watermark fades in along
   with the filter row, ending at its resting opacity of `0.32`.
4. The word does not intercept clicks or hover targets, and is not announced
   by screen readers.
5. Lighthouse / axe-core accessibility checks against the home route show no
   new violations attributable to this change.
6. No regression in the existing Purpose Grid behaviors (strip → grid morph,
   filter switching, hover overlays).
