# Lamplight Prettify — Design Spec

**Date:** 2026-06-06
**Status:** Approved design, pending implementation plan

## Summary

Extend Lamplight with a "Prettify" capability: a one-shot, user-triggered action that
uses Claude to read a note and creatively style it — applying semantic **highlights** and
text-anchored **decorations** to surface important points, group topics/themes, and draw
**within-note connections** between related ideas. The AI works in the semantic domain
(what matters, quoted verbatim); the client owns layout (where text renders) and the
curated visual palette (how it looks).

## Goals

- Make a note's structure visible and beautiful with restraint and reverence.
- Highlight the most important points; group topics/themes; link related ideas within the note.
- Keep the user fully in control: apply immediately, fully reversible.
- Reuse the existing Lamplight infrastructure (Edge Function + Anthropic tool-use, auth,
  tier gating, shared quota).

## Non-goals (v1)

- Cross-note connections (already covered by Lamplight connection cards).
- Always-on / continuous auto-styling.
- Purely decorative flourishes with no semantic meaning.
- A separate quota budget (uses the shared Lamplight quota).
- A new settings toggle (gated by existing `lamplight_settings.enabled` + tier).

## Decisions (locked)

| Topic | Decision |
|---|---|
| Control model | One-shot, **apply immediately + undo**. AI output becomes normal editable highlights/decorations. |
| Visual vocabulary | Semantic **highlights + text-anchored decorations**. |
| Connections | **Within-note only.** |
| Gating | **Full Lamplight gating** — requires enabled, respects tier, counts against the shared rolling quota. |
| Density | **User-selected per run**: Light / Balanced / Rich. |
| Architecture | **Approach A** — Edge Function returns semantic intents; client resolves palette + geometry. |

## Architecture & data flow

End-to-end when the user clicks "Prettify → Balanced":

1. **Snapshot for undo.** Client captures current editor JSON + decorations array.
2. **Gather text.** Client takes `editor.getText()` (canonical plaintext) and sends it to
   the Edge Function. The resolver later searches this same string, so AI quotes and client
   lookups share offsets.
3. **Edge Function `lamplight-prettify`.** Authenticates (JWT), checks
   `lamplight_settings.enabled` + tier, enforces shared quota, calls Claude (Sonnet) with a
   tool-use schema, validates output, records usage, returns a **PrettifyPlan** of semantic
   intents (quotes tagged with roles + within-note connections). No swatch IDs, no coordinates.
4. **Client resolution.** For each intent: locate the quote's position in the TipTap doc →
   map role/kind to a curated palette asset → apply. Highlights become `styleHighlight`
   marks; anchored decorations are placed using the phrase's rendered rect (measured on the
   client); connections become connector decorations between two anchors.
5. **Persist + offer undo.** Normal debounced save writes the new marks (content) and
   decorations. A toast offers one-click Undo that restores the snapshot.

### New files

- `supabase/functions/lamplight-prettify/index.ts` — entry: auth, gating, quota, usage recording
- `supabase/functions/lamplight-prettify/prettify-pipeline.ts` — builds the Claude request + validators
- `src/notepad/prettify/prettify-types.ts` — `PrettifyPlan`, intent types, `Density`, roles/kinds
- `src/notepad/prettify/palette.ts` — curated role→swatch and kind→asset mapping (the taste layer)
- `src/notepad/prettify/quote-locator.ts` — pure: quote string → ProseMirror `{from,to}`
- `src/notepad/prettify/anchor-geometry.ts` — pure: rects + container + contentWidth → decoration placement
- `src/notepad/prettify/apply-prettify.ts` — orchestrator: plan + editor + decorations API → applies + undo handle
- `src/notepad/prettify/use-prettify.ts` — hook: trigger → adapter → apply → undo/loading/error state
- UI: a Prettify button + density menu in the editor toolbar, plus an undo toast

### Changed files

- `src/notepad/storage/lamplight-adapter.ts` — add `generatePrettifyPlan` to the contract
- `src/notepad/storage/supabase-lamplight-adapter.ts` — implement via `functions.invoke('lamplight-prettify', …)`
- `src/notepad/storage/fake-lamplight-adapter.ts` — fake for tests
- `src/notepad/components/Editor.tsx` (or its toolbar) — mount the Prettify control + toast; pass editor + decorations API into the hook

### Key design choices

- **Testability via dependency injection.** The geometry layer takes an injected
  `measure(range)` function instead of reaching into the live DOM. jsdom has no layout
  (rects are 0), so DI lets us unit-test placement math with fake rects and wire the real
  ProseMirror `coordsAtPos` / DOM-range measurement only in the browser.
