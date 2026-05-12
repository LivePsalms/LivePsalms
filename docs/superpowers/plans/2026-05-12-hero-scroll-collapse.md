# Hero Scroll-Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a scroll-pinned segment into the existing Hero section that collapses the PSALMS wordmark back into the A as the user scrolls, then releases scroll into the existing mask-expand animation.

**Architecture:** All work lives in `src/components/sections/Hero.tsx`. A new pinned region using CSS `position: sticky` + GSAP `ScrollTrigger` (matching the existing mask-expand pattern) renders a second `PsalmsWordmarkSvg` instance plus halo and ring DOM. A new `useLayoutEffect` drives the bloom-and-collapse timeline via scroll progress. A separate small effect handles the `prefers-reduced-motion` fade-only fallback.

**Tech Stack:** React 19, TypeScript, GSAP 3.14.2, `gsap/ScrollTrigger`, Tailwind, Vite. All dependencies already present in `package.json`.

**Spec reference:** [docs/superpowers/specs/2026-05-12-hero-scroll-collapse-design.md](../specs/2026-05-12-hero-scroll-collapse-design.md)

---

## File Structure

**Modified:** `src/components/sections/Hero.tsx` (single file — no extraction)

The component already imports `gsap`, `ScrollTrigger`, `useLayoutEffect`, `useEffect`, `useRef`, `useState`. The implementation adds:
- One module-scope const (`COLLAPSE`, extracted from the existing intro effect).
- Five new `useRef` declarations inside the `Hero` component.
- One new `useMemo` for the reduced-motion check.
- One new `useLayoutEffect` for the main scrub timeline.
- One new `useEffect` for the reduced-motion IntersectionObserver fade.
- One new JSX block (the pin region) inserted between the existing first viewport and `maskScrollRef`.

**No new files. No new tests** (per spec Section 8 — verification is manual).

---

## Verification Conventions

This is a visual animation feature. Each task has a manual verification step with explicit instructions on what to look for. Run the dev server once at the start and keep it running:

```bash
npm run dev
```

Open `http://localhost:5173/` in a browser. When a task says "verify," follow the listed steps in the browser. If something looks wrong, fix before committing.

---

### Task 1: Extract `COLLAPSE` const to module scope

**Files:**
- Modify: `src/components/sections/Hero.tsx:1-15` (add module-scope const near the top)
- Modify: `src/components/sections/Hero.tsx:188-195` (remove local const inside intro effect)

- [ ] **Step 1: Verify intro currently works**

Run the dev server (`npm run dev`). Navigate to `http://localhost:5173/`. Clear sessionStorage (DevTools → Application → Session Storage → clear) so the intro plays. Reload. Watch the intro: A enters → heartbeat → letters spread to PSALMS → handoff to deep-umber 12% watermark. Confirm visually that the intro plays end-to-end.

- [ ] **Step 2: Add module-scope `COLLAPSE` const**

Edit `src/components/sections/Hero.tsx`. After the `DEEP_UMBER_HEX` const (around line 11), add:

```ts
// SVG-userspace collapse offsets. Distance each letter travels from its
// settled position to the A's center, in viewBox units (positive = moves
// rightward toward A from the left side; negative = moves leftward toward
// A from the right side). Used by both the intro spread (reverse direction)
// and the scroll-collapse effect.
const COLLAPSE = {
  P:  653.3,
  S1: 339.8,
  L: -313.9,
  M: -690.5,
  S2: -1076.4,
} as const;
```

- [ ] **Step 3: Remove the local `COLLAPSE` declaration inside the intro effect**

In `src/components/sections/Hero.tsx`, delete lines 188-195 (the local `const COLLAPSE = { ... };` and its preceding comment). The references at lines 206-210 (`tl.set(letterP, { x: COLLAPSE.P, ... })`) now resolve to the module-scope const.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Exits with code 0 (no errors).

- [ ] **Step 5: Verify intro still plays correctly**

