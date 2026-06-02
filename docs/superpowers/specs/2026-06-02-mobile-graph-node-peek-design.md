# Mobile graph node-tap → in-sheet peek

**Date:** 2026-06-02
**Status:** Approved (design)
**Scope:** Mobile view only. Desktop graph behavior is unchanged.

## Problem

On mobile, the knowledge graph renders inside the "More" sheet's **Graph** segment
(`MobileMoreSheet`). Tapping a node has no useful effect:

- **Note nodes** (devotion/sermon/theme) call `onNodeOpen(id)` →
  `collection.openNote(id)`, which sets the active note *behind* the full-screen
  sheet. The sheet stays open and the tab doesn't change, so the user sees nothing.
- **Scripture nodes** toggle an in-canvas tooltip (`popover`) positioned absolutely
  over the canvas — cramped inside the sheet and prone to overflow.
- `GraphView` wires only `onMouseMove/Down/Up`; touch taps don't reliably reach the
  hit-test path, so on a real device the tap may not register at all.

## Goal

A single, coherent "tap a node → peek" interaction on mobile that keeps the graph as
the primary exploration surface.

## Decisions (from brainstorming)

1. **Flow:** in-sheet peek. Tapping a node swaps the sheet content from the graph to a
   peek view for that node. A `← Graph` header returns to the graph; the sheet stays
   open throughout.
2. **Note peek:** read-only. Shows title, type chip, connection count, a read preview
   of the note body, and linked verses. Two actions:
   - **Open in Editor** — closes the sheet and switches to the Editor tab on that note.
   - **Focus in graph** — returns to the graph re-centered on that note in *local* mode.
3. **Scripture peek:** consistent with the note peek. Shows reference, translation, full
   verse text, and a **Referenced by** list of notes that cite the verse. Tapping a
   referenced note opens *that note's* peek (one-hop navigation). One action:
   **Focus in graph**. No "Open in Editor" (a verse is not an editable note).

## Interaction summary

```
Graph segment (sheet)
  └─ tap note node ......→ Note peek
  │     ├─ ← Graph ........→ back to Graph segment
  │     ├─ Open in Editor →  close sheet + Editor tab on note
  │     └─ Focus in graph →  back to Graph, local mode centered on note
  └─ tap scripture node →  Scripture (verse) peek
        ├─ ← Graph ........→ back to Graph segment
        ├─ tap "Referenced by" note → that note's peek
        └─ Focus in graph →  back to Graph, local mode centered on the verse
  └─ tap empty canvas ...→ unchanged (deselect / pan)
```

## Architecture

Peek state and routing live in **`MobileMoreSheet`** (it already owns the Graph
segment). The graph reports taps upward instead of acting on them directly.

### Components / changes

- **`GraphView`** (`src/notepad/graph/graph-view.ts`)
  - Add pointer/touch handling so a tap maps to the existing hit-test → node-tap path,
    and drag-to-pan continues to work. This is the enabling layer; nothing else works
    without it. (A tap that doesn't move past a small threshold = select; movement = pan.)
  - Add an optional "focus node id" input so local mode can center on an arbitrary node
    (including a **scripture** node, which has no entry in the note collection's
    `activeNoteId`). Today local mode filters by the neighborhood of `activeNodeId`,
    which is fed from `activeNoteId` via `setData`. The new input lets the sheet focus a
    node by id directly.
  - Add an optional "tap reporter" so an embedded view can surface the tapped node to the
    React layer instead of running the default desktop behavior
    (`onNodeOpen` for notes, in-canvas popover for scripture).

- **`GraphPane`** (`src/components/sections/notepad/GraphPane.tsx`)
  - New optional prop `onNodePeek(node)` used **only when `embedded`**. When provided,
    note-node taps and scripture-node taps both call `onNodePeek` instead of
    `openNote` / opening the in-canvas popover.
  - New optional prop to drive "focus" (mode = local + focus node id) from the parent.
  - Desktop usage (non-embedded) is untouched: `onNodeOpen` + in-canvas verse popover.

- **`MobileMoreSheet`** (`src/components/sections/notepad/mobile/MobileMoreSheet.tsx`)
  - Holds `peekedNode` state (`null | { id, kind: 'note' | 'scripture' }`).
  - Renders either the graph (`GraphPane embedded onNodePeek=…`) or a new **`NodePeek`**
    view, based on `peekedNode`.
  - Receives two callbacks from `MobileNotepadWorkspace`:
    - `onOpenNoteInEditor(id)` → existing `handleOpenNote` (`openNote(id)` +
      `setTab('editor')`) **plus** closing the sheet (`setMoreOpen(false)`).
    - `onFocusNote(id)` / focus-by-node → sets the graph to local mode focused on the
      node and returns to the Graph segment (sheet stays open).

- **`NodePeek`** (new component under `notepad/mobile/`)
  - Renders the note peek or the verse peek from the peeked node + collection/graph data.
  - Read-only; emits `onBack`, `onOpenInEditor`, `onFocus`, and (verse) `onPeekNote(id)`.

### Data flow

```
GraphView (tap, touch)        ── tap reporter ─▶ GraphPane (embedded)
                                                   │ onNodePeek(node)
                                                   ▼
                                         MobileMoreSheet  ── renders ─▶ NodePeek
                                            │  ▲                          │
                  onOpenNoteInEditor(id) ◀──┘  └── onFocus / onBack ◀─────┘
                  onFocusNote(id) ──▶ MobileNotepadWorkspace (tab + sheet + active note)
```

## Edge cases

- **Empty-canvas tap:** unchanged (deselect popover / pan).
- **Peeked note deleted or emptied:** `NodePeek` falls back to the Graph segment.
- **Verse with no referencing notes:** "Referenced by" shows an empty-state line; Focus
  still works.
- **Reduced motion:** segment swap respects existing motion conventions; no new
  always-on animation required.

## Out of scope

- Inline editing inside the sheet (explicitly chose read-only + "Open in Editor").
- Any desktop graph changes.
- Multi-hop breadcrumb history in the peek (one-hop verse→note navigation only).

## Testing

- **`GraphPane` (embedded):** note-node tap and scripture-node tap call `onNodePeek`
  with the right node kind, and do **not** call `openNote` or open the in-canvas popover.
- **`GraphPane` (desktop / non-embedded):** unchanged — note tap calls `onNodeOpen`,
  scripture tap toggles the in-canvas popover. (Regression guard.)
- **`MobileMoreSheet`:** after a peek event renders `NodePeek`; `← Graph` restores the
  graph; `Open in Editor` fires `onOpenNoteInEditor`; `Focus` fires the focus callback;
  verse "Referenced by" tap re-peeks the chosen note.
- **`graph-view` touch/pointer:** a tap (no movement past threshold) selects the node
  under the point; a drag pans and does not select; focus-node-id centers local mode on
  an arbitrary node id.
- **Real browser (390×844):** tap note node → note peek; Open in Editor → Editor tab,
  sheet closed; tap scripture node → verse peek; Focus → graph local mode.

## Files touched (anticipated)

- `src/notepad/graph/graph-view.ts` — touch/pointer input; focus-node-id; tap reporter.
- `src/components/sections/notepad/GraphPane.tsx` — `onNodePeek` + focus props (embedded).
- `src/components/sections/notepad/mobile/MobileMoreSheet.tsx` — peek state + routing.
- `src/components/sections/notepad/mobile/NodePeek.tsx` — new peek view (note + verse).
- `src/components/sections/notepad/mobile/MobileNotepadWorkspace.tsx` — wire
  `onOpenNoteInEditor` / `onFocusNote` into tab + sheet state.
- Tests alongside the above.
