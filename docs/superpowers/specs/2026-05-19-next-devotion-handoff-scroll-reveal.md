# Next Devotion Handoff — Scroll-Driven Reveal Animation

**Date:** 2026-05-19
**Status:** Draft — awaiting user review
**Scope:** Replace the current entrance animation on the `NextDevotionHandoff` zone with a richer, scroll-driven three-part choreography: background images slide in from opposite vertical directions, while the pill — initially completely invisible — fills with the next devotion's color from the center outward. All three motions are scrubbed to scroll progress and run in parallel.

**Parent feature:** [docs/superpowers/specs/2026-05-19-next-devotion-handoff-design.md](2026-05-19-next-devotion-handoff-design.md).

---

## 1. Problem

The current entrance animation on `NextDevotionHandoff` is the "cinematic entrance" from spec §6.1 of the parent feature — both images clip-reveal from the seam outward (left side from right, right side from left), the pill fades + lifts in, text reveals via `LineMaskReveal` (the last part was deferred). It's a reasonable transition but feels reserved.

The user wants something more deliberate: a choreographed reveal that *announces* the next devotion. Three things happen simultaneously as the user scrolls the zone into view:

1. The left half's background image (next project's `thumbnail`) **slides DOWN into place from above**.
2. The right half's background image (next devotion's `firstMoodboardImage`) **slides UP into place from below**.
3. The pill is **completely invisible** at scroll-start, then **its color fills in from the center outward** — a thin vertical band of the next devotion's `pillColor` grows symmetrically left and right until it covers the full notched-mask shape. Pill text fades in during the final ~40% of progress, once the fill is mostly covering the text-area.

---

## 2. Goal

Replace the current `useEntranceAnimation` hook contents in `src/components/sections/NextDevotionHandoff.tsx` with the new three-part choreography. Refactor the `Pill` component so the colored background is on an inner "fill" element that GSAP can scale; the outer pill stays invisible until the fill is non-zero. Preserve the same scroll trigger range, click-expand transition, image Ken Burns idle drift, and reduced-motion fallback.

---

## 3. Design

### 3.1 Choreography (all three motions in parallel, scrubbed to scroll)

The existing `containerAnimation: ScrollTrigger.getById('moodboard-pin').animation` (the moodboard's horizontal-scroll tween) drives the entrance. Range stays at `start: 'left 90%'`, `end: 'left 30%'`, `toggleActions: 'play none none reverse'` — confirmed unchanged by user.

| Element | Property | From → To | Duration in timeline | Ease |
|---|---|---|---|---|
| Left image | `yPercent` | `-100` → `0` | 0 → 1.0 | `power3.out` |
| Right image | `yPercent` | `100` → `0` | 0 → 1.0 | `power3.out` |
| Pill fill | `scaleX` | `0` → `1` (origin center) | 0 → 1.0 | `power3.out` |
| Pill text | `opacity` | `0` → `1` | 0.6 → 1.0 | `power2.out` |

Tween duration is `1.0` in timeline units — since the timeline is bound via `containerAnimation` to a scroll-progress range, the actual real-time duration depends on how fast the user scrolls. ScrollTrigger's `toggleActions: 'play none none reverse'` is the existing behavior; we keep it (the timeline plays forward when entering the trigger window, reverses on scroll-back, doesn't repeat or reset).

### 3.2 Pill structural refactor

Currently the `Pill` component renders one outer `<div>` whose `style.backgroundColor: pillColor` is the visible color. We refactor to three nested elements:

```tsx
<div className="next-handoff-pill ..." style={{ clipPath: 'url(#hero-mask-clip)', ...sizing }}>
  <div className="next-handoff-pill-fill" style={{ backgroundColor: pillColor }} />
  <div className="next-handoff-pill-content" style={{ ... }}>
    {/* three-column grid: label/title, logo, category/scripture */}
  </div>
</div>
```

