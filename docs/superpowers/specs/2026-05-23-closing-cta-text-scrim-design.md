# Closing CTA — Soft Text Scrim

**Date:** 2026-05-23
**Status:** Approved
**Surface:** Notepad landing page, Section 09 (`ClosingCTA`)

## Problem

Section 09 renders the closing copy ("The first page is open." + subtitle) on top of a bright vertical particle column. The column reaches peak brightness exactly where the text sits, washing the heading out and making the subtitle (`#b7ada0` on near-cream particles) hard to read. The CTA buttons sit on the same column but read acceptably because their pill border and uppercase mono label hold up against the brightness.

## Goal

Make the heading and subtitle clearly readable without introducing a visible "panel," a hard edge, or any new motion. The treatment must feel like part of the scene — as if the column simply got a little darker where the words are.

## Non-goals

- Changing the particle system, its brightness, or its motion.
- Changing the copy or CTA styling.
- Protecting the CTA buttons — they read on their own.
- Adding any animation or scroll-driven behavior.
- Introducing a visible bordered "glass card" element.

## Design decisions (locked during brainstorming)

| Decision           | Choice                                        | Why                                                                |
|--------------------|-----------------------------------------------|--------------------------------------------------------------------|
| Glass treatment    | Soft scrim, no border (radial darken + blur)  | Feels invisible; reads as scene-belonging rather than UI chrome    |
| Intensity          | Soft — 72% darken, 6px blur                   | Confidently readable while still part of the scene                 |
| Coverage           | Heading + subtitle only                       | CTAs hold up unaided; tighter coverage reads quieter               |
| Edge               | Radial fade via CSS mask                      | No visible blur seam at the boundary                               |

## Visual specification

The scrim is a single layer composed of two effects co-located inside the same pseudo-element:

1. **Radial darken** — a centered ellipse that fades from near-black at the middle to fully transparent at ~70% radius:
   `radial-gradient(ellipse 75% 55% at 50% 50%, rgba(8, 8, 10, 0.72), rgba(8, 8, 10, 0) 70%)`

2. **Backdrop blur with feathered edge** — a 6px blur applied through a mask that fades the blur itself to nothing at the edges, so there's no visible seam where the blur stops:
   - `backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);`
   - Mask: `radial-gradient(ellipse 70% 52% at 50% 50%, #000 35%, transparent 75%)`

The scrim spills out around the text by approximately `-3rem` vertical and `-5rem` horizontal so the fade has room to feather past the typography without the edge meeting the type. The ellipse was widened from a tighter 60%/45% during visual verification: the particle system morphs between a narrow pencil shape and a wider heart shape, and the bigger ellipse keeps the heart's outer extremes inside the darken footprint.

## DOM & CSS changes

### Component (`src/notepad-landing/sections/09-closing-cta.tsx`)

Wrap the heading and subtitle in a new `<div className="closing-text-block">`. CTAs stay outside the wrapper.

```tsx
<div className="closing-content">
  <div className="closing-text-block">
    <h2 id="sec09-h2">{h2}</h2>
    <p className="closing-sub">{sub}</p>
  </div>
  <Link to="/notepad/notes" className="cta-primary closing-cta-primary">{ctaPrimary}</Link>
  <Link to="/login" className="closing-cta-secondary">{ctaSecondary}</Link>
</div>
```

### Styles (`src/notepad-landing/styles/landing.css`)

Add a new rule next to the existing `.closing-*` block:

```css
.closing-text-block {
  position: relative;
}

.closing-text-block::before {
  content: '';
  position: absolute;
  inset: -3rem -5rem;
  background: radial-gradient(
    ellipse 75% 55% at 50% 50%,
    rgba(8, 8, 10, 0.72),
    rgba(8, 8, 10, 0) 70%
  );
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  -webkit-mask: radial-gradient(
    ellipse 70% 52% at 50% 50%,
    #000 35%,
    transparent 75%
  );
  mask: radial-gradient(
    ellipse 70% 52% at 50% 50%,
    #000 35%,
    transparent 75%
  );
  z-index: 0;
  pointer-events: none;
}

.closing-text-block > * {
  position: relative;
  z-index: 1;
}
```

No changes to `.closing-cta`, `.closing-canvas`, `.closing-content`, or any CTA selector.

## Stacking

Today's layers inside `.closing-cta`:

- `.closing-canvas` — `z-index: 0` (particle system)
- `.closing-content` — `z-index: 1` (text + CTAs)

The scrim is rendered *inside* `.closing-text-block`, which is a child of `.closing-content`. Inside that subtree:

- `.closing-text-block::before` — `z-index: 0` (scrim)
- `.closing-text-block > h2, p` — `z-index: 1` (lifted via the `> *` rule above)

This nesting means the scrim never needs to fight the existing two-layer stacking — it lives entirely within `.closing-content`'s own stacking context.

## Layout impact

None. The scrim is absolutely positioned and `pointer-events: none`; it does not displace flow, change the text-block's box, or affect the CTAs below.

## Responsive

The ellipse dimensions are percentages of `.closing-text-block`, so the scrim scales naturally with heading line length and viewport width. The negative `inset` is in `rem`, so it scales with root font size. No mobile-specific rules required.

## Accessibility

- **Semantic:** Decorative pseudo-element; invisible to assistive tech without any attribute change.
- **Contrast:** Today the subtitle (`#b7ada0`) on the bright cream particle column fails WCAG AA. With the scrim the subtitle sits on near-black (`rgba(8, 8, 10, 0.72)` over `#0e0e0e`), comfortably passing AA for body text. Heading (`#f4f0e8`) also gains contrast.
- **Reduced motion:** The scrim is static; no `prefers-reduced-motion` branching required.

## Browser support

`backdrop-filter` is supported in all evergreen browsers and Safari (via `-webkit-backdrop-filter`, included). If a Firefox build has `backdrop-filter` disabled, the user still gets the radial darken via the `background` declaration — they lose only the blur softness. The radial darken alone is enough to bring contrast above AA, so this graceful degradation is acceptable.

## Testing

Add `src/notepad-landing/sections/09-closing-cta.test.tsx`:

- Renders `<ClosingCTA prm={true} />` inside a `<MemoryRouter>` (the section uses `<Link>`).
- Stub `window.IntersectionObserver` so the staged effect never fires; this avoids the dynamic import of `three/particle-system`. Follow the pattern in `src/notepad-landing/hooks/use-intersection-stage.test.tsx`.
- Asserts a `.closing-text-block` element exists.
- Asserts the heading and `.closing-sub` paragraph are children of `.closing-text-block`.
- Asserts the primary and secondary CTAs are siblings of `.closing-text-block` (i.e., *not* inside it).

No visual regression test required — the change is small, the structure assertion catches accidental flattening of the wrapper, and the CSS values can be reviewed directly in the diff.

## Risks & open questions

None identified. The change is additive, scoped to one section, and pure CSS plus a single wrapper div.

## Out of scope

Particle system tuning, copy edits, CTA restyles, any other section. If the scrim's tone or feathering still doesn't feel right after the implementation lands, that's a follow-up tweak — not a redesign.
