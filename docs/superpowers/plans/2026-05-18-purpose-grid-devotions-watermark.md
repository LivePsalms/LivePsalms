# Purpose Grid — "Devotions" Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a decorative "Devotions" wordmark to the top-left of the Purpose Grid section, lifted into the section's top padding band above the RESTORATION / SERENITY filter row, with a scroll-linked opacity fade matching the existing filter-row reveal.

**Architecture:** A single absolutely-positioned `<span>` is added as the first child of the Purpose Grid `<section>`. Styling lives in a new CSS class in `src/index.css`. The section gets `position: relative` added to its inline style so the watermark anchors against the section box. A new `useEffect` registers a scrub-style GSAP ScrollTrigger that fades the watermark from `0` to `0.32` opacity as the section enters the viewport — mirroring the existing filter-row reveal pattern.

**Tech Stack:** React 18, TypeScript, Tailwind (via Vite), GSAP 3 + ScrollTrigger (already used in `PurposeGrid.tsx`), Cormorant Garamond (already loaded via Google Fonts in `index.css`).

**Spec:** [docs/superpowers/specs/2026-05-18-purpose-grid-devotions-watermark-design.md](../specs/2026-05-18-purpose-grid-devotions-watermark-design.md)

---

## File Structure

**Modify:**
- `src/index.css` — add one CSS class `.pg-devotions-watermark` (and its `md+` override) in the Purpose Grid CSS region, right after the existing `.pg-hover-overlay` block (around line 586).
- `src/components/sections/PurposeGrid.tsx` — add a `watermarkRef`, render the `<span>` as the first child of the `<section>`, add `position: 'relative'` to the section's inline `style`, and add one `useEffect` that wires the scroll-linked reveal.

No new files. No new dependencies.

---

## Task 1: Add the CSS class for the watermark

**Files:**
- Modify: `src/index.css` (insert new rule block right after the `.pg-hover-overlay` block, before the `/* TipTap Notepad Editor */` heading — around line 586–588).

- [ ] **Step 1: Add the CSS rule**

Open `src/index.css`. Find this block (around line 578–586):

```css
/* Hover overlay: hidden by default (mobile + strip), shown in grid mode */
.pg-hover-overlay {
  display: none !important;
}
@media (min-width: 768px) {
  [data-layout='grid'] .pg-hover-overlay {
    display: flex !important;
  }
}
```

Immediately after the closing `}` of the `@media` block, **before** the `/* TipTap Notepad Editor */` comment, insert:

```css
/* Decorative "Devotions" watermark in the top-left of the Purpose Grid
   section. Sits in the section's top padding band, above the filter row.
   Starts invisible — GSAP scroll-linked reveal in PurposeGrid.tsx tweens
   opacity to its resting decorative value of 0.32. */
.pg-devotions-watermark {
  position: absolute;
  top: 1.4rem;
  left: 1rem;
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 300;
  font-size: 2.6rem;
  line-height: 0.9;
  letter-spacing: 0.005em;
  color: var(--deep-umber);
  opacity: 0;
  pointer-events: none;
}

@media (min-width: 768px) {
  .pg-devotions-watermark {
    top: 1.6rem;
    left: 2rem;
    font-size: 4.4rem;
  }
}
```

- [ ] **Step 2: Verify the file still parses**

Run from project root:

```bash
npx vite build --mode development 2>&1 | tail -20
```

Expected: Build completes without CSS parse errors (any pre-existing warnings unrelated to this change are fine).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "$(cat <<'EOF'
feat(purpose-grid): add Devotions watermark CSS class

Adds .pg-devotions-watermark with desktop + mobile sizing. Starts at
opacity 0 — GSAP scroll-linked reveal in PurposeGrid.tsx tweens to 0.32.
EOF
)"
```

---

## Task 2: Render the watermark span inside PurposeGrid

**Files:**
- Modify: `src/components/sections/PurposeGrid.tsx`
  - Add `watermarkRef` next to existing refs (around line 141).
  - Add `position: 'relative'` to the section's inline `style` (line 420).
  - Insert the `<span>` as the first child of `<section>` (right after line 421, before the filter-tabs wrapper at line 423).

- [ ] **Step 1: Add the ref declaration**

Open `src/components/sections/PurposeGrid.tsx`. Find the block of `useRef` declarations (around lines 139–143):

```tsx
const sectionRef = useRef<HTMLElement>(null);
const filterWrapRef = useRef<HTMLDivElement>(null);
const gridRef = useRef<HTMLDivElement>(null);
const flipStateRef = useRef<Flip.FlipState | null>(null);
const morphTimelineRef = useRef<gsap.core.Timeline | null>(null);
```

Add a new ref directly after `sectionRef`:

```tsx
const sectionRef = useRef<HTMLElement>(null);
const watermarkRef = useRef<HTMLSpanElement>(null);
const filterWrapRef = useRef<HTMLDivElement>(null);
const gridRef = useRef<HTMLDivElement>(null);
const flipStateRef = useRef<Flip.FlipState | null>(null);
const morphTimelineRef = useRef<gsap.core.Timeline | null>(null);
```

- [ ] **Step 2: Add `position: 'relative'` to the section's inline style**

Find the `<section>` opening tag (around lines 416–421):

```tsx
<section
  ref={sectionRef}
  id="projects"
  className="pt-44 md:pt-64 pb-16 md:pb-24 px-0"
  style={{ background: 'var(--app-bg)' }}
