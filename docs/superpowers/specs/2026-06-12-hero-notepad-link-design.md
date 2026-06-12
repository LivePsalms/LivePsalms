# Hero "Open Your Notepad" Link — Design

**Date:** 2026-06-12
**Status:** Approved design → ready for implementation plan
**Scope:** Add a single subtle link in the home hero that takes users straight to `/notepad`.

## Summary

The home hero currently presents only the PSALMS wordmark and the top nav. People
who already know they want the journaling space have no shortcut from the opening
frame — they must find "Notepad" in the nav. We add one quiet, typographic link,
**"Open Your Notepad →"**, anchored to the bottom-right of the hero's opening view,
on both desktop and mobile. It reuses the existing nav→`/notepad` transition so it
feels native to the site rather than bolted on.

This is intentionally subtle: no pill or button chrome, no new color, no new motion
vocabulary. It is a margin note, not a call-to-action banner.

## Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Placement | Bottom-right corner of the hero's first (opening) viewport |
| Copy | `Open Your Notepad` followed by a right arrow `→` |
| Treatment | Text link, hairline underline, no pill/button background |
| Color | `--deep-umber` (`#3A3426`), matching the resting wordmark/nav ink |
| Relationship to scroll | Coexists; it does not replace any scroll affordance |
| Destination | Same as nav "Notepad": loading veil → `navigate('/notepad')` |
| Devices | Both desktop (`HeroDesktop`) and mobile (`HeroMobile`) |

## The Element

**Visual**
- Plain text "Open Your Notepad" + a right arrow glyph, serif (inherits hero type).
- Color `--deep-umber`. A 1px bottom border at ~40% opacity as the resting underline.
- No background, no border-radius, no box. It reads as text, not a control.

**Hover**
- Underline opacity deepens (~40% → ~85%).
- The arrow drifts right by a few px.
- Picks up the existing `TextStaggerHover` letter-blur used by the nav links, so its
  hover language matches the rest of the hero chrome.

**Interaction / destination**
- Rendered as a real, focusable link/button. On activate it runs the **same** path as
  the nav "Notepad" item: fire the existing nav-trigger (loading veil) callback, then
  `navigate('/notepad')`. No new navigation logic is invented — it reuses whatever
  mechanism `HeaderDesktop` already uses for nav items so transitions stay identical.

**Visibility lifecycle (desktop)**
- The hero opens with a dark intro; `HeroDesktop` already tracks `introActive` and a
  scroll-progress value that collapses the nav.
- The link is hidden during the intro and **fades in once the intro settles**
  (`introActive` → false), alongside the wordmark resolving to its umber resting state.
- As the user begins scrolling, the link **fades out early** — fully gone before the
  wordmark-collapse climax — so it never overlaps the manifesto/quote sections below.
  It binds to the same scroll-progress driver the nav uses; the exact fade-out window
  is finalized in the plan (target: opacity 1 at progress 0, opacity 0 by an early
  threshold well before nav collapse).

**Reduced motion**
- No fade. The link is simply present (static) in the opening view. Hover micro-motion
  (arrow drift) is suppressed or reduced per the existing reduced-motion conventions.

**Accessibility**
- Real link semantics with `aria-label="Open your Notepad"`.
- Keyboard focusable with a visible `focus-visible` ring.
- Its own interactive layer with `pointer-events: auto`, because the wordmark layer
  stacked above it is `pointer-events-none`. Ensure z-index places it above that layer
  but below any intro overlay so it is not clickable until the intro settles.

## Mobile (`HeroMobile`)

- Same component, same copy, same behavior.
- Positioned bottom-right within the mobile hero's opening view. If the right edge
  feels cramped at the smallest widths, fall back to bottom-center (decided during
  implementation against the real layout; bottom-right is the default).
- Honors the mobile hero's own intro/settle timing if one exists; otherwise it renders
  statically. Reduced-motion behavior matches desktop.
- Must not collide with the mobile bottom dock — verify spacing against
  `MobileBottomDock` during implementation.

## Components & Reuse

- **New shared component** (e.g. `HeroNotepadLink`) encapsulating copy, arrow, styling,
  `TextStaggerHover`, and accessibility. Both `HeroDesktop` and `HeroMobile` render it
  so there is a single source of truth and one place to test.
- Props (final shape decided in plan): a visibility/opacity input (driven by the host
  hero's intro + scroll state) and the nav-trigger/navigate handler. The component owns
  presentation; the host owns when it is visible.
- Reuse existing primitives: `TextStaggerHover` for hover, the design-token color
  variables, and the existing nav-trigger + `navigate` flow. Do **not** add a new
  routing path or a second loading-overlay mechanism.

## Testing

- Unit test for `HeroNotepadLink`:
  - renders the link with the correct accessible name and arrow,
  - points at `/notepad` and invokes the nav-trigger handler on activation,
  - renders statically (no fade classes/inline opacity transitions) under
    `prefers-reduced-motion`.
- Light integration check that the link is present in the desktop hero's opening state
  and that activating it triggers navigation to `/notepad`.
- Per the repo's known red baseline, the bar is **zero new** lint/tsc/test failures
  introduced by this change — not a globally green repo. Typecheck via `tsc -b`.

## Out of Scope (YAGNI)

- No analytics/event tracking on the link (can be added later if wanted).
- No change to the nav "Notepad" item or to the `/notepad` page itself.
- No new scroll-cue element on desktop (none exists today; the dash in screenshots is
  the browser scrollbar / dock handle).
- No A/B variants or copy toggles.

## Open Items for the Plan

- Exact fade-out scroll-progress threshold on desktop (kept early, pre-collapse).
- The precise hook by which the hero passes its intro/scroll state and nav-trigger
  handler into `HeroNotepadLink` (inspect current `HeroDesktop`/`HeaderDesktop` wiring).
- Mobile final position (bottom-right vs bottom-center) and dock spacing.
