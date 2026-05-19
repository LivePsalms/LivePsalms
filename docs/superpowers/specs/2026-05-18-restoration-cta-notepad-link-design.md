# Restoration CTA — Notepad Link Design

**Date:** 2026-05-18
**Scope:** Add a notepad reflection CTA to the "Continue Restoring Your [Purpose]" zone on every purpose detail page, and refactor the repeated CTA block into a shared component.

---

## Goal

On every purpose detail page, between the "Continue Restoring Your [Purpose]" heading and the newsletter signup, invite the reader to capture what God is revealing to them and link them to the notepad page.

## Current State

Inside [src/components/sections/MoodBoard.tsx](src/components/sections/MoodBoard.tsx), each of the 8 purpose detail page components (Peace, Hope, Strength, Wholeness, Purpose, Connection, Identity, Joy) contains an identical "Zone 7: CTA" block. The block currently renders:

1. `<h3>` — `"Continue Restoring Your {Purpose}"` (Cormorant Garamond italic, white/90).
2. `<p>` — `"Sign up for our newsletter to receive devotions that restores you"` (text-sm, white/50).
3. Email input + Subscribe button.

The block differs across the 8 detail pages only in:

- The trailing purpose word in the heading (`Peace`, `Hope`, …).
- The overlay color `ov` (a local constant in each detail component) that drives the section background via `color-mix`.

The 8 copies are otherwise byte-identical. Today's first set of locations:

- Line 955: Peace
- Line 1404: Hope
- Line 1850 (approx): Strength
- Line 2296 (approx): Wholeness
- Line 2742 (approx): Purpose
- Line 3188 (approx): Connection
- Line 3634 (approx): Identity
- Line 4080 (approx): Joy

(Exact line numbers shift as edits land; treat these as starting points to locate the block via the "Continue Restoring" string match.)

## New Behavior

### Visual structure (top → bottom) inside the CTA zone

1. **Heading** — `"Continue Restoring Your {Purpose}"` *(unchanged)*.
2. **Reflection prompt** *(new)* — `"Take a few moments to pause, reflect, and jot down what God is revealing to you."`
3. **Notepad link** *(new, separate line)* — `"Open your notepad →"`.
4. **Divider** *(new)* — a hairline `w-16 h-px bg-white/10` rule, centered, with `my-8` vertical spacing.
5. **Newsletter prompt** — `"Sign up for our newsletter to receive devotions that restores you"` *(unchanged)*.
6. **Email input + Subscribe button** *(unchanged)*.

### Styling

- **Reflection prompt**: `text-sm text-white/50 tracking-wide leading-relaxed mb-3`. Matches the existing newsletter prompt's voice and color so the two text intros read as parallel offerings. The tight `mb-3` binds the prompt to the link beneath it.
- **Notepad link**: rendered as `<Link to="/notepad">` from `react-router-dom`. Classes: `inline-flex items-center gap-2 text-sm text-white/80 tracking-wide hover:text-white transition-colors group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-sm`.
  - Underline: persistent `underline underline-offset-4 decoration-white/30` that becomes `decoration-white/70` on hover/focus.
  - Arrow: rendered as a separate `<span aria-hidden="true">→</span>`. On hover, the arrow nudges right by 3px via `group-hover:translate-x-[3px] transition-transform duration-200`. The translate is omitted when `prefers-reduced-motion: reduce` matches — handled by a `motion-reduce:transform-none` Tailwind variant on the arrow.
- **Divider**: `<div className="w-16 h-px bg-white/10 my-8" aria-hidden="true" />`.

### Behavior