>
```

Change the `style` prop to include `position: 'relative'`:

```tsx
<section
  ref={sectionRef}
  id="projects"
  className="pt-44 md:pt-64 pb-16 md:pb-24 px-0"
  style={{ background: 'var(--app-bg)', position: 'relative' }}
>
```

- [ ] **Step 3: Insert the watermark span as the first child of the section**

Directly after the `<section …>` opening tag and **before** the `{/* Filter Tabs */}` comment (around line 423), insert:

```tsx
      <span
        ref={watermarkRef}
        aria-hidden="true"
        className="pg-devotions-watermark"
      >
        Devotions
      </span>
```

The resulting block should look like:

```tsx
    <section
      ref={sectionRef}
      id="projects"
      className="pt-44 md:pt-64 pb-16 md:pb-24 px-0"
      style={{ background: 'var(--app-bg)', position: 'relative' }}
    >
      <span
        ref={watermarkRef}
        aria-hidden="true"
        className="pg-devotions-watermark"
      >
        Devotions
      </span>

      {/* Filter Tabs */}
      <div ref={filterWrapRef} className="px-4 md:px-8 mb-4 md:mb-6">
        <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} />
      </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run from project root:

```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: No new TypeScript errors. (Pre-existing errors elsewhere in the project — if any — are not blockers, but the file you changed must be clean.)

- [ ] **Step 5: Manually verify the watermark is present (but still invisible)**

Start the dev server:

```bash
npm run dev
```

Open the home route in a browser. Scroll to the Purpose Grid section. At this point the watermark exists in the DOM but is invisible (opacity 0 — the GSAP reveal is added in Task 3).

Open DevTools and inspect the Purpose Grid section (`<section id="projects">`). Confirm:
- The `<span class="pg-devotions-watermark" aria-hidden="true">Devotions</span>` is the first child.
- The section has `position: relative` (visible in the computed style or the inline `style` attribute).
- The span has `position: absolute; opacity: 0; top: 1.4rem` (mobile) or `top: 1.6rem; font-size: 4.4rem` (md+).

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/PurposeGrid.tsx
git commit -m "$(cat <<'EOF'
feat(purpose-grid): render Devotions watermark span

Adds an absolutely-positioned aria-hidden span as the first child of the
section. The section gains position: relative so the watermark anchors
correctly. Opacity stays at 0 until the next commit wires the scroll
reveal.
EOF
)"
```

---

## Task 3: Wire the scroll-linked opacity reveal

**Files:**
- Modify: `src/components/sections/PurposeGrid.tsx` — add one `useEffect` next to the existing filter-row reveal effect.

- [ ] **Step 1: Add the reveal effect**

Open `src/components/sections/PurposeGrid.tsx`. Find the filter-row reveal effect (around lines 175–202). It looks like:

```tsx
  // Scroll-linked reveal for the filter tabs only. The grid stays fully
  // visible at all times — animating its opacity/transform was interfering
  // with SVG clip-path references on the project cards.
  useEffect(() => {
    const section = sectionRef.current;
    const filters = filterWrapRef.current;
    if (!section || !filters) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        filters,
        { opacity: 0, y: 40, filter: 'blur(8px)' },
        {
          opacity: 1,
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
    }, section);

    return () => ctx.revert();
  }, []);
```

Directly **after** that `useEffect`'s closing `}, []);` line, and **before** the next comment block (`// Scroll-linked come-in for the whole image strip`), insert this new effect:

