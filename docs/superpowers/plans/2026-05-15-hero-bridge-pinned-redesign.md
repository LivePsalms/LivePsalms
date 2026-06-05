# Hero Bridge Pinned Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the just-implemented bridge cascade with a pinned scroll-scrub sequence where text 1 (left), text 2 (right), and text 3 (center) hand off to each other one at a time via kiss-handoff timing across a 300vh pinned section.

**Architecture:** The existing bridge in [Hero.tsx](../../../src/components/sections/Hero.tsx) is replaced with a sticky-positioned stage inside a 300vh outer container. A GSAP scrub timeline drives enter/hold/exit envelopes per beat. The constants module (`hero-bridge-content.ts`) replaces `BRIDGE_CASCADE_TIMING` with a nested `BRIDGE_PIN_TIMING` structure. CSS gains separate typography classes for side-positioned vs center-positioned beats, plus a small set of responsive positioning utilities. The mask section's negative margin is reduced from `-35vh` to `-10vh` so text 3's exit isn't eaten by the appearing silhouette.

**Tech Stack:** React 18, TypeScript, GSAP + ScrollTrigger (CSS sticky for the visual pin, GSAP for the scrub timeline — same pattern as the existing wordmark-collapse), Vitest (Node environment), Tailwind, CSS custom properties.

**Spec:** [docs/superpowers/specs/2026-05-15-hero-bridge-pinned-redesign.md](../specs/2026-05-15-hero-bridge-pinned-redesign.md)

---

## File Structure

- **Modify:** `src/components/sections/hero-bridge-content.ts` — `BRIDGE_CASCADE_TIMING` replaced with `BRIDGE_PIN_TIMING` (nested per-beat structure: `text1.enter / .holdStart / .holdEnd / .exit`, etc.). `BRIDGE_COPY` is unchanged.
- **Modify:** `src/components/sections/hero-bridge-content.test.ts` — timing assertions rewritten to match the new structure. Copy assertions unchanged.
- **Modify:** `src/index.css` — `.bridge-line` is split into `.bridge-line-side` (max-width 440px) and `.bridge-line-center` (max-width 560px). `.bridge-thesis` max-width drops from 720px to 440px; line-height changes from 1.25 to 1.4 (consistency fix flagged in the previous code review). New positioning utility classes `.bridge-beat`, `.bridge-beat-left`, `.bridge-beat-right`, `.bridge-beat-center`.
- **Modify:** `src/components/sections/Hero.tsx` — bridge `useEffect` and JSX replaced. Bridge JSX wraps in a 300vh outer `<div>` with a sticky-inner `<section>` containing three absolutely positioned beats. Mask section's `marginTop` changes from `-35vh` to `-10vh`. Reduced-motion path renders a static flex column (no pin, no animation).

---

## Task 1: Replace `BRIDGE_CASCADE_TIMING` with `BRIDGE_PIN_TIMING`

**Files:**
- Modify: `src/components/sections/hero-bridge-content.ts`
- Modify: `src/components/sections/hero-bridge-content.test.ts`

- [ ] **Step 1: Rewrite the test file to assert the new structure**

