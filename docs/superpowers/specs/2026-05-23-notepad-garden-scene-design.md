# Notepad Landing — Ink Garden Scene (Sections 02–08 Replacement)

**Status:** approved · ready for plan
**Date:** 2026-05-23
**Branch:** `deepen-architecture`
**Scope:** Replace Sections 02–08 of the notepad landing page with one pinned, scroll-jacked Three.js "ink garden" scene patterned on `reference/remix-landscape-design/index.html`. Hero (Section 01) and Closing CTA (Section 09) are untouched.

---

## 0. Errata (added 2026-05-23, post-approval)

Three corrections surfaced during plan drafting from reading the existing codebase. They tighten the spec to the project's actual conventions; no creative decisions changed.

- **Palette is the project's existing notepad tokens**, not the reference's hex values. Use `var(--np-bg-paper)` (`#f6f0e6`), `var(--np-ink)` (`#432c29`), `var(--np-ink-mid)`, `var(--np-ink-warm)`, `var(--np-ink-soft)`, `var(--np-display)` (Cormorant Garamond), `var(--np-body)` (Source Serif Pro), `var(--np-mono)` (JetBrains Mono). Three.js scene reads numeric versions of `--np-bg-paper` (`0xf6f0e6`) and `--np-ink` (`0x432c29`). The reference's `#F5F0E8` / `#1a1714` were original-site brand values that do not survive into this port.
- **`usePrefersReducedMotion` does subscribe to changes.** §6 of this spec said it did not. It does (see `src/notepad-landing/hooks/use-prefers-reduced-motion.ts:14-23`). Implication: a user toggling OS-level reduced motion mid-session triggers a `setReduced` → React re-render → `<GardenScene>` swaps between scene-mode and fallback-mode. The Three.js `cleanup()` returned by `mountGarden` must therefore be idempotent and complete; canvas must be removed from DOM via React unmount.
- **Hero CTA anchor:** `src/notepad-landing/sections/01-particle-hero.tsx:42` has `<a href="#section-02">`. The first station's container must carry `id="section-02"` (or `<GardenScene>` wrapper carries it) so the existing hero CTA continues to scroll the user into the garden.

---

## 1. Decisions Locked in Brainstorming

