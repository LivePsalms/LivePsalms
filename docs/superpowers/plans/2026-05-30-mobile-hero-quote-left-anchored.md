# Mobile hero quote left-anchored at 70vw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the centered quote container's className with a left-anchored variant at 70vw, plus two assertions verifying the change.

**Architecture:** Single className edit on the quote `<div>` inside `HeroMobile.tsx`. Wordmark, video, bridge copy, scroll-collapse animation, and intersection-fade all stay as-is.

**Tech Stack:** React 18, TypeScript, Tailwind, Vitest + @testing-library/react (jsdom env).

**Spec:** [`docs/superpowers/specs/2026-05-30-mobile-hero-quote-left-anchored-design.md`](../specs/2026-05-30-mobile-hero-quote-left-anchored-design.md)

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/components/sections/HeroMobile.tsx` | Modify (lines 112-115 — quote container className) | Swap `text-center px-8` → `self-start text-left w-[70vw]` |
| `src/components/sections/HeroMobile.test.tsx` | Modify (add 2 new tests inside `describe('HeroMobile content', ...)`) | Assert the new className shape |

---

## Task 1: Left-anchor the quote container (TDD)

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx` (lines 112-115)
- Modify: `src/components/sections/HeroMobile.test.tsx` (add 2 tests inside existing `describe('HeroMobile content', ...)` block)

- [ ] **Step 1: Add the failing tests**

Append the following two tests inside the existing `describe('HeroMobile content', ...)` block in `src/components/sections/HeroMobile.test.tsx`, just before the closing `});` (around line 290, after the previously-added red-square accent test):

```tsx
  it('quote container is left-anchored (self-start, text-left, no text-center, no px-8)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { getByTestId } = render(<Hero introActive={false} />);
    const quote = getByTestId('hero-mobile-quote');
    expect(quote.className).toContain('self-start');
    expect(quote.className).toContain('text-left');
    expect(quote.className).not.toContain('text-center');
    expect(quote.className).not.toContain('px-8');
  });

  it('quote container is sized to w-[70vw]', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { getByTestId } = render(<Hero introActive={false} />);
    const quote = getByTestId('hero-mobile-quote');
    expect(quote.className).toContain('w-[70vw]');
  });
```

- [ ] **Step 2: Run the tests to confirm failure**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: 2 new tests FAIL. The current container has `text-center px-8 ... max-w-md` and does not contain `self-start`, `text-left`, or `w-[70vw]`. The remaining 20 existing tests should still PASS.

- [ ] **Step 3: Apply the className change**

In `src/components/sections/HeroMobile.tsx`, locate the quote container className (currently lines 112-115):

```tsx
          className={cn(
            'text-center px-8 mt-2 transition-opacity duration-1000 max-w-md',
            quoteVisible ? 'opacity-100' : 'opacity-0',
          )}
```

Replace it with:

```tsx
          className={cn(
            'self-start text-left w-[70vw] max-w-md mt-2 transition-opacity duration-1000',
            quoteVisible ? 'opacity-100' : 'opacity-0',
          )}
```

That is the only edit in `HeroMobile.tsx`. Do NOT touch:
- The wordmark `<PsalmsWordmarkSvg className="w-[88vw] max-w-md" />` at line 107.
- The video mask wrapper at lines 131-146.
- The bridge container at lines 148-176.
- The attribution paragraph (lines 123-129) — its `inline-flex items-center justify-center gap-2` only affects its internal flex layout; the paragraph itself inline-aligns according to the parent's `text-left` automatically.
- Any other file.

- [ ] **Step 4: Re-run the tests to confirm pass**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: all tests PASS — the 2 new tests now pass; every existing test (centered wordmark, masked video, intersection-fade, GSAP-collapse, reduced-motion poster, quote-precedes-video DOM order, red-square accent, breathing-room spacing) continues to pass.

- [ ] **Step 5: Run the broader section tests for regression**

Run: `npx vitest run src/components/sections/`
Expected: all tests in that folder PASS. The only acceptable failure is a pre-existing flake unrelated to HeroMobile (e.g. `TwoPathInterlude` mobile-only label flake that pre-dates this branch). If `HeroMobile.test.tsx` shows ANY failure, STOP and report — the change is broken.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/HeroMobile.tsx src/components/sections/HeroMobile.test.tsx
git commit -m "feat(hero-mobile): left-anchor the quote at 70vw

Swap text-center+px-8 for self-start+text-left+w-[70vw] on the quote
container. Wordmark and masked video stay centered via the parent's
items-center; the quote overrides cross-axis centering for itself via
self-start. Creates the intentional asymmetric rhythm specified in the
left-anchored design.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final verification

After Task 1 commits:

- [ ] **Step 1: Targeted test run**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: 22 tests PASS (the prior 20 + the 2 new).

- [ ] **Step 2: TypeScript build (informational only)**

`npm run build` may still fail on a pre-existing unrelated TS error in `src/components/sections/PurposeGrid.tsx:177`. That is not introduced by this change. Skip if it fails for that reason.

- [ ] **Step 3: Spec coverage cross-check**

| Spec section | Task |
|---|---|
| Quote container className swap | Task 1 Step 3 |
| Two new tests (left-anchored classes + 70vw width) | Task 1 Step 1 |
| Attribution paragraph unchanged | Task 1 Step 3 (explicitly not touched) |
| All other elements unchanged | Task 1 Step 3 (explicitly not touched) |

All spec sections have implementing tasks. No gaps.
