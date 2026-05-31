# Mobile menu — bottom-up disclosure reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `MobileBottomDock`'s right-side Radix `Sheet` drawer with a WAI-ARIA Disclosure panel that expands upward from above the MENU pill, combining a max-height + opacity panel reveal, an in-button MENU↔CLOSE MENU text swap, and a staggered fade-and-translate of the nav items.

**Architecture:** Single-component refactor inside `src/components/layout/MobileBottomDock.tsx`. Two independent React state booleans (`panelOpen`, `socialExpanded`) drive `data-*` attributes that CSS selectors in `src/index.css` key off. No new dependencies, no new components, no Radix primitives. Reduced-motion users get instant state changes via a media query that zeroes all transitions.

**Tech Stack:** React 18, TypeScript, React Router, Tailwind CSS, Vite, Vitest + @testing-library/react.

**Spec:** [docs/superpowers/specs/2026-05-31-mobile-menu-bottom-up-reveal-design.md](../specs/2026-05-31-mobile-menu-bottom-up-reveal-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| [src/components/layout/MobileBottomDock.tsx](../../src/components/layout/MobileBottomDock.tsx) | Modify | Replace `Sheet*` JSX with disclosure markup; add `panelOpen`/`socialExpanded` state; update `visible` calc to suspend hide-on-scroll while panel is open. |
| [src/components/layout/MobileBottomDock.test.tsx](../../src/components/layout/MobileBottomDock.test.tsx) | Modify | Replace `dialog` role assertions with `aria-expanded` / `data-panel-state` assertions; add nested-toggle, reopen-resets-social, and scroll-hide-override tests. |
| [src/index.css](../../src/index.css) | Modify | Append the menu-panel / menu-links / social-sub / menu-toggle CSS rules + reduced-motion media query, following the existing top-level class pattern (`.psalms-nav-link`). |

No new files. No package additions. No changes to `@/data/projects`.

---

## Task 1: Strip the Sheet drawer and prove the new disclosure scaffolding

**Files:**
- Modify: `src/components/layout/MobileBottomDock.test.tsx` (lines 66-86 — delete the `dialog`/`Purpose` test and the `onNavTrigger` test temporarily; we'll reinstate the latter in Task 3)
- Modify: `src/components/layout/MobileBottomDock.tsx` (whole `return` block)

- [ ] **Step 1: Delete the now-obsolete Sheet tests**

In `src/components/layout/MobileBottomDock.test.tsx`, delete the entire `it('opens the Sheet drawer when MENU is clicked', …)` block (lines 66-76) and the entire `it('fires onNavTrigger when a trigger-label nav link is tapped', …)` block (lines 78-86). They will be re-added in Tasks 2 and 3 against the new markup.

- [ ] **Step 2: Add the failing disclosure-open test**

Add this new `it` block to `src/components/layout/MobileBottomDock.test.tsx`, immediately after the existing `it('starts visible (data-visible="true")', …)` block:

```tsx
  it('toggles data-panel-state and aria-expanded when the MENU button is clicked', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    const dock = screen.getByTestId('mobile-bottom-dock');
    const toggle = screen.getByRole('button', { name: /^menu$/i });
    expect(dock.getAttribute('data-panel-state')).toBe('closed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('mobile-menu-panel');

    fireEvent.click(toggle);
    expect(dock.getAttribute('data-panel-state')).toBe('open');
    const closeToggle = screen.getByRole('button', { name: /close menu/i });
    expect(closeToggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(closeToggle);
    expect(dock.getAttribute('data-panel-state')).toBe('closed');
    expect(screen.getByRole('button', { name: /^menu$/i }).getAttribute('aria-expanded')).toBe('false');
  });
```

- [ ] **Step 3: Run the new test and confirm it fails**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "toggles data-panel-state"`
Expected: FAIL. The current component renders neither `data-panel-state` on the dock nor a `MENU`-named button without an `aria-label`. The fail message will mention `Unable to find an accessible element with the role "button" and name '/^menu$/i'` or a missing `data-panel-state` attribute.

- [ ] **Step 4: Replace the Sheet block with the disclosure scaffolding**

Open `src/components/layout/MobileBottomDock.tsx`. Replace the file's entire contents with:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollDirection } from '@/hooks/use-scroll-direction';

interface MobileBottomDockProps {
  onNavTrigger?: () => void;
}

/**
 * Floating bottom dock for the mobile viewport (< 768px). Replaces the old
 * top `HeaderMobile`. Always visible at the top of the page; hides on
 * scroll-down; reveals on scroll-up. Tapping MENU expands a bottom-up
 * disclosure panel above the dock row; tapping CLOSE MENU collapses it.
 * Panel uses the WAI-ARIA Disclosure pattern (not a Dialog) — no backdrop,
 * no focus trap, no body-scroll lock. While the panel is open, the
 * hide-on-scroll-down behavior is suspended so the panel never scrolls
 * out from under the user mid-interaction.
 */
export function MobileBottomDock({ onNavTrigger: _onNavTrigger }: MobileBottomDockProps) {
  const isMobile = useIsMobile();
  const dir = useScrollDirection();
  const [panelOpen, setPanelOpenRaw] = useState(false);

  if (!isMobile) return null;

  const visible = panelOpen ? true : dir !== 'down';

  const setPanelOpen = (next: boolean): void => {
    setPanelOpenRaw(next);
  };

  return (
    <aside
      data-testid="mobile-bottom-dock"
      data-visible={visible ? 'true' : 'false'}
      data-panel-state={panelOpen ? 'open' : 'closed'}
      aria-label="Quick navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 motion-reduce:transition-none"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 1rem))' }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <div id="mobile-menu-panel" className="menu-panel" aria-hidden={!panelOpen}>
          {/* Links land in Task 3. */}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label="Home"
            className="h-11 w-11 rounded-xl bg-[color:var(--deep-umber)] inline-flex items-center justify-center"
          >
            <img
              src="/logo-icon.png"
              alt=""
              className="h-6 w-6 object-contain"
              style={{ filter: 'invert(1)' }}
            />
          </Link>
          <button
            type="button"
            className="menu-toggle h-11 px-6 rounded-full bg-[color:var(--deep-umber)] text-white text-xs font-semibold tracking-[0.14em]"
            aria-expanded={panelOpen}
            aria-controls="mobile-menu-panel"
            onClick={() => setPanelOpen(!panelOpen)}
          >
            <span className="text-menu">MENU</span>
            <span className="text-close">CLOSE MENU</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
```

The `_onNavTrigger` rename (underscore prefix) tells ESLint we know the prop is unused right now — it gets wired back up in Task 3.

- [ ] **Step 5: Add the minimal CSS so the two text spans behave**

Append the following block to the very end of `src/index.css`:

```css
/* ───── MobileBottomDock disclosure menu ───── */

.menu-panel {
  width: 300px;
  max-width: calc(100vw - 32px);
  background: var(--deep-umber);
  border-radius: 16px;
  overflow: hidden;
  padding: 24px 0;
  max-height: 0;
  opacity: 0;
  transition:
    max-height 500ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 400ms ease;
}

[data-panel-state="open"] .menu-panel {
  max-height: 420px;
  opacity: 1;
}

.menu-toggle {
  position: relative;
  min-width: 110px;
  transition: min-width 300ms ease-out;
}

[data-panel-state="open"] .menu-toggle {
  min-width: 150px;
}

.menu-toggle .text-close { display: none; }
[data-panel-state="open"] .menu-toggle .text-menu { display: none; }
[data-panel-state="open"] .menu-toggle .text-close { display: inline; }
```

Padding is intentionally constant (`padding: 24px 0` in both states) and lives inside the `overflow: hidden` so it's invisibly clipped when `max-height: 0`. Animating padding alongside max-height causes a visible jump-then-tween; keeping it constant gives the corner-radius-stays-uniform behavior the spec requires.

- [ ] **Step 6: Run the disclosure test and confirm it passes**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "toggles data-panel-state"`
Expected: PASS.

- [ ] **Step 7: Run the full dock test file to catch collateral damage**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx`
Expected: all remaining tests pass. The deleted `Sheet`/`onNavTrigger` tests are gone; the new disclosure test passes; the pre-existing visibility/scroll tests still pass because we preserved the dock's outer aside, the `data-testid`, the `data-visible` attribute, the logo, and the toggle button.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/MobileBottomDock.tsx src/components/layout/MobileBottomDock.test.tsx src/index.css
git commit -m "$(cat <<'EOF'
refactor(mobile-dock): swap Sheet drawer for disclosure scaffolding

Strip the Radix Sheet primitive from MobileBottomDock in favor of a
WAI-ARIA Disclosure pattern. Adds panelOpen state, data-panel-state
attribute, aria-expanded/aria-controls wiring, and the MENU/CLOSE MENU
text-swap spans. Panel body is still empty — links land in the next
commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add the staggered link reveal CSS

**Files:**
- Modify: `src/index.css` (append to the disclosure block from Task 1)

This task is CSS-only — no test added because the stagger is a pure visual concern. Functional behavior (links rendering, click handlers firing) is tested in Task 3.

- [ ] **Step 1: Append the link styles**

Append this block to `src/index.css`, immediately after the `[data-panel-state="open"] .menu-toggle .text-close { display: inline; }` line from Task 1:

```css
.menu-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: center;
}

.menu-links > li {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 200ms ease, transform 200ms ease;
}

[data-panel-state="open"] .menu-links > li {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 400ms cubic-bezier(0.16, 1, 0.3, 1) calc(100ms * var(--i, 1)),
    transform 400ms cubic-bezier(0.16, 1, 0.3, 1) calc(100ms * var(--i, 1));
}

.menu-links a,
.menu-links .social-toggle {
  display: inline-block;
  color: white;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-decoration: none;
  background: none;
  border: 0;
  padding: 4px 8px;
  min-height: 32px;
  cursor: pointer;
}

.social-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.social-sub {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition:
    max-height 350ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 250ms ease;
}

.social-row[data-social-state="open"] .social-sub {
  max-height: 40px;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .menu-panel,
  .menu-links > li,
  .social-sub,
  .menu-toggle {
    transition: none !important;
  }
}
```

The `var(--i, 1)` fallback means a list item that forgets to declare `--i` still gets a sane 100ms delay rather than `calc(100ms * undefined)` collapsing to 0.

- [ ] **Step 2: Re-run the full dock test file to confirm nothing regressed**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx`
Expected: all tests still pass — none of them assert on transition values, so CSS-only changes can't break them.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "$(cat <<'EOF'
style(mobile-dock): add menu-links stagger + social-sub + reduced-motion

Adds the per-row stagger via --i CSS variable, the nested social-sub
expansion track, and the prefers-reduced-motion override that zeroes
all transitions. No markup changes — link rendering lands next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Render the nav links + restore the onNavTrigger handoff

**Files:**
- Modify: `src/components/layout/MobileBottomDock.tsx`
- Modify: `src/components/layout/MobileBottomDock.test.tsx`

- [ ] **Step 1: Add the failing links-present test**

Add this `it` block to `src/components/layout/MobileBottomDock.test.tsx`, immediately after the disclosure-toggle test from Task 1:

```tsx
  it('renders the 4 nav links inside the panel and exposes them by accessible name', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    expect(screen.getByRole('link', { name: 'PURPOSE' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'NOTEPAD' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'COMMUNITY' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CONTACT' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Add the failing onNavTrigger test**

Immediately after the links-present test, add:

```tsx
  it('fires onNavTrigger when a NAV_TRIGGER_LABELS link is tapped', async () => {
    vi.resetModules();
    const onNavTrigger = vi.fn();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock onNavTrigger={onNavTrigger} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    fireEvent.click(screen.getByRole('link', { name: 'PURPOSE' }));
    expect(onNavTrigger).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 3: Run both new tests and confirm they fail**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "renders the 4 nav links|fires onNavTrigger when a NAV_TRIGGER_LABELS"`
Expected: both FAIL. "Unable to find an accessible element with the role 'link' and name 'PURPOSE'" — the panel body is empty.

- [ ] **Step 4: Render the links inside the panel**

In `src/components/layout/MobileBottomDock.tsx`, replace the existing import block with:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { navItems, NAV_TRIGGER_LABELS } from '@/data/projects';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
```

Replace the unused-prop rename — change the destructure back to `{ onNavTrigger }` and drop the underscore:

```tsx
export function MobileBottomDock({ onNavTrigger }: MobileBottomDockProps) {
```

Then replace the empty `<div id="mobile-menu-panel" …>` block with:

```tsx
        <div id="mobile-menu-panel" className="menu-panel" aria-hidden={!panelOpen}>
          <ul className="menu-links">
            {navItems.map((item, i) => (
              <li key={item.label} style={{ ['--i' as string]: i + 1 } as React.CSSProperties}>
                <Link
                  to={item.href}
                  onClick={() => {
                    if (NAV_TRIGGER_LABELS.has(item.label)) onNavTrigger?.();
                  }}
                >
                  {item.label.toUpperCase()}
                </Link>
              </li>
            ))}
          </ul>
        </div>
```

Add `import type React from 'react';` at the top if your tsconfig requires it; the project's existing components use the runtime `import { useState } from 'react'` form, so `React.CSSProperties` is referenced as a type and may need the type-only import depending on `verbatimModuleSyntax`. If `npm run lint` flags it, change `import { useState } from 'react';` to `import { useState, type CSSProperties } from 'react';` and use `CSSProperties` directly instead of `React.CSSProperties`.

- [ ] **Step 5: Run the two new tests and confirm they pass**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "renders the 4 nav links|fires onNavTrigger when a NAV_TRIGGER_LABELS"`
Expected: both PASS.

- [ ] **Step 6: Run the full dock test file to confirm no regression**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx`
Expected: every test in the file passes.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/MobileBottomDock.tsx src/components/layout/MobileBottomDock.test.tsx
git commit -m "$(cat <<'EOF'
feat(mobile-dock): render nav links inside the disclosure panel

Maps navItems into <li> rows inside .menu-panel, sets per-row --i for
the stagger, restores the onNavTrigger handoff for NAV_TRIGGER_LABELS
matches, and uppercases the visible label to match the MENU button
treatment.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add the SOCIAL row + nested Instagram reveal

**Files:**
- Modify: `src/components/layout/MobileBottomDock.tsx`
- Modify: `src/components/layout/MobileBottomDock.test.tsx`

- [ ] **Step 1: Add the failing social-expand test**

Add this `it` block to `src/components/layout/MobileBottomDock.test.tsx`, immediately after the `fires onNavTrigger` test:

```tsx
  it('toggles the Instagram sub-row when SOCIAL is clicked inside an open panel', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));

    const socialBtn = screen.getByRole('button', { name: /^social$/i });
    expect(socialBtn.getAttribute('aria-expanded')).toBe('false');
    expect(socialBtn.getAttribute('aria-controls')).toBe('mobile-social-instagram');
    const socialRow = socialBtn.closest('.social-row') as HTMLElement;
    expect(socialRow.getAttribute('data-social-state')).toBe('closed');

    fireEvent.click(socialBtn);
    expect(socialBtn.getAttribute('aria-expanded')).toBe('true');
    expect(socialRow.getAttribute('data-social-state')).toBe('open');
    const instagram = screen.getByRole('link', { name: /instagram/i });
    expect(instagram.getAttribute('href')).toBe('https://instagram.com');
    expect(instagram.getAttribute('target')).toBe('_blank');
    expect(instagram.getAttribute('rel')).toContain('noopener');
    expect(instagram.id).toBe('mobile-social-instagram');

    fireEvent.click(socialBtn);
    expect(socialBtn.getAttribute('aria-expanded')).toBe('false');
    expect(socialRow.getAttribute('data-social-state')).toBe('closed');
  });
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "toggles the Instagram sub-row"`
Expected: FAIL. "Unable to find an accessible element with the role 'button' and name '/^social$/i'."

- [ ] **Step 3: Add the SOCIAL state and the SOCIAL row JSX**

In `src/components/layout/MobileBottomDock.tsx`, change the state declarations from:

```tsx
  const [panelOpen, setPanelOpenRaw] = useState(false);
```

to:

```tsx
  const [panelOpen, setPanelOpenRaw] = useState(false);
  const [socialExpanded, setSocialExpanded] = useState(false);
```

Then update `setPanelOpen` to reset the nested state when collapsing — replace the existing setter with:

```tsx
  const setPanelOpen = (next: boolean): void => {
    setPanelOpenRaw(next);
    if (!next) setSocialExpanded(false);
  };
```

Finally, immediately after the closing `</li>` of the `navItems.map` and before the closing `</ul>`, add the SOCIAL row:

```tsx
            <li
              key="social"
              className="social-row"
              data-social-state={socialExpanded ? 'open' : 'closed'}
              style={{ ['--i' as string]: navItems.length + 1 } as React.CSSProperties}
            >
              <div className="social-sub" aria-hidden={!socialExpanded}>
                <a
                  id="mobile-social-instagram"
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  INSTAGRAM ↗
                </a>
              </div>
              <button
                type="button"
                className="social-toggle"
                aria-expanded={socialExpanded}
                aria-controls="mobile-social-instagram"
                onClick={() => setSocialExpanded((v) => !v)}
              >
                SOCIAL
              </button>
            </li>
```

The Instagram `<div>` is the **first child** of the social `<li>` (a flex column), so it visually renders **above** the SOCIAL toggle — matching the spec's "reveal above" requirement without any DOM reordering trickery.

- [ ] **Step 4: Run the social test and confirm it passes**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "toggles the Instagram sub-row"`
Expected: PASS.

- [ ] **Step 5: Add the failing "SOCIAL does not fire onNavTrigger" test**

Per the spec's testing strategy item #7, SOCIAL is intentionally excluded from `NAV_TRIGGER_LABELS` because it's a hover/disclosure trigger, not a navigation. Add this test immediately after the `toggles the Instagram sub-row` test:

```tsx
  it('does NOT fire onNavTrigger when SOCIAL is tapped (excluded from NAV_TRIGGER_LABELS)', async () => {
    vi.resetModules();
    const onNavTrigger = vi.fn();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock onNavTrigger={onNavTrigger} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
    expect(onNavTrigger).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run the new test and confirm it passes**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "does NOT fire onNavTrigger when SOCIAL"`
Expected: PASS. The SOCIAL toggle's `onClick` only sets local state — it doesn't reference `onNavTrigger` at all — so the assertion is naturally satisfied. This test guards against a future regression where a well-meaning refactor wires SOCIAL into the trigger path.

- [ ] **Step 7: Run the full dock test file**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/MobileBottomDock.tsx src/components/layout/MobileBottomDock.test.tsx
git commit -m "$(cat <<'EOF'
feat(mobile-dock): nested Social row reveals Instagram above

Adds a fifth row to the disclosure panel — a SOCIAL toggle button that
flips its own data-social-state to expand a sub-row containing the
Instagram link. Sub-row sits as the first child of the social-row flex
column, so it visually appears above the SOCIAL label per spec. Setter
also resets socialExpanded whenever the panel closes so reopening the
panel always starts with Social collapsed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Lock in the reopen-resets-social regression test

**Files:**
- Modify: `src/components/layout/MobileBottomDock.test.tsx`

Task 4 already implemented the reset behavior. This task adds the explicit regression test so any future refactor that drops the `if (!next) setSocialExpanded(false)` line gets caught immediately.

- [ ] **Step 1: Add the regression test**

Add this `it` block to `src/components/layout/MobileBottomDock.test.tsx`, immediately after the social-toggle test:

```tsx
  it('collapses Social automatically when the panel closes, even after Social was expanded', async () => {
    vi.resetModules();
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
    expect(screen.getByRole('button', { name: /^social$/i }).getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));

    expect(screen.getByRole('button', { name: /^social$/i }).getAttribute('aria-expanded')).toBe('false');
  });
```

- [ ] **Step 2: Run the regression test**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "collapses Social automatically"`
Expected: PASS (the behavior is already in place from Task 4).

- [ ] **Step 3: Sanity-check that the test actually fails when the reset is removed**

This is a one-time verification — do NOT commit either edit. Temporarily edit `src/components/layout/MobileBottomDock.tsx`'s `setPanelOpen` to remove the reset line, run the test, confirm it fails, then restore the line:

```tsx
// TEMPORARY — remove for one test run, then restore
  const setPanelOpen = (next: boolean): void => {
    setPanelOpenRaw(next);
    // if (!next) setSocialExpanded(false);
  };
```

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "collapses Social automatically"`
Expected: FAIL. Confirms the test is load-bearing.

Now uncomment the line so the file returns to its post-Task-4 state. Run the test again:

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "collapses Social automatically"`
Expected: PASS.

- [ ] **Step 4: Run the full dock test file**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MobileBottomDock.test.tsx
git commit -m "$(cat <<'EOF'
test(mobile-dock): regression guard for Social-resets-on-close

Locks in the reset-nested-state-when-parent-closes invariant added in
the previous commit. Verified by manually removing the reset line and
watching this test fail before re-enabling it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Override scroll-hide while the panel is open

**Files:**
- Modify: `src/components/layout/MobileBottomDock.test.tsx`
- Modify: `src/components/layout/MobileBottomDock.tsx` (verify — implemented in Task 1, but the test wasn't added)

The implementation already exists from Task 1 (`const visible = panelOpen ? true : dir !== 'down'`). This task adds the test that asserts the behavior so it survives future refactors.

- [ ] **Step 1: Add the failing scroll-hide-override test**

Add this `it` block to `src/components/layout/MobileBottomDock.test.tsx`, immediately after the reopen-resets-social regression:

```tsx
  it('keeps data-visible="true" while panel is open, even when the user scrolls down', async () => {
    vi.resetModules();
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    const { MobileBottomDock } = await import('./MobileBottomDock');
    render(<MemoryRouter><MobileBottomDock /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    expect(screen.getByTestId('mobile-bottom-dock').getAttribute('data-visible')).toBe('true');

    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 400, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });

    expect(screen.getByTestId('mobile-bottom-dock').getAttribute('data-visible')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));

    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 600, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });

    expect(screen.getByTestId('mobile-bottom-dock').getAttribute('data-visible')).toBe('false');
  });
