# Notepad Styling — Highlights & Decorations

**Date:** 2026-06-05
**Status:** Approved design, ready for implementation planning

## Summary

Add personalization to the notepad editor using the hand-painted "Notes Styles"
asset library. Users can **highlight** text with painterly swatches and place
**free-floating decorations** (shapes, arrows, speech bubbles, squiggles, lines)
onto the page to build layouts that fit their style.

Two of the library's three natural layers are in scope. **Page backgrounds/papers
(Layer 1) are explicitly out of scope** for this work.

| Layer | Source categories | Count | Model |
|-------|-------------------|-------|-------|
| 2 — Highlights & Boxes | `2. Highlights & Boxes` | 125 | Text-bound (reflows with text) |
| 3 — Decorations | Large Shapes, Arrows, Speech Bubbles, Squiggles & Lines | 288 | Free canvas (drag/resize/rotate overlay) |

Feature is **free for all users** (no tier gating).

## Decisions (locked during brainstorming)

1. **Backgrounds/papers out of scope.** No full-page effects in this iteration.
2. **Decorations use a free-canvas model** — placed on an overlay above the text,
   positioned absolutely, and do **not** move when the text is edited.
3. **Picker is a bottom tray** — identical on desktop and mobile — with category
   pills, a search box, and a swipeable thumbnail grid. Tap or drag a thumb to place.
4. **Highlights are text-bound** — select text → swatch popover next to the
   selection → painted band renders behind the text and stretches/reflows.
5. **No tier gating** — free for everyone.
6. **Full manipulation controls** on a selected decoration: move, resize, rotate,
   layer order (front/back), duplicate, delete. Mobile: drag to move, pinch to
   resize/rotate.
7. **Assets bundled in `public/styles/`** (not Supabase Storage), optimized to WebP,
   thumbnails always available, display versions lazy-loaded.

## Asset pipeline

Source files in `Notes Styles/` are far too large to ship raw (PNGs up to 3011px,
hundreds of MB total). A build script optimizes them into the app.

- **Script:** `scripts/build-style-assets.mjs`
  - Input: the `Notes Styles/` source folder (kept outside the app, not committed).
  - Output (committed): `public/styles/<category>/<id>.webp` (display, ~800px longest
    edge) and `public/styles/<category>/<id>.thumb.webp` (~120px).
  - Also emits `src/notepad/styles/manifest.ts` — a typed catalog:
    `{ id, category, thumbUrl, displayUrl, aspectRatio }[]`.
- **Categories in the manifest:** `highlight`, `shape`, `arrow`, `bubble`,
  `squiggle`, `line`. (Squiggles & Lines source subfolders map to `squiggle` and
  `line`.)
- **Size budget:** thumbnails ≈ 2–3 MB total (always loaded for the tray);
  display versions ≈ 15–25 MB total (lazy-loaded per placement).
- The script is idempotent and re-runnable; output is the source of truth the app
  imports. The app never reads the original `Notes Styles/` folder at runtime.

## Layer 2 — Highlights (text-bound)

**Persistence:** a TipTap **mark** extension, so highlights live inside the note's
existing `content` JSON and reflow/export/persist for free via the current save path.

- **Extension:** `src/notepad/extensions/style-highlight.ts`
  - Mark named `styleHighlight` with attribute `swatchId` (string, from manifest).
  - Renders `<span data-style-highlight="<id>">` whose painted band is applied via
    CSS using the swatch's display image as a stretched `background-image`
    (`background-size: 100% 100%`) sitting behind the text.
  - Commands: `setStyleHighlight(swatchId)`, `unsetStyleHighlight()`,
    `toggleStyleHighlight(swatchId)`.
- **UI:** `src/notepad/components/HighlightSwatchPopover.tsx`
  - Appears when there is a non-empty text selection, anchored to the selection
    (not the bottom tray — keeps text in view).
  - Shows the 125 swatches in a scrollable grid with a search box. Selecting a swatch
    applies the mark to the selection; an "remove" affordance clears it.
- **Boxes (frame a block):** the same mark applied across a full block using the
  frame-style swatches covers most cases. If block-framing proves fiddly within the
  mark model, ship inline highlights first and add boxes as a fast follow (a paragraph
  node attribute) — not a blocker for the headline highlight feature.

## Layer 3 — Decorations (free canvas)