| ID  | Decision                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **Scope = Full Replacement.** Sections 02–08 fuse into one pinned scene. No middle scrolling cards survive (except as the reduced-motion fallback).                                       |
| Q2  | **World = Ink Garden of Psalms.** Cream paper (`#F5F0E8`) + charcoal ink (`#1a1714`), procedural ink-line plants, doves replace butterflies, paper-noise SVG overlay at `multiply` blend. |
| Q3  | **7 stations, 1:1 mapping.** Every current section becomes one station. No copy cut. Total spacer ≈ 950vh (125vh per base station + per-item extra for the two list stations — see §4.4).        |
| Q4  | **List-station mechanic = pin-and-scroll.** Sections 06 (Seven Papers) and 07 (Tiers) hold the camera while items fade in one-by-one in the content layer, then release the camera.       |
| D1  | **Progress indicator = vertical Roman-numeral page numbers** (I/VII … VII/VII), right edge, clickable to jump.                                                                            |
| D2  | **Reduced-motion fallback = bypass the entire scene** and render the existing seven section components as today.                                                                          |
| D3  | **Procedural variance = on.** Fresh garden every mount (random plant jitter, butterfly positions, ink splash). Composition (cluster positions, density) is hand-authored.                |
| D4  | **Camera path = 7 hand-authored waypoints**, `lerp + smoothstep + sin breathing` (reference's exact model).                                                                              |
| D5  | **Nav theme = emit "light" for the whole pinned scene** via one selector replacing the seven middle entries in `NAV_THEME_SECTIONS`.                                                     |

---

## 2. Architecture

### 2.1 Layer model (matches reference index.html, z-order top-down)

```
z: 11  <GardenProgress />          ← Roman-numeral nav (fixed, right)
z: 10  <PaperOverlay />            ← SVG fractal-noise, multiply, opacity 0.3 (fixed)
z:  9  <GardenContentLayer />      ← 7 stations of copy, fixed full-viewport, fade in/out
z:  0  <GardenCanvas />            ← Three.js, fixed full-viewport
z: -1  <ScrollSpacer />            ← invisible div, height: 875vh, gives scrollbar its track
```

All five layers are children of `<GardenScene />`. `GardenScene` is the only sibling that replaces `<ThreeVoices>` through `<TrustImport>` in `src/notepad-landing/index.tsx`.

### 2.2 File layout

**New files**

```
src/notepad-landing/
  sections/
    garden-scene/
      index.tsx                       ← <GardenScene /> top-level component
      garden-canvas.tsx               ← Three.js mount wrapper (React side)
      garden-content-layer.tsx        ← 7 stations container, fade orchestration
      garden-progress.tsx             ← Roman-numeral progress indicator
      paper-overlay.tsx               ← SVG noise overlay component
      use-garden-scroll.ts            ← hook: scrollY → progress (0..1) + currentStation
      stations/
        01-three-voices.tsx           ← copy block for station 1
        02-living-graph.tsx
        03-lamplight.tsx
        04-scripture-margin.tsx
        05-seven-papers.tsx           ← list station: 7-item pin-and-scroll
        06-tier-path.tsx              ← list station: 8-item pin-and-scroll
        07-trust-import.tsx
      garden-scene.test.tsx           ← integration test: scroll → station fades, PRM bypass
      use-garden-scroll.test.ts       ← unit test: scrollY math
  three/
    garden/
      mount-garden.ts                 ← exported mount(canvas, opts) → { cleanup }; mirrors particle-system.ts shape
      camera-stations.ts              ← 7-tuple cameraStations[] (position + lookAt)
      plants.ts                       ← createBranch + createInkLeaf + createPlantCluster
      ground.ts                       ← createCrosshatchGround
      splashes.ts                     ← createInkSplash
      circles.ts                      ← createInkCircle (wobbly halos)
      doves.ts                        ← createDove (formerly butterfly — same wing math, different silhouette)
      particles.ts                    ← createFloatingParticles
      ink-materials.ts                ← inkLineMaterial / inkMeshMaterial helpers
```

**Modified files**

```
src/notepad-landing/
  index.tsx                ← composes GardenScene between ParticleHero and ClosingCTA;
                              when PRM, renders the existing 7 section components instead
  styles/landing.css       ← appends .garden-scene + descendant rules, scoped under .notepad-landing
```

**Unchanged files (and why)**

```
sections/01-particle-hero.tsx          ← Hero, untouched per scope
sections/09-closing-cta.tsx            ← CTA, untouched per scope
sections/02-08 *.tsx                   ← KEPT for the reduced-motion fallback render
hooks/use-prefers-reduced-motion.ts    ← reused as-is
hooks/use-adaptive-nav-theme.ts        ← reused; only the entries list in index.tsx changes
three/particle-system.ts               ← Hero particle system, separate concern
data/copy.ts                           ← stations consume the same copy object; no schema change
```

### 2.3 Why a separate `three/garden/` folder, not one file

`particle-system.ts` is 300 lines and does one thing. The garden scene is closer to the reference's 800+ lines of WebGL setup. Splitting by entity (plants, ground, doves, etc.) keeps each file < 150 lines, makes each entity unit-testable in isolation, and lets us defer-load only the entities we need if future stations don't use all of them. The folder also signals "this is its own subsystem" — distinct from the hero particle system.

---

## 3. The Scene (Three.js side)

### 3.1 Tech stack

- **three** — already a project dependency (per `particle-system.ts`). Use the same version. **Do not** pin to r128 like the reference; use the project's current version and verify `THREE.Shape`, `CatmullRomCurve3`, `LineBasicMaterial` are present (they remain part of the stable API).
- **No R3F.** Existing pattern is plain Three.js mounted from a React `useEffect`. Continue that pattern for consistency with `particle-system.ts`.
- **No GSAP for the camera.** The camera loop is plain `requestAnimationFrame` + `position.lerp(target, 0.08)` per the reference. We will still use GSAP ScrollTrigger elsewhere on the page, but the garden's camera is decoupled and scroll-driven through `useGardenScroll`.
- **No Lenis.** Project uses native scroll today; introducing Lenis is out of scope.

### 3.2 Procedural entities

Verbatim port of the reference's procedural functions, with renames and one substitution:

| Function                  | Source (reference line)                            | Change           |
| ------------------------- | -------------------------------------------------- | ---------------- |
| `createBranch`            | `index.html:666-712`                               | none             |
| `createInkLeaf`           | `index.html:714-747`                               | none             |
| `createPlantCluster`      | `index.html:749-772`                               | none             |
| `createCrosshatchGround`  | `index.html:775-798`                               | none             |
| `createInkSplash`         | `index.html:801-821`                               | none             |
| `createInkCircle`         | `index.html:864-880`                               | none             |
| `createDove` (was butterfly) | `index.html:824-861`                            | wing shape function changes silhouette from butterfly to dove; flap math identical |
| `createFloatingParticles` | `index.html:883-904`                               | none             |
| `inkLineMaterial`         | `index.html:648-654`                               | none             |
| `inkMeshMaterial`         | `index.html:656-663`                               | none             |

### 3.3 World composition (cluster placement)

13 plant clusters scattered along a path that loosely runs along the X axis with a deeper Z arm. Each station's camera waypoint is composed against a specific subset of clusters. Composition is hand-authored in `mount-garden.ts`, identical pattern to `index.html:911-932` but with cluster positions extended to support 7 stations instead of 4:

```
Station    Camera area                Clusters in frame
─────────  ─────────────────────────  ────────────────────────────
1  Three Voices       center, eye-lvl   3 saplings in foreground (cluster at z=-2, mirrored)
2  Living Graph       pan left          dense thicket; branches intertwine in middle distance
3  Lamplight          pan center, up    single sparse cluster + 1 large ink circle (the "lamp")
4  Scripture Margin   pan right         medium cluster with high crosshatch density (ink "text")
5  Seven Papers       wide, eye-lvl     a row of 7 narrow ink stems, evenly spaced laterally
6  Tier Path          pan deep (-Z)     8 progressively distant clusters along the Z axis
7  Trust / Import     close, low        2 small clusters + 2 doves circling a stone basin (an ink circle)
```

Two new entities for stations 5–7 that the reference doesn't have:

- **`paperStem`** — variant of `createPlantCluster` with `complexity = 1` and a wider, flatter leaf at the tip (suggests a paper sheet rather than a plant). Used in station 5.
- **`stoneBasin`** — a wobbly ink circle stack (3 concentric circles with decreasing radius + wobble). Used in station 7. Implemented in `circles.ts` as a `createStoneBasin(x, y, z)` helper.

### 3.4 Camera waypoints

```
const cameraStations = [
  { pos: V3(0, 2.5, 12),   look: V3(0, 1, 0)     }, // 1 — entry, three saplings
  { pos: V3(-10, 3, 6),    look: V3(-14, 1.5, -3)}, // 2 — left thicket, the living graph
  { pos: V3(-2, 4, 4),     look: V3(0, 5, -2)    }, // 3 — looking up at the lamp circle
  { pos: V3(8, 2.5, 6),    look: V3(14, 1.5, -2) }, // 4 — right cluster, scripture margin
  { pos: V3(0, 3, 8),      look: V3(0, 1, 2)     }, // 5 — wide on the row of 7 paper-stems
  { pos: V3(0, 4, -2),     look: V3(0, 1.5, -20) }, // 6 — deep dolly down the tier path
  { pos: V3(0, 2, 4),      look: V3(0, 1, -2)    }, // 7 — close on the doves and basin
];
```

Per-frame: `lerpVec3` between `cameraStations[floor(t)]` and `cameraStations[ceil(t)]` with `smoothstep` easing, then `camera.position.lerp(target, 0.08)` low-pass. Sin breathing offset `(y += sin(t*0.5)*0.08, x += sin(t*0.3)*0.04)`. All ported from `index.html:994-1057`.

### 3.5 Fog, palette, renderer

```
scene.background = Color(0xF5F0E8)
scene.fog        = FogExp2(0xF5F0E8, 0.012)
renderer         = WebGLRenderer({ antialias: true, alpha: false })
renderer.pixelRatio = min(devicePixelRatio, 2)
camera           = PerspectiveCamera(50, aspect, 0.1, 200)
```

These are the reference's exact values. No tonemapping. No PBR. All materials are `LineBasic` or `MeshBasic` with `transparent: true`.

### 3.6 Mount signature

```
// three/garden/mount-garden.ts
export interface MountOptions {
  prm: boolean;                              // if true, this function is never called (bypass at React level)
  onStationChange?: (index: 0..6) => void;   // fires when currentStation flips
  scrollProgress: { current: number };       // ref the React layer mutates each scroll event (0..1)
}

export interface MountReturn { cleanup: () => void; }

export function mountGarden(canvas: HTMLCanvasElement, opts: MountOptions): MountReturn;
```

Pattern matches `particle-system.ts:mountParticleSystem`. React owns the scroll listener and writes `scrollProgress.current` each tick; the RAF loop inside `mountGarden` reads it. This avoids cross-tree state coupling and lets the loop tick smoothly even if React re-renders.

---

## 4. The Content Layer (React side)

### 4.1 `<GardenScene />` shape

```
<GardenScene prm={prm}>
  {prm
    ? <FallbackStack />                     // renders existing <ThreeVoices/>...<TrustImport/>
    : <>
        <GardenCanvas scrollProgress={ref} onStationChange={setStation} />
        <PaperOverlay />
        <GardenContentLayer currentStation={station} />
        <GardenProgress total={7} current={station} onJump={jumpTo} />
        <ScrollSpacer vh={950} />   {/* computed in §4.4: 875 base + 35 (station 5) + 40 (station 6) */}
      </>}
</GardenScene>
```

`FallbackStack` imports and renders the existing seven section components in order. This is the only place those components are now used.

### 4.2 `useGardenScroll()` hook

```
function useGardenScroll(stationCount: 7): {
  scrollProgress: MutableRefObject<number>;   // mutable ref the mount loop reads
  currentStation: number;                     // React state, debounced from scrollProgress
  jumpTo: (i: number) => void;                // smooth-scroll to station i
}
```

Implementation outline:

- `scrollProgress.current = clamp(scrollY / (spacerHeight - viewportHeight), 0, 1)` — direct reference math.
- `currentStation = round(scrollProgress * 6)` — but only commit to React state when it changes (avoids per-tick re-renders).
- Scroll listener uses `{ passive: true }`. Resize listener recomputes `spacerHeight`.
- `jumpTo(i)` computes `top = (i / 6) * (spacerHeight - viewportHeight)` and calls `window.scrollTo({ top, behavior: 'smooth' })`.

### 4.3 Station fade orchestration

Each station component receives `isActive: boolean`. Styles:

```
.garden-station        { position: absolute; inset: 0; opacity: 0; transition: opacity 0.8s ease;
                         pointer-events: none; display: flex; align-items: center; }
.garden-station.active { opacity: 1; pointer-events: auto; }
```

Identical pattern to reference `index.html:80-95`. Cross-fade is purely CSS; no GSAP needed.

### 4.4 List-station mechanic (stations 5 and 6 only)

These two stations consume more scroll than the others (~180vh each vs ~100vh) and pause the camera mid-station. Implementation:

- Each station has a **base allotment of 125vh**. Total base = `7 * 125vh = 875vh`.
- Stations 5 (Seven Papers, 7 items) and 6 (Tier Path, 8 items) each receive **extra spacer of 5vh per item** — `35vh` for station 5, `40vh` for station 6.
- **Total spacer = 875vh + 35vh + 40vh = 950vh.**
- During the list stations, the camera waypoint pair is the same on both ends — so the lerp resolves to a held pose and the camera "stops." The base 125vh is consumed by camera-in / camera-out; the per-item extra is what holds the camera while items reveal.
- The content layer renders items one at a time. `itemIndex = floor(localProgressWithinStation * itemCount)`. Each item fades in (`opacity: 0 → 1`, `transform: translateY(8px) → translateY(0)`, 600ms).
- Once `localProgressWithinStation === 1`, the next station's waypoint pair becomes active and the camera resumes.

### 4.5 Progress indicator (`<GardenProgress />`)

```
.garden-progress         { position: fixed; right: 28px; top: 50%; transform: translateY(-50%); z-index: 11;
                           display: flex; flex-direction: column; gap: 18px; }
.garden-progress-item    { font-family: var(--display); font-style: italic; font-size: 18px; line-height: 1;
                           color: var(--ink-ghost); cursor: pointer; transition: color 0.3s, transform 0.3s;
                           background: none; border: none; padding: 0; }
.garden-progress-item.active { color: var(--ink); transform: scale(1.25); }
.garden-progress-item:hover  { color: var(--ink-light); }
```

Roman numerals rendered server-side from a constant array `['I','II','III','IV','V','VI','VII']`. `aria-label` is `"Go to station {n}: {stationName}"`. Each is a real `<button>` for keyboard accessibility.

### 4.6 Paper overlay

```
.garden-paper-overlay {
  position: fixed; inset: 0; z-index: 10; pointer-events: none; mix-blend-mode: multiply; opacity: 0.3;
  background-image: url("data:image/svg+xml,...fractalNoise...");
}
```

The SVG noise URL is copied verbatim from `reference/remix-landscape-design/index.html:58`.

---

## 5. Integration With Existing Page

### 5.1 `index.tsx` (modified)

```
const NAV_THEME_SECTIONS = [
  { selector: '.notepad-landing .hero',          theme: 'dark' },
  { selector: '.notepad-landing .garden-scene',  theme: 'light' },   // replaces 7 entries
  { selector: '.notepad-landing .closing-cta',   theme: 'dark' },
] as const;

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  useAdaptiveNavTheme(NAV_THEME_SECTIONS);
  return (
    <div className="notepad-landing">
      <ParticleHero prm={prm} />
      <GardenScene prm={prm} />
      <ClosingCTA prm={prm} />
    </div>
  );
}
```

### 5.2 Reduced-motion path

When `prm === true`, `<GardenScene />` renders `<FallbackStack />`. The PRM check is at the React level, so `mountGarden` is never imported, never executed, and Three.js never instantiates.

The nav theme list also switches based on PRM. `index.tsx` selects which `NAV_THEME_SECTIONS` array to pass:

```
const NAV_THEME_SECTIONS_GARDEN = [
  { selector: '.notepad-landing .hero',         theme: 'dark' },
  { selector: '.notepad-landing .garden-scene', theme: 'light' },
  { selector: '.notepad-landing .closing-cta',  theme: 'dark' },
];

const NAV_THEME_SECTIONS_FALLBACK = [
  { selector: '.notepad-landing .hero',            theme: 'dark' },
  { selector: '.notepad-landing .three-voices',    theme: 'light' },
  // ... the original seven entries ...
  { selector: '.notepad-landing .closing-cta',     theme: 'dark' },
];

useAdaptiveNavTheme(prm ? NAV_THEME_SECTIONS_FALLBACK : NAV_THEME_SECTIONS_GARDEN);
```

`FallbackStack` does not wrap its children in a `.garden-scene` div — the original section components render with their original class names, so the fallback nav-theme list resolves the same selectors today's page uses.

### 5.3 Particle system code-split preserved

The existing `particle-system.ts` lazy-load (commit `cc3b324`) is unchanged. `mount-garden.ts` follows the same pattern — only imported inside `GardenCanvas`'s `useEffect`, never at module top-level. This keeps the initial bundle slim and Three.js is shared between the hero and the garden.

### 5.4 Routing / SSR

`index.tsx` is a client component (the existing hooks `useAdaptiveNavTheme` and `usePrefersReducedMotion` require `window`). `GardenScene` is also client-only. No SSR concern; matches existing pattern.

---

## 6. Reduced-Motion Behavior (Explicit Spec)

| `prefers-reduced-motion` | Behavior                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-preference`          | Pinned garden scene: camera glides, plants sway, doves flap, particles drift, paper overlay applied, ~950vh spacer.                                                                                          |
| `reduce`                 | `GardenScene` short-circuits to `FallbackStack`. Existing `<ThreeVoices/>`…`<TrustImport/>` render as normal scrolling sections. No Three.js mount, no canvas in the DOM, no scroll spacer, no fixed layers. |

PRM is read via `usePrefersReducedMotion()`, which DOES subscribe to OS-level changes (see Errata §0). If the user toggles reduced-motion mid-session, the hook fires `setReduced` → React re-renders `<GardenScene>` → conditional render swaps between scene-mode and fallback-mode. The Three.js `cleanup()` returned by `mountGarden` must therefore be safe to call mid-session: dispose all geometries/materials, remove canvas from DOM (React handles this via unmount), and cancel the RAF loop. The two paths never run simultaneously because the conditional render is at the top of `<GardenScene>`.

---

## 7. Accessibility

- **Content layer is the accessible version.** Every station renders real `h2`, `p`, `ul`, `button`, `a` elements. The WebGL canvas has `aria-hidden="true"` and `role="presentation"` — it carries no semantic content.
- **Progress indicator is keyboard accessible.** Each Roman numeral is a `<button>` with `aria-label="Go to station {n}: {name}"` and `aria-current="true"` on the active one.
- **Scroll-jacked stations do not trap focus.** All station copy is visible to screen readers regardless of which station is "active" (the opacity transition does not use `display: none` or `visibility: hidden`). For sighted-keyboard users, Tab cycles through all CTAs/links across all 7 stations.
- **The 950vh spacer remains keyboard-scrollable.** Page Down, arrow keys, and spacebar all work because we use native scroll (no scroll-jacking via `wheel` event prevention).
- **Reduced-motion users get the canonical accessible page** (today's implementation).

---

## 8. Performance

- **Bundle:** `mount-garden.ts` + entity files ≈ ~12 KB minified+gzipped (plant tree generators are small). Three.js is already on the page; no double-cost.
- **DPR clamped to 2** (`min(devicePixelRatio, 2)`).
- **Geometry counts:** ~13 clusters × ~5 stems × ~20 line segments = ~1300 line segments + ~200 leaf shapes + 60 floating particles + 6 doves + 4 ink circles + ~108 ground hatching lines. All `BufferGeometry`, all transparent. Well within mobile GPU envelope.
- **Scroll listener:** `{ passive: true }`. No layout thrashing; only `scrollY` read.
- **RAF loop:** one `requestAnimationFrame` driving camera + particles + doves + plant sway. ~16ms budget per frame on a 2018 MBA.
- **Resize debounced** (250ms trailing).
- **No texture loads.** Everything is procedural geometry + the inline SVG noise. Zero network requests for the garden.

---

## 9. Testing

Three layers of test (matches existing project conventions — there's already a `*.test.tsx` for `index`, `use-prefers-reduced-motion`, etc.).

### 9.1 Unit tests (Vitest, no browser)

- `use-garden-scroll.test.ts` — given `scrollY` and viewport sizes, returns the right `progress` and `currentStation`. Tests boundary conditions: 0, exactly station boundaries, > max.
- `camera-stations.test.ts` — array has length 7; each entry has `pos` and `look` with finite numbers.

### 9.2 Integration tests (React Testing Library)

- `garden-scene.test.tsx`:
  - PRM=true → renders `FallbackStack` markup, no canvas in DOM.
  - PRM=false → renders canvas, paper overlay, 7 station divs, progress indicator.
  - Scrolling to station boundary commits `currentStation` to React state and applies `.active` to the matching station div.
  - Clicking a progress indicator button calls `window.scrollTo` with the right `top`.

### 9.3 Browser smoke tests

**Dropped from spec.** Project does not have Playwright as a dependency (`package.json` checked at plan time). Adding Playwright is out of scope for this feature. The acceptance criteria in §12 that require real-browser behavior (scroll-jacking under real native scroll, `mix-blend-mode: multiply` rendering, WebGL canvas pixels) will be verified manually by running `npm run dev` and exercising the route. The vitest+jsdom integration tests in §9.2 cover everything testable in jsdom (DOM structure, hook behavior, event handlers).

---

## 10. Browser support

- WebGL 1 required (Three.js r128+ baseline). All target browsers support it.
- `mix-blend-mode: multiply` — supported in all evergreen browsers. No fallback needed (overlay simply looks slightly different in unsupported browsers; non-blocking).
- `prefers-reduced-motion` — already used in the project; no additional concern.

---

## 11. Risks & Decision Log

| Risk                                                                                              | Mitigation                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **950vh of scroll feels long.** Users may abandon mid-scene.                                       | Progress indicator gives explicit "you are at I/VII." Roman numerals make the journey feel deliberate, not endless. If telemetry shows abandonment, the future move is the "C" station-mapping option (4 stations, condensed copy). Out of scope. |
| **Camera lerp + smoothstep can feel sluggish on touch devices** with sudden scroll deltas.       | The `0.08` lerp coefficient is reference-tuned. We will keep it; if QA flags it, we can bump to `0.12` on touch devices via `matchMedia('(pointer: coarse)')`.                                                                                       |
| **Three.js version drift** could break `THREE.Shape` or `CatmullRomCurve3` if the project pin is far from r128. | Verify project's `three` version in step 1 of the implementation plan. Both APIs are stable since r80; no foreseeable break.                                                                                                                       |
| **Procedural variance breaks visual QA.** Screenshot tests are non-deterministic.                 | Playwright tests assert *structural* presence (canvas exists, 7 stations exist), not pixel output. Visual regression for the garden is intentionally out of scope; the *composition* (cluster positions) is deterministic, only the jitter varies. |
| **Code-split bundle still loads Three.js eagerly** because hero needs it.                        | This is existing behavior. Garden adds no new Three.js entry point.                                                                                                                                                                                  |
| **The 7 list items (Section 06) include `clip` paths to template pages**. Pin-and-scroll loses the link affordance. | List items in stations 5 and 6 render as real `<a>` tags pointing at the original clip URLs. They become interactive once the item has faded in. Camera does not auto-advance past a station with unclicked links — user must keep scrolling to release. |

---

## 12. Acceptance Criteria

The implementation is done when:

1. Visiting the notepad landing route shows: Hero (unchanged) → pinned garden scene → Closing CTA (unchanged).
2. Scrolling the page progresses through 7 stations in the order: Three Voices, Living Graph, Lamplight, Scripture Margin, Seven Papers, Tier Path, Trust/Import.
3. The camera glides between waypoints with the reference's lerp+smoothstep+breathing model — verifiable by recording the scroll and confirming no visible "snap" between stations.
4. Stations 5 (Seven Papers) and 6 (Tier Path) hold the camera while their list items fade in one-by-one; releasing the camera after the last item.
5. The Roman-numeral progress indicator (right edge) updates as the user scrolls; clicking any numeral scrolls to that station.
6. With `prefers-reduced-motion: reduce`, the seven middle sections render as normal scrolling cards; no canvas in the DOM; no scroll spacer.
7. Nav theme stays "light" throughout the pinned scene; "dark" for hero and CTA — verified by the existing `useAdaptiveNavTheme` mechanism.
8. All copy from current `data/copy.ts` (sections 02–08) is preserved exactly, no edits.
9. Lighthouse performance score ≥ existing baseline on the notepad route.
10. Axe-core accessibility audit reports zero new violations vs the current notepad route.

---

## 13. Out of Scope

- Mobile-specific camera path adjustments (use the same waypoints; verify in QA).
- Adding new copy or restructuring existing copy.
- Modifying the hero or closing CTA.
- Adding Lenis or any new scroll library.
- A 3D version of the existing "Living Graph" video — the station 2 ink branches are the new graph metaphor.
- Internationalization of Roman numerals (English-locale site).
