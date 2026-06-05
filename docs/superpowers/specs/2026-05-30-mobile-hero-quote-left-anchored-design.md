# Mobile hero — left-anchored quote at 70vw

**Date:** 2026-05-30
**Component:** `src/components/sections/HeroMobile.tsx`
**Scope:** Mobile (`< 768px`) only. Single className change on the quote container. Wordmark, video, bridge copy, and all hero animation unchanged.

## Goal

Move the Psalm 23:2-3 quote from the current center-aligned position to a left-anchored block at ~70vw wide. Text aligns left, container hugs the section's left edge. Wordmark and masked video stay horizontally centered.

## Why

The current centered quote sits flush with the centered wordmark and video, producing a uniform centered stack. A left-anchored quote at 70vw breaks the column's symmetry deliberately — gives the verse its own asymmetric rhythm against the centered visual content above and below it.

## Layout change

In `src/components/sections/HeroMobile.tsx`, change the quote container's className.

**Current (line 112-115):**

```tsx
className={cn(
  'text-center px-8 mt-2 transition-opacity duration-1000 max-w-md',
  quoteVisible ? 'opacity-100' : 'opacity-0',
)}
```

**New:**

```tsx
className={cn(
  'self-start text-left w-[70vw] max-w-md mt-2 transition-opacity duration-1000',
  quoteVisible ? 'opacity-100' : 'opacity-0',
)}
```

### What each utility does

| Change | Effect |
|---|---|
| `text-center` → `text-left` | Text inside flows left-to-right. |
| Remove `px-8` | No longer need 32px internal padding. The parent's `px-5` already provides 20px from screen edge. |
| Add `w-[70vw]` | Caps container at 70% viewport width — creates the visible asymmetric "right side is intentionally empty" feel. |
| Add `self-start` | Overrides the parent flex `items-center` for this child only, so the quote left-anchors while wordmark + video stay centered. |
| Keep `max-w-md` | Caps width at 28rem (448px) on larger mobile/tablet viewports. At 768px the dispatcher hands off to `HeroDesktop` so this rarely engages. |
| Keep `mt-2` | Preserves the existing 8px nudge below the wordmark on top of the parent's `gap-10`. |
| Keep `transition-opacity duration-1000` and opacity-toggle | Intersection-fade behavior unchanged. |

### Geometry check

On a 375px iPhone:
- Parent `<div>` has `px-5` (20px each side) → content area is 335px wide, starting at 20px from screen-left.
- Wordmark and video are `w-[88vw]` (330px) and centered via parent's `items-center` → they sit at (335-330)/2 = 2.5px offset within the content area, i.e. at 22.5px from screen-left.
- Quote container with `self-start` overrides the cross-axis centering for itself → it sits flush at the start of the content area = 20px from screen-left.
- Difference between wordmark visual-left and quote-left: 2.5px. Visually imperceptible — they read as sharing the same left edge.

Quote width: `w-[70vw]` = 262.5px on a 375px viewport. Ends at 282.5px from screen-left (20 + 262.5). The 92.5px gap to the right screen edge is the "intentional negative space" the design relies on.

On a 414px iPhone: quote = 290px, ends at 310px from screen-left, right gap = 104px. Same proportional rhythm.

## Attribution paragraph

No change. The current attribution `<p>` is:

```tsx
<p className="quote-attr text-xs opacity-60 mt-5 inline-flex items-center justify-center gap-2">
  <span aria-hidden="true" className="inline-block w-1.5 h-1.5 bg-[var(--accent-red,#d9483a)]" />
  Psalm 23:2-3
</p>
```

The `inline-flex items-center justify-center gap-2` styles affect only the paragraph's internal flex layout (spacing between the red square and the "Psalm 23:2-3" text). The paragraph itself is laid out by the parent's text-alignment rule. With the parent now `text-left`, the inline-flex paragraph will inline-align to the left automatically — no className edit required on the attribution.

## What does NOT change

- Wordmark `<PsalmsWordmarkSvg className="w-[88vw] max-w-md" />` — stays centered.
- Video mask wrapper `<div data-testid="hero-mobile-video-mask" className="w-[88vw] max-w-md aspect-[5/3] overflow-hidden">` — stays centered.
- Bridge container `<div ref={bridgeRef} className="mt-20 mb-32 text-center px-6 flex flex-col gap-8 max-w-md">` — stays centered.
- Parent column wrapper className (`relative w-full flex flex-col items-center justify-center pt-20 pb-16 px-5 gap-10`) — unchanged.
- Quote `<p>` font classes (`quote-text italic text-[15px] leading-relaxed`) — unchanged per the user's earlier constraint that the quote font stays as-is.
- Red-square accent span markup — unchanged.
- GSAP scroll-collapse timeline (lines 53-95) — unchanged.
- Intersection-fade refs (`quoteRef`, threshold 0.4) and hook — unchanged.
- `HeroDesktop.tsx` — not touched.
- `MobileBottomDock.tsx`, `App.tsx`, `index.css` — not touched.
- All other tests in `HeroMobile.test.tsx` — should continue passing (none assert on `text-center` or `px-8` directly).

## Tests

Add two new tests inside the existing `describe('HeroMobile content', ...)` block in `src/components/sections/HeroMobile.test.tsx`:

1. **Quote container is left-anchored** — assert the container's className contains `text-left`, `self-start`, and does NOT contain `text-center` or `px-8`.
2. **Quote container is 70vw wide** — assert the container's className contains `w-[70vw]`.

Existing assertions to verify still pass after the change:
- `outer column wrapper uses the breathing-room spacing (pt-20 pb-16 px-5 gap-10)` — unaffected (parent untouched).
- `quote attribution contains an aria-hidden decorative red-square accent` — unaffected (attribution markup untouched).
- `renders the quote text and attribution` — unaffected (text content untouched).
- `quote container starts hidden (data-visible="false") on mount` — unaffected (intersection-fade infrastructure untouched).
- `renders the quote DOM-before the video` — unaffected (DOM order untouched).

## Risk

Trivial. Single className edit on a single component. The change is presentation-only — no behavior, no new dependencies, no asset changes. Reduced-motion path, scroll-collapse animation, intersection-fade, and the masked-video composition are all completely independent of this className.

## Out of scope

- Any change to `HeroDesktop.tsx` or the dispatcher.
- Any change to the wordmark, video, or bridge copy.
- Any change to the quote font, color, or text content.
- Any change to the attribution copy or accent square.
- Any change to other sections (`MidSectionMotion`, `TwoPathInterlude`, `PurposeGrid`, etc.).
- Adding new design tokens to `index.css`.