Replace the contents of `src/components/sections/hero-bridge-content.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { BRIDGE_COPY, BRIDGE_PIN_TIMING } from './hero-bridge-content';

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

describe('BRIDGE_PIN_TIMING', () => {
  describe('text1 (invitation)', () => {
    it('enters at the start of the timeline', () => {
      expect(BRIDGE_PIN_TIMING.text1.enter).toBe(0);
    });
    it('reaches full opacity at 0.10', () => {
      expect(BRIDGE_PIN_TIMING.text1.holdStart).toBe(0.10);
    });
    it('begins exit fade at 0.28', () => {
      expect(BRIDGE_PIN_TIMING.text1.holdEnd).toBe(0.28);
    });
    it('completes exit at 0.34 (kiss handoff to text2)', () => {
      expect(BRIDGE_PIN_TIMING.text1.exit).toBe(0.34);
    });
  });

  describe('text2 (thesis)', () => {
    it('enters at 0.34 (kissing text1 exit)', () => {
      expect(BRIDGE_PIN_TIMING.text2.enter).toBe(0.34);
    });
    it('reaches full opacity at 0.40', () => {
      expect(BRIDGE_PIN_TIMING.text2.holdStart).toBe(0.40);
    });
    it('begins exit fade at 0.60', () => {
      expect(BRIDGE_PIN_TIMING.text2.holdEnd).toBe(0.60);
    });
    it('completes exit at 0.66 (kiss handoff to text3)', () => {
      expect(BRIDGE_PIN_TIMING.text2.exit).toBe(0.66);
    });
  });

  describe('text3 (assurance)', () => {
    it('enters at 0.66 (kissing text2 exit)', () => {
      expect(BRIDGE_PIN_TIMING.text3.enter).toBe(0.66);
    });
    it('reaches full opacity at 0.72', () => {
      expect(BRIDGE_PIN_TIMING.text3.holdStart).toBe(0.72);
    });
    it('begins exit fade at 0.95 (long hold)', () => {
      expect(BRIDGE_PIN_TIMING.text3.holdEnd).toBe(0.95);
    });
    it('completes exit at 1.0 (end of pin)', () => {
      expect(BRIDGE_PIN_TIMING.text3.exit).toBe(1.0);
    });
  });

  it('uses kiss-handoff: text2 enters exactly where text1 exits', () => {
    expect(BRIDGE_PIN_TIMING.text2.enter).toBe(BRIDGE_PIN_TIMING.text1.exit);
  });

  it('uses kiss-handoff: text3 enters exactly where text2 exits', () => {
    expect(BRIDGE_PIN_TIMING.text3.enter).toBe(BRIDGE_PIN_TIMING.text2.exit);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/sections/hero-bridge-content.test.ts`

Expected: FAIL. Specifically, the `BRIDGE_PIN_TIMING` block fails because the module currently exports `BRIDGE_CASCADE_TIMING` instead. The `BRIDGE_COPY` tests still pass.

- [ ] **Step 3: Replace the module's timing export**

Replace the contents of `src/components/sections/hero-bridge-content.ts` with:

```typescript
// Three-beat manifesto for the hero bridge section.
// Same italic Cormorant voice as the Psalm 23 quote below the mask.
export const BRIDGE_COPY = {
  invitation: 'Come here to pause. To refill. To reflect. To reconnect.',
  thesis: 'Restoration is a returning.',
  assurance: 'Your life with God is not slipping away. It is being kept.',
} as const;

// GSAP timeline progress points for the pinned bridge stage.
// Each beat has an enter window (enter → holdStart), a hold plateau (holdStart → holdEnd),
// and an exit window (holdEnd → exit). Kiss handoff: textN.exit === text(N+1).enter,
// so the screen always has exactly one beat in flight or held — never two, never zero
// (except the very first 0%, before text1 enters, and the very last 0%, after text3 exits).
export const BRIDGE_PIN_TIMING = {
  text1: { enter: 0,    holdStart: 0.10, holdEnd: 0.28, exit: 0.34 },
  text2: { enter: 0.34, holdStart: 0.40, holdEnd: 0.60, exit: 0.66 },
  text3: { enter: 0.66, holdStart: 0.72, holdEnd: 0.95, exit: 1.0  },
} as const;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/sections/hero-bridge-content.test.ts`

Expected: PASS — 17/17 tests green (3 BRIDGE_COPY + 12 per-beat phases + 2 kiss-handoff invariants).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/hero-bridge-content.ts src/components/sections/hero-bridge-content.test.ts
git commit -m "feat(hero): replace cascade timing with pinned BRIDGE_PIN_TIMING"
```

---

## Task 2: Replace bridge CSS classes

**Files:**
- Modify: `src/index.css` (the existing `HERO BRIDGE STYLES` section, lines ~266-292)

- [ ] **Step 1: Read the existing bridge CSS section**

Open `src/index.css`. Find the section that begins:

```css
/* ============================================
   HERO BRIDGE STYLES - manifesto cascade
   ============================================ */
