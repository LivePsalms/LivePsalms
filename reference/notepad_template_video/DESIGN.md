# DESIGN — Notepad Cinematic Compilation

## Style Prompt

A premium cinematic montage of five notepad template clips, joined by soft blur
crossfades. The piece is restrained, emotionally controlled, and quietly
luxurious — closer to a fashion campaign or brand film than a tutorial reel.
The footage carries the meaning; the edit only guides the breath between
moments. Every transition is a single controlled exhale: the outgoing frame
softens into a calm cinematic blur, the incoming frame emerges through that
softness and settles into crisp focus.

## Colors

- `#000000` — Stage backdrop (pure cinematic black)
- `#0a0a0a` — Subtle vignette inner edge
- `#ffffff` — Reserved for any optional overlay or end card (unused here)

The palette is intentionally minimal so the original footage is the only
chromatic presence on screen. No washes, no gradients across the frame.

## Typography

- Not used — this is a pure-footage piece. Any text would compete with the
  source clips, which the brief forbids.

## Motion Language

- **Easing:** Emil Kowalski's strong `cubic-bezier(0.77, 0, 0.175, 1)`,
  expressed as GSAP `power3.inOut` for the crossfades and `power3.out` for the
  opening reveal.
- **Duration:** 1.4s per crossfade. Long enough to feel like an exhale, short
  enough to feel intentional. Opening reveal 1.1s. Closing fade 1.0s.
- **Blur peak:** 18px (under Emil's 20px Safari ceiling). Outgoing ramps to
  18px, incoming resolves from 18px.
- **Opacity:** Symmetric crossfade — both clips at ~50% opacity through the
  midpoint, creating the "breath between scenes" the brief asks for.

## What NOT to Do

- No sharp cuts, no whip pans, no zooms, no spins, no chrome, no glitch, no
  light leaks, no lens streaks, no overlays, no text, no music sting, no film
  grain, no Ken Burns push, no flashy transitions of any kind.
- No exit animations on intermediate clips — the blur crossfade IS the exit.
- No animated `scale(0)` and no entrance from pure transparency without a
  blur veil — every emergence has weight.
