# Hero Bridge Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-beat copy block ("Come here to pause… Restoration is a returning. Your life with God is not slipping away. It is being kept.") between the hero's wordmark-collapse stack and the silhouette mask. Reveal cascade mirrors the Psalm 23 cascade that already sits below the mask.

**Architecture:** Lives inside [src/components/sections/Hero.tsx](../../../src/components/sections/Hero.tsx) as a new JSX block + a new `useEffect` for the cascade timeline. Copy and timing constants extracted to a small companion module so the testable data sits behind a unit-test boundary (matches the existing `hero-intro-gate.ts` pattern). Two new CSS utility classes are added to [src/index.css](../../../src/index.css) next to the existing `.quote-text` block.

**Tech Stack:** React 18, TypeScript, GSAP + ScrollTrigger (already imported by `Hero.tsx`), Vitest (Node environment), Tailwind, CSS custom properties.

**Spec:** [docs/superpowers/specs/2026-05-15-hero-bridge-text-design.md](../specs/2026-05-15-hero-bridge-text-design.md)

---

## File Structure

- **Create:** `src/components/sections/hero-bridge-content.ts` — exports `BRIDGE_COPY` and `BRIDGE_CASCADE_TIMING` constants. Single source of truth for both the copy and the GSAP timeline positions.
- **Create:** `src/components/sections/hero-bridge-content.test.ts` — pins the copy and the timing values so future edits are intentional, not accidental.
- **Modify:** `src/components/sections/Hero.tsx` — adds four refs, one `useEffect` for the cascade, one `useEffect` reduced-motion fallback, and one JSX block between the wordmark stack and the mask stack. Also adds a reduced-motion early-return to the existing Psalm 23 effect for consistency (gap noted in the spec).
- **Modify:** `src/index.css` — adds `.bridge-line` and `.bridge-thesis` classes next to the existing `.quote-text` / `.quote-attr` block.

---

## Task 1: Extract bridge copy and timing constants

**Files:**
- Create: `src/components/sections/hero-bridge-content.ts`
- Test: `src/components/sections/hero-bridge-content.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/hero-bridge-content.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BRIDGE_COPY, BRIDGE_CASCADE_TIMING } from './hero-bridge-content';

describe('BRIDGE_COPY', () => {
  it('exports the invitation beat', () => {
    expect(BRIDGE_COPY.invitation).toBe(
      'Come here to pause. To refill. To reflect. To reconnect.',
    );
  });

  it('exports the thesis beat', () => {
    expect(BRIDGE_COPY.thesis).toBe('Restoration is a returning.');
  });

  it('exports the assurance beat', () => {
    expect(BRIDGE_COPY.assurance).toBe(
      'Your life with God is not slipping away. It is being kept.',
    );
  });
});

describe('BRIDGE_CASCADE_TIMING', () => {
  it('positions the invitation at the start of the timeline', () => {
    expect(BRIDGE_CASCADE_TIMING.invitation).toBe(0);
  });

  it('positions the thesis at 0.35 (matches Psalm 23 line-2 stagger)', () => {
    expect(BRIDGE_CASCADE_TIMING.thesis).toBe(0.35);
  });

  it('positions the assurance at 0.7 (matches Psalm 23 attribution stagger)', () => {
    expect(BRIDGE_CASCADE_TIMING.assurance).toBe(0.7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sections/hero-bridge-content.test.ts`

Expected: FAIL with a module-resolution error — `Failed to load url ./hero-bridge-content` or similar, because the module doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/sections/hero-bridge-content.ts`:

```typescript
// Three-beat manifesto for the hero bridge section.
// Same italic Cormorant voice as the Psalm 23 quote below the mask.
export const BRIDGE_COPY = {
  invitation: 'Come here to pause. To refill. To reflect. To reconnect.',
  thesis: 'Restoration is a returning.',
  assurance: 'Your life with God is not slipping away. It is being kept.',
} as const;