```

Confirm it contains `.bridge-line` and `.bridge-thesis` from the previous implementation. It sits between `.quote-attr` (above) and `.divider` (below).

- [ ] **Step 2: Replace the entire bridge styles section**

Replace the existing `HERO BRIDGE STYLES` block (the comment header plus the two existing classes `.bridge-line` and `.bridge-thesis`) with:

```css
/* ============================================
   HERO BRIDGE STYLES - pinned spatial sequence
   ============================================ */

/* Typography variants — side beat (text 1) and center beat (text 3) share
   the same base type ramp but differ in max-width because the side beats
   live in a narrower column on the desktop stage. */
.bridge-line-side {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(24px, 4vw, 40px);
  font-weight: 300;
  font-style: italic;
  line-height: 1.4;
  color: var(--deep-umber);
  max-width: 440px;
}

.bridge-line-center {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(24px, 4vw, 40px);
  font-weight: 300;
  font-style: italic;
  line-height: 1.4;
  color: var(--deep-umber);
  max-width: 560px;
}

.bridge-thesis {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(32px, 5.5vw, 60px);
  font-weight: 400;
  font-style: italic;
  line-height: 1.4;
  color: var(--deep-umber);
  max-width: 440px;
}

/* Stage positioning utilities. Mobile (default): all three beats absolutely
   centered on the stage — they overlap, but kiss-handoff opacity timing
   means only one is visible at a time. Desktop (≥ 768px): left and right
   positions activate; center beat keeps the default. */