Reload `http://localhost:5173/` (clear sessionStorage first to force intro). Watch the intro. It should be visually identical to Step 1. Letters should spread to the same positions.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
refactor(hero): extract COLLAPSE offsets to module scope

Preparation for the scroll-collapse effect, which uses the same letter
offsets as the intro spread (reverse direction, identical magnitudes).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add reduced-motion detection and pin region DOM (no animation yet)

**Files:**
- Modify: `src/components/sections/Hero.tsx` — add five refs, one `useMemo`, and the new DOM block

- [ ] **Step 1: Add the reduced-motion `useMemo`**

Inside the `Hero` function component, after the existing `useRef` declarations (after `quoteAttrRef`, around line 29), add:

```tsx
const prefersReducedMotion = useMemo(() => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}, []);
```

Ensure `useMemo` is imported from React. Check the existing import statement at line 1: `import { useEffect, useLayoutEffect, useRef, useState } from 'react';`. Update to:

```tsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 2: Add the five new refs**

Inside `Hero`, after the existing mask-scroll refs (after `maskVideoRef`, around line 35), add:

```tsx
// Scroll-collapse refs (new — see docs/superpowers/specs/2026-05-12-hero-scroll-collapse-design.md)
const collapseScrollRef = useRef<HTMLDivElement>(null);
const collapsePinRef = useRef<HTMLDivElement>(null);
const collapseSvgRef = useRef<SVGSVGElement>(null);
const collapseHaloRef = useRef<HTMLDivElement>(null);
const collapseRingRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Add the pin region JSX**

In the return statement, locate `{/* Hidden SVG defs for the mask clip-path */}` (around line 350 — this is the start of the SVG defs that precede `maskScrollRef`). Insert the new pin region BEFORE it (i.e., between the closing tag of the first viewport at line 348 and the SVG defs):

```tsx
{/* Scroll-collapse pin region — wordmark gathers back into A as user scrolls. */}
<div
  ref={collapseScrollRef}
  data-reduced-motion={prefersReducedMotion ? 'true' : undefined}
  className="relative"
  style={{
    height: prefersReducedMotion ? '100vh' : '150vh',
    overscrollBehaviorY: 'contain',
  }}
>
  <div
    ref={collapsePinRef}
    className="top-0 h-screen w-full flex items-center justify-center overflow-hidden"
    style={{ position: prefersReducedMotion ? 'static' : 'sticky' }}
  >
    {/* Persistent umber halo — sits behind the wordmark. */}
    <div
      ref={collapseHaloRef}
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        width: '520px',
        height: '520px',
        transform: 'translate(-50%, -50%) scale(0.3)',
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(58, 52, 38, 0.18) 0%, rgba(58, 52, 38, 0.10) 28%, rgba(58, 52, 38, 0.04) 55%, rgba(58, 52, 38, 0) 80%)',
        filter: 'blur(18px)',
        opacity: 0,
        willChange: 'opacity, transform',
        zIndex: 0,
      }}
    />

    {/* Second wordmark instance — the one that animates the collapse. */}
    <PsalmsWordmarkSvg
      ref={collapseSvgRef}
      className="w-[95vw] md:w-[80vw] max-w-4xl relative"
      style={{
        opacity: 0.12,
        color: 'var(--deep-umber)',
        zIndex: 1,
      }}
    />

    {/* Expanding warm-sand ring — sits in front of the wordmark. */}
    <div
      ref={collapseRingRef}
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        width: '24px',
        height: '24px',
        transform: 'translate(-50%, -50%) scale(0.3)',
        borderRadius: '50%',
        border: '1.5px solid rgba(188, 179, 163, 0.85)',
        opacity: 0,
        willChange: 'opacity, transform',
        zIndex: 2,
      }}
    />
  </div>
</div>
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Exits with code 0.

- [ ] **Step 5: Verify the DOM renders without animation**

Reload `http://localhost:5173/`. Wait for intro to complete (or skip via cached sessionStorage). Scroll down. You should see:
1. First viewport (existing wordmark resting state at 12% opacity).
2. 1.5 viewport heights of "pin" content — the wordmark stays glued to the viewport center while you scroll, at 12% opacity. No animation. Halo and ring are present but invisible (`opacity: 0`).
3. After 1.5vh of scroll, the pin releases and the existing mask-expand animation begins.
4. Existing quote section follows.

