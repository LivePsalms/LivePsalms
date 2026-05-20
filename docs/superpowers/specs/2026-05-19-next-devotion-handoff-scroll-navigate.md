# Next Devotion Handoff — Scroll-Driven Navigation Transition

**Date:** 2026-05-19
**Status:** Draft — awaiting user review
**Scope:** Extend the `NextDevotionHandoff` zone with a second "transition" act. After the existing slide-in animation completes, continuing to scroll drives a second scroll-scrubbed sequence: the split images slide back out (left up, right down), the pill fades out, then the images slide back in with the same motion. At the end of this transition, navigation fires to the next devotion. The destination's existing `useDetailReveal` takes over from there.

**Parent feature:** [docs/superpowers/specs/2026-05-19-next-devotion-handoff-design.md](2026-05-19-next-devotion-handoff-design.md) plus the scroll-reveal refinement at [2026-05-19-next-devotion-handoff-scroll-reveal.md](2026-05-19-next-devotion-handoff-scroll-reveal.md).

---

## 1. Problem

The handoff currently fires the slide-in animation (Act 1) as the zone enters viewport. Once the animation completes, the user is left on a "frozen" handoff until they click the pill (which fires the existing pill-expand transition + navigate). Some users won't notice the pill is clickable and will simply continue scrolling — at which point the moodboard's horizontal pin releases and they bottom-out at the end of the page. They lose the path to the next devotion.

We want scrolling itself to be the navigation gesture, and we want it to feel like part of the same visual language as the slide-in animation.

---

## 2. Goal

Extend the handoff zone so it occupies an additional viewport's worth of horizontal scroll. Within this extension (Act 2):

1. The handoff images animate OUT vertically — left image slides UP (yPercent 0 → -100), right image slides DOWN (yPercent 0 → 100). Mirrors the entrance in reverse.
2. The pill content fades to opacity 0 simultaneously.
3. After the images have fully exited, the same images slide BACK IN with the entrance motion (left -100 → 0, right 100 → 0).
4. At the end of Act 2's scroll range, `useNavigate()` fires to the next devotion.
5. The destination's existing reveal takes over.

The visual reading: "the split page leaves, a fresh split page arrives" — symbolizing the page transition. Same images, same motion, signaling a new context.

The click-on-pill path remains available (existing `useClickToExpand` pill-expand morph) for users who want to skip the scroll-driven transition.

---

## 3. Design

### 3.1 Zone width and pin extension

The outer `<section>` of both `DesktopLayout` and `MobileLayout` currently has `width: '100vw'`. We change it to `width: '200vw'` (desktop) and `minHeight: '200vh'` is not relevant because mobile uses vertical scroll. For mobile, we add a second 100vh section after the handoff — see §3.5.

For desktop, doubling the zone's width adds 100vw of horizontal-scroll runway. The moodboard's `mainTween` in `MoodBoard.tsx` already computes its end as `+= ${track.scrollWidth - window.innerWidth}`, so the extension is picked up automatically; no manual pin math required.

### 3.2 Act 1 trigger (unchanged conceptually, but range tightened)

Act 1 still uses the existing `useEntranceAnimation` timeline (images slide in, pill fill expands, pill content fades in). The trigger range stays the same: `start: 'left 30%'`, `end: 'left -10%'` — referenced to the LEFT edge of the zone, which is the same point as before.

The zone is now twice as wide, but the LEFT edge still enters viewport once, in the same place. Act 1 plays out exactly as it does today.

### 3.3 Act 2 trigger (new)

Inside the same `useEntranceAnimation` hook, add a second ScrollTrigger for Act 2. Its anchor is a NEW invisible child element placed at the 50% mark of the zone — call it `actTwoSentinelRef`. The element is a `<div>` with `position: absolute; left: 50%; top: 0; width: 1px; height: 100%;` inside the section, serving only as a positional anchor for ScrollTrigger.

Act 2 timeline (scrubbed to scroll progress 0 → 1 across the second half of the zone):

| Range (timeline t) | Element | Property | From → To | Ease |
|---|---|---|---|---|
| 0 → 0.4 | Left image | yPercent | `0` → `-100` | `power2.in` |
| 0 → 0.4 | Right image | yPercent | `0` → `100` | `power2.in` |
| 0 → 0.3 | Pill fill | scaleX | `1` → `0` | `power2.in` |
| 0 → 0.3 | Pill content | opacity | `1` → `0` | `power2.in` |
| 0.6 → 1.0 | Left image | yPercent | `-100` → `0` | `power3.out` |
| 0.6 → 1.0 | Right image | yPercent | `100` → `0` | `power3.out` |
| At 1.0 | Route navigation | `useNavigate(`/purpose/${next.id}`)` | one-shot | — |

The 0.4 → 0.6 gap is a brief "breathing room" where:
- Images are off-screen (yPercent at ±100)
- Pill content is fully faded (opacity 0)
- Pill fill is at scaleX(0) (invisible)
- Visible to the user: only the section's `backgroundColor` (which is `pillColor` — the next project's resolved dominant color). A clean color-wash beat between exit and re-entry.

ScrollTrigger config for Act 2:
```ts
scrollTrigger: {
  trigger: actTwoSentinelRef.current,
  containerAnimation,
  start: 'left 100%',  // when the sentinel (at 50% of zone) enters viewport from right
  end: 'left -10%',    // ends slightly past viewport left
  scrub: 1,            // scrubbed — user controls progress via scroll
  toggleActions: 'play none none reverse',
}
```

