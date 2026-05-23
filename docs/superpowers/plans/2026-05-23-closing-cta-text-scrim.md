# Closing CTA — Soft Text Scrim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a soft radial scrim (radial darken + masked backdrop-blur) behind the Section 09 closing heading + subtitle on the notepad landing page, so the text reads clearly above the bright particle column without introducing a visible "panel."

**Architecture:** A single new wrapper `<div className="closing-text-block">` inside `.closing-content` holds just the heading and subtitle. The scrim is a `::before` pseudo-element on that wrapper — no extra DOM, no JS, no animation. CTAs stay outside the wrapper and remain on the bare scene.

**Tech Stack:** React 19, TypeScript, vanilla CSS, Vitest + @testing-library/react + jsdom. Routing via `react-router-dom` (the component uses `<Link>`).

**Spec:** `docs/superpowers/specs/2026-05-23-closing-cta-text-scrim-design.md`

---

## File Structure

- **Modify:** `src/notepad-landing/sections/09-closing-cta.tsx` — wrap `<h2>` + subtitle in a new `<div className="closing-text-block">`. CTAs stay outside the wrapper.
- **Modify:** `src/notepad-landing/styles/landing.css` — add `.closing-text-block` (relative positioning + lift children above the pseudo) and `.closing-text-block::before` (the scrim).
- **Create:** `src/notepad-landing/sections/09-closing-cta.test.tsx` — structural assertions on the wrapper, the text it contains, and the CTAs being siblings.

---

## Task 1: Structural test for the text-block wrapper

**Files:**
- Create: `src/notepad-landing/sections/09-closing-cta.test.tsx`

- [ ] **Step 1: Write the failing test**

Create the file with this content (mirrors the pattern from `garden-scene.test.tsx`):

```tsx
// src/notepad-landing/sections/09-closing-cta.test.tsx
// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClosingCTA } from './09-closing-cta';

// IntersectionObserver isn't implemented in jsdom; stub it so the staged
// effect never fires and the dynamic three.js particle import is skipped.
beforeEach(() => {
  window.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as unknown as typeof IntersectionObserver;
});

afterEach(cleanup);

function renderCTA() {
  return render(
    <MemoryRouter>
      <ClosingCTA prm={true} />
    </MemoryRouter>,
  );
}

describe('<ClosingCTA />', () => {
  it('wraps the heading and subtitle in .closing-text-block', () => {
    renderCTA();
    const block = document.querySelector('.closing-text-block');
    expect(block).not.toBeNull();
    expect(block?.querySelector('#sec09-h2')).not.toBeNull();
    expect(block?.querySelector('.closing-sub')).not.toBeNull();
  });

  it('keeps both CTAs outside .closing-text-block (siblings, not children)', () => {
    renderCTA();
    const block = document.querySelector('.closing-text-block');
    const primary = document.querySelector('.closing-cta-primary');
    const secondary = document.querySelector('.closing-cta-secondary');
    expect(primary).not.toBeNull();
    expect(secondary).not.toBeNull();
    expect(block?.contains(primary!)).toBe(false);
    expect(block?.contains(secondary!)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad-landing/sections/09-closing-cta.test.tsx`

