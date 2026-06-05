# Notepad Mobile Revamp — Design Spec

**Date:** 2026-06-01
**Scope:** Mobile-only experience for the notepad editor route (`/notepad/notes`). Desktop is untouched.
**Status:** Approved design, ready for implementation planning.

---

## Problem

The notepad editor at `/notepad/notes` (`src/components/sections/Notepad.tsx` → `NotepadWorkspace`) is a fixed three-column desktop layout: a 220px collection sidebar, a flexible editor pane (with Content/Backlinks/Info/Lamplight tabs), and a graph pane — all laid out side-by-side in a `fixed inset-0 flex` row. There are no responsive breakpoints. On a phone all three columns fight for ~390px and the page is unusable.

## Goal

Deliver a dedicated mobile experience for the same notepad — same notes, persistence, editor, Lamplight, and graph — reorganized so each surface gets the full screen when it's needed. The desktop layout must render byte-for-byte unchanged at desktop widths.

Primary mobile job (per brainstorming): a **mix of quick capture, reading, and Lamplight discovery**. Writing stays supported but lean; reading is the baseline; Lamplight is a first-class destination.

---

## Architecture

A single breakpoint switch at the workspace level. All mobile code is new and isolated; the only change to existing code is a mechanical rename.

```
Notepad (existing — wraps NotepadProvider)
└─ NotepadWorkspace (becomes a thin router)
   ├─ useIsMobile() === false → <DesktopNotepadWorkspace/>   ← today's NotepadWorkspace body, renamed, unchanged
   └─ useIsMobile() === true  → <MobileNotepadWorkspace/>     ← NEW
```

- **Breakpoint:** the existing `useIsMobile()` hook (`src/hooks/use-mobile.ts`) — same threshold the rest of the app uses. Crossing the breakpoint (rotate/resize) swaps shells; note state lives in `NotepadProvider`, so nothing is lost.
- **Component reuse:** `MobileNotepadWorkspace` is purely *layout + navigation*. It composes the **existing leaf components** rather than reimplementing them, since they already read from `NotepadProvider` context and thus share data, persistence, and Lamplight wiring with the desktop shell:
  - Notes list → `NotepadSidebar`
  - Editor → `NotepadEditor` (+ a new mobile accessory toolbar)
  - Lamplight → `TodaysLampCard` (daily) + `ConnectionCardsStrip` (connections), composed behind a segmented toggle
  - More sheet → `BacklinksPanel`, `InfoPanel`, `GraphPane`
- If a leaf needs a small mobile change (e.g., the editor toolbar position), it takes a `variant`/prop rather than being forked.

---

## Navigation: bottom tab bar shell

A persistent bottom tab bar with four destinations. Each renders a full-screen view; tapping swaps the active view.

```
[ 📝 Notes ] [ ✏️ Editor ] [ 🕯 Lamplight ] [ ⋯ More ]
```

- The app's global `MobileBottomDock` is already hidden on `/notepad/notes`, so this bar replaces it without conflict.
- Bar respects `env(safe-area-inset-bottom)`. Touch targets ≥ 44px. The shell is sized with `100dvh` so the keyboard doesn't push the bar off-screen.
- A **glow-dot badge** appears on the 🕯 Lamplight tab when the active note has connections.

### View: Notes
- Full-screen collection list via `NotepadSidebar`: folders, note items, note dates.
- Header: a **"‹ Psalms" exit link** (left) to leave the notepad back into the app (the global dock is hidden here), and a **🔍 search icon** (right) that opens the existing `SearchDialog`.
- A **`+` FAB** (bottom-right, above the tab bar) creates a new note and drops the user into the Editor view with the title focused.
- Notes that have Lamplight connections show a small 🕯 marker in the list.
- Tapping a note opens it and switches the active tab to **Editor**.
- Empty state (no notes) still shows the `+` FAB.

