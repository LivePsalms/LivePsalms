# Hero bridge — pinned spatial redesign

Replaces the just-implemented bridge cascade (see [2026-05-15-hero-bridge-text-design.md](./2026-05-15-hero-bridge-text-design.md)) with a pinned scroll-scrub sequence. The three beats now occupy distinct positions on the stage and hand off to each other one at a time, instead of cascading together into a single stack.

## Why this redesign

The original bridge revealed the three beats as a tight stack that fades in once and stays put. After seeing it in motion, the design wants more spatial drama and more weight on each beat individually: each one should own a moment of the user's attention before yielding to the next. The result is a paced, cinematic triptych — one beat at a time, in its own corner of the stage — that earns the full ~300vh of scroll real estate the new pin consumes.

The voice and typography (Cormorant Garamond italic, deep umber, cream canvas, the thesis sized larger than its siblings) carry over unchanged.

## Copy

Unchanged from the original design:

1. **Invitation** (text 1) — *Come here to pause. To refill. To reflect. To reconnect.*
2. **Thesis** (text 2) — *Restoration is a returning.*
3. **Assurance** (text 3) — *Your life with God is not slipping away. It is being kept.*

## Visual & motion design

### Structure & pinning

```
[ wordmark-collapse section  — 380vh, sticky inner, ends with A on cream ]
[ NEW: bridge section        — 300vh outer, sticky inner h-screen, cream ]
[ silhouette mask section    — 250vh, sticky inner                       ]
[ Psalm 23 quote             — minHeight 8vh, marginTop 15vh             ]
```

- **Outer container:** 300vh tall — provides the scroll runway for the three-beat sequence.
- **Inner stage:** `position: sticky; top: 0; height: 100vh`, cream background (`var(--paper-cream)`), `overflow: hidden`. Stays glued to the viewport for the full 200vh of scrub range.
- Inside the sticky stage, three absolutely-positioned `<p>` elements (one per beat) share the stage; only one is visible at a time.

The mask section currently has `marginTop: '-35vh'`. With a pinned bridge, this would cause text 3 to be eaten by the appearing mask. **Required change:** reduce the mask's negative margin to `-10vh`. The bridge already fades text 3 to zero during the last 5% of the pin, so a 10vh overlap is purely a subtle ease into the imagery world — no text gets eaten.

### Spatial layout

Three beats, three positions on the stage:

| Beat | Position (≥ 768px) | Max-width | Size |
|---|---|---|---|
| 1 (invitation) | Left — `left: 10vw`, vertically centered | 440px | `clamp(24px, 4vw, 40px)`, weight 300 |
| 2 (thesis) | Right — `right: 10vw`, vertically centered | 440px | `clamp(32px, 5.5vw, 60px)`, weight 400 |
| 3 (assurance) | Center — `left: 50%, translate(-50%, -50%)` | 560px | `clamp(24px, 4vw, 40px)`, weight 300 |

All three:
- Font: Cormorant Garamond, italic
- Color: `var(--deep-umber)`
- Line height: 1.4
- Text-align: center

**Mobile (< 768px):** the spatial layout collapses to a single center position. All three beats are absolutely positioned at `top: 50%, left: 50%, transform: translate(-50%, -50%)` (vertically and horizontally centered). They overlap in position, but that's fine — the kiss-handoff timing means only one beat is ever visible at a time, so they take turns occupying the same center point. The narrative still works; the horizontal differentiation is just suppressed where there isn't room for it.

### Per-beat motion

Each beat passes through three phases inside the pin:

**Enter** — rise + blur clear + fade up
- `y: 40 → 0`
- `filter: blur(10px) → blur(0px)`
- `opacity: 0 → 1`
- ease: `power2.out`

**Hold** — at full presence
- `opacity: 1`, `y: 0`, `filter: blur(0px)`, no movement

**Exit** — pure opacity fade
- `opacity: 1 → 0`
- No reverse-rise, no reverse-blur — quiet, soft departure
- ease: `power1.in`

Asymmetric entry/exit (active rise on the way in, quiet fade on the way out) gives each beat a sense of arrival without making the exit feel performative.

### Timeline — kiss handoff across the pin

GSAP timeline scrubbed across the 200vh scroll range, progress 0.0 → 1.0:

| Progress | Text 1 (left) | Text 2 (right) | Text 3 (center) |
|---|---|---|---|
| 0.00 → 0.10 | enter | — | — |
| 0.10 → 0.28 | **hold** | — | — |
| 0.28 → 0.34 | exit | — | — |
| 0.34 → 0.40 | — | enter | — |
| 0.40 → 0.60 | — | **hold** | — |
| 0.60 → 0.66 | — | exit | — |
| 0.66 → 0.72 | — | — | enter |
| 0.72 → 0.95 | — | — | **hold** |
| 0.95 → 1.00 | — | — | exit |