// GSAP timeline positions for the cascade reveal. Match the Psalm 23 cascade
// stagger in Hero.tsx so the two passages bookend each other in motion shape.
export const BRIDGE_CASCADE_TIMING = {
  invitation: 0,
  thesis: 0.35,
  assurance: 0.7,
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/sections/hero-bridge-content.test.ts`

Expected: PASS — 6/6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/hero-bridge-content.ts src/components/sections/hero-bridge-content.test.ts
git commit -m "feat(hero): extract bridge copy and cascade timing constants"
```

---

## Task 2: Add bridge typography CSS classes

**Files:**
- Modify: `src/index.css` (insert after the existing `.quote-attr` block, around line 264)

- [ ] **Step 1: Read existing `.quote-text` styles for reference**

Open [src/index.css](../../../src/index.css) and locate the block that begins:

```css
/* ============================================
   QUOTE STYLES - Brand Storyguide
   ============================================ */

.quote-text {
  font-family: 'Cormorant Garamond', serif;
  ...
}
```

Confirm `.quote-attr` ends near line 264 and `.divider` begins after it.

- [ ] **Step 2: Add `.bridge-line` and `.bridge-thesis` classes**

Insert immediately after the `.quote-attr` closing brace and before the `.divider` block:

```css
/* ============================================
   HERO BRIDGE STYLES - manifesto cascade
   ============================================ */

.bridge-line {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(24px, 4vw, 40px);
  font-weight: 300;
  font-style: italic;
  line-height: 1.4;
  color: var(--deep-umber);
  max-width: 720px;
  position: relative;
  z-index: 1;
}

.bridge-thesis {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(32px, 5.5vw, 60px);
  font-weight: 400;
  font-style: italic;
  line-height: 1.25;
  color: var(--deep-umber);
  max-width: 720px;
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 3: Verify CSS is valid by running the build**

Run: `npx tsc -b --noEmit && npx vite build`

Expected: build succeeds; no TypeScript errors and no CSS parse errors.

(If only the dev server is preferred for verification: `npx vite` and confirm the page loads at the printed URL without console errors.)

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(hero): add bridge-line and bridge-thesis typography classes"
```

---

## Task 3: Add reduced-motion early return to the existing Psalm 23 effect

This is the small consistency fix called out in the spec — the new bridge cascade will honor `prefers-reduced-motion`, and the existing Psalm cascade should too.

**Files:**
- Modify: `src/components/sections/Hero.tsx:63-101` (the Psalm 23 `useEffect`)

- [ ] **Step 1: Locate the existing Psalm 23 effect**

Open [src/components/sections/Hero.tsx](../../../src/components/sections/Hero.tsx). Find the `useEffect` that starts on line 63 — the first `useEffect` in the component, the one that operates on `quoteRef`, `quoteLine1Ref`, `quoteLine2Ref`, `quoteAttrRef`.

It currently begins:

```typescript
useEffect(() => {
  const container = quoteRef.current;
  const l1 = quoteLine1Ref.current;
  const l2 = quoteLine2Ref.current;
  const attr = quoteAttrRef.current;
  if (!container || !l1 || !l2 || !attr) return;

  const ctx = gsap.context(() => {
```

- [ ] **Step 2: Add the reduced-motion early return**

Modify the effect so the body becomes:

```typescript
useEffect(() => {
  const container = quoteRef.current;
  const l1 = quoteLine1Ref.current;
  const l2 = quoteLine2Ref.current;
  const attr = quoteAttrRef.current;
  if (!container || !l1 || !l2 || !attr) return;

  if (prefersReducedMotion) {
    // Reduced motion: hold all three lines at their settled state, no scroll fade.
    gsap.set([l1, l2, attr], { opacity: 1, y: 0, filter: 'blur(0px)' });
    return;
  }

  const ctx = gsap.context(() => {
```

Also update the dependency array at the bottom of the effect from `[]` to `[prefersReducedMotion]`:

```typescript
  }, container);

  return () => ctx.revert();
}, [prefersReducedMotion]);
```

- [ ] **Step 3: Verify the existing tests still pass**

Run: `npm test`

Expected: all existing tests pass (the hero-intro-gate suite and the new bridge constants suite from Task 1).

- [ ] **Step 4: Verify in the dev server with reduced motion**

Run: `npm run dev`

In macOS System Settings → Accessibility → Display → Reduce Motion: enable. Reload the page (or use Chrome DevTools' Rendering panel: "Emulate CSS media feature prefers-reduced-motion: reduce"). Scroll past the silhouette mask to the Psalm 23 quote.

Expected: all three lines (line 1, line 2, attribution) are visible at full opacity immediately — no scroll-triggered fade-in. Disable reduce motion and scroll up/reload: the cascade fade resumes.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "fix(hero): honor prefers-reduced-motion in Psalm 23 cascade"
```

---

## Task 4: Add bridge refs and import the content module in Hero.tsx

**Files:**
- Modify: `src/components/sections/Hero.tsx` (imports + ref declarations)

- [ ] **Step 1: Add the import**

At the top of `Hero.tsx`, alongside the existing `PsalmsWordmarkSvg` import (around line 4), add:

```typescript
import { BRIDGE_COPY, BRIDGE_CASCADE_TIMING } from './hero-bridge-content';
```

- [ ] **Step 2: Add the four new refs**

Locate the existing ref declarations (around lines 40-43) where `quoteRef`, `quoteLine1Ref`, `quoteLine2Ref`, `quoteAttrRef` are declared. Immediately after that group, add:

```typescript
  const bridgeRef = useRef<HTMLDivElement>(null);
  const bridgeInviteRef = useRef<HTMLParagraphElement>(null);
  const bridgeThesisRef = useRef<HTMLParagraphElement>(null);
  const bridgeAssureRef = useRef<HTMLParagraphElement>(null);
```

- [ ] **Step 3: Verify the file still type-checks**

Run: `npx tsc -b --noEmit`

Expected: no errors. (The refs are declared but not yet used — that's fine; TypeScript does not flag unused refs.)

- [ ] **Step 4: Do not commit yet**

This task and Tasks 5–6 together form one logical commit ("add bridge section"). Continue to Task 5 without committing.

---

## Task 5: Add the bridge cascade `useEffect`

**Files:**
- Modify: `src/components/sections/Hero.tsx` (new `useEffect` immediately after the modified Psalm effect)

- [ ] **Step 1: Insert the new effect**

Immediately after the closing `}, [prefersReducedMotion]);` of the Psalm 23 effect (modified in Task 3) and before the `/* ── Mask-expand scroll animation ── */` comment, insert:

```typescript
  /* ── Bridge cascade: three-beat manifesto fades in as you scroll into the section ── */
  useEffect(() => {
    const container = bridgeRef.current;
    const l1 = bridgeInviteRef.current;
    const l2 = bridgeThesisRef.current;
    const l3 = bridgeAssureRef.current;
    if (!container || !l1 || !l2 || !l3) return;

    if (prefersReducedMotion) {
      // Reduced motion: hold all three beats at their settled state, no scroll fade.
      gsap.set([l1, l2, l3], { opacity: 1, y: 0, filter: 'blur(0px)' });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set([l1, l2, l3], { opacity: 0, y: 40, filter: 'blur(10px)' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top 95%',
          end: 'top 10%',
          scrub: 3,
          invalidateOnRefresh: true,
        },
      });

      tl.to(
        l1,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 1 },
        BRIDGE_CASCADE_TIMING.invitation,
      );
      tl.to(
        l2,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 1 },
        BRIDGE_CASCADE_TIMING.thesis,
      );
      tl.to(
        l3,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 1 },
        BRIDGE_CASCADE_TIMING.assurance,
      );
    }, container);

    return () => ctx.revert();
  }, [prefersReducedMotion]);