The boundary handoff: as you scroll from first viewport into the pin, the first wordmark scrolls UP and out of view; the pin's wordmark takes its place at the same screen position. There should be NO visible flash.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): scaffold scroll-collapse pin region DOM

Adds the pinned sticky container with a second PsalmsWordmarkSvg
instance, halo div, and ring div. No animation yet — the next task
wires the GSAP timeline. Reduced-motion users get a 100vh static
section (no sticky) via the data-reduced-motion attribute.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire the bloom + three-wave collapse (timeline phases 1–4)

**Files:**
- Modify: `src/components/sections/Hero.tsx` — add new `useLayoutEffect`

- [ ] **Step 1: Add the scroll-collapse effect skeleton**

Inside `Hero`, after the existing intro `useLayoutEffect` (after line 271, closing brace and deps), add a new effect:

```tsx
/* ── Scroll-collapse: bloom + three-wave collapse + A pulse + climax + rest ── */
useLayoutEffect(() => {
  if (introActive) return;
  if (prefersReducedMotion) return;

  const scrollEl = collapseScrollRef.current;
  const svgEl    = collapseSvgRef.current;
  const haloEl   = collapseHaloRef.current;
  const ringEl   = collapseRingRef.current;
  if (!scrollEl || !svgEl || !haloEl || !ringEl) return;

  const letterA  = svgEl.querySelector<SVGGElement>('#letter-A');
  const letterP  = svgEl.querySelector<SVGGElement>('#letter-P');
  const letterS1 = svgEl.querySelector<SVGGElement>('#letter-S1');
  const letterL  = svgEl.querySelector<SVGGElement>('#letter-L');
  const letterM  = svgEl.querySelector<SVGGElement>('#letter-M');
  const letterS2 = svgEl.querySelector<SVGGElement>('#letter-S2');
  if (!letterA || !letterP || !letterS1 || !letterL || !letterM || !letterS2) return;

  const ctx = gsap.context(() => {
    const tl = gsap.timeline({
      defaults: { force3D: true },
      scrollTrigger: {
        trigger: scrollEl,
        start: 'top top',
        end: 'bottom top',
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    // Phase 1 — Bloom (progress 0.000 → 0.150)
    // Wordmark wakes up: opacity 0.12 → 1.0 + faint scale 0.98 → 1.0.
    tl.fromTo(svgEl,
      { opacity: 0.12, scale: 0.98, transformOrigin: '50% 50%' },
      { opacity: 1.0, scale: 1.0, duration: 0.150, ease: 'power2.out' },
      0);

    // Phase 2 — Wave 1: S₂ (progress 0.150 → 0.377)
    // Three independent eases per letter, matching the standalone composition.
    tl.to(letterS2, { x: COLLAPSE.S2,       duration: 0.227, ease: 'power3.out' }, 0.150);
    tl.to(letterS2, { opacity: 0,           duration: 0.227, ease: 'power1.out' }, 0.150);
    tl.to(letterS2, { filter: 'blur(6px)',  duration: 0.227, ease: 'power2.out' }, 0.150);

    // Phase 3 — Wave 2: P + M (progress 0.221 → 0.448)
    tl.to(letterP, { x: COLLAPSE.P,         duration: 0.227, ease: 'power3.out' }, 0.221);
    tl.to(letterP, { opacity: 0,            duration: 0.227, ease: 'power1.out' }, 0.221);
    tl.to(letterP, { filter: 'blur(6px)',   duration: 0.227, ease: 'power2.out' }, 0.221);

    tl.to(letterM, { x: COLLAPSE.M,         duration: 0.227, ease: 'power3.out' }, 0.221);
    tl.to(letterM, { opacity: 0,            duration: 0.227, ease: 'power1.out' }, 0.221);
    tl.to(letterM, { filter: 'blur(6px)',   duration: 0.227, ease: 'power2.out' }, 0.221);

    // Phase 4 — Wave 3: S₁ + L (progress 0.292 → 0.518)
    tl.to(letterS1, { x: COLLAPSE.S1,       duration: 0.226, ease: 'power3.out' }, 0.292);
    tl.to(letterS1, { opacity: 0,           duration: 0.226, ease: 'power1.out' }, 0.292);
    tl.to(letterS1, { filter: 'blur(6px)',  duration: 0.226, ease: 'power2.out' }, 0.292);

    tl.to(letterL, { x: COLLAPSE.L,         duration: 0.226, ease: 'power3.out' }, 0.292);
    tl.to(letterL, { opacity: 0,            duration: 0.226, ease: 'power1.out' }, 0.292);
    tl.to(letterL, { filter: 'blur(6px)',   duration: 0.226, ease: 'power2.out' }, 0.292);
  }, scrollEl);

  return () => ctx.revert();
}, [introActive, prefersReducedMotion]);
```