`scrub: 1` makes the animation feel responsive to scroll speed. Scrolling back reverses the timeline cleanly.

### 3.4 Navigation firing

The navigation must fire once, exactly when Act 2 reaches scroll progress ~1.0. With `scrub`, the standard `onComplete` doesn't fire — instead use `onUpdate` and a shared guard ref:

```ts
const navigatedRef = useRef(false);
// ...
const tl = gsap.timeline({
  scrollTrigger: {
    // ...config above...
    onUpdate: (self) => {
      if (self.progress >= 0.98 && !navigatedRef.current) {
        navigatedRef.current = true;
        navigate(`/purpose/${nextProject.id}`);
      }
    },
  },
});
```

Threshold at `0.98` rather than `1.0` so the nav fires just before the user reaches the end of the extension — reduces the chance of overshooting if the user scrolls fast.

The same `navigatedRef` is shared with `useClickToExpand` (passed as a fourth argument or via a small new arg) so that a click during scrubbing is also reflected in the ref — and vice versa. Both paths check the ref before firing `navigate(...)`, preventing double-navigation.

### 3.5 Mobile

Mobile uses vertical scroll, no horizontal pin. The handoff currently renders as a single 100vh `<section>` with the same content. For Act 2 on mobile:

Option A — wider: change `minHeight: '100vh'` to `minHeight: '200vh'`. As the user scrolls down through the second viewport of the section, a vertical-scroll-driven Act 2 plays. ScrollTrigger anchors to a sentinel at the section's 50% vertical mark.

Option B — separate section: append a second `<section>` after the handoff that mirrors the structure with a vertical-scroll-driven Act 2.

I recommend **A** — a single section with a longer minHeight is simpler and keeps the layout cohesive. The mobile-fallback path in `useEntranceAnimation` already snaps to visible state and won't conflict.

For mobile Act 2's ScrollTrigger:
```ts
scrollTrigger: {
  trigger: actTwoSentinelRef.current,
  start: 'top 80%',
  end: 'top -20%',
  scrub: 1,
  onUpdate: (self) => { /* same nav guard */ },
}
```

### 3.6 Sentinel ref

A new `actTwoSentinelRef` is added to `NextDevotionHandoff`'s ref set. Both `DesktopLayout` and `MobileLayout` render the sentinel `<div>` inside the section at the appropriate position (50% horizontal for desktop, 50% vertical for mobile).

### 3.7 Click expand interaction

The existing `useClickToExpand` (vanilla DOM cover that morphs the pill to fullscreen on click) remains available. If the user clicks the pill during Act 1 or Act 2, the morph fires and the cover navigates immediately. The Act 2 timeline is killed when the component unmounts (during route change).

To prevent double navigation if both a scroll-threshold-cross and a click happen close together, share a single `navigatedRef` (per §3.4) between `useClickToExpand` and the Act 2 timeline. Both check it before firing `navigate(...)`.

### 3.8 Reduced motion

When `prefers-reduced-motion: reduce` is set:
- Act 1 still snaps to its final state via the existing reduced-motion branch (no change).
- Act 2 is fully skipped — no scroll-driven slide-out/in animation, and no scroll-driven navigation.
- The user is allowed to scroll past the handoff (the zone is still wider), but the second viewport simply shows the static handoff color. To navigate, the user must click the pill.

Rationale: auto-navigation on scroll without a visible cue is potentially disorienting for users who opt out of motion. Keeping the click path as the explicit nav for this audience matches reduced-motion expectations.

The zone width stays at 200vw / 200vh even under reduced motion — the extra scroll space costs nothing visually (it's the same flat color) and avoids branching the layout based on motion preference.

---

## 4. Files Affected

### Modified

| Path | Change |
|---|---|
| `src/components/sections/NextDevotionHandoff.tsx` | Section width changes to `200vw` (desktop) / `200vh` (mobile). New `actTwoSentinelRef`. New Act 2 timeline + ScrollTrigger inside `useEntranceAnimation`. Shared `navigatedRef` to coordinate with `useClickToExpand`. Reduced-motion skip. |

### Untouched

`MoodBoard.tsx`, `PurposeDetail.tsx`, all data files, all other components. The moodboard pin math automatically accounts for the wider zone.

---

## 5. Testing

- **Desktop scroll:** scroll horizontally through a devotion's moodboard. Verify Act 1 plays at zone entry (existing behavior). Continue scrolling past Act 1 completion. Verify Act 2 plays: images slide out, pill fades, brief pause, images slide back in, then page navigates to the next devotion. The destination's reveal plays.
- **Scroll back:** scrolling backward during Act 2 should reverse the timeline. If the user scrolls back before navigation triggers, no nav happens.
- **Click on pill mid-Act-1 / mid-Act-2:** triggers the existing pill-expand morph and navigates immediately. Act 2 timeline gets killed cleanly on unmount.
- **Mobile:** vertical-scroll equivalent — Act 1 plays on entry, scroll further triggers Act 2.
- **Reduced motion:** scrolling past the handoff does NOT auto-navigate. Click on pill still works.
- **Build + tests:** `npm run build` and `npm test` (534/534) remain clean.

---

## 6. Out of scope

- Animating the destination page's hero with a slide-in (the destination's `useDetailReveal` continues to play its existing reveal).
- Changing the pill-expand click transition.
- Modifying the moodboard's pinning math beyond what the wider zone automatically does.

---

## 7. Open questions

None. Two design decisions confirmed by user:
1. The transition's "act 2" should re-play the slide-in animation: images animate OUT, then the same images slide back IN.
2. Pill fades out during act 2's first phase.
