# Next Devotion Handoff — Scroll-Driven Navigation Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the existing slide-in animation completes, continuing to scroll drives a scrubbed timeline that slides the handoff images back out, fades the pill, holds for a brief color-wash beat, slides the same images back in, then triggers `useNavigate()` to the next devotion. Zone widens to 200vw (desktop) / 200vh (mobile).

**Architecture:** Single file change. New `actTwoSentinelRef` placed at the zone's 50% mark serves as the trigger element for the scrub-driven Act 2 timeline. A shared `navigatedRef` coordinates with the existing pill-click path so scroll-threshold and click-nav can't both fire. Reduced motion skips Act 2 entirely (zone width stays 200vw / 200vh — the extra scroll space is just a color wash).

**Tech Stack:** React, TypeScript, GSAP + ScrollTrigger, react-router-dom's `useNavigate`. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-19-next-devotion-handoff-scroll-navigate.md](../specs/2026-05-19-next-devotion-handoff-scroll-navigate.md)

---

## File Structure

### Modified

| Path | Change |
|---|---|
| `src/components/sections/NextDevotionHandoff.tsx` | Section width → `200vw` (desktop) / `200vh` (mobile). New `actTwoSentinelRef` + sentinel `<div>` inside both layouts. New Act 2 timeline + ScrollTrigger inside `useEntranceAnimation`. New `navigatedRef` threaded into both `useEntranceAnimation` and `useClickToExpand`. `useClickToExpand` updated to check `navigatedRef` before navigating. Reduced-motion path skips Act 2. |

### Untouched

`MoodBoard.tsx` (pin math picks up the wider zone automatically), all data files, all other components.

---