Note: durations are in scroll-progress units (the ScrollTrigger maps progress 0–1 onto the timeline). A duration of `0.227` means the tween covers 22.7% of scroll progress.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Exits with code 0.

- [ ] **Step 3: Verify the bloom + waves visually**

Reload `http://localhost:5173/`. Skip intro (or wait for it to complete). Scroll slowly into the pin region.
- First ~15% of pin scroll: the wordmark blooms from 12% → 100% opacity, with a faint scale-up. No letters have moved yet.
- Next ~25% of pin scroll: S₂ flies inward toward A, fading and blurring.
- Next ~22% of pin scroll: P and M collapse together.
- Next ~22% of pin scroll: S₁ and L collapse together (last to merge).
- At this point only the A is visible. Halo and ring still invisible.

Scroll back up. Letters reverse — S₁/L return first, then P/M, then S₂, then the wordmark dims back to 12% as bloom reverses. No jank, no flashes.

- [ ] **Step 4: Verify the intro is unaffected**

Clear sessionStorage. Reload. Watch the intro play. It should be visually identical to Task 1's baseline (A enters → heartbeat → spread → handoff). The new effect must not interfere.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): wire scroll-collapse bloom + three-wave timeline

Adds the main scrub effect with phases 1-4: bloom (15% of scroll),
then S₂ alone, then P+M together, then S₁+L last. Three independent
eases per letter (position power3.out, opacity power1.out, blur
power2.out) — same formula as the intro spread, reversed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add A pulse + climax (timeline phases 5–6)

**Files:**
- Modify: `src/components/sections/Hero.tsx` — extend the timeline inside the new effect

- [ ] **Step 1: Add the A pulse**

Inside the new effect's `gsap.context` callback (added in Task 3), after the Phase 4 (`letterL`) tweens, append:

```tsx
    // Phase 5 — A pulse (progress 0.504 → 0.639)
    // Single subtle pulse marks the moment of full contact. Peak 1.06.
    tl.to(letterA, { scale: 1.06, transformOrigin: '50% 50%', duration: 0.071, ease: 'power2.out' }, 0.504);
    tl.to(letterA, { scale: 1.00, transformOrigin: '50% 50%', duration: 0.064, ease: 'power3.out' }, 0.575);
```

- [ ] **Step 2: Add the halo swell (Phase 6 part 1)**

After the A pulse tweens, append:

```tsx
    // Phase 6.1 — Halo swell + settle
    tl.fromTo(haloEl,
      { opacity: 0,    scale: 0.30 },
      { opacity: 0.85, scale: 1.0, duration: 0.075, ease: 'power2.out' },
      0.568);
    tl.to(haloEl,
      { opacity: 0.10, duration: 0.137, ease: 'power2.out' },
      0.643);
```

