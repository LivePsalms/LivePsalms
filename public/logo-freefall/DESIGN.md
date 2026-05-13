# Design — PSALMS Logo Collapse & Glow Release

A mirror of the original **PSALMS Logo Reveal**. The wordmark — already fully expanded at t=0 — gathers back into the A in three calm waves, and the moment of full contact triggers a single vibrant glow ring. No freefall. No tumble. Quiet beginning, quiet end, one luminous moment in the middle.

## Style Prompt

Cinematic, calm, elegant. The PSALMS wordmark inhales — letters slide horizontally back into the A in deliberate waves, fading and softening with motion-blur as they merge. The moment of full merge releases a single vibrant cream halo: a quick core flash, an expanding ring, and a soft lingering glow that holds behind the A as the composition rests. The aesthetic borrows from luxury film outros and modern brand stings: warm near-black canvas, cream type, generous negative space, no decorative noise.

## Colors

- `#f6f4f0` — Cream (the logo's native fill)
- `#0a0a0c` — Near-black canvas (warm-leaning to harmonize with cream)
- `#050507` — Vignette outer edge (radial only — no linear gradients on dark to avoid H.264 banding)
- `rgba(246,244,240, 0.85–1.0)` — Glow core peak (cream pushed bright, never pure white)
- `rgba(246,244,240, 0.35)` — Persistent halo behind the A through the final hold

## Typography

The logo IS the typography. No additional type renders.

## Motion Rules (mirror of the original reveal)

- All collapse easings **decelerate** (ease-out family) — same family the original used for the spread, applied to the reverse direction. No `ease-in`, no bounce.
- Three eases per scene (Emil's rule): **position** uses `power3.out`, **opacity** uses `power1.out`, **blur** uses `power2.out`.
- Initial blur of `0px` on each letter grows to **6px** during the inward flight — same blur-to-mask trick as the original, just reversed in direction.
- **Three waves**, mirroring the original's three outward waves:
  - Wave 1 (0.00s): far letter `S₂` collapses alone — the original's last-out is the first to come home.
  - Wave 2 (0.50s): outer pair `P` + `M` collapse together.
  - Wave 3 (1.00s): inner pair `S₁` + `L` collapse together — the closest to A, last to merge.
- Each collapse tween is **1.6s** long — matches the original's 1.8s but a touch shorter so the eye stays in motion.
- A holds at scale 1, opacity 1 through the entire collapse — it is the anchor, never moves.
- At the moment of full merge (~2.6s), A breathes a single subtle pulse: scale **1 → 1.06 → 1** over 0.9s (`power2.out` then `power3.out`).
- Glow release fires at 2.95s — three coordinated layers (halo / core / ring), all `power2.out` for the energetic outward release.
- Final 1.5s is a still hold with only the A visible and a soft persistent halo behind it.
- Total composition: **6s** — 0–2.6s motion → 2.5–4.4s climax → 4.4–6.0s rest.

## What NOT to Do

- No simultaneous collapse of all letters — preserve the wave structure.
- No `scale(0)` entries or exits anywhere. Letters never scale; they only translate, fade, and blur. Glow elements start from `scale(0.3)` minimum.
- No `ease-in` family. The collapse is a deceleration, not an acceleration.
- No bouncy springs on the A pulse — `power2.out` → `power3.out`, never `back` or `elastic`.
- No pure-white glow. Cream `#f6f4f0` pushed bright, never `#fff`.
- No pure-black `#000` background — too harsh against cream. Use `#0a0a0c`.
- No linear gradients on the background — radial only.
- No exit animation on the A itself — it is the resting brand mark when the composition ends.

## Geometry (for the collapse)

X-centres of each glyph in the SVG viewBox (0–1494). The A is the anchor.

| Glyph | x-centre | Δ to A (positive = travels left) |
| ----- | -------- | -------------------------------- |
| P     | 109      | −478 (slides right toward A)     |
| S₁    | 338      | −249 (slides right toward A)     |
| A     | 587      |   0 (anchor — never moves)        |
| L     | 819      | +232 (slides left toward A)      |
| M     | 1095     | +508 (slides left toward A)      |
| S₂    | 1378     | +791 (slides left toward A)      |

At rendered scale (stage width 1280px on 1920×1080 frame, 1 svg unit ≈ 0.857px), the longest journey (`S₂`) is ~678px and the shortest (`S₁` / `L`) is ~213px.
