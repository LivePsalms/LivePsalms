# Design — PSALMS Logo Reveal

## Style Prompt

Cinematic, calm, elegant logo reveal. The PSALMS wordmark expands letter-by-letter from a single anchor (the A), like ink settling onto paper. Motion exhales rather than announces — long decelerating curves with extended settles, no bounces, no flourish. The aesthetic borrows from luxury film titles and modern brand identities: deep near-black canvas, cream type, generous negative space, no decorative noise.

## Colors

- `#f6f4f0` — Cream (the logo's native fill, sourced from the SVG)
- `#0a0a0c` — Near-black canvas (warm-leaning to harmonize with cream type)
- `#050507` — Vignette outer edge (radial only — no linear gradients on dark to avoid H.264 banding)

## Typography

The logo IS the typography. No additional type renders.

## Motion Rules

- All entrance eases decelerate (ease-out family). No ease-in. No bounce.
- A is a soft fade-in: opacity 0 → 1, scale 0.96 → 1, 900 ms, `power2.out`.
- Spread fans from A outward in three waves at 450 ms intervals: inner pair (S, L) → outer pair (P, M) → far letter (S).
- Each spread tween is 1.8 s long — slow enough to feel deliberate, short enough to keep momentum.
- Three eases per scene (Emil's rule): position uses `power3.out`, opacity uses `power1.out`, blur uses `power2.out`.
- Initial blur of 6 px on traveling letters masks the visual transition (Emil's blur-to-mask trick).
- Total composition: 6 s. Approximately 4 s of motion + 2 s hold to let the final composition land.

## What NOT to Do

- No bouncy springs. This is not a playful brand reveal.
- No simultaneous reveal of all letters — stagger from A outward in waves.
- No exit animations on individual letters before composition end.
- No pure-black `#000` background — too harsh against cream. Use `#0a0a0c`.
- No linear gradients on the background — radial only.
- No scale-from-zero on letters. They start at A's position with opacity 0, sliding outward.