- Clicking "Open your notepad →" performs SPA navigation to `/notepad` via React Router. The `/notepad` route already exists ([src/App.tsx:138](src/App.tsx#L138)) and is not behind an auth wall, so unauthenticated visitors land on the notepad directly.
- Focus state: visible focus ring on keyboard tab.
- Reduced motion: the arrow nudge is suppressed; the color/underline transitions remain (they are low-motion and not contraindicated by `prefers-reduced-motion`).

### Out of scope

- No copy changes to the heading or newsletter sentence.
- No layout changes to the email input or Subscribe button.
- No analytics events on the new link (none of the existing CTAs have them; adding one here would be an unmatched precedent).
- No design changes to the notepad page itself.

## Refactor: Extract `RestorationCTA` component

The 8 byte-identical copies are an existing maintenance smell that the new edit would make worse (16 lines of new code × 8 = 128 duplicated lines to keep in sync). The refactor is bounded to the CTA block and is justified by the work in flight.

### Component shape

Defined inline at the top of [src/components/sections/MoodBoard.tsx](src/components/sections/MoodBoard.tsx) (same file — no new files; the component is a private implementation detail of MoodBoard).

```tsx
type RestorationCTAProps = {
  purposeWord: string;   // "Peace" | "Hope" | "Strength" | "Wholeness" | "Purpose" | "Connection" | "Identity" | "Joy"
  overlayColor: string;  // the local `ov` value from the parent detail component
};

function RestorationCTA({ purposeWord, overlayColor }: RestorationCTAProps) { … }
```

The component renders the full Zone 7 wrapper (the `h-screen` flex container with the `color-mix` background) so each call site replaces its 22-line JSX block with a one-liner: `<RestorationCTA purposeWord="Peace" overlayColor={ov} />`.

### React Router import

`Link` is imported from `react-router-dom` at the top of the file. No other components in MoodBoard.tsx use Router primitives today, so a new import is added; the project already depends on `react-router-dom` (see `App.tsx`).

### Call site update

Each of the 8 existing CTA blocks (lines ~955, ~1404, ~1850, ~2296, ~2742, ~3188, ~3634, ~4080) is replaced with the single component call. The 8 detail-component functions are otherwise untouched.

## Accessibility

- `Link` provides semantic anchor behavior with keyboard focus and screen-reader announcement.
- The decorative arrow `<span>` is `aria-hidden="true"` so screen readers read "Open your notepad" without the glyph.
- The divider `<div>` is `aria-hidden="true"` so screen readers don't announce empty content.
- `focus-visible:ring-1 focus-visible:ring-white/40` gives keyboard users a visible focus indicator against the dark overlay.
- Color contrast: `text-white/80` on the link against the `color-mix(ov 95%, black 10%)` background exceeds WCAG AA at the existing 14px (`text-sm`) size for all 8 overlay colors used by purposes (verified informally by matching the existing white/90 heading treatment that ships today).

## Testing

The change is presentational. Manual verification covers:

1. Navigate to each of the 8 purpose detail pages, scroll to the CTA zone, confirm the new reflection prompt, link, and divider render before the newsletter block.
2. Click "Open your notepad →" — confirm SPA navigation to `/notepad` (no full page reload).
3. Keyboard `Tab` through the section — confirm the link receives a visible focus ring; `Enter` activates it.
4. Toggle the OS "Reduce motion" setting — confirm the arrow does not animate on hover but color/underline transitions still apply.
5. Resize to mobile viewport — confirm the new lines stack cleanly within `max-w-lg px-8` and don't push the email form below the fold (the existing `flex items-center justify-center` on the parent zone centers the new total height automatically).

No automated tests are added; this matches the convention of the surrounding CTA block, which has none today.

## Risks

- **Regression risk on 7 of 8 pages**: because the refactor edits all 8 call sites in one pass, a typo in the component or a missed prop on one call site is the main failure mode. Mitigated by the prop signature being tiny (2 strings) and by manual verification on each page after the change.
- **Layout overflow at small heights**: adding 4 elements (prompt, link, divider, existing newsletter prompt) before the form could push content below the fold on very short viewports. The current zone is `h-screen flex items-center justify-center` with `max-w-lg`, which absorbs reasonable additions; if overflow appears at < 700px viewport height during verification, the fix is to tighten the divider's `my-8` to `my-6`. Not pre-emptively changed — verify first.
