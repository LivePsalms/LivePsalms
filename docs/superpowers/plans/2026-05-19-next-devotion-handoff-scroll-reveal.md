# Next Devotion Handoff — Scroll-Driven Reveal Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing entrance animation on the `NextDevotionHandoff` zone with a three-part scroll-driven choreography: images slide in from top/bottom, pill fill expands from center outward, pill text fades in late. Pill is completely invisible until the fill begins.

**Architecture:** Refactor `Pill` from a single colored div into three nested divs (outer pill = clipPath + sizing + no background; inner fill = colored layer that scales; inner content = three-column grid that fades). Replace `useEntranceAnimation` body with the new tweens, keeping the existing scroll-trigger range and `containerAnimation` reference unchanged. Refs added: `pillFillRef`, `pillContentRef` — created in the parent `NextDevotionHandoff` and threaded through `layoutProps` to both layouts and the `Pill`.

**Tech Stack:** React, TypeScript, GSAP + ScrollTrigger. Single file change.

**Spec:** [docs/superpowers/specs/2026-05-19-next-devotion-handoff-scroll-reveal.md](../specs/2026-05-19-next-devotion-handoff-scroll-reveal.md)

---

## File Structure

### Modified

| Path | Change |
|---|---|
| `src/components/sections/NextDevotionHandoff.tsx` | Pill JSX refactored to three nested divs. `LayoutProps`, `PillProps`, `EntranceArgs` extended with `pillFillRef` + `pillContentRef`. Parent creates both refs; layouts thread them through. Image initial inline styles changed from `clipPath` to `transform: translateY(±100%)`. `useEntranceAnimation` body rewritten for the new motion. Reduced-motion + no-`moodboard-pin` fallbacks updated to snap to new final state. |

### Untouched

All data files, all other components, all utilities. Zero test changes (animation is integration-only with GSAP/DOM).

---

## Task 1: Pill refactor + scroll-reveal choreography

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx`

This is one cohesive change — the Pill structural refactor and the entrance rewrite must ship together. Splitting them produces a broken intermediate state.

- [ ] **Step 1: Add `pillFillRef` and `pillContentRef` to the parent `NextDevotionHandoff`**

Find the `NextDevotionHandoff` exported function (around line 60-90 of the file). After the existing four refs, add two more:

```tsx
const pillRef = useRef<HTMLDivElement>(null);
const pillFillRef = useRef<HTMLDivElement>(null);
const pillContentRef = useRef<HTMLDivElement>(null);
```

Pass them into `useEntranceAnimation`:

```tsx
useEntranceAnimation({
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  reducedMotion,
});
```

`useIdleLoop` does NOT need them (it targets images + pill only); keep its call unchanged.

Add the two refs into `layoutProps`:

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
  onActivate: startExpand,
  pillColor,
};
```

- [ ] **Step 2: Extend `LayoutProps` interface**

Find the `LayoutProps` interface (around line 100). Add two fields:

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
  onActivate: () => void;
  pillColor: string;
}
```

- [ ] **Step 3: Update `DesktopLayout` to consume + forward the new refs**

Destructure the two new refs from props, and:
- Change the left `<img>` initial style from `clipPath: 'inset(0 100% 0 0)'` to `transform: 'translateY(-100%)'`
- Change the right `<img>` initial style from `clipPath: 'inset(0 0 0 100%)'` to `transform: 'translateY(100%)'`
- Pass `pillFillRef` and `pillContentRef` to the inner `<Pill>` invocation

Full DesktopLayout (replace the existing function body):

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
  onActivate,
  pillColor,
}: LayoutProps) {
  return (
    <section
      ref={rootRef}
      onClick={onActivate}
      className="next-handoff relative flex-shrink-0 h-screen overflow-hidden cursor-pointer"
      style={{ width: '100vw', backgroundColor: pillColor }}
    >
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
            style={{ transform: 'translateY(-100%)' }}
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
            style={{ transform: 'translateY(100%)' }}
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
        variant="desktop"
        onActivate={onActivate}
        pillColor={pillColor}
      />
    </section>
  );
}
```

- [ ] **Step 4: Update `MobileLayout` identically**