```

- [ ] **Step 2: Run the test and confirm it passes**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "keeps data-visible"`
Expected: PASS. The behavior is already in place from Task 1; this test is locking it in.

- [ ] **Step 3: Sanity-check that the test actually fails when the override is removed**

Temporarily edit `src/components/layout/MobileBottomDock.tsx`:

```tsx
// TEMPORARY — remove for one test run, then restore
  const visible = /* panelOpen ? true : */ dir !== 'down';
```

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx -t "keeps data-visible"`
Expected: FAIL.

Restore the line:

```tsx
  const visible = panelOpen ? true : dir !== 'down';
```

Run again to confirm PASS.

- [ ] **Step 4: Run the full dock test file**

Run: `npx vitest run src/components/layout/MobileBottomDock.test.tsx`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MobileBottomDock.test.tsx
git commit -m "$(cat <<'EOF'
test(mobile-dock): lock in scroll-hide override while panel is open

Verifies that the panelOpen-overrides-hide-on-scroll-down branch in
`visible` calculation survives future refactors. Sanity-checked by
removing the override and watching this test fail.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Manual browser verification of the animation contract

**Files:** none modified

Tests assert structure and state transitions; they don't assert that the animation looks right. This task is a manual verification step using the running dev server so the visual feel matches the spec.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite reports a local URL (typically `http://localhost:5173`).

