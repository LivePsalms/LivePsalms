# Connection Cards Show/Hide Toggle (Desktop) — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)

## Problem

On the desktop Notepad Content tab, the Connection Cards strip appears
automatically whenever the active note has qualifying connections, anchored at the
bottom of the editor pane. There is no way for a user to dismiss it. Some users
want a quieter writing surface and want to choose whether the cards are visible.

Mobile is out of scope — this toggle is desktop-only.

## Current state (for reference)

- `DesktopNotepadWorkspace` (`src/components/sections/Notepad.tsx`) renders
  `ConnectionCardsStrip` only on the `content` tab, only when `lamplightAdapter`
  and `user` exist, inside a `max-h-[45vh]` scroll container (`Notepad.tsx:244-257`).
- `ConnectionCardsStrip` (`src/notepad/components/lamplight/ConnectionCardsStrip.tsx`)
  is a thin **desktop-only** wrapper that renders
  `<ConnectionCardsPanel showEmptyStates={false} />` (default `layout="strip"`).
  Mobile renders `ConnectionCardsPanel` directly with `layout="stack"` from
  `LamplightMobileView`, so it never goes through the strip.
- `ConnectionCardsPanel` (`ConnectionCardsPanel.tsx`) returns `null` for every
  phase except `ready` (`:70-77`) — so the strip self-hides when there is nothing
  to show. When ready it renders a `<section aria-label="Connection cards">` whose
  first child is a `"Connection Cards"` label row (`:153-158`), followed by the
  optional active-card "why" block and the card list (`:159+`).
- The sidebar collapse pattern (`Notepad.tsx:124-135`) is the existing idiom for a
  show/hide affordance: a button toggling a boolean, swapping a `lucide-react`
  icon. The Connection Cards toggle should feel like a sibling of it.

## Decisions

1. **Affordance:** a collapsible header bar. The existing `"Connection Cards"`
   label row becomes a clickable header with a rotating chevron. Collapsing hides
   the card list; the header bar stays as the re-open affordance.
2. **Default:** hidden (closed). The cards stay collapsed until the user opens
   them; the choice then persists. (Updated 2026-06-09: originally shipped
   default-open, then changed to default-closed for a quieter writing surface.)
3. **Persistence:** remembered across sessions via `localStorage`, one global
   preference (not per-note).
4. **Architecture (Approach A):** collapse rendering lives **inside**
   `ConnectionCardsPanel`, gated by a new `collapsible` prop, because the panel is
   the only place that knows whether there are cards (`phase === 'ready'`). The
   desktop `ConnectionCardsStrip` owns the persisted open/closed state and passes
   it down. Collapsing hides the list without unmounting the panel, so discovery
   does not re-run on re-open. (Rejected: a wrapper-level header bar — it would
   duplicate the existing label, need a readiness callback, and risk a
   remount/re-fetch when toggled.)

## Architecture

### Unit 1 — Persisted disclosure state (`ConnectionCardsStrip.tsx`)

The strip stops being a pure pass-through and becomes the owner of the desktop
open/closed preference.

- New module-level constant `CONNECTION_CARDS_OPEN_KEY = 'lp.notepad.connectionCards.open'`.
- `useState<boolean>` initialized lazily from `localStorage`:
  `localStorage.getItem(KEY) === 'true'` (i.e. default **closed**; only an explicit
  stored `'true'` opens). The initializer is wrapped in `try/catch` returning
  `false` so a throwing/absent `localStorage` (jsdom edge cases, privacy mode) falls
  back to the default.
- `toggle = () => setOpen(prev => { const next = !prev; try { localStorage.setItem(KEY, String(next)); } catch {} return next; })`.
- Renders `<ConnectionCardsPanel {...props} showEmptyStates={false} collapsible open={open} onToggleOpen={toggle} />`.

Interface unchanged for callers — `ConnectionCardsStrip` keeps the same props and
stays desktop-only, so the persistence/toggle behavior cannot leak into mobile.

### Unit 2 — Collapsible rendering (`ConnectionCardsPanel.tsx`)

Three new optional props, all backward-compatible:

```ts
collapsible?: boolean;      // default false — when false, today's behavior exactly
open?: boolean;             // default true
onToggleOpen?: () => void;
```

When the panel is `ready` and `collapsible` is true:

- The `"Connection Cards"` label row (`:153-158`) becomes a `<button>` spanning the
  row: `aria-expanded={open}`, `aria-controls="connection-cards-list"`, label text
  unchanged, plus a chevron span (`▾`) that rotates 180° via
  `transform: rotate(open ? 0 : -90deg)` with a `0.2s` transition. Reuses existing
  tokens (`--silica`, `Outfit`).
- The active-card "why" block (`:145-152`) and the card list `<div role="list">`
  (now `id="connection-cards-list"`) render **only when `open`**.
- When `!open`, only the header button remains inside the `<section>` — the
  re-open affordance.

When `collapsible` is false (mobile stack, any other caller) the label stays a
plain `<p>` and the list always renders — byte-for-byte today's behavior. The
`phase !== 'ready'` early return (`:70-77`) is untouched, so when there are no
cards nothing renders, header included.

No change needed in `Notepad.tsx` — the `max-h-[45vh]` container simply shrinks to
the header height when collapsed.

## Testing

- **`ConnectionCardsStrip` persistence** (`ConnectionCardsStrip.test.tsx`, jsdom;
  mock the discovery hook into a `ready` state with ≥1 card, as the existing test
  file already does):
  - Defaults to closed: header present but card list hidden on first render with
    empty `localStorage`.
  - Clicking the header opens: list (`#connection-cards-list`) appears, header
    button `aria-expanded="true"`.
  - Pre-seeded `localStorage` `KEY='true'` → renders open on mount.
  - Toggling writes `'true'`/`'false'` to `localStorage` under the key.
  - (Behavior tests that exercise the underlying panel — chip/why/threshold —
    pre-seed `KEY='true'` so the cards are visible.)
- **`ConnectionCardsPanel` collapsible rendering** (extend existing panel tests):
  - `collapsible open={false}` → header button present, list absent.
  - `collapsible` + not-ready → renders `null` (no header).
  - Default (no `collapsible`) and `layout="stack"` → unchanged: plain label, list
    always present, `aria-expanded` absent.
- Full notepad suite stays green; lint only the touched files (per project
  convention — repo-wide lint has unrelated pre-existing errors).

## Out of scope

- Mobile / stack-layout toggle (mobile keeps always-rendered cards).
- Per-note disclosure memory (one global preference only).
- Animating the list height on collapse (chevron transition only; list mounts/
  unmounts).
- Any change to discovery, qualification, "why" generation, card content, or the
  `45vh` container.
