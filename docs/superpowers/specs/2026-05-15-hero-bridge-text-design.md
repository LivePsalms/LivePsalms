# Hero bridge text — design

Adds a new copy block to the hero scroll flow, slotted between the wordmark-collapse stack and the silhouette mask. The block introduces the site in the site's own voice — a manifesto moment that bookends the existing Psalm 23 quote sitting below the mask.

## Why

The hero currently moves: **wordmark → silhouette mask → Psalm 23 scripture quote**. That sequence has visual and scriptural weight but no plain-language explanation of what the site is for. A new visitor sees a beautiful wordmark, then beautiful imagery, then a verse — and is asked to infer everything else. The bridge text fills that gap with three short beats: an invitation, a thesis, and an assurance.

The bridge is positioned so it answers the wordmark's distillation moment (the A holding alone on cream) and sets up the silhouette imagery that follows.

## Copy

Three beats, in scroll order:

1. **Invitation** — *Come here to pause. To refill. To reflect. To reconnect.*
2. **Thesis** — *Restoration is a returning.*
3. **Assurance** — *Your life with God is not slipping away. It is being kept.*

## Visual & motion design

### Placement in the scroll stack

```
[ wordmark-collapse section — 380vh, sticky inner, ends with A on cream ]
[ NEW: bridge section          — ~80vh, normal flow, cream canvas       ]
[ silhouette mask section      — 250vh, sticky inner, marginTop -35vh   ]
[ Psalm 23 quote               — minHeight 8vh, marginTop 15vh          ]
```

- Standalone block — not pinned, no `position: sticky`. Same architectural role as the Psalm 23 quote below the mask.
- Cream canvas (`var(--paper-cream)`) — visually identical to the wordmark's end state and the Psalm's backdrop. No tonal jump between sections.
- The mask section's existing `marginTop: '-35vh'` still applies — the overlap is preserved, but now the mask's top pulls into the bridge's tail instead of the wordmark's tail. The visual handoff (bridge fades, imagery emerges) carries the same overlap relationship that exists today.

### Typography

All three beats use **Cormorant Garamond, italic**, color `var(--deep-umber)`. Centered within a max-width column of `720px` (chosen so the thesis line *"Restoration is a returning."* fits on a single line at its largest clamp size). The thesis line is lifted in scale and weight to become the architectural center of the passage.

| Beat | Font | Weight | Size |
|---|---|---|---|
| Invitation | Cormorant Garamond italic | 300 | `clamp(24px, 4vw, 40px)` |
| Thesis | Cormorant Garamond italic | 400 | `clamp(32px, 5.5vw, 60px)` |
| Assurance | Cormorant Garamond italic | 300 | `clamp(24px, 4vw, 40px)` |

Line height: 1.4 (matches existing `.quote-text`).

Vertical rhythm between beats: `mt-8 md:mt-12` (32px mobile, 48px desktop). Slightly more breathing room than the Psalm's tight `mt-2 md:mt-3` stack — the lifted thesis needs space around it to read as the visual center.

### Reveal motion

Cascade pattern, structurally identical to the Psalm 23 reveal in [Hero.tsx:63-101](../../../src/components/sections/Hero.tsx). The two passages become motion-twins as well as voice-twins.

GSAP scrub timeline triggered on the bridge container:

| Parameter | Value |
|---|---|
| `trigger` | bridge container ref |
| `start` | `'top 95%'` |
| `end` | `'top 10%'` |
| `scrub` | `3` |
| `invalidateOnRefresh` | `true` |

Each beat is tweened from a hidden initial state to its visible state:

| Property | From | To |
|---|---|---|
| `opacity` | 0 | 1 |
| `y` | 40 | 0 |
| `filter` | `blur(10px)` | `blur(0px)` |
| `ease` | — | `power2.out` |
| `duration` | — | 1 |

Stagger positions on the timeline (matching the Psalm exactly):

| Beat | Timeline position |
|---|---|
| Invitation | `0` |
| Thesis | `0.35` |
| Assurance | `0.7` |

### Reduced motion

`prefers-reduced-motion: reduce` users get all three beats rendered statically at full opacity, no scroll-fade, no blur, no transform.

The existing Psalm 23 reveal in [Hero.tsx:63-101](../../../src/components/sections/Hero.tsx) does not currently honor `prefers-reduced-motion`. Adding the same fallback to the Psalm is part of this change — it's a small consistency fix that belongs with introducing a second cascade reveal in the same file.

### Accessibility

- Bridge wrapped as its own `<section>` with `aria-label="Site introduction"`. The block is expository copy, not decorative.
- All three beats use semantic `<p>` elements (matching the Psalm's structure).
- Text color and size comfortably exceed WCAG AA against the cream canvas.

## Code shape

The bridge lives inside [Hero.tsx](../../../src/components/sections/Hero.tsx), not in a new file. Reasoning:

1. It belongs to the hero scroll act narratively — wordmark → bridge → mask → psalm reads as one continuous opening sequence.
2. The mask section is already inside `Hero.tsx`. Splitting only the bridge into a separate component would create asymmetric component structure.
3. The bridge's cascade timeline mirrors the Psalm's cascade timeline almost verbatim — easier to maintain consistency when they live in the same file.

### New additions to `Hero.tsx`

**New refs** (alongside the existing `quoteRef` family):
- `bridgeRef` — container
- `bridgeLine1Ref` — invitation line
- `bridgeThesisRef` — thesis line
- `bridgeCloseRef` — assurance line

**New `useEffect`** — mirrors the existing Psalm cascade effect at [Hero.tsx:63-101](../../../src/components/sections/Hero.tsx). Adds the reduced-motion early-return that the existing Psalm effect lacks.

**Updated existing Psalm `useEffect`** — gains the same reduced-motion early-return for consistency.

**New JSX block** — placed between the wordmark scroll container (closes at the `</div>` ending the 380vh container) and the mask scroll container (the one with `marginTop: '-35vh'`).

### CSS

Two options:
- **Option 1 (preferred):** Add new utility classes `.bridge-line` and `.bridge-thesis` to `src/index.css` next to the existing `.quote-text` / `.quote-attr` block. This keeps typographic tokens grouped with siblings.
- **Option 2:** Inline Tailwind via `clamp()` and `font-[Cormorant_Garamond]`. Rejected because the existing quote uses the CSS class pattern — staying consistent matters more than saving one CSS file edit.

Implementation will use Option 1.

## Out of scope

- Changing the Psalm 23 quote text, typography, or position
- Changing the wordmark-collapse or mask-expand timelines
- Adding any backdrop element behind the bridge text (organic backdrop, watermark A, etc.) — pure cream canvas, no atmospheric layer
- Mobile-specific layout variations beyond the responsive `clamp()` sizing
- Internationalization of the copy (English-only for now, consistent with the rest of the hero)