## Task 1: Scroll-driven navigation transition

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx`

Single cohesive change — must ship as one commit. The zone widening, sentinel ref, Act 2 timeline, and click-coordination ref all interact.

- [ ] **Step 1: Add `actTwoSentinelRef` + `navigatedRef` in the parent `NextDevotionHandoff`**

Find the exported `NextDevotionHandoff` function (around line 60-90). After the existing six refs (`rootRef`, `leftImgRef`, `rightImgRef`, `pillRef`, `pillFillRef`, `pillContentRef`), add two more:

```tsx
const actTwoSentinelRef = useRef<HTMLDivElement>(null);
const navigatedRef = useRef(false);
```

Pass `actTwoSentinelRef` and `navigatedRef` into `useEntranceAnimation`:

```tsx
useEntranceAnimation({
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  actTwoSentinelRef,
  navigatedRef,
  nextProject,
  reducedMotion,
});
```

Pass `navigatedRef` into `useClickToExpand`:

```tsx
const { startExpand } = useClickToExpand(pillRef, nextProject, reducedMotion, pillColor, navigatedRef);
```

Add `actTwoSentinelRef` to `layoutProps` so the layouts can render the sentinel `<div>`:

```tsx
const layoutProps = {
  nextProject,
  nextDevotion,
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  actTwoSentinelRef,
  onActivate: startExpand,
  pillColor,
};
```

`navigatedRef` does NOT need to be in `layoutProps` — it's only consumed by the two hooks.

- [ ] **Step 2: Extend `LayoutProps` interface**

```tsx
interface LayoutProps {
  nextProject: Project;
  nextDevotion: Devotion;
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillRef: React.RefObject<HTMLDivElement | null>;
  pillFillRef: React.RefObject<HTMLDivElement | null>;
  pillContentRef: React.RefObject<HTMLDivElement | null>;
  actTwoSentinelRef: React.RefObject<HTMLDivElement | null>;
  onActivate: () => void;
  pillColor: string;
}
```

- [ ] **Step 3: Update `DesktopLayout` — widen + add sentinel**

Find `DesktopLayout` (around line 119). Make two changes:

1. Section style `width: '100vw'` → `width: '200vw'`.
2. Destructure `actTwoSentinelRef` from props and render a sentinel `<div>` at the 50% horizontal mark of the section, after the seam line and before the `<Pill>` invocation.

Full updated DesktopLayout body:

```tsx
function DesktopLayout({
  nextProject,
  nextDevotion,
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  actTwoSentinelRef,
  onActivate,
  pillColor,
}: LayoutProps) {
  return (
    <section
      ref={rootRef}
      onClick={onActivate}
      className="next-handoff relative flex-shrink-0 h-screen overflow-hidden cursor-pointer"
      style={{ width: '200vw', backgroundColor: pillColor }}
    >
      <div className="absolute inset-0 grid grid-cols-2" style={{ width: '100vw' }}>
        <div className="relative overflow-hidden">
          <img
            ref={leftImgRef}
            src={nextProject.thumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="relative overflow-hidden">
          <img
            ref={rightImgRef}
            src={nextDevotion.firstMoodboardImage}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />

      {/* Act 2 sentinel: at the zone's 50% mark (since zone is 200vw wide,
          50% = the start of the extension viewport). ScrollTrigger anchors
          here for the scroll-driven exit+re-enter+navigate timeline. */}
      <div
        ref={actTwoSentinelRef}
        aria-hidden="true"
        className="absolute top-0 h-full pointer-events-none"
        style={{ left: '50%', width: '1px' }}
      />

      <Pill
        pillRef={pillRef}
        pillFillRef={pillFillRef}
        pillContentRef={pillContentRef}
        nextProject={nextProject}
        nextDevotion={nextDevotion}
        variant="desktop"
        onActivate={onActivate}
        pillColor={pillColor}
      />
    </section>
  );
}
```

Note the additional `style={{ width: '100vw' }}` on the split-images container. The split is rendered in the FIRST viewport of the now-200vw zone — the second viewport is just the section's background color (the color-wash beat). The pill stays at `left: 50%` of the WHOLE section (which is at 100vw absolute) — that's fine because the pill is centered relative to its container; it'll sit at the boundary between act 1 and act 2 viewports. The pill's apparent visual position relative to viewport during scroll is driven by GSAP, not by static layout.

Wait — actually the pill's `left: 50%` of a 200vw section puts it at 100vw absolute, which is the right edge of the first viewport / left edge of the second viewport. That's NOT where the pill should appear during Act 1 (it should be centered in the first viewport). Need to re-anchor.

**Correction:** the Pill's `left: 50%` is relative to its parent. If we want the pill in the middle of the FIRST viewport, the pill needs to be at `left: 25%` of the 200vw section, or contained inside a 100vw wrapper.

Cleanest fix: wrap the split + pill in a `100vw` container, then the sentinel + remainder of the 200vw is empty space. Update structure:

```tsx
<section
  ref={rootRef}
  onClick={onActivate}
  className="next-handoff relative flex-shrink-0 h-screen overflow-hidden cursor-pointer"
  style={{ width: '200vw', backgroundColor: pillColor }}
>
  {/* Act 1 viewport — split images + pill, all centered in the first 100vw */}
  <div className="absolute top-0 left-0 h-full" style={{ width: '100vw' }}>
    <div className="absolute inset-0 grid grid-cols-2">
      <div className="relative overflow-hidden">
        <img ref={leftImgRef} ... />
      </div>
      <div className="relative overflow-hidden">
        <img ref={rightImgRef} ... />
      </div>
    </div>
    <div
      className="absolute top-0 bottom-0 left-1/2 w-px"
      style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
      aria-hidden="true"
    />
    <Pill
      pillRef={pillRef}
      pillFillRef={pillFillRef}
      pillContentRef={pillContentRef}
      nextProject={nextProject}
      nextDevotion={nextDevotion}
      variant="desktop"
      onActivate={onActivate}
      pillColor={pillColor}
    />
  </div>
  {/* Act 2 sentinel — at the 50% mark of the SECTION (= start of Act 2 viewport) */}
  <div
    ref={actTwoSentinelRef}
    aria-hidden="true"
    className="absolute top-0 h-full pointer-events-none"
    style={{ left: '50%', width: '1px' }}
  />
</section>
```

The Pill's `left: 50%` is now relative to the 100vw wrapper, putting it in the center of the first viewport. The sentinel is at 50% of the section (= 100vw absolute = start of the second viewport). When the user scrolls past Act 1, the second viewport reveals, the sentinel enters the viewport, and the Act 2 ScrollTrigger fires.

- [ ] **Step 4: Update `MobileLayout` — taller + add sentinel**

Same structural change for mobile. Section's `minHeight: '100vh'` → `minHeight: '200vh'`. Wrap the split + pill in a 100vh container. Sentinel at the 50% vertical mark.

```tsx
function MobileLayout({
  nextProject,
  nextDevotion,
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  actTwoSentinelRef,
  onActivate,
  pillColor,
}: LayoutProps) {
  return (
    <section
      ref={rootRef}
      onClick={onActivate}
      className="next-handoff relative w-full overflow-hidden cursor-pointer"
      style={{ minHeight: '200vh', backgroundColor: pillColor }}
    >
      {/* Act 1 viewport — split images + pill, in the first 100vh */}
      <div className="absolute top-0 left-0 right-0" style={{ height: '100vh' }}>
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative overflow-hidden">
            <img
              ref={leftImgRef}
              src={nextProject.thumbnail}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="relative overflow-hidden">
            <img
              ref={rightImgRef}
              src={nextDevotion.firstMoodboardImage}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </div>
        <div
          className="absolute top-0 bottom-0 left-1/2 w-px"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          aria-hidden="true"
        />
        <Pill
          pillRef={pillRef}
          pillFillRef={pillFillRef}
          pillContentRef={pillContentRef}
          nextProject={nextProject}
          nextDevotion={nextDevotion}
          variant="mobile"
          onActivate={onActivate}
          pillColor={pillColor}
        />
      </div>
      {/* Act 2 sentinel — at the 50% mark of the SECTION (= start of Act 2 viewport) */}
      <div
        ref={actTwoSentinelRef}
        aria-hidden="true"
        className="absolute left-0 w-full pointer-events-none"
        style={{ top: '50%', height: '1px' }}
      />
    </section>
  );
}
```

- [ ] **Step 5: Extend `EntranceArgs` interface**

Find the `EntranceArgs` interface and add the new fields:

```tsx
interface EntranceArgs {
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillRef: React.RefObject<HTMLDivElement | null>;
  pillFillRef: React.RefObject<HTMLDivElement | null>;
  pillContentRef: React.RefObject<HTMLDivElement | null>;
  actTwoSentinelRef: React.RefObject<HTMLDivElement | null>;
  navigatedRef: React.RefObject<boolean>;
  nextProject: Project;
}
```

- [ ] **Step 6: Add `useNavigate` import (if not already imported elsewhere in the file)**

The existing `useClickToExpand` already imports `useNavigate` from `react-router-dom`. The Act 2 timeline also needs it — but rather than importing twice, pass `navigate` from a single call site or import inside `useEntranceAnimation`. Simplest: just `import { useNavigate } from 'react-router-dom'` already exists; call it inside `useEntranceAnimation`:

```tsx
function useEntranceAnimation({ ... }: EntranceArgs & { reducedMotion: boolean }) {
  const navigate = useNavigate();
  // ...rest
}
```

Verify the import exists at the top of the file; if not, add it.

- [ ] **Step 7: Add Act 2 timeline inside `useEntranceAnimation`**

Inside the existing `useEntranceAnimation`'s `gsap.context` block (just after the existing Act 1 timeline), add the Act 2 timeline.

The full updated `useEntranceAnimation` function (the standard-motion branch is the only part that changes):

```tsx
function useEntranceAnimation({
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  actTwoSentinelRef,
  navigatedRef,
  nextProject,
  reducedMotion,
}: EntranceArgs & { reducedMotion: boolean }) {
  const navigate = useNavigate();

  useEffect(() => {
    const root = rootRef.current;
    const left = leftImgRef.current;
    const right = rightImgRef.current;
    const pill = pillRef.current;
    const fill = pillFillRef.current;
    const content = pillContentRef.current;
    const actTwoSentinel = actTwoSentinelRef.current;
    if (!root || !left || !right || !pill || !fill || !content || !actTwoSentinel) return;

    if (reducedMotion) {
      // Same reduced-motion path as before — single fade, no Act 2.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });
      tl.set([left, right], { yPercent: 0 });
      tl.set(fill, { scaleX: 1, transformOrigin: '50% 50%' });
      tl.set(content, { opacity: 1 });
      tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
      return () => {
        tl.kill();
      };
    }

    let ctx: gsap.Context | null = null;
    const rafId = requestAnimationFrame(() => {
      const mainTrigger = ScrollTrigger.getById('moodboard-pin');
      const containerAnimation = mainTrigger?.animation;
      if (!containerAnimation) {
        gsap.set([left, right], { yPercent: 0 });
        gsap.set(fill, { scaleX: 1, transformOrigin: '50% 50%' });
        gsap.set(content, { opacity: 1 });
        return;
      }

      ctx = gsap.context(() => {
        // Seed off-screen start state
        gsap.set(left, { yPercent: -100 });
        gsap.set(right, { yPercent: 100 });
        gsap.set(fill, { scaleX: 0, transformOrigin: '50% 50%' });
        gsap.set(content, { opacity: 0 });

        // ===== ACT 1: Slide-in entrance =====
        const actOne = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            containerAnimation,
            start: 'left 30%',
            end: 'left -10%',
            toggleActions: 'play none none reverse',
          },
        });
        actOne
          .fromTo(left, { yPercent: -100 }, { yPercent: 0, duration: 1.0, ease: 'power3.out' }, 0)
          .fromTo(right, { yPercent: 100 }, { yPercent: 0, duration: 1.0, ease: 'power3.out' }, 0)
          .fromTo(
            fill,
            { scaleX: 0, transformOrigin: '50% 50%' },
            { scaleX: 1, transformOrigin: '50% 50%', duration: 1.0, ease: 'power3.out' },
            0,
          )
          .to(content, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.6);

        // ===== ACT 2: Scrubbed exit + re-enter + navigate =====
        const actTwo = gsap.timeline({
          scrollTrigger: {
            trigger: actTwoSentinel,
            containerAnimation,
            start: 'left 100%',
            end: 'left -10%',
            scrub: 1,
            onUpdate: (self) => {
              if (self.progress >= 0.98 && !navigatedRef.current) {
                navigatedRef.current = true;
                navigate(`/purpose/${nextProject.id}`);
              }
            },
          },
        });
        // Exit phase: 0 → 0.4 — images slide back out, pill fades.
        actTwo
          .to(left, { yPercent: -100, duration: 0.4, ease: 'power2.in' }, 0)
          .to(right, { yPercent: 100, duration: 0.4, ease: 'power2.in' }, 0)
          .to(fill, { scaleX: 0, duration: 0.3, ease: 'power2.in' }, 0)
          .to(content, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0);
        // Breathing room: 0.4 → 0.6 — everything stays at exit state.
        actTwo.to({}, { duration: 0.2 }, 0.4);
        // Re-enter phase: 0.6 → 1.0 — same images slide back in.
        actTwo
          .to(left, { yPercent: 0, duration: 0.4, ease: 'power3.out' }, 0.6)
          .to(right, { yPercent: 0, duration: 0.4, ease: 'power3.out' }, 0.6);
      }, root);
    });

    return () => {
      cancelAnimationFrame(rafId);
      ctx?.revert();
    };
  }, [
    rootRef,
    leftImgRef,
    rightImgRef,
    pillRef,
    pillFillRef,
    pillContentRef,
    actTwoSentinelRef,
    navigatedRef,
    nextProject,
    reducedMotion,
    navigate,
  ]);
}
```

Key points:
- Act 2's trigger anchors to `actTwoSentinel` (the new sentinel div at the 50% mark of the section).
- `start: 'left 100%'` = Act 2 begins when the sentinel just enters viewport from the right.
- `end: 'left -10%'` = ends when the sentinel has scrolled 10% past viewport left.
- `scrub: 1` = scrubbed timeline (user controls progress via scroll).
- `onUpdate` guards against double-nav via `navigatedRef`.
- The Pill content opacity goes 1 → 0 in the exit phase. There's no re-fade in the re-enter phase — once the user is past the handoff conceptually, the pill stays gone.

- [ ] **Step 8: Update `useClickToExpand` signature to accept `navigatedRef`**

The existing signature is `(pillRef, nextProject, reducedMotion, pillColor) => { startExpand }`. Add `navigatedRef` as a fifth argument and check it before navigating.

```tsx
function useClickToExpand(
  pillRef: React.RefObject<HTMLDivElement | null>,
  nextProject: Project,
  reducedMotion: boolean,
  pillColor: string,
  navigatedRef: React.RefObject<boolean>,
): { startExpand: () => void } {
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      const orphan = document.querySelector('[data-pill-cover]');
      orphan?.remove();
      document.body.style.overflow = '';
    };
  }, []);

  const startExpand = () => {
    if (navigatedRef.current) return;  // ← new guard
    const pill = pillRef.current;
    if (!pill) return;
    if (document.querySelector('[data-pill-cover]')) return;

    navigatedRef.current = true;  // ← set early so Act 2 onUpdate doesn't also fire

    // ...rest of body unchanged: build cover, animate, navigate, fade out, cleanup
  };

  return { startExpand };
}
```

The guard at the top exits early if a navigation has already been initiated (either via Act 2's onUpdate or a prior click). Setting `navigatedRef.current = true` immediately after the guards prevents Act 2's `onUpdate` from also calling `navigate(...)` if the user clicks during Act 2's scrub.

- [ ] **Step 9: Verify build + tests + grep**

```bash
cd /Users/newmac/Downloads/Psalms_app
npm run build
npm test
```

Expected: build clean, 534/534 tests pass.

```bash
grep -c "actTwoSentinelRef" src/components/sections/NextDevotionHandoff.tsx
# Expect: at least 6 (declaration, layoutProps key, two uses in layouts, EntranceArgs field, useEffect deps)