Kiss handoff: each beat's exit ends exactly where the next beat's enter begins. There is never a moment when two beats are visible simultaneously, and there is never (except at the very start and very end) a moment when zero beats are visible.

**Scrub value:** `scrub: 2` — matches the Psalm 23 cascade's smoothing. Fast trackpad flicks decompress into a smooth settle.

`invalidateOnRefresh: true` so resize and layout changes recompute the trigger positions.

### Reduced motion

Users with `prefers-reduced-motion: reduce` get a non-pinned static fallback:

- Outer container: 100vh (no pinning, no scrub)
- Inner: normal flex column, all three beats stacked vertically on cream, all at full opacity
- No rise, no blur, no fade
- Effectively reverts to a layout similar to the original bridge cascade's static end state

The user gets the full message without the spatial choreography.

### Exit and handoff to the mask

After the pin releases (when the outer's bottom passes `top` in the viewport), the mask section follows. Per the structural note above, the mask's existing `-35vh` margin-top is removed or reduced to `-10vh` so text 3 isn't eaten by the appearing silhouette.

Text 3 fades out during the last 5% of the pin (progress 0.95 → 1.00), so the final scroll moment before pin release shows a clean cream stage — making the handoff to the mask visually clean.

### Accessibility

- The bridge `<section>` retains `aria-label="Site introduction"` from the original design.
- Each beat is a semantic `<p>` element.
- All three beats are present in the DOM at all times — the animation only changes their visual presence, not their structural presence. Screen readers read all three regardless of scroll position.

## Code shape

### Files modified

**`src/components/sections/Hero.tsx`** — rewrites the bridge's `useEffect` and JSX block introduced in commit `4fd02e8`. Specifically:

- The 4 bridge refs stay (`bridgeRef`, `bridgeInviteRef`, `bridgeThesisRef`, `bridgeAssureRef`)
- The `useEffect` is rewritten to use a pinned `ScrollTrigger` with the kiss-handoff timeline above
- The JSX block becomes the pinned stage (outer + sticky inner + three absolutely-positioned `<p>` elements)
- The reduced-motion early-return is updated to set ALL three beats to their settled state (`opacity: 1`) since the fallback shows all three stacked
- The mask scroll container's `marginTop` is changed from `'-35vh'` to `'-10vh'` (or `0`)

**`src/index.css`** — `.bridge-line` and `.bridge-thesis` keep their existing typography. The max-width changes:
- `.bridge-line` max-width: 720px → keep at 720px (still appropriate for text 3, the center beat that uses it)
- A new `.bridge-stage` class may help group the sticky inner's properties

Text 1 and text 3 both use the same typography (`.bridge-line`) but want different max-widths (440px for text 1 on the side, 560px for text 3 at center). The existing `.bridge-line` class is split into:

- `.bridge-line-side` — max-width 440px, used by text 1 (and by symmetry, the thesis already has its own `.bridge-thesis` class with max-width adjusted to 440px to match the side-positioned typography column)
- `.bridge-line-center` — max-width 560px, used by text 3

The split keeps the typography in CSS where it belongs, instead of relying on inline `maxWidth` overrides on the JSX elements.

**`src/components/sections/hero-bridge-content.ts`** — `BRIDGE_CASCADE_TIMING` is replaced with `BRIDGE_PIN_TIMING`, structured per beat for clarity at the call site:

```typescript
export const BRIDGE_PIN_TIMING = {
  text1: { enter: 0,    holdStart: 0.10, holdEnd: 0.28, exit: 0.34 },
  text2: { enter: 0.34, holdStart: 0.40, holdEnd: 0.60, exit: 0.66 },
  text3: { enter: 0.66, holdStart: 0.72, holdEnd: 0.95, exit: 1.00 },
} as const;
```

Each beat's `enter` equals the previous beat's `exit` (kiss handoff). The `holdStart` is where the entry tween completes (full opacity reached); `holdEnd` is where the exit tween begins (opacity starts dropping).

**`src/components/sections/hero-bridge-content.test.ts`** — update timing assertions to match the new structure.

### What this work undoes

The previous bridge implementation (commit `4fd02e8`) is largely undone:
- The cascade `useEffect` is replaced with a pinned-scrub version
- The JSX structure is replaced with the pinned stage
- The `BRIDGE_CASCADE_TIMING` constants are replaced with `BRIDGE_PIN_TIMING`

The previous Psalm 23 cascade fix (commit `d2f1265`) is **kept** — that's a real consistency improvement that stands on its own.

## Out of scope

- Changing the Psalm 23 quote's cascade reveal — it still uses the existing cascade pattern below the mask
- Changing the wordmark-collapse or mask-expand timelines themselves
- Adding new backdrop elements behind the bridge (organic backdrop, watermark A, etc.)
- Adding parallax or velocity-driven secondary motion to the beats
- Internationalization of the copy
- Tracking which beats the user has actually read (analytics)