Note the halo's `transform-origin` is its own center (already handled by the `translate(-50%, -50%)` baseline transform in the DOM).

- [ ] **Step 3: Add the ring expansion (Phase 6 part 2)**

After the halo tweens, append:

```tsx
    // Phase 6.2 — Ring bloom + expand
    tl.fromTo(ringEl,
      { opacity: 0,    scale: 0.30 },
      { opacity: 0.85, scale: 1.0,  duration: 0.020, ease: 'power1.out' },
      0.568);
    tl.to(ringEl,
      { opacity: 0,    scale: 45,   duration: 0.192, ease: 'power2.out' },
      0.588);
```

- [ ] **Step 4: Add the A tonal warming (Phase 6 part 3)**

The wordmark SVG (`src/components/sections/PsalmsWordmarkSvg.tsx`) uses `<g fill="currentColor">`, so each letter inherits its fill from the SVG's CSS `color`. Tweening the SVG's `color` property warms all letters — but the non-A letters are at `opacity: 0` by this point in the timeline, so only the A's warming reads visually.

After the ring tweens, append:

```tsx
    // Phase 6.3 — A fill warming (tonal "flash" — additive light would not read on cream)
    // Letters inherit fill via `currentColor`; tween the SVG's `color` and the
    // already-invisible siblings are harmlessly warmed too.
    tl.to(svgEl,
      { color: '#5A4520', duration: 0.036, ease: 'power2.out' },
      0.568);
    tl.to(svgEl,
      { color: 'var(--deep-umber)', duration: 0.156, ease: 'power2.out' },
      0.604);
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Exits with code 0.

- [ ] **Step 6: Verify the climax visually**

Reload `http://localhost:5173/`. Scroll into the pin region. After the three-wave collapse completes (~52% of pin scroll):
- A pulses subtly (scale 1.06 then back to 1.0).
- Halo swells in behind the A (subtle umber wash, blurred).
- Ring expands outward from the A (thin warm-sand ring growing and fading).
- A's fill briefly warms toward a richer brown, then returns to deep-umber.

Scroll past the climax (~78% of pin scroll): only the A and a soft halo remain.

Scroll back. Climax reverses cleanly — ring shrinks, halo fades, A returns.

- [ ] **Step 7: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): add A pulse, halo swell, ring expand, A tonal warming

Climax phases 5-6 of the scroll-collapse timeline. Cream-adapted
palette — umber halo, warm-sand ring, A fill warming toward
#5A4520. No additive light on cream.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verify Phase 7 rest hold + mask-expand chain

This task adds no new code — Phase 7 is implicit (no tweens fire between 0.780 and 1.000, so the timeline just holds its end state). The verification confirms the rest hold reads correctly and that the existing mask-expand picks up scroll cleanly when the pin releases.

- [ ] **Step 1: Verify the rest hold**

Reload `http://localhost:5173/`. Scroll into the pin. Stop scrolling once the climax has played out (around 78% of pin scroll). Continue scrolling slowly toward the end of the pin (last 22% of pin scroll). The A remains visible at deep-umber, the halo holds at low opacity (~0.10), the ring is gone, all other letters are at opacity 0.

Scroll just past the pin's end. The pin releases. The page resumes normal scrolling.

- [ ] **Step 2: Verify the mask-expand still triggers**

Continue scrolling after the pin releases. The existing mask-expand should begin (jungle image clipped through the SVG path, expanding to fill the viewport, then crossfading to the video). This was unchanged by previous tasks but verify it still works.

- [ ] **Step 3: Verify the quote section still triggers**

Continue scrolling past the mask-expand. The quote section ("He leads me beside still waters...") should fade in via its existing GSAP-driven scroll animation.

- [ ] **Step 4: No commit (verification-only task)**

Nothing to commit. If any of the above fail, investigate and fix in the appropriate prior task.

