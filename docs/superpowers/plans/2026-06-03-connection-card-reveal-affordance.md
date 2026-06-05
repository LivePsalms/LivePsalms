# Connection Card "Why" Reveal Affordance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the mobile (`stack`) connection card, add a footer "Why these connect ⌄" / "Hide ⌃" hint that signals (and toggles) the inline reflection; desktop (`strip`) footer is unchanged.

**Architecture:** In `ConnectionCardsPanel`, the stack-mode footer becomes a `flex justify-between` row: a left hint button (toggles via the existing `handleChipClick`) and the unchanged right "Open ↗" button. The strip-mode footer stays exactly as today (just "Open ↗"). The hint's accessible name comes from its visible text ("Why these connect" / "Hide") with an `aria-hidden` chevron and `aria-expanded`, kept distinct from the title button's "Show why this connects to …" label so existing queries stay unambiguous.

**Tech Stack:** React + TypeScript, Tailwind + inline CSS-variable styles, Vitest + @testing-library/react (jsdom), `FakeLamplightAdapter`.

---

### Task 1: Add the footer reveal hint to stack-mode cards

**Files:**
- Modify: `src/notepad/components/lamplight/ConnectionCardsPanel.tsx:197-213` (the current Open `<button>`)
- Test: `src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx`

Context for the implementer — the current stack card renders (after the inline-why block) a single Open button:

```tsx
              <button
                aria-label={`Open note: ${c.relatedNoteTitle}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNote(c.relatedNoteId);
                }}
                className={`block w-full text-right px-3 text-xs cursor-pointer hover:underline ${
                  isStack ? 'border-t pt-2 pb-2 mt-1' : 'pb-1'
                }`}
                style={{
                  color: 'var(--deep-umber)',
                  fontFamily: 'Outfit, sans-serif',
                  ...(isStack ? { borderColor: 'var(--pale-stone)' } : {}),
                }}
              >
                Open ↗
              </button>
```

`handleChipClick`, `isActive`, `isStack`, `c`, `onOpenNote` are all already in scope here.

- [ ] **Step 1: Write the failing tests**

Append these tests inside the existing `describe('ConnectionCardsPanel layout="stack"', …)` block in `src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx` (the `seedReadyPanel`, `fakeNote`, `makeContent` helpers already exist in that file):

```tsx
  it('shows a "Why these connect" hint in the footer at rest', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="stack"
      />,
    );
    expect(
      await screen.findByRole('button', { name: /why these connect/i }),
    ).toBeInTheDocument();
  });

  it('tapping the hint reveals the why and switches its label to "Hide"', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="stack"
      />,
    );
    const hint = await screen.findByRole('button', { name: /why these connect/i });
    fireEvent.click(hint);

    await waitFor(() =>
      expect(screen.getByText('Both notes circle the same wilderness motif.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^hide$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /why these connect/i })).not.toBeInTheDocument();
  });

  it('does not render the hint in strip layout', async () => {
    const { adapter, note, loadNeighborNotes } = seedReadyPanel();
    render(
      <ConnectionCardsPanel
        adapter={adapter}
        userId="u1"
        activeNote={note}
        totalNoteCount={50}
        loadNeighborNotes={loadNeighborNotes}
        onOpenNote={() => {}}
        layout="strip"
      />,
    );
    await screen.findByText('Note note-2');
    expect(screen.queryByRole('button', { name: /why these connect/i })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx`
Expected: the 3 new tests FAIL (no "Why these connect" button exists); the 2 existing stack tests still PASS.

- [ ] **Step 3: Replace the Open button with a layout-branched footer**

In `src/notepad/components/lamplight/ConnectionCardsPanel.tsx`, replace the entire Open `<button>…</button>` element shown in the context above with this conditional footer:

```tsx
              {isStack ? (
                <div
                  className="flex items-center justify-between border-t px-3 pt-2 pb-2 mt-1"
                  style={{ borderColor: 'var(--pale-stone)' }}
                >
                  <button
                    aria-expanded={isActive}
                    onClick={() => handleChipClick(c.relatedNoteId)}
                    className="inline-flex items-center gap-1 text-xs cursor-pointer"
                    style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {isActive ? 'Hide' : 'Why these connect'}
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                        transform: isActive ? 'rotate(180deg)' : 'none',
                      }}
                    >
                      ⌄
                    </span>
                  </button>
                  <button
                    aria-label={`Open note: ${c.relatedNoteTitle}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNote(c.relatedNoteId);
                    }}
                    className="text-xs cursor-pointer hover:underline"
                    style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    Open ↗
                  </button>
                </div>
              ) : (
                <button
                  aria-label={`Open note: ${c.relatedNoteTitle}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNote(c.relatedNoteId);
                  }}
                  className="block w-full text-right px-3 text-xs cursor-pointer hover:underline pb-1"
                  style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                >
                  Open ↗
                </button>
              )}
```

Notes for the implementer:
- The `else` branch is the strip footer. It is the current Open button with the now-dead `isStack` conditionals resolved to their strip values (`pb-1`, no `border-t`, no `borderColor`) — so strip renders byte-for-byte as before.
- The hint's accessible name is its visible text ("Why these connect" or "Hide") because the chevron span is `aria-hidden`. This stays distinct from the title button's `aria-label="Show why this connects to …"`, so the existing `getByRole('button', { name: /show why this connects to …/i })` query remains unambiguous.

- [ ] **Step 4: Run the stack suite to verify it passes**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx`
Expected: PASS (all 5 — 2 existing + 3 new).

- [ ] **Step 5: Run the strip regression suite**

Run: `npx vitest run src/notepad/components/lamplight/ConnectionCardsStrip.test.tsx`
Expected: PASS (all cases — strip footer unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/components/lamplight/ConnectionCardsPanel.tsx \
        src/notepad/components/lamplight/ConnectionCardsPanel.stack.test.tsx
git commit -m "feat(lamplight): add why-reveal hint to mobile connection card footer"
```

---

### Task 2: Full verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the lamplight + mobile test scope**

Run: `npx vitest run src/notepad/components/lamplight src/components/sections/notepad/mobile`
Expected: PASS.

- [ ] **Step 3: Lint the touched file**

Run: `npx eslint src/notepad/components/lamplight/ConnectionCardsPanel.tsx`
Expected: clean.

---

## Notes for the implementer

- Do not touch the title-area toggle button — it stays as the big tap target; the footer hint is an additional, labeled control for the same `handleChipClick` action.
- Do not add the hint to strip mode. The strip footer must remain just "Open ↗".
- No new imports, props, or data changes are needed.