.bridge-beat {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

@media (min-width: 768px) {
  .bridge-beat-left {
    left: 10vw;
    transform: translate(0, -50%);
  }
  .bridge-beat-right {
    left: auto;
    right: 10vw;
    transform: translate(0, -50%);
  }
  /* .bridge-beat-center keeps the default mobile centering on desktop too */
}
```

- [ ] **Step 3: Verify the build still succeeds**

Run: `npx tsc -b --noEmit && npx vite build`

Expected: both succeed. (TypeScript will complain about Hero.tsx's existing `.bridge-line` and `.bridge-thesis` references, but only at the CSS-class-as-string level which TS doesn't typecheck, so no errors here. Visual breakage will exist until Task 3.)

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(hero): replace bridge typography with side/center/thesis variants"
```

---

## Task 3: Rewrite bridge useEffect, JSX, and reduce mask margin

This is a single combined task because the `useEffect`, the JSX, and the mask-margin reduction are tightly coupled — they share refs, they're in the same file, and committing any of them alone would leave the bridge in a broken intermediate state.

**Files:**
- Modify: `src/components/sections/Hero.tsx` (multiple regions)

- [ ] **Step 1: Update the import to use `BRIDGE_PIN_TIMING`**

Locate line 5 (the bridge content import). Currently:

```typescript
import { BRIDGE_COPY, BRIDGE_CASCADE_TIMING } from './hero-bridge-content';
```

Replace with:

```typescript
import { BRIDGE_COPY, BRIDGE_PIN_TIMING } from './hero-bridge-content';
```

- [ ] **Step 2: Replace the bridge `useEffect`**

Find the existing bridge cascade `useEffect` in `Hero.tsx`. It starts with the comment:

```typescript
/* ── Bridge cascade: three-beat manifesto fades in as you scroll into the section ── */
```

(this comment lives around line 113.) The effect ends at the closing `}, [prefersReducedMotion]);` ~46 lines later.

Replace the entire comment-and-effect block (the comment line plus the full `useEffect`) with:

```typescript
  /* ── Bridge cascade: pinned three-beat sequence. Text 1 enters from the
        left, hands off to text 2 on the right, hands off to text 3 at center.
        Same scroll-scrub pattern as the wordmark-collapse: CSS sticky owns
        the visual pin; GSAP owns the timeline scrub. ── */
  useEffect(() => {
    const scrollEl = bridgeRef.current;
    const t1 = bridgeInviteRef.current;
    const t2 = bridgeThesisRef.current;
    const t3 = bridgeAssureRef.current;
    if (!scrollEl || !t1 || !t2 || !t3) return;

    if (prefersReducedMotion) {
      // Reduced motion: all three beats settle to visible at their static
      // positions. The reduced-motion JSX path renders them in normal flow
      // (no pin, no overlap), so we just clear any transform/blur state.
      gsap.set([t1, t2, t3], { opacity: 1, y: 0, filter: 'blur(0px)' });
      return;
    }

    const ctx = gsap.context(() => {
      // All three beats start hidden, lifted, and blurred.
      gsap.set([t1, t2, t3], { opacity: 0, y: 40, filter: 'blur(10px)' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 2,
          invalidateOnRefresh: true,
        },
      });

      // Text 1 — enter (rise + blur clear + fade up), hold, exit (opacity only).
      tl.to(
        t1,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out',
          duration: BRIDGE_PIN_TIMING.text1.holdStart - BRIDGE_PIN_TIMING.text1.enter },
        BRIDGE_PIN_TIMING.text1.enter,
      );
      tl.to(
        t1,
        { opacity: 0, ease: 'power1.in',
          duration: BRIDGE_PIN_TIMING.text1.exit - BRIDGE_PIN_TIMING.text1.holdEnd },
        BRIDGE_PIN_TIMING.text1.holdEnd,
      );

      // Text 2.
      tl.to(
        t2,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out',
          duration: BRIDGE_PIN_TIMING.text2.holdStart - BRIDGE_PIN_TIMING.text2.enter },
        BRIDGE_PIN_TIMING.text2.enter,
      );
      tl.to(
        t2,
        { opacity: 0, ease: 'power1.in',
          duration: BRIDGE_PIN_TIMING.text2.exit - BRIDGE_PIN_TIMING.text2.holdEnd },
        BRIDGE_PIN_TIMING.text2.holdEnd,
      );

      // Text 3 — long hold; exits in the last 5% so the stage is clean cream
      // for the final frame before pin release hands off to the mask section.
      tl.to(
        t3,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out',
          duration: BRIDGE_PIN_TIMING.text3.holdStart - BRIDGE_PIN_TIMING.text3.enter },
        BRIDGE_PIN_TIMING.text3.enter,
      );
      tl.to(
        t3,
        { opacity: 0, ease: 'power1.in',
          duration: BRIDGE_PIN_TIMING.text3.exit - BRIDGE_PIN_TIMING.text3.holdEnd },
        BRIDGE_PIN_TIMING.text3.holdEnd,
      );
    }, scrollEl);

    return () => ctx.revert();
  }, [prefersReducedMotion]);
```

- [ ] **Step 3: Replace the bridge JSX**

Find the existing bridge JSX in the return body. It starts with the comment:

```tsx
      {/* Bridge — three-beat manifesto. Cream canvas, italic Cormorant cascade.
          Sits between the wordmark distillation and the silhouette mask;
          mirrors the Psalm 23 cascade below the mask in shape and voice. */}
```

(this lives around line 649.) The block ends at `</section>` ~20 lines later.

Replace the entire comment-and-section block with:

```tsx
      {/* Bridge — pinned three-beat manifesto. Cream stage with text 1 on the
          left, text 2 on the right, text 3 at center; kiss-handoff timing across
          a 300vh pinned scroll range. Mirrors the wordmark-collapse structure:
          outer 300vh + sticky-inner h-screen. Reduced-motion users get a static
          flex column (no pin, all three beats visible at once). */}
      {prefersReducedMotion ? (
        <section
          ref={bridgeRef}
          aria-label="Site introduction"
          className="relative flex flex-col items-center justify-center px-6 py-24 text-center"
          style={{ minHeight: '100vh', backgroundColor: 'var(--paper-cream)' }}
        >
          <div className="flex flex-col items-center">
            <p ref={bridgeInviteRef} className="bridge-line-center">
              {BRIDGE_COPY.invitation}
            </p>
            <p ref={bridgeThesisRef} className="bridge-thesis mt-8 md:mt-12">
              {BRIDGE_COPY.thesis}
            </p>
            <p ref={bridgeAssureRef} className="bridge-line-center mt-8 md:mt-12">
              {BRIDGE_COPY.assurance}
            </p>
          </div>
        </section>
      ) : (
        <div ref={bridgeRef} className="relative" style={{ height: '300vh' }}>
          <section
            aria-label="Site introduction"
            className="overflow-hidden"
            style={{
              position: 'sticky',
              top: 0,
              height: '100vh',
              backgroundColor: 'var(--paper-cream)',
            }}
          >
            <p ref={bridgeInviteRef} className="bridge-beat bridge-beat-left bridge-line-side">
              {BRIDGE_COPY.invitation}
            </p>
            <p ref={bridgeThesisRef} className="bridge-beat bridge-beat-right bridge-thesis">
              {BRIDGE_COPY.thesis}
            </p>
            <p ref={bridgeAssureRef} className="bridge-beat bridge-beat-center bridge-line-center">
              {BRIDGE_COPY.assurance}
            </p>
          </section>
        </div>
      )}
```

- [ ] **Step 4: Reduce the mask scroll container's negative margin**

Find the mask scroll container `<div>`. It currently has this exact style block:

```tsx
      <div
        ref={maskScrollRef}
        className="relative"
        style={{
          height: prefersReducedMotion ? '100vh' : '250vh',
          marginTop: '-35vh',
        }}
      >
```

Change `marginTop: '-35vh'` to `marginTop: '-10vh'`:

```tsx
      <div
        ref={maskScrollRef}
        className="relative"
        style={{
          height: prefersReducedMotion ? '100vh' : '250vh',
          marginTop: '-10vh',
        }}
      >
```

- [ ] **Step 5: Verify type-check and build pass**

Run: `npx tsc -b --noEmit && npx vite build`

Expected: both succeed cleanly. No errors. (The pre-existing chunk-size warning is unrelated.)

- [ ] **Step 6: Run the full test suite**

Run: `npm test`

Expected: all tests pass. Specifically the 17 tests in `hero-bridge-content.test.ts` (3 copy + 14 timing including kiss-handoff invariants), plus all other existing tests.

- [ ] **Step 7: Lint the touched file**

Run: `npx eslint src/components/sections/Hero.tsx`

Expected: no new errors. (Pre-existing project-wide lint problems in unrelated files are not in scope.)

- [ ] **Step 8: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "feat(hero): pin bridge stage with kiss-handoff scroll sequence"
```

---

## Task 4: Final verification

- [ ] **Step 1: Full test run**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Production build**

Run: `npm run build`

Expected: clean build with no new TypeScript or Vite errors. Pre-existing chunk-size warnings are not in scope.

- [ ] **Step 3: Lint all touched files**

Run: `npx eslint src/components/sections/Hero.tsx src/components/sections/hero-bridge-content.ts src/components/sections/hero-bridge-content.test.ts`

Expected: no errors. (`src/index.css` is ignored by ESLint; that's expected.)

- [ ] **Step 4: Confirm the dev server still runs**

Run: `lsof -i :5173 | grep LISTEN` to confirm a Vite dev server is already up. If not: `npm run dev` (the user will navigate to it in their browser).

Expected: the dev server is reachable.

- [ ] **Step 5: Visual walkthrough checklist (user verifies in browser)**

This step is performed by the human, not the implementer. The implementer reports DONE when steps 1–4 pass. The user then walks through:

- [ ] Wordmark intro plays (or is skipped if intro flag is set)
- [ ] Wordmark collapses to A as before
- [ ] On further scroll, the cream stage pins to the viewport (sticky)
- [ ] Text 1 ("Come here to pause…") rises from below on the **left** side of the screen, blur clearing
- [ ] Text 1 holds at full opacity for a beat
- [ ] Text 1 fades out as text 2 ("Restoration is a returning.") rises on the **right** side — there is never a moment where both are simultaneously visible at full opacity, never a blank moment between
- [ ] Text 2 holds, then fades out as text 3 ("Your life with God…") rises in the **center**
- [ ] Text 3 holds for a longer plateau, then fades out cleanly
- [ ] Pin releases; the silhouette mask appears, with only a small 10vh overlap into the bridge's tail
- [ ] Psalm 23 reveals as before below the mask
- [ ] At mobile width (~414px), all three beats appear centered (no horizontal split), but the kiss-handoff timing still plays as expected
- [ ] DevTools console: no errors, no GSAP warnings about missing trigger elements, no React warnings
- [ ] With Chrome DevTools Rendering panel set to `prefers-reduced-motion: reduce`, the bridge falls back to a static stacked column (all three beats visible, no pin, no animations). Same for the Psalm 23 quote below.

- [ ] **Step 6: No commit needed**

Verification only.

---

## Self-Review

### Spec coverage

- ✅ Pinned 300vh outer + sticky-inner h-screen stage → Task 3 step 3 JSX
- ✅ Three absolutely-positioned beats (left/right/center) → Task 3 step 3 JSX + Task 2 step 2 positioning utilities
- ✅ Mobile collapse to single centered position → Task 2 step 2 (`.bridge-beat` default + `@media (min-width: 768px)` overrides)
- ✅ Enter motion: rise + blur + fade up → Task 3 step 2 `tl.to(...)` for each beat's enter
- ✅ Exit motion: pure opacity fade → Task 3 step 2 `tl.to(...)` for each beat's exit
- ✅ Hold plateau between enter and exit → no tween in that progress range; the timeline naturally holds at the enter tween's end state
- ✅ Kiss-handoff timing (no overlap, no blank between adjacent beats) → Task 1 timing constants + 2 kiss-handoff invariant tests
- ✅ `scrub: 2` smoothing → Task 3 step 2 `scrollTrigger.scrub: 2`
- ✅ Reduced motion: static flex column, no pin → Task 3 step 3 ternary `prefersReducedMotion ? <static> : <pinned>`
- ✅ Reduce mask `marginTop` from -35vh to -10vh → Task 3 step 4
- ✅ Text 3 long hold ending at 0.95, exit by 1.0 → Task 1 constants (`text3.holdEnd: 0.95`, `text3.exit: 1.0`)
- ✅ Typography variants `.bridge-line-side` (440px), `.bridge-line-center` (560px), `.bridge-thesis` (440px, line-height 1.4) → Task 2 step 2
- ✅ Voice/typography carry over unchanged (Cormorant italic, deep umber) → Task 2 step 2
- ✅ `aria-label="Site introduction"` retained → Task 3 step 3 (both render paths)
- ✅ All three beats remain in the DOM at all times (animation only changes visual presence) → Task 3 step 3 (no conditional mounting of beats)

### Placeholder scan

No TBDs, no "TODO", no "implement later", no "similar to Task N" without inlined code. Every code step contains complete code; every shell step contains the exact command and expected outcome.

### Type consistency

- `BRIDGE_PIN_TIMING.text1 / .text2 / .text3`, each with `.enter / .holdStart / .holdEnd / .exit` — used identically in Task 1 (constants + test), Task 3 step 2 (effect). ✓
- Ref names `bridgeRef`, `bridgeInviteRef`, `bridgeThesisRef`, `bridgeAssureRef` — declared in the original commit `4fd02e8` (not touched in this redesign), used in Task 3 step 2 (effect) and Task 3 step 3 (both JSX render paths). Variable aliases inside the effect (`scrollEl`, `t1`, `t2`, `t3`) are consistent across enter/exit tween calls. ✓
- CSS classes `.bridge-line-side`, `.bridge-line-center`, `.bridge-thesis`, `.bridge-beat`, `.bridge-beat-left`, `.bridge-beat-right`, `.bridge-beat-center` — defined in Task 2 step 2, applied in Task 3 step 3. ✓