Same changes as DesktopLayout — destructure `pillFillRef`, `pillContentRef`; change image initial styles to `translateY(±100%)`; pass refs to `<Pill>`:

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
  onActivate,
  pillColor,
}: LayoutProps) {
  return (
    <section
      ref={rootRef}
      onClick={onActivate}
      className="next-handoff relative w-full overflow-hidden cursor-pointer"
      style={{ minHeight: '100vh', backgroundColor: pillColor }}
    >
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
            style={{ transform: 'translateY(-100%)' }}
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
            style={{ transform: 'translateY(100%)' }}
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
    </section>
  );
}
```

- [ ] **Step 5: Refactor `PillProps` + `Pill` to three nested divs**

Update `PillProps` to accept the two new refs:

```tsx
interface PillProps {
  nextProject: Project;
  nextDevotion: Devotion;
  variant: 'desktop' | 'mobile';
  pillRef?: React.RefObject<HTMLDivElement | null>;
  pillFillRef?: React.RefObject<HTMLDivElement | null>;
  pillContentRef?: React.RefObject<HTMLDivElement | null>;
  onActivate?: () => void;
  pillColor: string;
}
```

Replace the entire `Pill` function body with:

```tsx
function Pill({
  nextProject: _nextProject,
  nextDevotion,
  variant,
  pillRef,
  pillFillRef,
  pillContentRef,
  onActivate,
  pillColor,
}: PillProps) {
  void _nextProject;
  const isMobile = variant === 'mobile';

  // Outer pill — owns sizing, clipPath, centering, click affordance.
  // No background or shadow of its own; the inner fill carries those so the
  // pill is invisible until the entrance fills it from the center outward.
  const pillStyle: React.CSSProperties = {
    clipPath: 'url(#hero-mask-clip)',
    width: isMobile ? '92%' : 'min(62vw, 920px)',
    aspectRatio: '11 / 3.2',
    transform: 'translate(-50%, -50%)',
  };

  // Inner fill — colored layer that GSAP scaleX's from 0 to 1.
  const fillStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundColor: pillColor,
    boxShadow: '0 25px 50px -20px rgba(0,0,0,0.55)',
    transform: 'scaleX(0)',
    transformOrigin: '50% 50%',
  };

  // Inner content — three-column grid; fades in late.
  const contentStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    padding: isMobile ? '0 14%' : '0 10%',
    fontFamily: '"Cormorant Garamond", Georgia, serif',
    color: '#fff',
    opacity: 0,
  };

  return (
    <div
      ref={pillRef}
      className="next-handoff-pill absolute left-1/2 top-1/2 cursor-pointer"
      style={pillStyle}
      role={onActivate ? 'link' : undefined}
      aria-label={onActivate ? `Next devotion: ${nextDevotion.title}` : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
    >
      <div ref={pillFillRef} className="next-handoff-pill-fill" style={fillStyle} />
      <div ref={pillContentRef} className="next-handoff-pill-content" style={contentStyle}>
        {/* Left column: label + title */}
        <div className="flex flex-col gap-1 text-left">
          <span
            className="next-handoff-label"
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Next Devotion
          </span>
          <span
            className="next-handoff-title"
            style={{
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: isMobile ? '12px' : '28px',
              lineHeight: 1,
              color: 'rgba(255,255,255,0.95)',
            }}
          >
            {nextDevotion.title}
          </span>
        </div>

        {/* Center column: logo watermark — nudged down to visually center
            in the pill's main body (the clipPath has a notch at the top). */}
        <img
          src="/logo-icon.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={`next-handoff-logo opacity-25 invert pointer-events-none ${isMobile ? 'w-5' : 'w-10'}`}
          style={{ transform: isMobile ? 'translateY(6px)' : 'translateY(12px)' }}
        />

        {/* Right column: category + scripture */}
        <div className="flex flex-col gap-1 text-right">
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {nextDevotion.label.replace(/^(The )?(Restoration of |Serenity of )/, '')}
          </span>
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            {nextDevotion.scriptureRef} <span aria-hidden="true">↗</span>
          </span>
        </div>
      </div>
    </div>
  );
}
```

Key differences from the previous Pill:
- Outer pill style has no `backgroundColor`, no `boxShadow`, no `opacity`. Just sizing/clipPath/centering.
- New `fillStyle` (and ref slot) for the colored layer that scales.
- New `contentStyle` (and ref slot) wrapping the grid; `opacity: 0` initial.

- [ ] **Step 6: Update `EntranceArgs` interface to accept the two new refs**

Find `EntranceArgs` interface (around line 344):

```tsx
interface EntranceArgs {
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillRef: React.RefObject<HTMLDivElement | null>;
  pillFillRef: React.RefObject<HTMLDivElement | null>;
  pillContentRef: React.RefObject<HTMLDivElement | null>;
}
```

- [ ] **Step 7: Rewrite `useEntranceAnimation` body**

Replace the existing `useEntranceAnimation` function (currently lines ~351-433) with:

```tsx
function useEntranceAnimation({
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  reducedMotion,
}: EntranceArgs & { reducedMotion: boolean }) {
  useEffect(() => {
    const root = rootRef.current;
    const left = leftImgRef.current;
    const right = rightImgRef.current;
    const pill = pillRef.current;
    const fill = pillFillRef.current;
    const content = pillContentRef.current;
    if (!root || !left || !right || !pill || !fill || !content) return;

    if (reducedMotion) {
      // Single fade of the whole zone — snap motion targets to their
      // final state.
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

    // The moodboard's main horizontal scroll tween lives at id 'moodboard-pin'.
    // It's created in MoodBoard's useEffect, which fires AFTER this component's
    // child useEffects. Defer to the next frame so the parent has registered it.
    let ctx: gsap.Context | null = null;
    const rafId = requestAnimationFrame(() => {
      const mainTrigger = ScrollTrigger.getById('moodboard-pin');
      const containerAnimation = mainTrigger?.animation;
      if (!containerAnimation) {
        // No horizontal-scroll container available — happens on mobile (no
        // horizontal pin) and during the race-condition window where MoodBoard
        // hasn't registered its trigger yet. Snap to the visible resting
        // state so nothing is stuck off-screen or invisible.
        gsap.set([left, right], { yPercent: 0 });
        gsap.set(fill, { scaleX: 1, transformOrigin: '50% 50%' });
        gsap.set(content, { opacity: 1 });
        return;
      }

      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            containerAnimation,
            start: 'left 90%',
            end: 'left 30%',
            toggleActions: 'play none none reverse',
          },
        });

        // All three motions in parallel from t=0 to t=1.0:
        tl.to(left, { yPercent: 0, duration: 1.0, ease: 'power3.out' }, 0)
          .to(right, { yPercent: 0, duration: 1.0, ease: 'power3.out' }, 0)
          .fromTo(
            fill,
            { scaleX: 0, transformOrigin: '50% 50%' },
            { scaleX: 1, transformOrigin: '50% 50%', duration: 1.0, ease: 'power3.out' },
            0,
          )
          // Text fades in during the final 40% (t=0.6 to t=1.0).
          .to(content, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.6);
      }, root);
    });

    return () => {
      cancelAnimationFrame(rafId);
      ctx?.revert();
    };
  }, [rootRef, leftImgRef, rightImgRef, pillRef, pillFillRef, pillContentRef, reducedMotion]);
}
```

Key differences from the previous entrance:
- Image tweens write `yPercent` instead of `clipPath` + `y`.
- Pill tween replaced by two: fill `scaleX 0 → 1`, content `opacity 0 → 1` late.
- Both reduced-motion and no-`moodboard-pin` fallbacks use the new targets (`yPercent: 0`, `scaleX: 1`, content `opacity: 1`).
- Effect deps include the two new refs.

- [ ] **Step 8: Type-check + build**

```bash
cd /Users/newmac/Downloads/Psalms_app
npm run build
```

Expected: build clean (only pre-existing chunk-size and dynamic-import warnings). No TypeScript errors.

- [ ] **Step 9: Run tests**

```bash
cd /Users/newmac/Downloads/Psalms_app
npm test
```

Expected: 534/534 tests pass. No new tests; no regressions.

- [ ] **Step 10: Verify the file changes**

```bash
cd /Users/newmac/Downloads/Psalms_app
grep -c "next-handoff-pill-fill" src/components/sections/NextDevotionHandoff.tsx
# Expect: 1 (className on the new fill div)