```tsx
  // Scroll-linked reveal for the "Devotions" watermark. Mirrors the
  // filter-row reveal but lands at opacity 0.32 (its resting decorative
  // opacity), with a smaller y offset because it's a quieter element.
  useEffect(() => {
    const section = sectionRef.current;
    const watermark = watermarkRef.current;
    if (!section || !watermark) return;

    const ctx = gsap.context(() => {
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
    }, section);

    return () => ctx.revert();
  }, []);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: No new TypeScript errors in `PurposeGrid.tsx`.

- [ ] **Step 3: Manually verify the reveal**

```bash
npm run dev
```

Open the home route in a fresh browser tab (hard reload — Cmd+Shift+R / Ctrl+Shift+R — to clear any stale GSAP state). Scroll down from the hero. As the Purpose Grid section approaches the viewport, the "Devotions" watermark should:

1. Start invisible (opacity 0, blurred, slightly offset down by 20px).
2. Fade in along with the filter row as the section's top enters between 85% and 20% of the viewport.
3. Land at its resting state: opacity 0.32, no blur, no y offset.

The watermark should be:
- Visible at the top-left of the section.
- Clearly separated vertically from the RESTORATION / SERENITY filter row (with the section's existing top padding band between them).
- Behind / below the filter row visually (no overlap; no interference).
- Smaller on mobile (resize the browser to a narrow viewport to confirm — 2.6rem instead of 4.4rem, anchored to `left: 1rem`).

Scroll up and down to confirm the reveal scrubs correctly and reverses cleanly. Confirm clicking the RESTORATION / SERENITY filters and hovering grid items behaves the same as before (no regressions).

Stop the dev server.

- [ ] **Step 4: Verify no regressions in the strip → grid morph**

Restart the dev server, hard reload the home route, and scroll the Purpose Grid into view from the top. Confirm the existing strip → grid morph still plays normally (images animate from a horizontal strip into the editorial grid). Then click between RESTORATION and SERENITY filters and confirm the Flip-based filter reflow still works.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/PurposeGrid.tsx
git commit -m "$(cat <<'EOF'
feat(purpose-grid): scroll-linked reveal for Devotions watermark

Adds a GSAP ScrollTrigger that mirrors the filter-row reveal pattern,
fading the watermark from 0 to its resting opacity of 0.32 as the
section enters the viewport. Smaller y offset (20 vs 40) so the
decorative watermark settles before the interactive filter row.
EOF
)"
```

---

## Task 4: Final verification pass

**Files:** None — verification only.

- [ ] **Step 1: Run the full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No new errors introduced by this change.

- [ ] **Step 2: Run the project's tests (if any cover this area)**

```bash
npm test 2>&1 | tail -30
```

Expected: All existing tests pass. (There are currently no component tests for `PurposeGrid`; this command should still exit cleanly.)

- [ ] **Step 3: Build the project**

```bash
npm run build 2>&1 | tail -20
```

Expected: Vite build completes successfully with no new errors.

- [ ] **Step 4: Manual acceptance check against the spec**

Start the dev server (`npm run dev`) and walk through the acceptance criteria from the spec [docs/superpowers/specs/2026-05-18-purpose-grid-devotions-watermark-design.md](../specs/2026-05-18-purpose-grid-devotions-watermark-design.md):

1. "Devotions" appears top-left of the Purpose Grid section, in Cormorant italic at the spec's color/opacity, sized correctly per breakpoint.
2. There is a clearly readable vertical gap between the watermark and the filter row.
3. On scroll into the section, the watermark fades in along with the filter row, ending at opacity 0.32.
4. The word does not intercept clicks or hover targets. Verify by clicking through the area where the watermark sits — clicks should pass through (`pointer-events: none`).
5. Screen-reader check (macOS VoiceOver: `Cmd + F5`): the word is not announced when navigating the section.
6. No regressions in the strip → grid morph, filter switching, or hover overlays.

If any criterion fails, stop and fix before the final commit.

- [ ] **Step 5: Final wrap commit (only if any fixes were needed in Step 4)**

If Step 4 surfaced fixes, commit them with a clear message describing the fix. If everything passed, no extra commit is needed — the three feature commits above are the complete change set.

---

## Notes for the implementing engineer

- **Don't change the section's existing top padding** (`pt-44 md:pt-64`). The watermark fits inside the existing padding band; the spec validated this. Increasing padding would shift the grid down and break the existing visual rhythm.
- **Don't reorder GSAP plugin registration.** The file already calls `gsap.registerPlugin(Flip, ScrollTrigger)` at the top — this covers the new effect too.
- **Don't add a `data-testid`.** The element is decorative and has no behavior to test.
- **Don't add motion preference branching to the new effect.** The existing filter-row reveal doesn't branch either — GSAP's scrub already respects the reduced-motion behavior the project relies on elsewhere. Keep this consistent.
- **If `npx tsc --noEmit` shows pre-existing errors unrelated to this work**, those are not blockers for this plan — but the files you touched (`PurposeGrid.tsx`, `index.css`) must be clean.
