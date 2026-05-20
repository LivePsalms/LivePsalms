# Next Devotion Handoff — Final Moodboard Zone Redesign

**Date:** 2026-05-19
**Status:** Draft — awaiting user review
**Scope:** Replace Zone 8 ("Next Devotion Hero") in every devotion's zones component inside [src/components/sections/MoodBoard.tsx](../../../src/components/sections/MoodBoard.tsx) with a shared, cinematic handoff component inspired by the Mersi Architecture project-card transition (see [reference/Screen Recording 2026-05-19 at 10.53.18.mov](../../../reference/Screen%20Recording%202026-05-19%20at%2010.53.18.mov)).

---

## 1. Problem

The current Zone 8 across all 11 devotions is a copy-pasted two-column block: next project's name + description on the left, next project's thumbnail on the right. It functions, but it doesn't read as a deliberate "transition moment" between devotions. It also has no click affordance — the user must scroll back into the page header or restart the scroll-pin to navigate elsewhere.

The reference video shows a more deliberate handoff: a horizontal split-image composition with a floating, mask-clipped pill in the center that acts as both a label and a navigation primitive. On click, the pill itself expands into the next page, providing visual continuity between contexts.

We want that pattern for our devotion-to-devotion handoff.

---

## 2. Goal

Build a single shared component, `NextDevotionHandoff`, that:

1. Replaces the existing Zone 8 in all 11 zones functions (`PeaceZones`, `HopeZones`, `StrengthZones`, `WholenessZones`, `PurposeZones`, `ConnectionZones`, `IdentityZones`, `JoyZones`, `ForgivenessZones`, `SurrenderZones`, `TrustZones`).
2. Reads from typed project + devotion data — works generically for any (current, next) pair.
3. Hooks into the existing `transition` navigation system so click behavior chains correctly into the destination page's `useDetailReveal`.
4. Respects `prefers-reduced-motion` for the idle loop and entrance.
5. Is mobile-aware: the mobile MoodBoard variants (`PurposeMobile`, etc.) get a vertical-column variant of the same component.

---

## 3. Visual Design

### 3.1 Desktop layout

A full-width, single-screen zone styled to match the existing Zone 8 outer shell:

```
<div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
```

Inside, a two-column 50/50 grid:

- **Left half** (`grid-cols-2`, full height): `<img src={nextProject.thumbnail} />` covering the half, `object-cover`.
- **Right half**: `<img src={nextDevotion.firstMoodboardImage} />` covering the half, `object-cover`.
- A 1px vertical seam line at the 50% mark in `rgba(255,255,255,0.15)` adds editorial precision (not strictly necessary but ties to the reference).

### 3.2 The pill

Absolutely positioned, centered both axes via `top: 50% / left: 50% / transform: translate(-50%, -50%)`.