grep -c "next-handoff-pill-content" src/components/sections/NextDevotionHandoff.tsx
# Expect: 1 (className on the new content div)

grep -c "clipPath: 'inset" src/components/sections/NextDevotionHandoff.tsx
# Expect: 0 (the old clip-reveal initials are removed)

grep -c "yPercent" src/components/sections/NextDevotionHandoff.tsx
# Expect: at least 5 (initial sets in reduced-motion + fallback + standard tweens for left and right)

grep -c "scaleX" src/components/sections/NextDevotionHandoff.tsx
# Expect: at least 4 (initial sets in reduced-motion + fallback + standard fromTo for fill)
```

If any count is off, you've missed a step.

- [ ] **Step 11: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "feat(next-handoff): scroll-driven reveal — slide + center-out fill

Replaces the entrance animation with a three-part scroll-scrubbed
choreography:
- Left image slides DOWN into place (yPercent -100 → 0)
- Right image slides UP into place (yPercent 100 → 0)
- Pill fill expands from center outward (scaleX 0 → 1) in the next
  devotion's color
- Pill text fades in during the final 40% of progress

Pill is completely invisible at scroll-start — outer pill has no
background; the inner fill div carries the color and shadow and is what
scales. Same trigger range as before (left 90% → left 30%).

Refactors Pill into three nested divs (outer/fill/content) so each can be
animated independently. Reduced-motion + no-moodboard-pin fallbacks
updated to snap to the new final state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Done

After this task:
- The handoff zone reveals via the new three-part choreography on desktop.
- Mobile (no `moodboard-pin`) snaps to the final visible state, same as before.
- Reduced motion does a single 400ms zone fade with motion targets snapped to final.
- Click-expand transition continues to work — the cover is built from the outer pill's bounding rect, independent of the inner fill's scale state.
- Idle Ken Burns on the images still runs after entrance completes (writes `scale` + `x`, doesn't fight `yPercent`).

Visually verify on a few devotions: scroll into the moodboard's final zone. Confirm the three motions run in parallel, text fades in late, and reversing the scroll cleanly reverses the animation.

Open spec: [docs/superpowers/specs/2026-05-19-next-devotion-handoff-scroll-reveal.md](../specs/2026-05-19-next-devotion-handoff-scroll-reveal.md).
