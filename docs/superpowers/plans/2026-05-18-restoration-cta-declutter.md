# Restoration CTA Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `RestorationCTA` zone (rendered on all 11 desktop purpose detail pages) so the notepad invitation is the single primary action (a bordered pill), and the newsletter signup is demoted to a tiny "Or join the newsletter" trigger that opens an in-place dialog with the email form.

**Architecture:** A new self-contained component `NewsletterDialog` (in its own file) wraps the existing Radix `Dialog` primitive and the existing `subscribe()` newsletter action. It exposes `children` as the trigger (passed via `<DialogTrigger asChild>`), owns its own form state machine, and stays open on success to display the result message in place. `RestorationCTA` (existing private component in `MoodBoard.tsx`) has its JSX body rewritten to drop the divider + inline email form and instead render a pill `<Link>` plus a tiny `<p>` containing the dialog trigger. Public API of `RestorationCTA` is unchanged — the 11 call sites stay the same.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, react-router-dom `<Link>`, Radix `Dialog` (`@/components/ui/dialog`), Supabase via the existing `subscribe()` in `@/components/sections/newsletter-actions`, Vitest (tests already exist for `subscribe()`; no new test files added).

**Verification approach:** TypeScript type-check + production build + Vitest suite + Playwright smoke test of the new modal behavior on a sample detail page. No component-level unit tests are added (this codebase has no React Testing Library installed; the prior `RestorationCTA` change also had none).

---

## File Structure

**Create:**
- `src/components/sections/NewsletterDialog.tsx` — self-contained dialog that renders its caller-supplied trigger via `<DialogTrigger asChild>` and the email form inside `<DialogContent>`. Owns form state, calls `subscribe()`, displays in-place success/error microcopy. ~110 lines.

**Modify:**
- `src/components/sections/MoodBoard.tsx` — rewrite the JSX body of the existing `RestorationCTA` (lines ~19-64). No other changes elsewhere in the file. Imports gain `NewsletterDialog`. The 11 call sites of `<RestorationCTA …/>` are NOT modified.

**No deletions, no schema changes, no changes to `newsletter-actions.ts`, `FinalReflectionCta.tsx`, the Dialog primitive, or any of the 11 detail-component functions.**

Both files have one clear responsibility:
- `NewsletterDialog.tsx` — encapsulates the "open a dialog and let the user subscribe" interaction. A future surface (e.g., a header CTA) could reuse it by wrapping a different trigger element.
- `RestorationCTA` (inside `MoodBoard.tsx`) — composes the heading, reflection prompt, primary notepad CTA, and the dialog trigger into the visible Zone 7 layout. It owns the layout and the moodboard's color-mix background.

---

## Task 1: Create `NewsletterDialog` component

**Files:**
- Create: `/Users/newmac/Downloads/Psalms_app/src/components/sections/NewsletterDialog.tsx`

- [ ] **Step 1: Write the component file**

Create `src/components/sections/NewsletterDialog.tsx` with the following exact content:

```tsx
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import {
  subscribe,
  type NewsletterClient,
  type SubscribeResult,
} from './newsletter-actions';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface NewsletterState {
  status: Status;
  alreadySubscribed: boolean;
}

interface NewsletterDialogProps {
  /** The element rendered as the dialog trigger. Passed through DialogTrigger asChild. */
  children: ReactNode;
  /** Subscribe-source label written to the newsletter_subscribers row. */
  source?: string;
}

export function NewsletterDialog({ children, source = 'restoration-cta' }: NewsletterDialogProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<NewsletterState>({ status: 'idle', alreadySubscribed: false });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.status === 'submitting') return;
    setState({ status: 'submitting', alreadySubscribed: false });
    const result: SubscribeResult = await subscribe({
      email,
      source,
      // Supabase's PostgrestFilterBuilder is thenable but not structurally
      // a Promise; the runtime shape matches NewsletterClient so we narrow it
      // here at the boundary. (Same cast as FinalReflectionCta.)
      client: supabase as unknown as NewsletterClient | null,
    });
    if (result.kind === 'success') {
      setState({ status: 'success', alreadySubscribed: result.alreadySubscribed });
      return;
    }
    setState({ status: 'error', alreadySubscribed: false });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // When the dialog closes, reset the form so the next open is fresh.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setEmail('');
      setState({ status: 'idle', alreadySubscribed: false });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(22px, 2.4vw, 28px)',
              lineHeight: 1.25,
            }}
          >
            Receive devotions in your inbox
          </DialogTitle>
          <DialogDescription
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'hsl(var(--mersi-dark) / 0.7)',
            }}
          >
            A short note from us each week.
          </DialogDescription>
        </DialogHeader>

        <div aria-live="polite">
          {state.status === 'success' ? (
            <p
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontStyle: 'italic',
                fontSize: '16px',
                color: 'hsl(var(--mersi-dark) / 0.78)',
                margin: 0,
              }}
            >
              {state.alreadySubscribed
                ? "You're already in."
                : 'Thanks — keep an eye on your inbox.'}
            </p>
          ) : (
            <form
              className="flex items-center gap-2"
              aria-label="Newsletter subscription"
              style={{
                borderBottom: '1px solid hsl(var(--mersi-dark) / 0.22)',
                paddingBottom: '8px',
              }}
              onSubmit={handleSubmit}
            >
              <label htmlFor={inputId} className="sr-only">
                Email address
              </label>
              <input
                id={inputId}
                ref={inputRef}
                type="email"
                name="email"
                required
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state.status === 'submitting'}
                className="flex-1 bg-transparent border-0 outline-0 disabled:opacity-50"
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '13px',
                  color: 'hsl(var(--mersi-dark) / 0.85)',
                }}
              />
              <button
                type="submit"
                disabled={state.status === 'submitting'}
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '10px',
                  letterSpacing: '0.24em',
                  padding: '8px 14px',
                  border: '1px solid hsl(var(--mersi-dark))',
                  background: 'transparent',
                  color: 'hsl(var(--mersi-dark))',
                  textTransform: 'uppercase',
                  cursor: state.status === 'submitting' ? 'not-allowed' : 'pointer',
                  opacity: state.status === 'submitting' ? 0.5 : 1,
                }}
              >
                {state.status === 'submitting' ? '…' : 'Subscribe'}
              </button>
            </form>
          )}
          {state.status === 'error' && (
            <p
              style={{
                marginTop: '8px',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '11px',
                color: 'hsl(var(--mersi-orange))',
              }}
            >
              Try that again?
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Notes on this code (the engineer should not need them — code is self-explanatory — but for safety):

- The `NewsletterClient` cast and `subscribe()` call mirror `FinalReflectionCta.tsx:63-82` so behavior is identical.
- `useId()` produces a unique id per dialog instance so multiple `NewsletterDialog`s on the same page wouldn't collide (defensive — only one renders per detail page today).
- `handleOpenChange` resets `email` and `state` on close. This guarantees the next open starts in `idle`, satisfying spec Test #7.
- Microcopy strings are copy-pasted verbatim from `FinalReflectionCta` for brand consistency.
- Form-field colors use the `--mersi-dark` CSS variable already defined in the app's Tailwind theme (used by `FinalReflectionCta`).
- `<DialogContent>` uses no `className` override — all default chrome (padding, backdrop, close button) is preserved.

- [ ] **Step 2: Verify the file type-checks**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`

Expected: no output (success). The `NewsletterDialog` is exported but not yet referenced — that's fine because it's an exported (not local) symbol; `noUnusedLocals` doesn't apply.

- [ ] **Step 3: Run the full test suite**

Run: `cd /Users/newmac/Downloads/Psalms_app && npm test`

Expected: All 531 tests pass. No new tests are added in this task; the existing `newsletter-actions.test.ts` already covers `subscribe()`.

- [ ] **Step 4: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/components/sections/NewsletterDialog.tsx && git commit -m "$(cat <<'EOF'
feat(newsletter-dialog): self-contained newsletter signup modal

Adds NewsletterDialog, a thin wrapper around the existing Radix Dialog
primitive and the existing subscribe() newsletter action. Renders its
caller-supplied trigger via DialogTrigger asChild, owns form state,
stays open on success to display in-place result microcopy. Wired into
RestorationCTA in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rewrite `RestorationCTA` body — pill + dialog trigger

**Files:**
- Modify: `/Users/newmac/Downloads/Psalms_app/src/components/sections/MoodBoard.tsx` (imports block + the `RestorationCTA` body at lines ~19-64)

The component's name, signature, and props stay the same — only the JSX body of the return statement changes.

- [ ] **Step 1: Add the `NewsletterDialog` import**

Open `src/components/sections/MoodBoard.tsx`. Find the existing import block at lines 1-9:

```tsx
// src/components/sections/MoodBoard.tsx
import { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useIsMobile } from '@/hooks/use-mobile';
import { categoryLabel, projects } from '@/data/projects';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import type { Project } from '@/types';
```

Add a new import line for `NewsletterDialog` immediately after the `PhotoDevelopImage` import so the import block becomes:

```tsx
// src/components/sections/MoodBoard.tsx
import { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useIsMobile } from '@/hooks/use-mobile';
import { categoryLabel, projects } from '@/data/projects';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import { NewsletterDialog } from '@/components/sections/NewsletterDialog';
import type { Project } from '@/types';
```

- [ ] **Step 2: Replace the `RestorationCTA` body**

Find the existing component at lines 19-64. The current code is:

```tsx
function RestorationCTA({ purposeWord, overlayColor }: RestorationCTAProps) {
  return (
    <div
      className="relative flex-shrink-0 h-screen flex items-center justify-center"
      style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${overlayColor} 95%, black 10%)` }}
    >
      <div className="flex flex-col items-center text-center max-w-lg px-8">
        <h3
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[1.15] mb-6"
          style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
        >
          Continue Restoring Your {purposeWord}
        </h3>
        <p className="text-sm text-white/50 tracking-wide leading-relaxed mb-3">
          Take a few moments to pause, reflect, and jot down what God is revealing to you.
        </p>
        <Link
          to="/notepad"
          className="group inline-flex items-center gap-2 text-sm text-white/80 tracking-wide underline underline-offset-4 decoration-white/30 hover:text-white hover:decoration-white/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-sm"
        >
          Open your notepad
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transform-none"
          >
            →
          </span>
        </Link>
        <div className="w-16 h-px bg-white/10 my-8" aria-hidden="true" />
        <p className="text-sm text-white/50 tracking-wide leading-relaxed mb-10">
          Sign up for our newsletter to receive devotions that restores you
        </p>
        <div className="flex w-full max-w-md">
          <input
            type="email"
            placeholder="Your email address"
            className="flex-1 bg-white/10 border border-white/20 text-white text-sm tracking-wide px-5 py-4 placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
          />
          <button className="px-6 py-4 bg-white text-mersi-dark text-sm tracking-wide hover:bg-white/90 transition-colors whitespace-nowrap">
            Subscribe
          </button>
        </div>
      </div>
    </div>
  );
}
```

Replace the entire function body (everything from `function RestorationCTA` through the matching closing `}` on its own line) with:

```tsx
function RestorationCTA({ purposeWord, overlayColor }: RestorationCTAProps) {
  return (
    <div
      className="relative flex-shrink-0 h-screen flex items-center justify-center"
      style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${overlayColor} 95%, black 10%)` }}
    >
      <div className="flex flex-col items-center text-center max-w-lg px-8">
        <h3
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[1.15] mb-6"
          style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
        >
          Continue Restoring Your {purposeWord}
        </h3>
        <p className="text-sm text-white/50 tracking-wide leading-relaxed mb-8">
          Take a few moments to pause, reflect, and jot down what God is revealing to you.
        </p>
        <Link
          to="/notepad"
          className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full border border-white/30 bg-white/5 text-sm text-white/95 tracking-wide hover:bg-white/10 hover:border-white/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 mt-2"
        >
          Open your notepad
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transform-none"
          >
            →
          </span>
        </Link>
        <p className="mt-6 text-xs text-white/40 tracking-wide">
          Or{' '}
          <NewsletterDialog>
            <button
              type="button"
              className="underline underline-offset-4 decoration-white/30 text-white/70 hover:text-white hover:decoration-white/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-sm"
            >
              join the newsletter
            </button>
          </NewsletterDialog>
        </p>
      </div>
    </div>
  );
}
```

Diff intent (for the engineer's mental model):
- Reflection prompt's bottom margin changed from `mb-3` to `mb-8` (the new pill needs more breathing room than the old underlined link did).
- Notepad link's classes flipped from "underlined text" to "bordered pill": removed `underline underline-offset-4 decoration-white/30 hover:text-white hover:decoration-white/70` and `text-white/80`; added `px-8 py-3.5 rounded-full border border-white/30 bg-white/5 hover:bg-white/10 hover:border-white/50` and `text-white/95` and `mt-2`. The arrow span keeps its existing classes verbatim.
- The hairline divider `<div className="w-16 h-px bg-white/10 my-8" aria-hidden="true" />` is removed.
- The newsletter prompt `<p>` and the email form `<div className="flex w-full max-w-md">…</div>` are removed.
- A new `<p className="mt-6 text-xs text-white/40 tracking-wide">` is added containing the literal text "Or " followed by a `<NewsletterDialog>` that wraps an inline `<button type="button">` with the literal text "join the newsletter".

The outer wrapper `<div>` and inner column `<div>` are unchanged.

- [ ] **Step 3: Type-check**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`

Expected: no output (success).

- [ ] **Step 4: Run the full test suite**

Run: `cd /Users/newmac/Downloads/Psalms_app && npm test`

Expected: All 531 tests pass.

- [ ] **Step 5: Build**

Run: `cd /Users/newmac/Downloads/Psalms_app && npm run build`

Expected: build completes with no errors. The pre-existing chunk-size and supabase dynamic-import warnings are unchanged and acceptable.

- [ ] **Step 6: Verify the diff is local to `RestorationCTA`**

Run: `cd /Users/newmac/Downloads/Psalms_app && git diff --stat HEAD -- src/components/sections/MoodBoard.tsx`

Expected: shows `MoodBoard.tsx` changed; insertions roughly equal to deletions plus ~5 (you added 1 import line + restructured the CTA body which is ~5 lines shorter net).

Run: `cd /Users/newmac/Downloads/Psalms_app && grep -c "<RestorationCTA " src/components/sections/MoodBoard.tsx`

Expected: `11`. (Call sites must be untouched.)

Run: `cd /Users/newmac/Downloads/Psalms_app && grep -c "Continue Restoring Your" src/components/sections/MoodBoard.tsx`

Expected: `1`. (Only the line inside the component definition; all 11 inline blocks were eliminated in the prior commit.)

- [ ] **Step 7: Commit**

```bash
cd /Users/newmac/Downloads/Psalms_app && git add src/components/sections/MoodBoard.tsx && git commit -m "$(cat <<'EOF'
feat(restoration-cta): declutter — pill primary + newsletter modal

Rewrites the RestorationCTA body so the notepad invitation is the
single primary action (bordered pill), and the newsletter signup is
demoted to a tiny "Or join the newsletter" trigger that opens the
NewsletterDialog in place. Removes the hairline divider, the inline
newsletter prompt, and the inline email form from this zone — those
live in the dialog now.

The 11 call sites of <RestorationCTA /> are unchanged; the component's
public API (purposeWord, overlayColor) is preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Runtime verification via Playwright

**Files:** none — runtime verification only against the existing dev server at `http://localhost:5173`.

- [ ] **Step 1: Confirm the dev server is running**

Run: `lsof -i :5173 2>&1 | grep LISTEN | head -3`

Expected: a `node` process listening on port 5173. If not, start one with `cd /Users/newmac/Downloads/Psalms_app && npm run dev &` (only kill THIS process at the end, not other dev servers on the machine).

- [ ] **Step 2: Use Playwright MCP to verify the new layout structure**

Navigate to a sample detail page (Peace), then evaluate JS to assert the new DOM structure.

Navigation:

```
mcp__plugin_playwright_playwright__browser_navigate to http://localhost:5173/purpose/restoration1
```

Then evaluate:

```js
() => {
  const heading = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Continue Restoring Your'));
  if (!heading) return { error: 'no heading' };
  const column = heading.parentElement;
  const children = Array.from(column.children).map(c => ({
    tag: c.tagName,
    text: c.textContent?.trim().slice(0, 100),
    role: c.getAttribute('role') || c.getAttribute('href') || c.tagName,
  }));
  // Expected order: H3, P (reflection), A (pill link), P (tiny "Or join the newsletter")
  return { childCount: children.length, children };
}
```

Expected result: `childCount: 4`, and the children in order are:
1. `H3` — "Continue Restoring Your Peace"
2. `P` — "Take a few moments to pause, reflect, and jot down what God is revealing to you."
3. `A` — text starts with "Open your notepad"; `role` field shows `/notepad` (href)
4. `P` — text starts with "Or join the newsletter"

If `childCount` is not 4 or the order is wrong, stop and investigate before continuing.

- [ ] **Step 3: Verify the divider and inline form are gone**

Evaluate:

```js
() => {
  return {
    dividerCount: document.querySelectorAll('div.w-16.h-px.bg-white\\/10[aria-hidden="true"]').length,
    inlineEmailInputCount: Array.from(document.querySelectorAll('input[placeholder="Your email address"]')).length,
    inlineSubscribeButtonCount: Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'Subscribe' && !b.closest('[role="dialog"]')).length,
  };
}
```

Expected: `{ dividerCount: 0, inlineEmailInputCount: 0, inlineSubscribeButtonCount: 0 }`.

The `not closest [role="dialog"]` filter is because the dialog form's Subscribe button is allowed to exist — it's just not in the Zone 7 inline DOM. (Note: until the dialog is opened, the form is not in the DOM at all, so `inlineSubscribeButtonCount: 0` is expected regardless.)

- [ ] **Step 4: Open the newsletter dialog and verify**

Evaluate:

```js
async () => {
  // Find and click the "join the newsletter" trigger button.
  const trigger = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'join the newsletter');
  if (!trigger) return { error: 'trigger not found' };
  trigger.click();
  await new Promise(r => setTimeout(r, 250));

  // Verify a dialog with the expected title appeared, portaled to body.
  const titleEl = Array.from(document.querySelectorAll('[role="dialog"] h2, [role="dialog"] [data-slot="dialog-title"]')).find(el => el.textContent?.includes('Receive devotions in your inbox'));
  const descEl = document.querySelector('[role="dialog"] [data-slot="dialog-description"]');
  const input = document.querySelector('[role="dialog"] input[type="email"]');
  const submit = Array.from(document.querySelectorAll('[role="dialog"] button[type="submit"]')).find(b => b.textContent?.trim() === 'Subscribe');
  return {
    titleText: titleEl?.textContent?.trim(),
    descText: descEl?.textContent?.trim(),
    inputPlaceholder: input?.getAttribute('placeholder'),
    inputAutocomplete: input?.getAttribute('autocomplete'),
    submitExists: !!submit,
    activeElementIsInput: document.activeElement?.tagName === 'INPUT' && document.activeElement.getAttribute('type') === 'email',
  };
}
```

Expected: `titleText: 'Receive devotions in your inbox'`, `descText: 'A short note from us each week.'`, `inputPlaceholder: 'you@email.com'`, `inputAutocomplete: 'email'`, `submitExists: true`, `activeElementIsInput: true` (Radix Dialog auto-focuses the first focusable element, which should be the input).

If `activeElementIsInput` is false, that's a Radix Dialog autofocus behavior issue not directly caused by this change — note it but don't block.

- [ ] **Step 5: Close the dialog and verify reset**

Evaluate:

```js
async () => {
  // Type something into the input first to verify the reset.
  const input = document.querySelector('[role="dialog"] input[type="email"]');
  if (input) {
    input.value = 'test@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // Press Escape to close.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await new Promise(r => setTimeout(r, 400));

  const dialogStillOpen = !!document.querySelector('[role="dialog"]');

  // Re-open and check the input was reset.
  const trigger = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'join the newsletter');
  trigger?.click();
  await new Promise(r => setTimeout(r, 250));
  const reopenedInput = document.querySelector('[role="dialog"] input[type="email"]');
  return {
    dialogClosedOnEscape: !dialogStillOpen,
    inputValueAfterReopen: reopenedInput?.value,
  };
}
```

Expected: `dialogClosedOnEscape: true`, `inputValueAfterReopen: ''` (empty — the dialog reset state on close).

- [ ] **Step 6: Take a screenshot of the new CTA**

The Zone 7 CTA sits past the end of the moodboard's pinned scroll at wide viewports (pre-existing layout issue). To get a clean screenshot, use the same DOM-overlay technique used during the prior PR's runtime check: clone the Zone 7 wrapper into a fixed full-viewport overlay and screenshot.

Resize the browser to a sensible laptop viewport first:

```
mcp__plugin_playwright_playwright__browser_resize width=1440 height=900
```

Re-navigate (so GSAP re-measures): `mcp__plugin_playwright_playwright__browser_navigate to http://localhost:5173/purpose/restoration1`

Then evaluate:

```js
async () => {
  await new Promise(r => setTimeout(r, 1500));
  const heading = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Continue Restoring Your'));
  const wrapper = heading?.closest('.h-screen');
  if (!wrapper) return { error: 'no wrapper' };
  const clone = wrapper.cloneNode(true);
  clone.style.position = 'fixed';
  clone.style.inset = '0';
  clone.style.zIndex = '999999';
  clone.style.width = '100vw';
  clone.style.height = '100vh';

  document.body.style.overflow = 'hidden';
  const hideShell = document.createElement('style');
  hideShell.id = 'preview-shell-hider';
  hideShell.textContent = 'body > *:not(#preview-overlay) { visibility: hidden !important; }';
  document.head.appendChild(hideShell);

  const container = document.createElement('div');
  container.id = 'preview-overlay';
  container.appendChild(clone);
  document.body.appendChild(container);
  await new Promise(r => setTimeout(r, 200));
  return { ok: true };
}
```

Take screenshot:

```
mcp__plugin_playwright_playwright__browser_take_screenshot filename=cta-declutter-preview.png type=png
```

Read the screenshot file and verify visually that:
- The heading reads "Continue Restoring Your Peace"
- The reflection prompt appears beneath it
- A bordered pill containing "Open your notepad →" is visible
- A tiny line "Or join the newsletter" appears beneath the pill
- NO divider, NO inline email input, NO inline Subscribe button

- [ ] **Step 7: Clean up screenshot files and close browser**

Run: `cd /Users/newmac/Downloads/Psalms_app && rm -f cta-declutter-preview.png && rm -rf .playwright-mcp`

Close the browser via `mcp__plugin_playwright_playwright__browser_close`.

Leave the dev server running (do not kill it — only kill processes that this task started).

---

## Self-Review (run after the plan is written)

**Spec coverage check (against `docs/superpowers/specs/2026-05-18-restoration-cta-declutter-design.md`):**

- New `NewsletterDialog` component at the specified path → Task 1 Step 1.
- Component exposes `children` as trigger via `<DialogTrigger asChild>` → Task 1 Step 1 (in the JSX).
- `source` default `'restoration-cta'` → Task 1 Step 1 (props default).
- State machine `idle | submitting | success | error` with `alreadySubscribed` flag → Task 1 Step 1.
- Calls `subscribe()` with `{ email, source, client: supabase as unknown as NewsletterClient | null }` → Task 1 Step 1.
- Modal stays open on success, displays in-place success microcopy → Task 1 Step 1.
- Microcopy matches `FinalReflectionCta` verbatim → Task 1 Step 1.
- Dialog title `"Receive devotions in your inbox"` + description `"A short note from us each week."` → Task 1 Step 1.
- Form fields styled with `--mersi-dark` colors → Task 1 Step 1.
- `useId()` for unique label/input pairing → Task 1 Step 1.
- Reset on close (`handleOpenChange`) → Task 1 Step 1.
- `RestorationCTA` JSX rewrite: heading unchanged, reflection prompt unchanged, pill `<Link>`, tiny `<p>` with `<NewsletterDialog>` trigger → Task 2 Step 2.
- Divider removed, newsletter prompt removed, inline email form removed → Task 2 Step 2 (and verified in Task 3 Step 3).
- `mb-3` → `mb-8` margin change on the reflection prompt → Task 2 Step 2.
- Pill classes spec match → Task 2 Step 2.
- Tiny secondary line copy "Or join the newsletter" → Task 2 Step 2.
- Public API of `RestorationCTA` unchanged → Task 2 Step 6 verifies 11 call sites still exist.
- Accessibility: pill keeps focus-visible ring → Task 2 Step 2; trigger is `<button type="button">` with focus-visible ring → Task 2 Step 2; DialogTitle/Description populated → Task 1 Step 1; sr-only label on input → Task 1 Step 1.
- Reduced motion: pill arrow's translate suppressed via `motion-reduce:transform-none` → Task 2 Step 2.
- Runtime verification of new DOM structure → Task 3 Step 2.
- Runtime verification dialog opens and contains expected content → Task 3 Step 4.
- Runtime verification dialog closes and resets on Escape → Task 3 Step 5.
- Visual screenshot verification → Task 3 Step 6.

All spec requirements have a matching task.

**Placeholder scan:** No "TBD" / "TODO" / "implement later" / "Similar to Task N" references in the plan. Every code-emitting step contains the actual code.

**Type consistency:** `NewsletterDialog` (component name) and its `NewsletterDialogProps` interface are referenced consistently across Tasks 1 and 2. Prop names `children`, `source` match between component declaration and call site. The `RestorationCTA` signature `(purposeWord, overlayColor)` and prop names are unchanged.