**Data model:** a new optional `decorations` array on the `Note` type. Each item:

```ts
interface NoteDecoration {
  id: string;          // local uuid
  assetId: string;     // manifest id
  xPct: number;        // 0..1, left position normalized to content width
  yPx: number;         // vertical position in px from top of content
  widthPct: number;    // 0..1, width normalized to content width (height = width / aspectRatio)
  rotation: number;    // degrees
  z: number;           // stacking order
}
```

`xPct`/`widthPct` are normalized to the editor content width so layouts stay correct
across phone and desktop; `yPx` pins the vertical position. Height derives from
`widthPct` × the asset's manifest `aspectRatio`.

**Persistence:** saved through the existing debounced `updateNote` path
(`useNoteEditor` pattern) by extending the saved patch to include `decorations`.
Requires adding a `decorations` column/field to the note record in Supabase and the
local note shape. Saving stays debounced and merged with content/tags writes.

**Rendering & interaction (`src/notepad/decorations/`):**
- `useDecorations.ts` — owns the decorations array for the active note, exposes
  add/update/remove/reorder/duplicate, and bridges to `updateNote` (debounced).
  Mirrors the `useNoteEditor` ↔ `NotepadActions` seam described in `docs/CONTEXT.md`.
- `DecorationLayer.tsx` — an absolutely-positioned overlay rendered **inside the
  editor's scroll container, above the text content**, so decorations scroll with the
  page. Maps `xPct/yPx/widthPct/rotation/z` to CSS transforms. Owns canvas-level
  concerns (click-empty-to-deselect, measuring content width).
- `DecorationItem.tsx` — a single placed decoration with selection handles: drag body
  to move, corner handle to resize, top handle to rotate, plus a compact action bar
  (front/back, duplicate, delete). Mobile: drag to move, pinch to resize/rotate.
- `DecorationTray.tsx` — bottom drawer picker (desktop + mobile): category pills,
  search box, swipeable thumbnail grid. Tap places at a default position; drag drops
  at the cursor/touch point.

## Module boundaries

New units are self-contained so `Editor.tsx` stays focused — it only mounts the
overlay and the picker/popover triggers.

```
src/notepad/styles/manifest.ts            generated asset catalog + types
src/notepad/extensions/style-highlight.ts TipTap mark
src/notepad/components/HighlightSwatchPopover.tsx
src/notepad/decorations/
  useDecorations.ts        state + persistence bridge
  DecorationLayer.tsx      overlay container
  DecorationItem.tsx       one sticker + manipulation handles
  DecorationTray.tsx       bottom picker
scripts/build-style-assets.mjs            source -> WebP + manifest
public/styles/<category>/<id>.webp        committed optimized assets
```

`docs/CONTEXT.md` glossary: add a domain entry only if a genuinely new domain concept
emerges (e.g. "decoration overlay" as a seam). The asset pipeline and generic hooks do
not get glossary entries.

## Build phases

1. **Asset pipeline + manifest** — `build-style-assets.mjs`, optimized WebP in
   `public/styles/`, generated `manifest.ts`.
2. **Highlights** — `style-highlight` mark + `HighlightSwatchPopover`, wired into the
   editor selection UI. (Delivers the headline "highlight" ask.)
3. **Decoration data model + overlay** — `Note.decorations`, Supabase field,
   `useDecorations`, `DecorationLayer` rendering + persistence.
4. **Tray picker** — `DecorationTray` with categories + search; tap/drag to place.
5. **Full manipulation** — resize/rotate/layer/duplicate handles + mobile pinch gestures.

## Out of scope

- Layer 1 page backgrounds and papers (full-page textures).
- Tier gating / premium upsell.
- User-uploaded custom stickers.
- Animated or interactive decorations.

## Open questions / risks

- **Supabase migration:** adding `decorations` to the note record needs a migration;
  existing notes default to an empty array. Confirm the storage column type
  (jsonb) during planning.
- **Repo size:** ~20–30 MB of committed WebP. Accepted trade-off (decision #7).
- **Box-framing** within the mark model may need the fast-follow paragraph-attribute
  approach noted in Layer 2.
- **Highlight raster stretch:** painterly bands stretch horizontally well (texture is
  horizontal); verify vertical stretch on tall multi-line selections looks acceptable,
  otherwise constrain highlights to single-line spans.