- **No schema change.** `NoteDecoration` stays unchanged; undo works via snapshot/restore,
  so no per-item tagging or migration is needed.

## Edge Function & Claude tool schema

`lamplight-prettify` mirrors `lamplight-generate` — same auth, gating, quota, and shared
`createAnthropicAdapter` with tool-use forcing.

**Request (client → function):**
```ts
{ kind: 'prettify', user_id: string, note_id: string, content_text: string, density: 'light' | 'balanced' | 'rich' }
```

**System prompt (intent):** an editorial assistant that marks up a *personal*
devotional/sermon/theme note to make its structure visible and beautiful, with restraint
and reverence. Hard rules: only reference text that appears **verbatim** in the note; never
invent, paraphrase, or add content; choose the *most meaningful* few, not everything; honor
the density budget; assign each item a role.

**Claude tool `input_schema` (structured output):**
```ts
{
  summary: string,                       // one line, e.g. "Highlighted 4 key points and linked 2 related ideas."
  highlights: Array<{
    quote: string,                       // verbatim substring of content_text
    occurrence?: number,                 // 1-based; disambiguates repeated phrases (default 1)
    role: 'key-point' | 'topic' | 'theme'
  }>,
  decorations: Array<{
    quote: string,
    occurrence?: number,
    kind: 'underline' | 'bracket' | 'margin-arrow'
  }>,
  connections: Array<{
    from_quote: string, from_occurrence?: number,
    to_quote: string,   to_occurrence?: number
  }>
}
```

**Density budgets** (taught in the prompt *and* clamped by validators):

| Density | key-point | topic/theme | decorations | connections |
|---|---|---|---|---|
| Light | ≤3 | ≤1 | ≤2 | 0–1 |
| Balanced | ≤4 | ≤2 | ≤4 | ≤2 |
| Rich | ≤6 | ≤4 | ≤8 | ≤4 |