Expected: 2 failing tests — "expected null not to be null" on the `.closing-text-block` lookup (the wrapper doesn't exist yet).

- [ ] **Step 3: Add the wrapper in the component**

Edit `src/notepad-landing/sections/09-closing-cta.tsx`. Replace the JSX of `.closing-content` (current lines 39–44) so the heading + subtitle are wrapped, CTAs are not:

Current:
```tsx
<div className="closing-content">
  <h2 id="sec09-h2">{h2}</h2>
  <p className="closing-sub">{sub}</p>
  <Link to="/notepad/notes" className="cta-primary closing-cta-primary">{ctaPrimary}</Link>
  <Link to="/login" className="closing-cta-secondary">{ctaSecondary}</Link>
</div>
```

New:
```tsx
<div className="closing-content">
  <div className="closing-text-block">
    <h2 id="sec09-h2">{h2}</h2>
    <p className="closing-sub">{sub}</p>
  </div>
  <Link to="/notepad/notes" className="cta-primary closing-cta-primary">{ctaPrimary}</Link>
  <Link to="/login" className="closing-cta-secondary">{ctaSecondary}</Link>
</div>
```

No other changes to the file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/notepad-landing/sections/09-closing-cta.test.tsx`

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/sections/09-closing-cta.tsx src/notepad-landing/sections/09-closing-cta.test.tsx
git commit -m "$(cat <<'EOF'
feat(closing-cta): wrap heading + subtitle in .closing-text-block

Preparation for the soft text scrim. CTAs stay outside the wrapper so
they keep rendering directly on the particle column.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Scrim CSS

**Files:**
- Modify: `src/notepad-landing/styles/landing.css` (append after the existing `.closing-cta-secondary:hover` rule around line 581)

- [ ] **Step 1: Add the scrim styles**

Append to `src/notepad-landing/styles/landing.css` immediately after the `.closing-cta-secondary:hover` block and before the `/* ─── Garden Scene ─── */` section header:

```css
.closing-text-block {
  position: relative;
}

.closing-text-block::before {
  content: '';
  position: absolute;
  inset: -2rem -3rem;
  background: radial-gradient(
    ellipse 60% 45% at 50% 50%,
    rgba(8, 8, 10, 0.72),
    rgba(8, 8, 10, 0) 70%
  );
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  -webkit-mask: radial-gradient(
    ellipse 55% 42% at 50% 50%,
    #000 35%,
    transparent 75%
  );
  mask: radial-gradient(
    ellipse 55% 42% at 50% 50%,
    #000 35%,
    transparent 75%
  );
  z-index: 0;
  pointer-events: none;
}

.closing-text-block > * {
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 2: Re-run the structural tests to confirm nothing broke**

Run: `npx vitest run src/notepad-landing/sections/09-closing-cta.test.tsx`

Expected: 2 passing tests (CSS change shouldn't affect them, but verify the wrapper still renders).

- [ ] **Step 3: Verify visually in the browser**

Start the dev server and open the notepad landing page footer.

Run:
```bash
npm run dev
```

Then in a browser, navigate to the notepad landing route and scroll to Section 09. Confirm:
- The heading "The first page is open." reads clearly against the bright particle column.
- The subtitle ("No account required to begin...") is fully legible.
- There is no visible rectangular panel, no hard edge, no border — the scrim fades into the scene.
- The two CTA buttons below still sit on the bare particle column (no scrim under them).
- Reload with DevTools' "Disable cache" on to make sure no stale CSS is in play.

If the scrim feels too strong or too soft, this is the moment to nudge the `rgba` alpha (currently `0.72`) or the `blur(6px)` value — but only if the result is clearly off. Spec-approved values stand by default.

- [ ] **Step 4: Run the full test suite to confirm no regressions**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/styles/landing.css
git commit -m "$(cat <<'EOF'
style(closing-cta): soft radial scrim behind heading + subtitle

Radial darken (rgba 8/8/10 at 72%) with a masked 6px backdrop-blur on
.closing-text-block::before. Edges feather to transparent via CSS mask
so there is no visible blur seam. CTAs are unaffected and continue to
render on the bare particle column.

Lifts the subtitle (#b7ada0) over the bright cream column from a WCAG
AA fail to a comfortable pass.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist (for the implementer)

Before declaring complete:

- [ ] `npx vitest run src/notepad-landing/sections/09-closing-cta.test.tsx` — both tests pass.
- [ ] `npm test` — full suite green.
- [ ] Visual check in browser at the notepad landing footer — heading and subtitle are clearly readable above the particle column, no visible panel or hard edge.
- [ ] Diff is exactly three files: the section component, the test file (new), and the CSS file. No other files changed.
- [ ] No console errors or warnings on the notepad landing page when scrolling through Section 09.