- **Shape:** the same SVG clip-path `hero-mask-clip` defined in [src/components/sections/Hero.tsx:747](../../../src/components/sections/Hero.tsx#L747). The path lives inside the home hero's hidden `<svg>` block; for the moodboard we will lift it into a shared SVG defs block so both the hero and the handoff can reference it without one mounting/unmounting affecting the other.
- **Size:** `width: min(62vw, 920px); aspect-ratio: 11 / 3.2` (matches the reference proportions and reads as a banner, not a button; the cap prevents it sprawling on ultra-wide displays).
- **Fill:** `backgroundColor: nextProject.overlayColor`.
- **Shadow:** `box-shadow: 0 25px 50px -20px rgba(0,0,0,0.55)` for depth above the split images.

### 3.3 Pill content — three columns

A `flex` row with `justify-content: space-between`, padded `0 10%`:

| Column | Content | Type |
|---|---|---|
| Left | "Next Devotion" label (uppercase, 10px, 0.25em tracking, `text-white/60`) | label |
| Left | Devotion title (e.g. "Brought Near"), Cormorant Garamond italic 300, ~28px, `text-white` | title |
| Center | 2-letter monogram (e.g. "CN" for Connection), sans-serif 700, ~22px, `opacity: 0.25`, uppercase | embossed-style monogram |
| Right | Category name (e.g. "Connection") and scripture ref + `↗` (uppercase, 10-12px, 0.2em tracking, `text-white/65-70`) | meta |

### 3.4 Mobile layout

Each `*Mobile` component currently renders a vertical stack of `<section>` blocks. The new handoff replaces the last "Next Devotion" section.

- The split is preserved but rotated to **two vertical columns** (50/50 width, full height of the section).
- Section height: `min-h-screen` (matches existing mobile sections).
- Pill is centered, `width: ~92%`, same three-column content but scaled down (~12px title, ~6-7px labels).

---

## 4. Data

### 4.1 New file: `src/data/devotions.ts`

Keyed by project `id` (the 11 devotion slugs: `restoration1`, `restoration3`, `strength`, `wholeness`, `purpose`, `connection`, `identity`, `joy`, `forgiveness`, `surrender`, `trust`):

```ts
export interface Devotion {
  id: string;                   // matches Project.id
  label: string;                // e.g. "The Restoration of Connection"
  title: string;                // e.g. "Brought Near"
  scriptureRef: string;         // e.g. "Ephesians 2:13"
  monogram: string;             // 2 letters, e.g. "CN"
  firstMoodboardImage: string;  // public path, e.g. "/restoration8/hf_..."
}

export const devotions: Record<string, Devotion> = { ... };
```

The `label`, `title`, and `scriptureRef` values are sourced from the inline conditionals in [src/components/sections/PurposeDetail.tsx:75-272](../../../src/components/sections/PurposeDetail.tsx#L75-L272). We do **not** refactor PurposeDetail to consume this data file in this spec — that's a separate cleanup. We just duplicate the strings into the new data file so the handoff component can read them cleanly. (We will leave a TODO comment in PurposeDetail noting the duplication.)

The `firstMoodboardImage` values are sourced from the `hero` field of each per-devotion image-map constant in [src/components/sections/MoodBoard.tsx:65-225](../../../src/components/sections/MoodBoard.tsx) (e.g. `P.hero`, `C.hero`, `T.hero`). Same one-time duplication, same TODO.

The 2-letter monogram is a new piece of data — proposed values:

| Devotion | Monogram |
|---|---|
| restoration1 (Peace) | PE |
| restoration3 (Hope) | HO |
| strength | ST |
| wholeness | WH |
| purpose | PU |
| connection | CN |
| identity | ID |
| joy | JY |
| forgiveness | FG |
| surrender | SR |
| trust | TR |

These are placeholder picks — the user can override before merge.

---

## 5. Component API

### 5.1 New file: `src/components/sections/NextDevotionHandoff.tsx`

```tsx
interface NextDevotionHandoffProps {
  currentProject: Project;   // for context / future use
  nextProject: Project;      // drives overlayColor, thumbnail, route
  nextDevotion: Devotion;    // drives pill text + firstMoodboardImage
  variant?: 'desktop' | 'mobile';  // default: 'desktop'
}
```

The component:

1. Renders the split-image background + pill.
2. Owns its own GSAP `ScrollTrigger` for the cinematic entrance.
3. Owns its own click handler. Uses `useNavigate()` from `react-router-dom` directly (NextDevotionHandoff renders inside the `/purpose/:id` route, so this is safe). No prop drilling from `App.tsx` needed.
4. Owns its own pill-expand animation (see §6.3).

### 5.2 Integration into existing zones

Each of the 11 zones functions currently has, at the bottom:

```tsx
{/* ── Zone 8: Next Devotion Hero ── */}
<div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
  <div className="grid grid-cols-2 h-full">
    {/* ... left column with text ... */}
    {/* ... right column with thumbnail ... */}
  </div>
</div>
```

We replace all 11 blocks with:

```tsx
<NextDevotionHandoff
  currentProject={project}
  nextProject={nextProject}
  nextDevotion={devotions[nextProject.id]}
/>
```

Same swap on the mobile side, with `variant="mobile"`.

If `devotions[nextProject.id]` is undefined (project has no devotion attached — e.g. some restoration images don't), the component falls back to a simplified version: just the split + a small "Next" label, no pill. This preserves the navigation handoff without crashing when data is incomplete.

---

## 6. Motion

### 6.1 Entrance — desktop

Triggered when the zone enters the viewport (horizontal scroll). Uses GSAP `ScrollTrigger` bound to the zone's container, scrubbing on horizontal scroll position.

| Stage | Element | Animation | Timing |
|---|---|---|---|
| 1 | Left image | `clipPath: inset(0 100% 0 0)` → `inset(0 0 0 0)` plus subtle `y: 24px → 0` parallax | 0 → 0.4 |
| 1 | Right image | `clipPath: inset(0 0 0 100%)` → `inset(0 0 0 0)` plus subtle `y: 24px → 0` parallax | 0 → 0.4 |
| 2 | Pill | `y: 40px → 0`, `opacity: 0 → 1`, `scale: 0.96 → 1` | 0.35 → 0.55 |
| 3 | Pill text | `LineMaskReveal` (same primitive as elsewhere in the detail page) | 0.5 → 0.75 |

### 6.2 Idle loop (after entrance settles)

- **Pill breathing:** GSAP `repeat: -1, yoyo: true`, `scale: 1 → 1.02`, duration `4s`, ease `sine.inOut`.
- **Ken Burns drift on both images:** GSAP `repeat: -1, yoyo: true`, `scale: 1 → 1.05` + `x: 0 → -10px` (left) / `x: 0 → 10px` (right), duration `12s`, ease `sine.inOut`. These are independent of the scroll-driven entrance — they start once the entrance timeline finishes.

### 6.3 Click — pill expand

The pill-expand intentionally replaces the existing `SplitTransition`'s `expanding` phase for this navigation path. We bypass `transition.beginNavigation()` (which would run a competing overlay) and use `useNavigate()` directly, with the pill itself acting as the color cover during route swap.

On pointer-down on the pill (or the full zone if `variant === 'mobile'`):

1. Kill the idle loop tweens. Lock body scroll (`document.body.style.overflow = 'hidden'`) to prevent jank during the morph.
2. Capture the pill's current rect with `getBoundingClientRect()`, promote it to `position: fixed` at the captured rect (FLIP technique), and reparent it under `document.body` via a portal so transform/clip changes are not constrained by ancestor `overflow: hidden`.
3. Tween in parallel (duration ~650ms, ease `power3.inOut`):
   - `top/left/width/height` → `0 / 0 / 100vw / 100vh`.
   - `clipPath` from `url(#hero-mask-clip)` to `inset(0 0 0 0)`. The clipPath morph is rendered by transitioning the path's `d` attribute via GSAP's `MorphSVGPlugin` if available, or by cross-fading two overlapping divs (clipped + unclipped) if not.
   - Pill text fades to `opacity: 0` in the first 200ms.
4. When the pill fully covers the viewport, call `navigate('/purpose/{next.id}')`. React Router unmounts the current route. The pill remains mounted via the portal (it lives outside the route tree once portaled) and stays as a full-screen color cover.
5. The destination route mounts and runs its existing `useDetailReveal`. After a 200ms delay (allowing the destination's first paint to settle), the portaled pill fades out (`opacity: 1 → 0` over 400ms), then unmounts itself and restores body scroll.

Net effect: a single, continuous color cover bridges the two routes — owned by `NextDevotionHandoff`, not by `RouteTransition`.

### 6.4 Reduced motion

When `window.matchMedia('(prefers-reduced-motion: reduce)').matches`:

- Skip entrance parallax, skip scrub. Use a single `opacity: 0 → 1` fade over 400ms on the whole zone.
- Skip the idle breathing and Ken Burns.
- On click, skip the pill-expand morph. Fall back to the existing app-wide flow: `transition.beginNavigation('/purpose/{next.id}', next.overlayColor)`. The existing `RouteTransition` already handles reduced motion via its own shorter durations. To access `beginNavigation` without prop drilling under reduced motion, we route the click through `useNavigate()` *plus* a small `useRouteTransitionContext()` (a new lightweight context provided by `App.tsx` that exposes the existing `transition` instance to descendants). This context is only consumed under reduced motion; the standard path doesn't need it.

---

## 7. SVG clip-path sharing

The `hero-mask-clip` clipPath currently lives inside the Hero component's render tree (line 747). When the user is on a purpose detail page, the Hero component is not mounted — meaning the clipPath def doesn't exist in the DOM.

Resolution: extract the clipPath def into a small dedicated component, `<HeroMaskClipDef />`, that renders the hidden `<svg><defs><clipPath id="hero-mask-clip">...</clipPath></defs></svg>` and nothing else. Mount it in:

- The Hero component (replace inline def with `<HeroMaskClipDef />`).
- The MoodBoard component, once near the top of its render. Every devotion's last zone uses it, so we mount unconditionally rather than gating on data.

The Hero page and the MoodBoard never render at the same time (they're on different routes), so there is no ID collision risk. The path is the single source of truth.

File location: `src/components/ui-custom/HeroMaskClipDef.tsx`.

---

## 8. Files Affected

### New files

- `src/data/devotions.ts` — per-devotion metadata
- `src/components/sections/NextDevotionHandoff.tsx` — the shared zone component
- `src/components/ui-custom/HeroMaskClipDef.tsx` — extracted clipPath def

### Modified files

- `src/components/sections/Hero.tsx` — replace inline clipPath def with `<HeroMaskClipDef />`
- `src/components/sections/MoodBoard.tsx` — mount `<HeroMaskClipDef />` once near root; replace all 11 desktop Zone 8 blocks; replace all 11 mobile Next-Devotion sections

### Untouched

- `src/data/projects.ts` (no schema change — devotions are a parallel typed map)
- `src/types/index.ts` (we can add the `Devotion` type to `src/data/devotions.ts` itself, or to types; either is fine — proposal puts it in `devotions.ts` to keep `types/index.ts` focused on cross-cutting types)
- `src/App.tsx` and `transition` system (no API change — we reuse existing `beginNavigation`)

---

## 9. Testing

- **Manual visual regression:** scroll to the final zone of each of 11 devotions on desktop. Confirm the layout, the next-devotion data, the pill content match expectations. Mobile pass for all 11.
- **Click behavior:** click pill on each of 11 desktop devotions, confirm correct route navigation and that the destination page's reveal runs without flicker.
- **Reduced motion:** toggle the OS setting and re-check entrance + click behavior.
- **Wraparound:** navigate to the final devotion (Trust), confirm the next is the first project in the array (`projects[0]`) per existing `(currentIndex + 1) % projects.length` logic.
- **Data fallback:** temporarily remove an entry from `devotions[]`, confirm the simplified fallback renders without crash. Then restore.

No new unit tests are proposed — the component is composition and data-driven; there's no business logic to test in isolation. If we find ourselves wanting one, a snapshot test of the rendered output for one (current, next) pair would be the right place to start.

---

## 10. Out of scope (explicit)

- Refactoring `PurposeDetail.tsx` to consume `src/data/devotions.ts` for its inline conditionals. Tracked as a TODO comment.
- Refactoring the per-devotion `T` / `F` / `P` / etc. image-map constants in `MoodBoard.tsx` to consume `src/data/devotions.ts`. Tracked as a TODO comment.
- Adding a "previous devotion" handoff at the *start* of each moodboard. The pattern would be symmetric but the user has not asked for it; we ship one direction first.
- Changing the navigation chain order (still `(currentIndex + 1) % projects.length`).

---

## 11. Open questions

None. All design decisions confirmed by user (replace Zone 8 across all 11, three-column pill, pill-expand click transition, cinematic entrance + idle loop, mobile vertical-split preserved).