### View: Editor
- `NotepadEditor`: title, date + tags, and the writing surface. Journal themes (fonts, paper textures, serif titles) carry over unchanged — they're CSS-driven.
- **Keyboard accessory toolbar:** the existing Tiptap formatting commands (undo/redo, headings, lists, bold/italic/strike/code/underline) rendered as a horizontally-scrollable bar pinned directly above the keyboard. Visible only while editing; hidden when the surface is in read mode. Positioned using the keyboard inset (`visualViewport`/sticky).
- A **`⋯` button** in the editor header opens the per-note **Details sheet** (Backlinks / Info / Graph — see More).
- Two desktop interactions are hover-based and must become **tap** on mobile: the **verse tooltip** and the **note-link popup**. Both open on tap and dismiss on outside-tap/scroll.
- Empty state (no active note): a gentle "Pick or create a note" prompt.

### View: Lamplight
Tapping 🕯 Lamplight lands on a screen that holds **both** Lamplight surfaces, chosen via a **segmented toggle** at the top:

```
[ Today's Lamp | Connections ]
```

- **Today's Lamp** (default selected): the daily devotion via `TodaysLampCard` — date, opening, scripture, reflection, prayer prompt, note citations, voice/tradition footer. Goes through the existing auth/consent/entitlement gates in `LamplightTabPanel` (SignInGate, consent card, opted-out card, paywall).
- **Connections:** this note's connection cards via `ConnectionCardsStrip` — shared tags/verse refs, related note title, "why" explanation, "Open ↗".
- Only one surface shows at a time; each gets the full screen.
- If the active note has no connections, the Connections side shows its existing empty state. Today's Lamp always has content.

> Lamplight voice principle (project memory): Lamplight artifacts never speak prophetically — Scripture is revealed against the user's context and interpretation is offered as possibility, not pronouncement. This is preserved by reusing the existing components unchanged.

### View: More
- A bottom sheet hosting per-note details via a segmented control: **Backlinks / Info / Graph** (`BacklinksPanel`, `InfoPanel`, `GraphPane`).
- Footer row: Theme picker, Sync/offline status, Settings.
- Reached from both the bottom-bar **⋯ More** tab and the editor header **⋯** button (same sheet).
- Graph remains the existing deferred placeholder; no graph functionality is added by this work.

---

## Cross-cutting details

- **Offline banner:** the existing "You're offline — viewing cached notes" banner pins just under the top header, above whichever view is active.
- **Search:** reuses `SearchDialog`. Mobile triggers it by tapping 🔍 (not Cmd+K). Selecting a result opens the note in Editor.
- **Data/persistence:** unchanged. Everything flows through `NotepadProvider` (Supabase adapter + localStorage fallback) exactly as on desktop.
- **Migration dialog:** the existing `MigrationDialog` still mounts and fires on first load.

---

## Testing

Playwright mobile-viewport tests (the repo already uses Playwright):

- Tab switching between Notes / Editor / Lamplight / More.
- `+` FAB creates a note and lands in Editor with title focused.
- Tapping a note in Notes opens it in Editor.
- 🔍 opens `SearchDialog`; selecting a result opens the note.
- Accessory toolbar appears on editor focus and hides on blur.
- Lamplight segmented toggle switches between Today's Lamp and Connections; glow-dot badge shows when the active note has connections.
- More sheet opens from both the ⋯ tab and the editor header ⋯; segmented control switches Backlinks/Info/Graph.
- Offline banner renders when offline.
- "‹ Psalms" exit link navigates out of the notepad.
- **Regression guard:** the desktop workspace renders unchanged at desktop widths (no mobile shell mounted).

---

## Out of scope

- Any change to desktop layout or behavior.
- New graph functionality (stays a placeholder).
- Changes to Lamplight generation, thresholds, data model, or copy.
- Tightening the dev-mode Connection Cards thresholds (tracked separately).

---

## Open follow-ups (non-blocking)

- Confirm the exact keyboard-inset technique for the accessory toolbar during implementation (visualViewport API vs. CSS sticky) against real devices.
- Decide final iconography/labels for the bottom bar during build (glyphs in this spec are indicative).
