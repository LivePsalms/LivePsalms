# Hero Background Motion — Design

**Status:** Approved (2026-05-13)
**Scope:** Add a looping, breath-like warm-shadow surface behind the PSALMS wordmark in the first hero viewport, preserving the existing olive background tone.
**File touched:** `src/components/sections/Hero.tsx` only.

---

## Goal

Layer a meditative, photographic "sunlight on water" reflection behind the wordmark on the first hero viewport. The motion is subtle — `sine.inOut` only, breath-like, glacial — and reads as warm light/shadow playing over the existing background, never as a replacement of it. The site's olive (`#988F80`) remains the dominant tone; only the shadow side of the composition modulates it.

## Source assets

Located in `public/hero-background-motion/`:

- `renders/hero-loop-draft.mp4` — pre-rendered 8s seamless loop, ~1.29 MB. Authored from the standalone HyperFrames composition (`index.html`) and its `DESIGN.md` spec.
- `shadow-overlay.jpg` — the static base frame the composition was built from. Used as the reduced-motion fallback.

The standalone composition uses SVG `feTurbulence` + `feDisplacementMap` to warp the base image with two-layer turbulence (slow macro-swell + finer shimmer). We do NOT re-run that live in React — the pre-rendered MP4 is the shipping asset.

## Why pre-rendered, not live

The existing Hero is animation-dense: an intro timeline (`useLayoutEffect`), a scroll-collapse timeline (`useLayoutEffect`), a mask-expand timeline (`useEffect`), and a scroll-linked quote reveal — all sharing the main thread, often simultaneously. `feDisplacementMap` over a full-viewport surface is one of the more expensive SVG filters and would compete for paint budget during the scroll-collapse scrub.

The composition was authored specifically to be rendered out — that's why the MP4 exists. The motion is subtle enough that H.264 compression doesn't read as a downgrade, and hardware video decode is essentially free CPU-wise.

## Placement & layering

A new element is added inside the existing sticky `h-screen` container in `src/components/sections/Hero.tsx` (the block beginning at line 490). Its style:

```ts
{
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  pointerEvents: 'none',
  mixBlendMode: 'multiply',
  opacity: 0,                  // initial — see Lifecycle
  zIndex: 1,                   // see Z-order
  willChange: 'opacity',
}
```

Element type:

- `prefersReducedMotion === false` → `<video src="/hero-background-motion/renders/hero-loop-draft.mp4" loop muted playsInline autoPlay preload="auto">`
- `prefersReducedMotion === true` → `<img src="/hero-background-motion/shadow-overlay.jpg" alt="">`

Both share identical wrapper styles; only the inner element type changes.

## Z-order

Existing stack inside the sticky container (preserved exactly):

| Layer | z-index | Purpose |
|---|---|---|
| `darkCanvasRef` | 2 | Dark intro radial-gradient canvas |
| `glowAuraRef` | 3 | Wordmark glow during heartbeats |
| `pulseRingRef` | 3 | Intro ring |
| Wordmark | 4 | The PSALMS SVG |
| `collapseRingRef` | 5 | Scroll-collapse climax ring |

The new motion layer slots in **at z-index 1** — above the section base, below everything else. This is the key trick that makes the intro handoff work without any custom timing: the dark canvas at z2 covers the motion during the intro, and as `darkCanvasRef` tweens from opacity 1 → 0 at handoff, the multiply blend underneath is revealed automatically.

## Blend mode: `multiply`

The composition's warm cream highlights (`#fffbf2` / `#f6f1e8`) collapse to near-zero contribution against the olive `#988F80` under multiply — they effectively disappear. Only the warm-gray shadow regions (`#c8c0b0`, `#a8a094`) and the corner-shadow falloff darken the olive, which is exactly the "shadow overlay over the background" the user described.

Trade-off accepted: the bright sun-bloom in the upper-left will be visually quiet against the olive base. That's intentional — preserving the olive tone matters more than retaining the cream highlight read.

If after implementation the multiply effect feels too heavy, the only tuning knob is a slight `opacity` reduction (e.g., 0.85). No change to blend mode.

