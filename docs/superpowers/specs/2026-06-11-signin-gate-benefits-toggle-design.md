# SignInGate "Why sign in?" → inline benefits toggle

**Date:** 2026-06-11
**Component:** `src/notepad/components/lamplight/SignInGate.tsx`

## Problem

On the Today's Lamp sign-in gate, the "Why sign in?" control is an `<a>` that
navigates to the external privacy policy (`livepsalms.com/privacy#lamplight`).
That is the wrong destination. Clicking it should instead reveal the benefits of
signing in, inline, below the control.

## Behavior

- "Why sign in?" becomes a `<button type="button">` (no longer a link).
- Clicking it toggles a benefits panel open/closed directly below it. Clicking
  again collapses it. Default state is collapsed.
- The button carries `aria-expanded={showBenefits}` and `aria-controls` pointing
  at the panel's `id`; the panel has a matching `id`.
- The external privacy-policy navigation is removed entirely. No privacy link
  remains in the component.

## Benefits panel content

A short list, left-aligned, separated from the button by a subtle top border.
Each item is an emoji + a bolded label + a short description. Copy lives inline
in the component, consistent with the other hardcoded strings in this card.

- 🕯 **Today's Lamp** — a piece of Scripture and a short reflection, drawn from your recent notes
- 💬 **Reflective chat** — ask about the passage and follow the thread, grounded in Scripture and your own notes
- 🔗 **Connection Cards** — see the threads linking your notes together
- ☁️ **Saved & synced** — your notepad travels with you across devices
- 🔒 **Yours alone** — your writing stays private to you

## Styling

- Panel: `Outfit, sans-serif`, small text (≈ `text-xs` / `text-[11px]`),
  `--silica` for description text and `--deep-umber` for the bold labels.
- Separated from the toggle with a 1px top border in `--pale-stone` and small
  vertical spacing, matching the card's existing palette and rhythm.
- Items stack vertically with left-aligned text inside the otherwise
  center-aligned card.

## Component implementation

- Local `useState` `showBenefits` in `SignInGate.tsx`. No new files, no props,
  no data fetching.
- The benefits list is a small inline array mapped to rows.

## Voice cleanup (related)

- Remove "quietly" from the existing intro copy in
  `src/notepad/lamplight/lamplight-copy.ts` (`todaysLampIntro`): "draws quietly
  from your recent notes" → "draws from your recent notes".
- Update any test asserting that exact string.

## Tests

Extend `src/notepad/components/lamplight/SignInGate.test.tsx`:

- Benefits panel is not in the document by default.
- Clicking "Why sign in?" reveals the benefits (assert a representative benefit,
  e.g. "Reflective chat", is visible).
- Clicking again hides the benefits.
- The toggle button reflects state via `aria-expanded`.
- No anchor pointing at the privacy policy URL remains.

Plus the `lamplight-copy.ts` test update for the removed "quietly".

## Out of scope

- No analytics events.
- No changes to the sign-in / sign-up button destinations.
- No new shared copy module; strings stay inline as the rest of the card does.