```

- [ ] **Step 2: Verify the file still type-checks**

Run: `npx tsc -b --noEmit`

Expected: no errors.

- [ ] **Step 3: Do not commit yet**

Continue to Task 6.

---

## Task 6: Add the bridge JSX block to the render tree

**Files:**
- Modify: `src/components/sections/Hero.tsx` (JSX between the wordmark scroll container and the mask scroll container)

- [ ] **Step 1: Locate the insertion point**

In the JSX `return (...)` block, find the end of the wordmark scroll container. It closes here (current line ~589):

```tsx
            />
          </div>
        </div>
      </div>

      {/* Hidden SVG defs for the mask clip-path */}
      <svg
        className="absolute -top-[999px] -left-[999px] w-0 h-0"
```

The new bridge block goes **between** the wordmark's outermost closing `</div>` and the `{/* Hidden SVG defs for the mask clip-path */}` comment.

- [ ] **Step 2: Insert the bridge JSX**

Insert this block at the location identified in Step 1:

```tsx
      {/* Bridge — three-beat manifesto. Cream canvas, italic Cormorant cascade.
          Sits between the wordmark distillation and the silhouette mask;
          mirrors the Psalm 23 cascade below the mask in shape and voice. */}
      <section
        ref={bridgeRef}
        aria-label="Site introduction"
        className="relative flex flex-col items-center justify-center px-6 text-center"
        style={{ minHeight: '80vh', backgroundColor: 'var(--paper-cream)' }}
      >
        <div className="flex flex-col items-center" style={{ maxWidth: '720px' }}>
          <p ref={bridgeInviteRef} className="bridge-line">
            {BRIDGE_COPY.invitation}
          </p>
          <p ref={bridgeThesisRef} className="bridge-thesis mt-8 md:mt-12">
            {BRIDGE_COPY.thesis}
          </p>
          <p ref={bridgeAssureRef} className="bridge-line mt-8 md:mt-12">
            {BRIDGE_COPY.assurance}
          </p>
        </div>
      </section>
