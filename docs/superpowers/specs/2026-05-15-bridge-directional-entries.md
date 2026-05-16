# Bridge — directional enter motion for texts 2 and 3

Iterative tweak on the [pinned bridge redesign](./2026-05-15-hero-bridge-pinned-redesign.md). After watching the pinned sequence, the user noted that text 1 reads as "scrolling in" (it appears while the bridge is still scrolling up due to the `'top 80%'` trigger, plus it has a longer enter window) while texts 2 and 3 read as "fading in" (they enter while the bridge is statically pinned, in a shorter window, with the same vertical rise as text 1 but feeling more static). This change gives texts 2 and 3 directional motion that distinguishes their entries — and lengthens their enter windows so the motion has room to be felt.

## Changes

### Text 1 (invitation, left)

Unchanged.

- Initial: `y: 40, opacity: 0, filter: blur(10px)`
- Tween to: `y: 0, opacity: 1, filter: blur(0px)`
- Position: enter 0 → holdStart 0.10 (10% of timeline)

### Text 2 (thesis, right)

Replace vertical rise with horizontal slide from offscreen-right.

- Initial: `x: 120, opacity: 0, filter: blur(10px)` (120px to the right of resting position — beyond the right edge given `right: 10vw`)
- Tween to: `x: 0, opacity: 1, filter: blur(0px)`
- Ease: `power2.out`
- Position: enter 0.34 → holdStart **0.44** (10% of timeline, was 0.06)

Text 2 slides leftward across the screen, decelerating into its right-side resting position.

### Text 3 (assurance, center)

Keep vertical rise but make it more pronounced (doubled travel distance).

- Initial: `y: 80, opacity: 0, filter: blur(10px)` (was `y: 40`)
- Tween to: `y: 0, opacity: 1, filter: blur(0px)`
- Ease: `power2.out`
- Position: enter 0.66 → holdStart **0.76** (10% of timeline, was 0.06)

### Exits — unchanged

All three beats still exit with pure opacity fade-out (`opacity: 1 → 0`). No reverse-slide, no reverse-rise. The asymmetric entry/exit (active arrival, quiet departure) is intentional.

### Hold durations

Slightly shorter to accommodate the longer enter windows. Still substantial.

| Beat | Old hold | New hold |
|---|---|---|
| Text 2 | 20% (0.40 → 0.60) | 16% (0.44 → 0.60) |
| Text 3 | 23% (0.72 → 0.95) | 19% (0.76 → 0.95) |

### Kiss-handoff invariants

Preserved:
- `text1.exit (0.34) === text2.enter (0.34)` ✓
- `text2.exit (0.66) === text3.enter (0.66)` ✓

## Code changes

### `src/components/sections/hero-bridge-content.ts`

`BRIDGE_PIN_TIMING.text2.holdStart`: `0.40` → `0.44`
`BRIDGE_PIN_TIMING.text3.holdStart`: `0.72` → `0.76`

### `src/components/sections/hero-bridge-content.test.ts`

Update the corresponding `holdStart` assertions for text2 and text3.

### `src/components/sections/Hero.tsx`

In the bridge `useEffect`:

1. Split the single `gsap.set([t1, t2, t3], { opacity: 0, y: 40, filter: 'blur(10px)' })` into three per-beat calls with the per-beat initial states.

2. Change text 2's enter tween target from `{ opacity: 1, y: 0, ... }` to `{ opacity: 1, x: 0, ... }` (replace `y` with `x`).

3. Text 3's enter tween target is unchanged (`y: 0`) since the initial state changed (`y: 80`) but the resting position is still `y: 0`.

## Out of scope

- Adding directional motion to text 1 (stays as vertical rise from below)
- Adding directional motion to exits
- Changing trigger position or scrub value
- Mobile-specific behavior (the horizontal slide for text 2 will still play on mobile, even though text 2 occupies the center position there; the 120px x-offset is small enough relative to viewport that it shouldn't cause layout issues, and reduced-motion users bypass this entirely)