- **Outer pill (`next-handoff-pill`)** — owns the size, clipPath, shadow, and the positioning + click affordance. No `backgroundColor` of its own.
- **Inner fill (`next-handoff-pill-fill`)** — `position: absolute; inset: 0; background-color: pillColor;`. Initial state set by `gsap.set` to `{ scaleX: 0, transformOrigin: '50% 50%' }`. GSAP tweens to `scaleX: 1`.
- **Inner content (`next-handoff-pill-content`)** — `position: absolute; inset: 0;` contains the existing three-column grid. Initial `opacity: 0` (set inline). GSAP tweens to `1` during the final 40%.

The clipPath on the outer pill ensures both the fill and the content are clipped to the notched mask shape — so as the fill expands, it reveals the notched shape naturally.

Because the outer pill has no background and the fill starts at `scaleX: 0`, the pill is completely invisible to the user at scroll-start (confirmed requirement). The shadow on the pill outer is also conditional — it should NOT render until the fill exists. Move the shadow to the fill element so it appears with the color: `boxShadow: '0 25px 50px -20px rgba(0,0,0,0.55)'` on `next-handoff-pill-fill`, not on the outer.

### 3.3 Image slide structural change

Currently the images are positioned with `position: absolute; inset: 0; object-cover` inside their grid cells (the seam-split grid). Both grid cells have `overflow: hidden`. The entrance currently uses `clipPath: inset(0 100% 0 0)` → `inset(0 0 0 0)` for the left, mirror for right.

We replace those clip-reveal tweens with `yPercent` translations. Initial state set by `gsap.set`:
- Left image: `yPercent: -100` (off-screen above its half)
- Right image: `yPercent: 100` (off-screen below its half)

Then tween both to `yPercent: 0` over the timeline. The `overflow: hidden` on each grid cell keeps the off-screen portion hidden so the visible split-seam stays clean.

The existing initial inline `clipPath: 'inset(0 100% 0 0)' / 'inset(0 0 0 100%)'` on the `<img>` elements must be removed (they were the initial state for the OLD entrance). Replace with `style={{ transform: 'translateY(-100%)' }}` for left and `style={{ transform: 'translateY(100%)' }}` for right so first paint doesn't show them in place before GSAP attaches.

### 3.4 Idle Ken Burns coordination

The current `useIdleLoop` runs Ken Burns drift on `left` and `right` images (scale 1 ↔ 1.05, x ± 10) continuously. The new entrance also writes to the images' `yPercent`. Both can coexist since they target different properties (idle = `scale` + `x`; entrance = `yPercent`). No change needed to `useIdleLoop` — keep as-is, including its existing pill-tween removal from the previous commit.

### 3.5 Reduced motion

Per spec §6.4 of the parent, when `prefers-reduced-motion: reduce` is set, the entrance jumps to its final state with a single 400ms opacity fade on the zone root. Adapt this for the new motion:

```ts
if (reducedMotion) {
  const tl = gsap.timeline({
    scrollTrigger: { trigger: root, start: 'top 80%', toggleActions: 'play none none reverse' },
  });
  // Final state for all three motions
  tl.set([left, right], { yPercent: 0 });
  tl.set(pillFill, { scaleX: 1, transformOrigin: '50% 50%' });
  tl.set(pillContent, { opacity: 1 });
  tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
  return () => tl.kill();
}
```

### 3.6 No-`moodboard-pin` graceful fallback

The existing fallback (when `ScrollTrigger.getById('moodboard-pin')` returns undefined — happens on mobile and during the race condition) sets the images and pill to their visible static state via `gsap.set`. Update this fallback for the new structure:

```ts
gsap.set([left, right], { yPercent: 0 });
gsap.set(pillFill, { scaleX: 1, transformOrigin: '50% 50%' });
gsap.set(pillContent, { opacity: 1 });
```

This way, mobile (no horizontal pin) still shows the fully-revealed handoff. On desktop, if the race condition hits (no `moodboard-pin` registered yet), same outcome — the pill is at least visible.

### 3.7 Refs needed