---

### Task 6: Reduced-motion fallback (fade-only on intersection)

**Files:**
- Modify: `src/components/sections/Hero.tsx` — add a new `useEffect` for the fade fallback

- [ ] **Step 1: Add the reduced-motion fade effect**

Inside `Hero`, after the new scroll-collapse `useLayoutEffect` (from Task 3), add:

```tsx
/* ── Reduced-motion fallback: fade-only entrance on IntersectionObserver ── */
useEffect(() => {
  if (introActive) return;
  if (!prefersReducedMotion) return;

  const scrollEl = collapseScrollRef.current;
  const svgEl    = collapseSvgRef.current;
  const haloEl   = collapseHaloRef.current;
  if (!scrollEl || !svgEl || !haloEl) return;

  const letterA  = svgEl.querySelector<SVGGElement>('#letter-A');
  const letterP  = svgEl.querySelector<SVGGElement>('#letter-P');
  const letterS1 = svgEl.querySelector<SVGGElement>('#letter-S1');
  const letterL  = svgEl.querySelector<SVGGElement>('#letter-L');
  const letterM  = svgEl.querySelector<SVGGElement>('#letter-M');
  const letterS2 = svgEl.querySelector<SVGGElement>('#letter-S2');
  if (!letterA || !letterP || !letterS1 || !letterL || !letterM || !letterS2) return;

  // Establish starting state (the SVG wrapper is at opacity 0.12 from inline style;
  // each letter inherits — but the A needs to bump to full opacity on intersection,
  // and siblings need to fade to 0. Seed the wrapper to opacity 1.0 with each
  // letter's individual opacity at 0.12 so the inheritance math works out).
  gsap.set(svgEl, { opacity: 1.0 });
  gsap.set([letterA, letterP, letterS1, letterL, letterM, letterS2], { opacity: 0.12 });

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;

      // Run the fade once, then disconnect.
      gsap.to([letterP, letterS1, letterL, letterM, letterS2], {
        opacity: 0,
        duration: 0.8,
        ease: 'power1.out',
      });
      gsap.to(letterA, {
        opacity: 1.0,
        duration: 0.8,
        ease: 'power2.out',
      });
      gsap.to(haloEl, {
        opacity: 0.10,
        scale: 1.0,
        duration: 0.8,
        ease: 'power2.out',
      });

      observer.disconnect();
    },
    { threshold: 0.3 },
  );

  observer.observe(scrollEl);
  return () => observer.disconnect();
}, [introActive, prefersReducedMotion]);
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Exits with code 0.

- [ ] **Step 3: Verify reduced-motion path in browser**

In Chrome DevTools, open the command menu (`Cmd+Shift+P`), search for "reduced motion", select "Emulate CSS prefers-reduced-motion: reduce". Reload `http://localhost:5173/`. Skip intro.

Scroll into the pin region. The container should NOT be sticky — it scrolls naturally past as a 100vh section. As the section crosses ~30% into view, the fade fires:
- Letters P, S₁, L, M, S₂ fade out (opacity 0).
- A bumps to full opacity in deep-umber.
- Halo fades in to opacity 0.10 behind the A.

There should be no pin, no horizontal motion, no blur, no ring, no pulse. Just a graceful in-place fade.

Disable the reduced-motion emulation and reload to confirm the full scrub mode still works.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): reduced-motion fade-only fallback

When prefers-reduced-motion is set, skip the pin entirely (100vh
static section) and run a one-shot 800ms fade on IntersectionObserver:
siblings fade out, A bumps to full opacity, halo settles. Honors the
narrative of the moment with zero scroll-coupling.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Final verification pass

This is the spec's Section 8 checklist run end-to-end as the last gate before considering the work complete.

- [ ] **Step 1: Cross-device check — desktop**

Reload `http://localhost:5173/` in a desktop Chrome window (~1440px wide). Run the full Section 8 verification table from the spec:

| Check | Pass criterion |
|-------|----------------|
| Bloom timing | At ~7% of pin scroll, wordmark is at ~56% opacity, no letters moved yet |
| Wave order | S₂ moves first, then P+M, then S₁+L last |
| Climax palette | Halo umber-tinted, ring warm-sand, A briefly warmer |
| Rest state | A at full deep-umber, halo ~0.10, ring gone |
| Scroll-up reverse | Timeline reverses smoothly to bloom state |
| Boundary handoff | No flash at the first-viewport ↔ pin boundary |
| Mask-expand chain | Triggers normally after pin releases |
| Intro coexistence | Clear sessionStorage, reload — intro plays then scroll-collapse engages on first scroll |

- [ ] **Step 2: Cross-device check — mobile emulation**

In DevTools, toggle device emulation (`Cmd+Shift+M`). Pick "iPhone 14 Pro" or similar. Reload. Test:
- Touch fling through the pin scrubs smoothly.
- iOS Safari profile: no premature pin release from rubber-band overscroll.
- Wordmark scales appropriately to the narrow viewport (the existing `w-[95vw] md:w-[80vw]` carries the second instance).

- [ ] **Step 3: ScrollTrigger leak check**

Open DevTools console. Scroll through the page top-to-bottom several times. Run:

```js
ScrollTrigger.getAll().length
```

The number should be stable across multiple scroll passes (not growing). If it grows, there's a cleanup leak — investigate `ctx.revert()` calls.

- [ ] **Step 4: Lint check**

Run: `npm run lint`
Expected: No errors related to the modified files.

- [ ] **Step 5: Production build check**

Run: `npm run build`
Expected: Exits cleanly. The output `dist/` is generated without errors.

- [ ] **Step 6: Final commit (if any cleanup was needed)**

If Steps 1–5 surface any fixes, commit them. Otherwise no commit needed — the work is complete.

If a final commit IS needed:

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
fix(hero): [describe specific fix from verification]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

After writing the full plan, here's the check against the spec:

**Spec coverage:**
- ✅ Section 1 (Placement) → Task 2 inserts the pin region between first viewport and `maskScrollRef`.
- ✅ Section 2 (Visual treatment) → Task 2 DOM uses umber halo, warm-sand ring; Task 4 wires A tonal warming.
- ✅ Section 3 (Timeline) → Tasks 3 and 4 wire all seven phases with the exact progress offsets.
- ✅ Section 4 (Component structure) → Task 2 adds refs, Task 3 adds the main effect, Task 6 adds the reduced-motion effect.
- ✅ Section 5 (Reduced-motion) → Task 2 adds the `data-reduced-motion` attribute and conditional layout; Task 6 adds the fade effect.
- ✅ Section 6 (Mobile) → Task 2 sets `overscrollBehaviorY: 'contain'`; Task 7 verifies mobile emulation.
- ✅ Section 7 (Edge cases) → Task 7's Step 1 covers refresh, scroll-up, intro coexistence; Step 3 covers ScrollTrigger leaks.
- ✅ Section 8 (Verification) → Task 7 runs the full checklist.
- ✅ Section 10 (Implementation order) → Tasks 1-6 follow the spec's order exactly.

**Placeholder scan:** No TBDs, no "implement later", no "similar to Task N" shortcuts. Every step has the actual code or command.

**Type consistency:** `COLLAPSE` is consistent across Tasks 1, 3 (uses `COLLAPSE.S2`, `.P`, etc. matching the const definition). Ref names (`collapseScrollRef`, `collapseSvgRef`, `collapseHaloRef`, `collapseRingRef`, `collapsePinRef`) used consistently across Tasks 2, 3, 6.

**Resolved ambiguities:**
- Task 4 Step 4 — confirmed via direct inspection that `PsalmsWordmarkSvg` uses `<g fill="currentColor">`, so the A tonal warming tweens the SVG's CSS `color` (not the letter's `fill` attribute). Plan reflects the single confirmed path.