**Validators** (reuse Lamplight's validator pattern; drop/clamp rather than fail the whole run):

1. Each `quote` / `from_quote` / `to_quote` must be an exact substring of `content_text`
   after whitespace normalization — failing intents are dropped.
2. `occurrence` must be within the count of matches; otherwise default to 1.
3. Counts exceeding the density budget are truncated (lowest-priority dropped).
4. A connection whose either endpoint didn't survive validation is dropped.

**Response (function → client):**
```ts
| { ok: true; plan: PrettifyPlan }
| { ok: false; reason: 'no_content' | 'disabled' | 'quota' | 'validators_failed' | 'network' }
```
`validators_failed` only when *nothing* survived. Empty note → `no_content`. Over quota →
`quota`. Usage is recorded on success exactly like other Lamplight kinds.

**Why roles/kinds instead of concrete asset IDs:** keeps the AI in the semantic domain it's
reliable at, and lets the client's curated palette own the look — so taste stays consistent
and the whole feature can be restyled by editing one `palette.ts` file without re-prompting.

## Client-side resolution

Four pure-ish units, each independently testable.

### 1. `palette.ts` — taste layer (pure constants + lookups)

Maps roles/kinds to concrete curated assets from the existing manifest:
```ts
const HIGHLIGHT_SWATCH: Record<HighlightRole, string> = {
  'key-point': 'highlight-XX',  // strong/warm
  'topic':     'highlight-YY',  // cool
  'theme':     'highlight-ZZ',  // soft
};
const DECORATION_ASSET: Record<DecorationKind, string> = {
  'underline':    'squiggle-NN',  // or a line asset
  'bracket':      'shape-NN',     // or line
  'margin-arrow': 'arrow-NN',
};
const CONNECTOR_ASSET = 'line-NN'; // straight connector for within-note links
```
Exact asset IDs are finalized during implementation by eyeballing thumbnails; the spec names
the *slots*, not the final picks. Changing the look later = edit this one file.

### 2. `quote-locator.ts` — quote string → ProseMirror `{from, to}` (pure)

Walks the doc once, building a flat text string with a parallel index→PM-position map, using
the *same* block separators as `editor.getText()` so offsets match what the AI saw. Finds the
quote (whitespace-tolerant), honors `occurrence` (1-based), returns `{from, to}` or `null` if
not found. Unit-testable against a doc JSON with no DOM.

### 3. Highlights application

All resolved highlights apply in **one transaction** — `tr.addMark(from, to,
styleHighlight.create({ swatchId }))` per highlight — so the whole batch is a single TipTap
history entry (clean Cmd-Z) and the user's cursor/selection is not disturbed.

### 4. `anchor-geometry.ts` — decoration placement (pure, via injected `measure`)

Signature: `placeDecoration(kind, rect, containerRect, contentWidth) → Partial<NoteDecoration>`.
The caller supplies `rect` from an injected `measure(range)` (real ProseMirror `coordsAtPos`
+ DOM range in the browser; fake rects in tests). Placement per kind:

- **underline:** `xPct = (rect.left − containerLeft)/contentWidth`,
  `yPx = rect.bottom − containerTop + gap`, `widthPct = rect.width/contentWidth`, rotation 0,
  `behindText: false`.
- **bracket:** left of the span in the margin, height ≈ span height, `xPct` just left of `rect.left`.
- **margin-arrow:** left margin at the phrase's vertical center, pointing right.
- **connector (connections):** measure both endpoints → place `CONNECTOR_ASSET` from center A
  to center B: `xPct`/`yPx` at the start, `widthPct = distance/contentWidth`,
  `rotation = atan2(dy, dx)`. v1 is a best-effort straight line; if either endpoint is
  unresolved or off-screen, the connection is skipped.

### Orchestration (`apply-prettify.ts`)

Takes `{ plan, editor, decorationsApi, measure }`, resolves every intent, applies surviving
highlights (one transaction) and decorations (via existing `addDecoration`), and returns
`{ applied: {…counts}, snapshot }` for undo. Anything unresolved is counted and skipped
silently; if *zero* intents resolve, it reports that so the UI can show a soft "couldn't find
anchors" message.

The `measure` DI seam is the crux of testability: geometry math is verified with fake rects
in jsdom; real layout is wired only in the browser.

## UX

- **Trigger & density.** A "Prettify" control in the editor toolbar, rendered only when
  Lamplight is enabled and tier ≠ `none`. Clicking opens a menu: **Light / Balanced / Rich**
  (one-line hint each). Picking one runs immediately. While running, the control shows a
  spinner and is disabled to prevent double-fire. Empty note → disabled with a tooltip
  ("Write something first").
- **Apply + undo.** On success, marks and decorations appear, and a toast shows the function's
  `summary` plus an **Undo** action (e.g. *"Highlighted 4 key points and linked 2 ideas. —
  Undo"*). Undo restores the pre-run snapshot: `editor.commands.setContent(snapshot.json)` +
  reset decorations to `snapshot.decorations`, then the normal debounced save persists the
  reverted state. After the toast is dismissed, highlights still reverse via Cmd-Z and
  decorations remain individually deletable. Re-running is additive — each run snapshots fresh
  and offers its own Undo.

## Gating & quota

Reuses `lamplight_settings.enabled` + tier; the function records a usage row on success
against the **shared** Lamplight quota. Over quota → `reason: 'quota'` → toast "You've reached
your Lamplight limit for now." Tier `none` → control hidden/disabled.

## Error handling / graceful degradation

- `no_content` → soft toast, no changes.
- `network` → "Couldn't reach Lamplight — try again."
- `quota` → limit message.
- `validators_failed` (nothing survived) or zero resolved client-side → "Couldn't find
  anchors to style — try again."
- Partial success → apply what resolved; if some quotes failed to locate, still succeed
  silently (count tracked for telemetry).
- User content is never destroyed: highlights are reversible marks, decorations are deletable,
  and the snapshot undo covers the whole batch.

## Testing strategy

- **Pure unit (vitest, no DOM):** `quote-locator` (offsets, occurrence disambiguation,
  whitespace tolerance, not-found), `palette` lookups, `anchor-geometry` placement per kind
  with fake rects, connector math, density-budget clamping, and the function's quote-substring
  validators.
- **Edge Function:** pipeline + validators tested with a fake Anthropic adapter (existing
  `fake-lamplight-adapter` pattern) — verifies budgets, verbatim enforcement, and `reason`
  mapping.
- **Apply orchestration:** `apply-prettify` against a real TipTap editor in jsdom with an
  injected fake `measure` — confirms highlights land on correct ranges and decorations get
  correct placements, without real layout.
- **Manual browser verification:** geometry only truly exists in the browser, so verify
  visually that underlines/brackets/arrows/connectors land where they should, across a couple
  of real notes, before calling it done.

## Open implementation details (decide during build, not blockers)

- Final curated asset IDs for each palette slot (chosen by eyeballing thumbnails).
- Exact margin offsets / gaps for bracket and margin-arrow placement (tuned visually).
- Toast component: reuse existing notification UI if present, else a minimal local toast.