- [ ] **Step 2: Open the site on a mobile viewport**

Open the local URL in Chrome. Toggle DevTools → device toolbar → iPhone 14 Pro (390×844). Scroll the page a bit so the dock is in its normal context (not at the absolute top).

- [ ] **Step 3: Verify the open animation matches the spec**

Tap MENU. Watch for:
1. Panel grows upward from above the MENU pill — corners stay uniformly rounded throughout (no oval stretch). If you see corner distortion, the CSS is using `transform: scaleY` instead of `max-height` — re-check Task 1 Step 5.
2. Button label crossfades to CLOSE MENU after ~180ms. Pill min-width grows smoothly to fit the longer label (no snap).
3. The 4 nav rows + SOCIAL row reveal in stagger order (PURPOSE first, SOCIAL last), each fading in and rising 20px to its final position.
4. Total perceived time from tap to final settle: ~700ms.

If any of these fail, fix the relevant CSS rule in `src/index.css` and re-test.

- [ ] **Step 4: Verify SOCIAL nested expand**

With the panel open, tap SOCIAL. Watch for:
1. The Instagram row reveals **above** SOCIAL (not below).
2. The whole panel grows by one row height to accommodate it.
3. The corner radius of the panel stays uniform.
4. Tap SOCIAL again — Instagram collapses cleanly.