The `Pill` component needs to expose two new refs to its parent: `pillFillRef` and `pillContentRef`. They're set via `useRef<HTMLDivElement>(null)` in the parent (`NextDevotionHandoff`), passed down to `Pill` as optional props (so the mobile/desktop layouts can opt in), and forwarded to the inner fill and content divs.

`EntranceArgs` interface expands:

```ts
interface EntranceArgs {
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillRef: React.RefObject<HTMLDivElement | null>;
  pillFillRef: React.RefObject<HTMLDivElement | null>;
  pillContentRef: React.RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}
```

`useIdleLoop` keeps its existing signature (it only needs the image refs and the pill, doesn't need the fill or content).

`useClickToExpand` signature unchanged — the cover is built from the outer pill's `getBoundingClientRect()` which still works regardless of whether the inner fill is currently scaleX'd to 0.

### 3.8 Click expand interaction with the new structure

The click handler captures `pill.getBoundingClientRect()` and builds a fixed-position cover. The cover's color is `pillColor` (the resolved dominant color). This still works correctly — the cover is independent of the inner fill's current scaleX state. If the user somehow clicks before the entrance plays (e.g., the page loads with the zone already in view due to deep-link scroll), the cover still expands from the pill's bounding rect. The only visual oddity would be that the source pill was invisible at click time, but since the cover takes over with the full color, the visual effect remains coherent.

This is sufficiently rare that we don't need to gate clicks on entrance completion. The whole zone has `onClick={onActivate}` already; this stays.

---

## 4. Files Affected

### Modified

| Path | Change |
|---|---|
| `src/components/sections/NextDevotionHandoff.tsx` | Pill refactor (3 nested divs with fill + content refs), updated `EntranceArgs`, replaced `useEntranceAnimation` body for the new choreography, updated the no-`moodboard-pin` fallback, updated reduced-motion branch. |

### Untouched

`src/utils/extractDominantColor.ts`, `src/hooks/useProjectColors.ts`, `src/data/devotions.ts`, `src/data/projects.ts`, `src/components/sections/MoodBoard.tsx`, `src/components/sections/PurposeDetail.tsx`, `src/App.tsx`, `src/components/ui-custom/HeroMaskClipDef.tsx`.

---

## 5. Testing

- **Visual scrub (desktop):** scroll horizontally through the moodboard. As the handoff zone enters viewport (`left 90%`), the animation begins. Verify all three motions run in parallel — images sliding from top (left) and bottom (right), pill fill expanding from center outward, text fading in late.
- **Scroll back:** scrolling backward past the trigger should reverse the timeline (`toggleActions: 'play none none reverse'`).
- **Mobile:** the handoff component renders the same structure but with no `moodboard-pin` ScrollTrigger. The fallback path in `useEntranceAnimation` should set everything to its visible state. Mobile should look identical to the final-state desktop handoff with no entrance motion.
- **Reduced motion:** toggle the OS setting. Verify a single 400ms zone fade instead of the three-part choreography. Images, fill, and content should snap to final state immediately.
- **Click expand:** click the pill mid-animation and after animation completes. Both should expand the cover to fullscreen with no visual glitch.
- **Build + tests:** `npm run build` and `npm test` (534/534) remain clean.

No new unit tests are proposed — the choreography is integration-only with GSAP/DOM. The existing test surface is unchanged.

---

## 6. Out of scope

- Adding a `LineMaskReveal` to pill text (originally specced for v1 but deferred; the new fade-in is simpler and matches the "fill from center" feel).
- Mobile-specific entrance choreography (mobile uses the fallback path that snaps to final state).
- Changing the scroll trigger range or `toggleActions`.

---

## 7. Open questions

None. All four design axes confirmed by user:
1. Image slide directions: left = down, right = up.
2. Pill fill direction: from center outward (`scaleX(0)` → `scaleX(1)`, origin center).
3. Initial pill state: completely invisible (no outline, no border, no ghost).
4. Trigger range: same as current entrance (`left 90%` → `left 30%`).
