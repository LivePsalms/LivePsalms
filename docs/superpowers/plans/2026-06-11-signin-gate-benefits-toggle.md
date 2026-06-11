# SignInGate Benefits Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Today's Lamp "Why sign in?" control toggle an inline benefits list instead of navigating to the privacy policy, and remove the "quietly" wording from Lamplight messaging.

**Architecture:** Convert the `<a>` in `SignInGate` to a `<button>` driving local `useState`; render a benefits panel below it. Separately, a small copy edit removes "quietly" from two messaging strings and their locked tests.

**Tech Stack:** React + TypeScript, Tailwind utility classes, Vitest + @testing-library/react (jsdom).

---

### Task 1: Remove "quietly" from Lamplight messaging copy

**Files:**
- Modify: `src/notepad/lamplight/lamplight-copy.ts:26-27`
- Modify: `src/notepad/lamplight/lamplight-copy.test.ts:46,52`
- Modify: `src/notepad/components/lamplight/TodaysLampIntro.test.tsx:11,17`
- Modify: `src/notepad-landing/data/copy.ts:5`
- Modify: `src/notepad-landing/data/copy.test.ts:11`

- [ ] **Step 1: Update the locked copy tests to the new strings (these fail first)**

In `src/notepad/lamplight/lamplight-copy.test.ts`, replace the two assertion strings (lines 46 and 52) — remove the word `quietly ` (note the trailing space, so "draws quietly from" → "draws from"):

```ts
    expect(todaysLampIntro('Sarah')).toBe(
      "Sarah, Today's Lamp draws from your recent notes — a piece of Scripture and a short reflection for where you are right now.",
    );
```

```ts
    expect(todaysLampIntro(null)).toBe(
      "Today's Lamp draws from your recent notes — a piece of Scripture and a short reflection for where you are right now.",
    );
```

In `src/notepad/components/lamplight/TodaysLampIntro.test.tsx`, update the two matchers (lines 11 and 17):

```tsx
    expect(screen.getByText(/Today's Lamp draws from your recent notes/i)).toBeInTheDocument();
```

```tsx
    expect(screen.getByText(/Natalie, Today's Lamp draws/i)).toBeInTheDocument();
```

In `src/notepad-landing/data/copy.test.ts`, update the subtitle assertion (line 11) — remove `quietly `:

```ts
    expect(copy.section01.sub).toBe(
      'Your devotions, your sermon notes, the verses you keep coming back to — written down, connected, and read back to you when you need it.',
    );
```

- [ ] **Step 2: Run the copy tests to verify they fail**

Run: `npx vitest run src/notepad/lamplight/lamplight-copy.test.ts src/notepad/components/lamplight/TodaysLampIntro.test.tsx src/notepad-landing/data/copy.test.ts`
Expected: FAIL — received strings still contain "quietly".

- [ ] **Step 3: Update the source copy strings**

In `src/notepad/lamplight/lamplight-copy.ts`, lines 26-27, remove `quietly ` from both branches:

```ts
    ? `${firstName}, Today's Lamp draws from your recent notes — a piece of Scripture and a short reflection for where you are right now.`
    : `Today's Lamp draws from your recent notes — a piece of Scripture and a short reflection for where you are right now.`;
```

In `src/notepad-landing/data/copy.ts`, line 5, remove `quietly ` from the `sub` string:

```ts
    sub: 'Your devotions, your sermon notes, the verses you keep coming back to — written down, connected, and read back to you when you need it.',
```

- [ ] **Step 4: Run the copy tests to verify they pass**

Run: `npx vitest run src/notepad/lamplight/lamplight-copy.test.ts src/notepad/components/lamplight/TodaysLampIntro.test.tsx src/notepad-landing/data/copy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/lamplight/lamplight-copy.ts src/notepad/lamplight/lamplight-copy.test.ts src/notepad/components/lamplight/TodaysLampIntro.test.tsx src/notepad-landing/data/copy.ts src/notepad-landing/data/copy.test.ts
git commit -m "copy(lamplight): drop 'quietly' from Lamplight + landing messaging"
```

---

### Task 2: Replace privacy link with an inline benefits toggle in SignInGate

**Files:**
- Modify: `src/notepad/components/lamplight/SignInGate.tsx`
- Test: `src/notepad/components/lamplight/SignInGate.test.tsx`

- [ ] **Step 1: Replace the existing test with toggle behavior tests (these fail first)**

Overwrite `src/notepad/components/lamplight/SignInGate.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInGate } from './SignInGate';

afterEach(cleanup);

function renderGate() {
  render(<MemoryRouter><SignInGate /></MemoryRouter>);
}