## Lifecycle

### `introActive === true` (first-paint intro path)

1. The video element mounts at opacity 0 with `autoPlay loop muted playsInline`. Decoder warms and the loop is already mid-cycle by the time it becomes visible — no startup hitch.
2. The intro timeline runs unchanged. At t=6.40s, `tl.call(...)` fires `setShowNav(true)` and `onHandoff?.()`. Simultaneously the dark canvas tween (`opacity 1 → 0` over 1.2s, `ease: 'power2.inOut'`) begins.
3. The motion layer's opacity is bound to `showNav`. When `showNav` flips to `true`, a CSS transition fades opacity 0 → 1 over **1.2s, `ease: 'power2.inOut'`** — same shape and duration as the dark canvas. They cross at the midpoint and the multiply effect "develops in" as the dark canvas thins.

Reusing the existing `showNav` state means we add zero new state, zero new effects, zero new refs — just `style={{ opacity: showNav ? 1 : 0, transition: 'opacity 1.2s cubic-bezier(0.45, 0, 0.55, 1)' }}` on the wrapper. The cubic-bezier approximates GSAP's `power2.inOut` curve so the motion fade and the dark canvas fade share the same eye-shape.

### `introActive === false` (refresh / non-first visit)

`showNav` defaults to `true` (`useState<boolean>(!introActive)` at line 34). The motion layer renders at opacity 1 immediately — no transition runs because nothing changes.

### Scroll-collapse

No special handling needed. The motion layer is a sibling of the wordmark inside the sticky `h-screen` container. The container stays glued for 280vh of scroll while the wordmark collapse plays out; the motion plays continuously through that whole window. When the sticky releases (~60% of the outer 380vh), the entire scene scrolls up out of view together. The motion never bleeds into the mask-expand section below because it lives inside the sticky region, not the outer scroll container.

### Reduced motion

`prefersReducedMotion === true` → the `<video>` is swapped for an `<img>` with the same src family (`shadow-overlay.jpg` — the static base frame). Same z-index, same multiply blend, same `showNav`-driven opacity fade. The user gets the warm-shadow ambiance with no motion.

## What does NOT change

- The intro timeline (`useLayoutEffect` at line 217) — untouched.
- The scroll-collapse timeline (`useLayoutEffect` at line 314) — untouched.
- The mask-expand timeline (`useEffect` at line 103) — untouched.
- The reduced-motion fallbacks for the existing animations — untouched.
- Z-indices of any existing element — preserved exactly.
- Component props and the `Hero` contract — no new props.
- The `--app-bg` olive token and the page's background color rendering.

## Acceptance criteria

1. On a fresh load with `introActive=true`, the motion is invisible until the dark canvas begins fading at handoff; by ~1.2s after handoff it is fully visible at full multiply blend; the wordmark, glow, ring, and climax ring all render normally on top.
2. On a non-intro render (`introActive=false`), the motion is fully visible from the first paint.
3. The motion loops seamlessly (no visible cut at the 8s mark).
4. As the user scrolls past the hero, the motion scrolls out of view together with the wordmark — it does not appear in the mask-expand section below.
5. With `prefers-reduced-motion: reduce`, the layer renders as a static image with identical placement and blend; no `<video>` decode occurs.
6. The page background tone (`#988F80`) is visibly preserved — the motion reads as shadow play over olive, not as a cream replacement.
7. No regressions to intro, scroll-collapse, mask-expand, or quote-reveal animations.

## Out of scope

- Any change to the standalone HyperFrames composition or re-rendering of the MP4.
- Live SVG-filter implementation in React.
- Scroll-linked parameter modulation of the motion (e.g., slowing it down during scroll).
- Replacing or supplementing the existing `--app-bg` token.
- Background motion in any section other than the hero's first viewport.

## File touch list

- `src/components/sections/Hero.tsx` — add one wrapper element (video or img) inside the sticky `h-screen` container, immediately before `darkCanvasRef` so it sits beneath in DOM order with `z-index: 1`. No new imports, no new state, no new effects.