grep -c "navigatedRef" src/components/sections/NextDevotionHandoff.tsx
# Expect: at least 6 (declaration, two hook calls, EntranceArgs field, useEffect deps, click hook signature, click guard)

grep -c "200vw\|200vh" src/components/sections/NextDevotionHandoff.tsx
# Expect: exactly 2 (one desktop, one mobile)

grep -c "left 100%" src/components/sections/NextDevotionHandoff.tsx
# Expect: 1 (Act 2 start)
```

- [ ] **Step 10: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "feat(next-handoff): scroll-driven navigation transition (Act 2)

After the existing slide-in completes, continuing to scroll drives a
scrubbed Act 2 timeline:
- 0 → 0.4: images slide back out (left up, right down), pill fades
- 0.4 → 0.6: brief color-wash breathing room
- 0.6 → 1.0: same images slide back in (left down, right up)
- 0.98: useNavigate to next devotion (one-shot via navigatedRef guard)

Zone widens to 200vw (desktop) / 200vh (mobile) to add the extra scroll
runway. The moodboard's pin math picks up the wider zone automatically.
Pill is centered in a new 100vw/100vh Act 1 wrapper so it sits in the
first viewport, not at the section midpoint.

A new actTwoSentinelRef anchors Act 2's ScrollTrigger at the section's
50% mark. A shared navigatedRef coordinates between Act 2's onUpdate and
the existing pill-click path so both can't fire navigate() in quick
succession.

Reduced motion skips Act 2 entirely — the section's extra space is just
a color wash; click on pill remains the explicit nav.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Done

After this task:
- Scrolling past the handoff plays Act 2 scrubbed to scroll: exit → pause → re-enter → navigate.
- Click on pill still navigates immediately via the existing pill-expand morph (coordinated via `navigatedRef`).
- Reduced motion users get just Act 1 + click-to-nav; no scroll-trap.
- Mobile gets the same flow via vertical scroll on a 200vh section.

Open spec: [docs/superpowers/specs/2026-05-19-next-devotion-handoff-scroll-navigate.md](../specs/2026-05-19-next-devotion-handoff-scroll-navigate.md).