describe('SignInGate', () => {
  it('renders the waiting line and sign-in + sign-up CTAs', () => {
    renderGate();
    expect(screen.getByText(/today's lamp is waiting for you/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/login');
  });

  it('exposes "Why sign in?" as a collapsed toggle button by default', () => {
    renderGate();
    const toggle = screen.getByRole('button', { name: /why sign in\?/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/reflective chat/i)).not.toBeInTheDocument();
  });

  it('reveals the benefits when the toggle is clicked', () => {
    renderGate();
    fireEvent.click(screen.getByRole('button', { name: /why sign in\?/i }));
    expect(screen.getByRole('button', { name: /why sign in\?/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/reflective chat/i)).toBeInTheDocument();
    expect(screen.getByText(/connection cards/i)).toBeInTheDocument();
  });

  it('hides the benefits again when the toggle is clicked twice', () => {
    renderGate();
    const toggle = screen.getByRole('button', { name: /why sign in\?/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/reflective chat/i)).not.toBeInTheDocument();
  });

  it('no longer links out to the privacy policy', () => {
    renderGate();
    expect(document.querySelector('a[href*="privacy"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/notepad/components/lamplight/SignInGate.test.tsx`
Expected: FAIL — there is no button named "Why sign in?" (it is still an `<a>`).

- [ ] **Step 3: Implement the toggle + benefits panel**

Overwrite `src/notepad/components/lamplight/SignInGate.tsx` with:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';

const BENEFITS: { icon: string; label: string; text: string }[] = [
  { icon: '🕯', label: "Today's Lamp", text: 'a piece of Scripture and a short reflection, drawn from your recent notes' },
  { icon: '💬', label: 'Reflective chat', text: 'ask about the passage and follow the thread, grounded in Scripture and your own notes' },
  { icon: '🔗', label: 'Connection Cards', text: 'see the threads linking your notes together' },
  { icon: '☁️', label: 'Saved & synced', text: 'your notepad travels with you across devices' },
  { icon: '🔒', label: 'Yours alone', text: 'your writing stays private to you' },
];

export function SignInGate() {
  const [showBenefits, setShowBenefits] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center min-h-[420px] px-6"
      style={{ background: 'linear-gradient(180deg, var(--plaster) 0%, var(--alabaster) 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ filter: 'blur(8px)', opacity: 0.4 }}>
        <div className="p-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--silica)' }}>
            Today's Lamp
          </div>
          <div className="text-base leading-relaxed" style={{ color: 'var(--deep-umber)' }}>
            "You've been writing about waiting. Three notes mention Psalm 27…"
          </div>
        </div>
      </div>
      <div
        className="relative z-10 max-w-sm w-full text-center px-6 py-6 rounded-lg"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div className="text-2xl mb-2" aria-hidden>🕯</div>
        <h3
          className="text-base mb-1"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
        >
          Today's Lamp is waiting for you.
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          Sign in to begin.
        </p>
        <div className="flex gap-2 justify-center mb-3">
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-xs rounded transition-colors"
            style={{
              background: 'var(--deep-umber)',
              color: 'var(--alabaster)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-xs rounded transition-colors"
            style={{
              background: 'transparent',
              border: '1px solid var(--pale-stone)',
              color: 'var(--deep-umber)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Sign up
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setShowBenefits((v) => !v)}
          aria-expanded={showBenefits}
          aria-controls="signin-benefits"
          className="text-[10px] underline cursor-pointer bg-transparent border-0"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Why sign in?
        </button>
        {showBenefits && (
          <ul
            id="signin-benefits"
            className="mt-3 pt-3 text-left space-y-2 list-none"
            style={{ borderTop: '1px solid var(--pale-stone)' }}
          >
            {BENEFITS.map((b) => (
              <li key={b.label} className="text-[11px] leading-relaxed flex gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                <span aria-hidden className="shrink-0">{b.icon}</span>
                <span style={{ color: 'var(--silica)' }}>
                  <span style={{ color: 'var(--deep-umber)', fontWeight: 600 }}>{b.label}</span> — {b.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/notepad/components/lamplight/SignInGate.test.tsx`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc -b`
Expected: no new errors from these files (a pre-existing red baseline exists; verify no `SignInGate.tsx` errors).

```bash
git add src/notepad/components/lamplight/SignInGate.tsx src/notepad/components/lamplight/SignInGate.test.tsx
git commit -m "feat(lamplight): 'Why sign in?' toggles inline benefits instead of privacy link"
```

---

## Notes

- The horizontal/vertical centering of the Sign in / Sign up buttons (`inline-flex items-center justify-center`) is already in place from earlier work and is preserved in the Task 2 rewrite — do not regress it.
- Benefit strings are intentionally inline, matching the rest of this card's hardcoded copy; no shared copy module is introduced (YAGNI).