```

- [ ] **Step 3: Verify the file type-checks and builds**

Run: `npx tsc -b --noEmit && npx vite build`

Expected: both commands succeed with no errors.

- [ ] **Step 4: Verify in the dev server**

Run: `npm run dev`

Open the printed URL. Scroll through the hero:

1. Wordmark intro plays (or is skipped if intro flag is set).
2. Scroll the wordmark-collapse — letters collapse to A.
3. Continue scrolling: the cream bridge section appears. As it enters the viewport, line 1 ("Come here to pause…") fades up. Continuing to scroll fades up the thesis ("Restoration is a returning."), then the assurance ("Your life with God is not slipping away…").
4. Continue scrolling: the silhouette mask opens as before.
5. After the mask, the Psalm 23 cascade reveals as before.

Open DevTools Console: no errors, no warnings about missing refs, no GSAP warnings about missing trigger elements.

- [ ] **Step 5: Verify reduced motion**

In Chrome DevTools, open the Rendering panel (⌘⇧P → "Rendering"), enable "Emulate CSS media feature prefers-reduced-motion: reduce". Reload.

Expected: all three bridge beats are immediately visible at full opacity, no scroll-driven fade. Same for the Psalm 23 quote below.

Disable the emulation, reload: the cascade returns.

- [ ] **Step 6: Verify the test suite is green**

Run: `npm test`

Expected: all tests pass (hero-intro-gate suite + bridge content constants suite).

- [ ] **Step 7: Commit Tasks 4–6 together**

```bash
git add src/components/sections/Hero.tsx
git commit -m "feat(hero): add bridge cascade between wordmark and silhouette mask"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full test run**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Build verification**

Run: `npm run build`

Expected: clean build with no TypeScript or Vite errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`

Expected: no new lint errors introduced by these changes. (Pre-existing project lint warnings are not in scope.)

- [ ] **Step 4: Visual cross-check against the spec**

Run: `npm run dev`. Walk through this checklist:

- [ ] Bridge sits between the wordmark's A and the silhouette mask
- [ ] Background is cream (matches surrounding sections, no tonal jump)
- [ ] All three beats use Cormorant Garamond italic, deep umber color
- [ ] Thesis line ("Restoration is a returning.") is visibly larger and slightly heavier than the lines that flank it
- [ ] Cascade order: invitation first, thesis second, assurance third
- [ ] Each beat rises from `y: 40` with blur(10px) clearing as it settles, on scroll-scrub
- [ ] The Psalm 23 cascade below the mask still works as before
- [ ] No layout shifts when scrolling at high speed
- [ ] At mobile width (≤640px), copy still reads cleanly and the column does not overflow

- [ ] **Step 5: No commit needed**

Verification only.

---

## Self-Review (run before handoff)

### Spec coverage

- ✅ Placement between wordmark and mask → Task 6 (JSX insertion location)
- ✅ Standalone non-pinned section, cream canvas → Task 6 (`<section>` with `min-height: 80vh`, `var(--paper-cream)`)
- ✅ Cormorant italic typography, thesis lifted → Task 2 (`.bridge-line` + `.bridge-thesis` CSS)
- ✅ Cascade timing matches Psalm 23 (0 / 0.35 / 0.7) → Task 1 (constants) + Task 5 (effect)
- ✅ Same easing, blur, and scrub pattern as Psalm → Task 5 (effect body mirrors lines 71–97 of the original effect)
- ✅ Reduced-motion fallback for bridge → Task 5 (early return + `gsap.set`)
- ✅ Reduced-motion fallback added to existing Psalm cascade (spec consistency fix) → Task 3
- ✅ Bridge lives inside `Hero.tsx`, not a new component → Tasks 4–6
- ✅ `aria-label="Site introduction"` on the bridge section → Task 6
- ✅ Vertical rhythm `mt-8 md:mt-12` between beats → Task 6
- ✅ Max-width 720px column → Task 6 + Task 2 (`max-width: 720px` on both `.bridge-line` and `.bridge-thesis`)

### Placeholder scan

No TBDs, no "TODO", no "implement later", no "similar to Task N" without inlined code, no "add appropriate error handling". Every code step contains the actual code; every shell step contains the exact command and the expected outcome.

### Type consistency

- Constants module exports: `BRIDGE_COPY` (object with `invitation`, `thesis`, `assurance`) and `BRIDGE_CASCADE_TIMING` (object with `invitation`, `thesis`, `assurance`). Same names used in Task 1 (test), Task 5 (effect), Task 6 (JSX). ✓
- Ref names: `bridgeRef`, `bridgeInviteRef`, `bridgeThesisRef`, `bridgeAssureRef`. Same names used in Task 4 (declaration), Task 5 (effect body), Task 6 (JSX `ref={…}` attributes). ✓
- CSS class names: `.bridge-line`, `.bridge-thesis`. Same names used in Task 2 (definition), Task 6 (JSX `className`). ✓