- [ ] **Step 5: Verify scroll-hide override**

With the panel open, scroll the page down. The dock should **not** hide. Close the panel (tap CLOSE MENU). Scroll down again — the dock should now slide off the bottom as before.

- [ ] **Step 6: Verify reduced-motion**

In Chrome DevTools, open `…` → More tools → Rendering → "Emulate CSS media feature prefers-reduced-motion" → set to "reduce". Reload. Tap MENU. The panel should appear instantly with no animation; the link stagger should be absent; the button label should swap instantly. Functionality is preserved.

- [ ] **Step 7: Verify on a real device if possible**

If a phone is handy: visit the dev server's network URL from the phone (Vite prints both `local` and `network` URLs on start). Tap MENU. Confirm the animation feels right at native touch latency — desktop emulation undersells the snappiness.

- [ ] **Step 8: Stop the dev server**

Stop the dev server with `Ctrl+C` in the terminal where you ran `npm run dev`.

- [ ] **Step 9: No commit needed — this task only validates the work from prior commits**

If anything was wrong, the fixes from Step 3-6 should already be committed under their relevant prior task's commit message. If you made a CSS tweak in this task that wasn't covered by a prior commit, commit it now with:

```bash
git add src/index.css
git commit -m "style(mobile-dock): tune disclosure animation per manual verification"
```

---

## Task 8: Final repo-wide verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests across the repo pass. If anything fails outside `MobileBottomDock.test.tsx`, investigate — the only file that imported the dock besides itself is probably the page that mounts it (likely a layout component), and our public API surface (`MobileBottomDockProps`, the default export shape) is unchanged.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no new errors. If ESLint complains about an unused `_onNavTrigger` (it shouldn't — Task 3 already dropped the underscore prefix), fix the rename.

- [ ] **Step 3: Run a production build to catch TypeScript errors**

Run: `npx vite build`
Expected: clean build, no TypeScript errors. The build is the project's `tsc + vite` typecheck path.

- [ ] **Step 4: Confirm no Radix Sheet imports remain in MobileBottomDock**

Run: `grep -n "from '@/components/ui/sheet'" src/components/layout/MobileBottomDock.tsx`
Expected: no output (the imports were removed in Task 1; if anything still references the Sheet primitive in this file, something went wrong).

- [ ] **Step 5: Final commit if any verification fixes were needed**

If Steps 1-3 surfaced fixes, commit them now under a clear message. If everything passed clean, no final commit is needed and the work is done.
