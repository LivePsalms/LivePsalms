# Handoff: Mobile highlight selection UX (notepad editor)

**Date:** 2026-06-11
**Status:** NEW request — not yet started. Resume in a fresh session and run `superpowers:brainstorming` first (the user explicitly wants to talk it through before implementing).
**Scope:** Mobile view only. Desktop must stay unchanged.

## The problem (user's words)

On mobile, in the notepad editor, the user **cannot highlight full words or sentences**. The moment they start dragging a text selection, the **highlight-swatch popover** (the color picker with "Search…" + colored swatch tiles) appears immediately. It pops up over the text mid-selection, disrupting the drag, so finishing a multi-word/sentence selection is very hard. It does not fit mobile selection behavior (where the user drags handles to extend a selection over time).

Screenshot showed: a note with several highlighted lines, and the swatch popover (Search field + grid of pastel highlighter swatches) overlapping the text while the user was mid-selection.

## Likely root cause (from prior reading — verify before designing)

In `src/notepad/components/Editor.tsx` there is a `useEffect` wired to the editor's `selectionUpdate` event (around lines 110–131 as of this session; line numbers may have drifted — search for `selectionUpdate` and `setSwatchAnchor`). It does roughly:

```
const update = () => {
  const { from, to } = editor.state.selection;
  if (from === to) { setSwatchAnchor(null); ... return; }   // collapsed -> hide
  const start = editor.view.coordsAtPos(from);
  setSwatchAnchor({ top: start.bottom + 6, left: start.left });
  setSwatchAutoFocus(lastInteractionRef.current === 'pointer');
  ...
};
editor.on('selectionUpdate', update);
```

So the swatch popover anchor is set on **every** selection change where `from !== to` — i.e., as soon as the selection becomes non-empty, *while the user is still dragging*. On desktop (mouse) the selection is usually made in one quick drag and released, so it feels fine. On mobile, selection is extended incrementally via handles, so the popover keeps appearing and fighting the user.

The popover component is `src/notepad/components/HighlightSwatchPopover.tsx` (a.k.a. "HighlightSwatchPopover" — imported in Editor.tsx). `swatchAnchor`, `swatchAutoFocus`, `swatchDismissed`, `dismissedRangeRef`, and `lastInteractionRef` are the relevant state/refs.

## Design directions to explore in brainstorming (do NOT pre-decide — talk through with user)

- **Defer until selection settles:** on mobile, only show the swatch popover after the selection is *finalized* (e.g., on `selectionchange`/pointerup debounce, or when the selection has been stable for ~N ms), not on every `selectionUpdate`.
- **Trigger on demand instead of auto:** on mobile, don't auto-open; show a small "Highlight" affordance (e.g., in the bottom toolbar, or a single floating button) that opens the swatch picker for the current selection. Mirrors iOS's selection→action-menu pattern.
- **Relocate the popover:** anchor it so it never overlaps the active selection (e.g., dock it to the toolbar area at the bottom) — but this alone won't fix the "fires mid-drag" disruption.
- **Use native selection + toolbar action:** let the OS handle selection fully; apply highlight via a toolbar button.

Recommended leaning: combine "don't auto-open on mobile" + "apply via an affordance after selection is complete." Confirm with user.

## Constraints / project conventions (important)

- **Mobile-only.** Gate every change on the mobile path. In this component the mobile flag is `isBottomToolbar` (`toolbarPlacement === 'bottom'`). Desktop (top toolbar) must be byte-for-byte unchanged — the user has repeatedly required this.
- **TDD + subagent-driven-development** were used for the prior fix and worked well. Tests run with `npx vitest run <file>`. There's an existing pattern test file `src/notepad/components/Editor.mobile-scroll.test.tsx` with a complete `fakeEditor` mock (includes `on`/`off`/`chain`/`can`/`isActive`/`commands`, plus jsdom mocks for `DecorationLayer`, `useDecorations`, `DecorationTray`, `HighlightSwatchPopover`, `ResizeObserver`) — copy that mock setup for any new Editor test file. NOTE: `Editor.toolbar-placement.test.tsx` is a STALE pre-existing failing file (its mock lacks `on`/`off`) — do not extend it; goal is zero NEW failures, not a green repo.
- **Pre-existing red baseline:** repo ships ~114 lint errors, tsc errors only in `force-sphere.test.ts`, and 2 failing test files (`Editor.toolbar-placement`, `garden-scene`) unrelated to this work. Verify changes add ZERO new errors rather than gating on a green repo.
- **Deploy:** frontend-only changes ship via the normal Vercel deploy on `main` push. No `supabase/functions/**` involved, so no edge-function deploy needed.
- **Branching:** user prefers a feature branch, then merge to `main` + push (that's the flow we used this session).

## Verification approach that worked

A Vite dev server runs on `http://localhost:5173`. The mobile notepad is reachable signed-out at `/notepad/notes` (local mode, no auth gate). At 375–500px the editor renders the mobile workspace; create a note via the FAB → "General". Chrome DevTools MCP was used to measure/verify. For selection UX specifically, you'll likely need to simulate a touch drag-select or test the timing logic directly in a unit test, since jsdom has no real selection layout.

## Prior related work this session (already shipped to main)

Mobile editor scroll fix: toolbar horizontal-only scroll (`overflow-x:auto` + `overflow-y:hidden` + `min-width:0` + `scrollbar-hide`, buttons `flex-shrink:0` gated mobile), writing pad clamped to vertical-only scroll, heading dropdown portaled to `document.body`. Specs/plans under `docs/superpowers/{specs,plans}/2026-06-11-mobile-editor-scroll*`. Latest `main` commit at handoff: `9edbf09`.

## First steps in the fresh session

1. Invoke `superpowers:brainstorming`.
2. Read the `selectionUpdate` effect + `HighlightSwatchPopover.tsx` + `use-note-editor` to confirm the trigger mechanism and how highlights are applied (the swatch onClick → which editor command/decoration).
3. Ask the user 1–2 clarifying questions (e.g., "auto-open after selection settles" vs "manual highlight button"), propose 2–3 approaches, get approval, then spec → plan → implement.
