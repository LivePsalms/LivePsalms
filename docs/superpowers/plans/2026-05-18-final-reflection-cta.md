# Final Reflection CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new section to the bottom of the home route (`/`) that reopens the journal thread with an "Open your notepad →" CTA and includes a Supabase-backed newsletter subscription form.

**Architecture:** Single React section component (`FinalReflectionCta`) that replaces the empty `h-[20vh] md:h-[25vh]` spacer in `App.tsx`. Newsletter writes go through a pure, injectable `subscribe()` function that talks to a new `public.newsletter_subscribers` Supabase table (insert-only RLS). Visual motion mirrors the existing `PurposeGrid` scroll-fade pattern. All copy uses Cormorant Garamond, single family.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, GSAP + ScrollTrigger, Supabase (`@supabase/supabase-js`), React Router, Vitest (Node environment, no jsdom — pure-function tests only).

**Spec:** [docs/superpowers/specs/2026-05-18-final-reflection-cta-design.md](../specs/2026-05-18-final-reflection-cta-design.md)

---

## File Structure

- **Create:** `supabase/migrations/005_newsletter_subscribers.sql` — table + RLS policy.
- **Create:** `src/components/sections/newsletter-actions.ts` — pure `isValidEmail()` + `subscribe()`.
- **Create:** `src/components/sections/newsletter-actions.test.ts` — Vitest unit tests for the above.
- **Create:** `src/components/sections/FinalReflectionCta.tsx` — the section component (visual + form state machine + scroll motion).
- **Modify:** `src/App.tsx` — replace the `h-[20vh] md:h-[25vh]` spacer with the new component import + element.

---

## Task 1: Supabase migration

**Files:**
- Create: `supabase/migrations/005_newsletter_subscribers.sql`

- [ ] **Step 1: Create the migration file**

Write `supabase/migrations/005_newsletter_subscribers.sql` with this exact content:

```sql
-- Newsletter subscribers: insert-only from the client. No SELECT/UPDATE/DELETE
-- policies — reading is service-role only. Unique email constraint means
-- duplicate submissions surface as Postgres 23505, which the client maps to
-- a friendly "you're already in" success state.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now(),
  unique (email)
);

alter table public.newsletter_subscribers enable row level security;

create policy "Anyone can subscribe"
  on public.newsletter_subscribers for insert
  to anon, authenticated
  with check (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/005_newsletter_subscribers.sql
git commit -m "feat(newsletter): add newsletter_subscribers table + insert-only RLS"
```

> **Note:** Applying the migration to the actual Supabase project is a manual step outside this plan. The repo only tracks the migration SQL; the engineer running this will need to push it via `supabase db push` (or apply it through the Supabase dashboard) before the Subscribe button works against the live backend. Local Vitest tests don't require the migration to be applied.

---

## Task 2: Pure `isValidEmail()`

**Files:**
- Create: `src/components/sections/newsletter-actions.ts`
- Test: `src/components/sections/newsletter-actions.test.ts`

- [ ] **Step 1: Write the failing tests for `isValidEmail`**

Create `src/components/sections/newsletter-actions.test.ts` with this content:

```ts
import { describe, it, expect } from 'vitest';
import { isValidEmail } from './newsletter-actions';

describe('isValidEmail', () => {
  it('returns true for a normal address', () => {
    expect(isValidEmail('hello@example.com')).toBe(true);
  });

  it('returns true for an address with a subdomain', () => {
    expect(isValidEmail('user.name@mail.example.co')).toBe(true);
  });

  it('returns true after trimming surrounding whitespace', () => {
    expect(isValidEmail('  hello@example.com  ')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('returns false for whitespace-only input', () => {
    expect(isValidEmail('   ')).toBe(false);
  });

  it('returns false for a bare word', () => {
    expect(isValidEmail('foo')).toBe(false);
  });

  it('returns false when the local part is missing', () => {
    expect(isValidEmail('@bar.com')).toBe(false);
  });

  it('returns false when the @ is missing', () => {
    expect(isValidEmail('foobar.com')).toBe(false);
  });

  it('returns false when the TLD is missing', () => {
    expect(isValidEmail('foo@bar')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- newsletter-actions`

Expected: All 9 tests fail with an import error or "isValidEmail is not a function".

- [ ] **Step 3: Implement `isValidEmail`**

Create `src/components/sections/newsletter-actions.ts` with this content:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- newsletter-actions`

Expected: All 9 `isValidEmail` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/newsletter-actions.ts src/components/sections/newsletter-actions.test.ts
git commit -m "feat(newsletter): add isValidEmail helper"
```

---

## Task 3: `subscribe()` happy path

**Files:**
- Modify: `src/components/sections/newsletter-actions.ts`
- Modify: `src/components/sections/newsletter-actions.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/components/sections/newsletter-actions.test.ts`:

```ts
import { subscribe } from './newsletter-actions';
import type { NewsletterClient, NewsletterInsertResult } from './newsletter-actions';

function makeFakeClient(result: NewsletterInsertResult): {
  client: NewsletterClient;
  inserts: Array<{ table: string; row: Record<string, unknown> }>;
} {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client: NewsletterClient = {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return result;
      },
    }),
  };
  return { client, inserts };
}

describe('subscribe', () => {
  it('returns success when the client resolves with no error', async () => {
    const { client, inserts } = makeFakeClient({ error: null });
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'success', alreadySubscribed: false });
    expect(inserts).toEqual([
      {
        table: 'newsletter_subscribers',
        row: { email: 'hello@example.com', source: 'home-final-cta' },
      },
    ]);
  });

  it('trims whitespace before inserting', async () => {
    const { client, inserts } = makeFakeClient({ error: null });
    await subscribe({
      email: '  hello@example.com  ',
      source: 'home-final-cta',
      client,
    });
    expect(inserts[0]?.row.email).toBe('hello@example.com');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- newsletter-actions`

Expected: The two new `subscribe` tests fail — `subscribe` is not exported yet.

- [ ] **Step 3: Implement `subscribe` (happy path only for now)**

Replace the content of `src/components/sections/newsletter-actions.ts` with:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}

export type NewsletterInsertResult = {
  error: { code?: string; message?: string } | null;
};

export interface NewsletterClient {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<NewsletterInsertResult>;
  };
}

export type SubscribeResult =
  | { kind: 'success'; alreadySubscribed: boolean }
  | { kind: 'invalid-email' }
  | { kind: 'no-client' }
  | { kind: 'network-error' };

export interface SubscribeInput {
  email: string;
  source?: string;
  client: NewsletterClient | null;
}

export async function subscribe(input: SubscribeInput): Promise<SubscribeResult> {
  const email = input.email.trim();
  const { error } = await input.client!
    .from('newsletter_subscribers')
    .insert({ email, source: input.source ?? null });
  if (error) {
    return { kind: 'network-error' };
  }
  return { kind: 'success', alreadySubscribed: false };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- newsletter-actions`

Expected: All `isValidEmail` tests still pass + the two new `subscribe` happy-path tests pass. The full and final implementation of `subscribe` lands in Task 4 — the version here is intentionally incomplete (it dereferences `client!` without a null check; that's covered in Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/newsletter-actions.ts src/components/sections/newsletter-actions.test.ts
git commit -m "feat(newsletter): add subscribe() happy path"
```

---

## Task 4: `subscribe()` error branches

**Files:**
- Modify: `src/components/sections/newsletter-actions.ts`
- Modify: `src/components/sections/newsletter-actions.test.ts`

- [ ] **Step 1: Add the failing tests**

Append inside the `describe('subscribe', …)` block in `src/components/sections/newsletter-actions.test.ts`:

```ts
  it('returns invalid-email when the email fails validation', async () => {
    const { client } = makeFakeClient({ error: null });
    const result = await subscribe({
      email: 'not-an-email',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'invalid-email' });
  });

  it('returns no-client when client is null', async () => {
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client: null,
    });
    expect(result).toEqual({ kind: 'no-client' });
  });

  it('maps Postgres unique-violation 23505 to alreadySubscribed: true', async () => {
    const { client } = makeFakeClient({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'success', alreadySubscribed: true });
  });

  it('returns network-error for any other Supabase error', async () => {
    const { client } = makeFakeClient({
      error: { code: '08000', message: 'connection exception' },
    });
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'network-error' });
  });

  it('returns network-error when the client throws', async () => {
    const client: NewsletterClient = {
      from: () => ({
        insert: async () => {
          throw new Error('network down');
        },
      }),
    };
    const result = await subscribe({
      email: 'hello@example.com',
      source: 'home-final-cta',
      client,
    });
    expect(result).toEqual({ kind: 'network-error' });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- newsletter-actions`

Expected: The five new tests fail. The `invalid-email` test crashes on the unguarded `client!.from(...)` call; the `no-client` test crashes for the same reason; the `23505` test returns `network-error` instead of `success`; the network-down test surfaces an uncaught throw.

- [ ] **Step 3: Update `subscribe()` to cover all branches**

Replace the body of `subscribe()` in `src/components/sections/newsletter-actions.ts` with:

```ts
export async function subscribe(input: SubscribeInput): Promise<SubscribeResult> {
  const email = input.email.trim();
  if (!isValidEmail(email)) {
    return { kind: 'invalid-email' };
  }
  if (!input.client) {
    return { kind: 'no-client' };
  }
  try {
    const { error } = await input.client
      .from('newsletter_subscribers')
      .insert({ email, source: input.source ?? null });
    if (error) {
      if (error.code === '23505') {
        return { kind: 'success', alreadySubscribed: true };
      }
      return { kind: 'network-error' };
    }
    return { kind: 'success', alreadySubscribed: false };
  } catch {
    return { kind: 'network-error' };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- newsletter-actions`

Expected: All tests in the file pass (9 `isValidEmail` + 7 `subscribe` = 16 total).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/newsletter-actions.ts src/components/sections/newsletter-actions.test.ts
git commit -m "feat(newsletter): cover subscribe() error branches"
```

---

## Task 5: `FinalReflectionCta` static visual

Builds the section's DOM and styling with the form in `idle` state only. No submit wiring yet — that lands in Task 6. No scroll motion yet — that lands in Task 7.

**Files:**
- Create: `src/components/sections/FinalReflectionCta.tsx`

- [ ] **Step 1: Create the component file**

Create `src/components/sections/FinalReflectionCta.tsx` with this content:

```tsx
import { Link } from 'react-router-dom';

export function FinalReflectionCta() {
  return (
    <section
      className="final-reflection-cta py-32 md:py-40 px-4 md:px-8"
      style={{ background: 'var(--app-bg)' }}
      aria-label="Final reflection"
    >
      <div className="max-w-[720px]">
        <p
          className="text-mersi-dark"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 400,
            fontStyle: 'italic',
            fontSize: 'clamp(28px, 4vw, 44px)',
            lineHeight: 1.22,
            margin: '0 0 14px',
          }}
        >
          God's been revealing things to you all along.
        </p>
        <p
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 400,
            fontSize: 'clamp(18px, 2vw, 22px)',
            lineHeight: 1.45,
            color: 'hsla(var(--mersi-dark), 0.72)',
            maxWidth: '600px',
            margin: '0 0 28px',
          }}
        >
          In the verses you underlined, the prayers you wrote. Add your notes and journals here and see what He's been revealing about you — to you.
        </p>
        <Link
          to="/notepad"
          aria-label="Open your notepad"
          className="final-reflection-notepad-cta"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: '18px',
            color: 'hsl(var(--mersi-dark))',
            borderBottom: '1px solid currentColor',
            paddingBottom: '2px',
            textDecoration: 'none',
          }}
        >
          Open your notepad →
        </Link>

        <div
          className="final-reflection-newsletter flex flex-col gap-4 md:flex-row md:items-end md:gap-6"
          style={{
            marginTop: '48px',
            paddingTop: '24px',
            borderTop: '1px solid hsla(var(--mersi-dark), 0.22)',
          }}
        >
          <p
            className="flex-1"
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'hsla(var(--mersi-dark), 0.7)',
              margin: 0,
            }}
          >
            Subscribe to our newsletter for more devotions and deep dives into God's word.
          </p>
          <form
            className="flex-[1.2] flex items-center gap-2"
            aria-label="Newsletter subscription"
            style={{
              borderBottom: '1px solid hsla(var(--mersi-dark), 0.22)',
              paddingBottom: '8px',
            }}
            onSubmit={(e) => e.preventDefault()}
          >
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              name="email"
              required
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              className="flex-1 bg-transparent border-0 outline-0"
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '13px',
                color: 'hsla(var(--mersi-dark), 0.85)',
              }}
            />
            <button
              type="submit"
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '10px',
                letterSpacing: '0.24em',
                padding: '8px 14px',
                border: '1px solid hsl(var(--mersi-dark))',
                background: 'transparent',
                color: 'hsl(var(--mersi-dark))',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into `App.tsx` temporarily so you can see it**

Open `src/App.tsx`. Add this import near the other section imports (after `PurposeGrid`):

```tsx
import { FinalReflectionCta } from '@/components/sections/FinalReflectionCta';
```

Find this block (around line 159-161):

```tsx
{!hideFooter && (
  <div className="h-[20vh] md:h-[25vh]" style={{ background: 'var(--app-bg)' }} />
)}
```

Replace it with:

```tsx
{!hideFooter && <FinalReflectionCta />}
```

- [ ] **Step 3: Manually verify the visual**

Run: `npm run dev`

Open the URL printed by Vite (typically `http://localhost:5173`). Scroll to the bottom of the home route. You should see:
- The italic headline "God's been revealing things to you all along." on the left, at the page's left gutter, inside a 720px column.
- The supporting paragraph below, at softer ink, narrower than the column.
- The italic underlined "Open your notepad →" CTA below the paragraph.
- A hairline divider below that.
- A small sans label on the left and an email input + Subscribe button on the right.
- Clicking the CTA navigates to `/notepad`.
- The form submits (page does not reload) but does nothing visible — this is expected; wiring lands in Task 6.

Resize to mobile width (≤768px): the newsletter label should stack above the form.

- [ ] **Step 4: Lint and typecheck**

Run: `npm run lint && npm run build`

Expected: No lint errors, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/FinalReflectionCta.tsx src/App.tsx
git commit -m "feat(final-reflection): add section with notepad CTA and newsletter form (static)"
```

---

## Task 6: Wire form submit + state machine

**Files:**
- Modify: `src/components/sections/FinalReflectionCta.tsx`

- [ ] **Step 1: Replace the file with the state-machine version**

Replace the entire content of `src/components/sections/FinalReflectionCta.tsx` with:

```tsx
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { subscribe, type SubscribeResult } from './newsletter-actions';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface NewsletterState {
  status: Status;
  alreadySubscribed: boolean;
}

export function FinalReflectionCta() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<NewsletterState>({
    status: 'idle',
    alreadySubscribed: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.status === 'submitting') return;
    setState({ status: 'submitting', alreadySubscribed: false });
    const result: SubscribeResult = await subscribe({
      email,
      source: 'home-final-cta',
      client: supabase,
    });
    if (result.kind === 'success') {
      setState({ status: 'success', alreadySubscribed: result.alreadySubscribed });
      return;
    }
    setState({ status: 'error', alreadySubscribed: false });
    // Refocus the input so the user can correct and retry.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <section
      className="final-reflection-cta py-32 md:py-40 px-4 md:px-8"
      style={{ background: 'var(--app-bg)' }}
      aria-label="Final reflection"
    >
      <div className="max-w-[720px]">
        <p
          className="text-mersi-dark"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 400,
            fontStyle: 'italic',
            fontSize: 'clamp(28px, 4vw, 44px)',
            lineHeight: 1.22,
            margin: '0 0 14px',
          }}
        >
          God's been revealing things to you all along.
        </p>
        <p
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 400,
            fontSize: 'clamp(18px, 2vw, 22px)',
            lineHeight: 1.45,
            color: 'hsla(var(--mersi-dark), 0.72)',
            maxWidth: '600px',
            margin: '0 0 28px',
          }}
        >
          In the verses you underlined, the prayers you wrote. Add your notes and journals here and see what He's been revealing about you — to you.
        </p>
        <Link
          to="/notepad"
          aria-label="Open your notepad"
          className="final-reflection-notepad-cta"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: '18px',
            color: 'hsl(var(--mersi-dark))',
            borderBottom: '1px solid currentColor',
            paddingBottom: '2px',
            textDecoration: 'none',
          }}
        >
          Open your notepad →
        </Link>

        <div
          className="final-reflection-newsletter flex flex-col gap-4 md:flex-row md:items-end md:gap-6"
          style={{
            marginTop: '48px',
            paddingTop: '24px',
            borderTop: '1px solid hsla(var(--mersi-dark), 0.22)',
          }}
        >
          <p
            className="flex-1"
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'hsla(var(--mersi-dark), 0.7)',
              margin: 0,
            }}
          >
            Subscribe to our newsletter for more devotions and deep dives into God's word.
          </p>

          <div className="flex-[1.2]" aria-live="polite">
            {state.status === 'success' ? (
              <p
                style={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: '16px',
                  color: 'hsla(var(--mersi-dark), 0.78)',
                  margin: 0,
                }}
              >
                {state.alreadySubscribed
                  ? "You're already in."
                  : 'Thanks — keep an eye on your inbox.'}
              </p>
            ) : (
              <>
                <form
                  className="flex items-center gap-2"
                  aria-label="Newsletter subscription"
                  style={{
                    borderBottom: '1px solid hsla(var(--mersi-dark), 0.22)',
                    paddingBottom: '8px',
                  }}
                  onSubmit={handleSubmit}
                >
                  <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="newsletter-email"
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
                      color: 'hsla(var(--mersi-dark), 0.85)',
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
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Lint and typecheck**

Run: `npm run lint && npm run build`

Expected: No errors.

- [ ] **Step 3: Manually verify the form behavior**

Run: `npm run dev`. Scroll to the new section.

Try each path (you'll need the migration applied to the live Supabase project for the success path; otherwise expect the error state):

| Input | Expected |
|---|---|
| Submit empty form | Browser's native required-field popup; nothing else happens. |
| Submit `foo` | Browser native email-validation popup (because `type="email"`); nothing else happens. |
| Submit `foo@bar` | Browser native email-validation popup. |
| Submit a fresh valid email (migration applied) | Button briefly shows `…`, then form replaces with the italic "Thanks — keep an eye on your inbox." |
| Submit the same email a second time | Button briefly shows `…`, then form replaces with the italic "You're already in." |
| Submit a valid email with the Supabase project unreachable (or env vars missing) | Form returns to idle with a small orange "Try that again?" line under the input; input is refocused. |

The native HTML5 validation catches `foo` / `foo@bar` before our submit handler runs. The `isValidEmail` check in `subscribe()` is the belt-and-suspenders backstop and is still exercised by the unit tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/FinalReflectionCta.tsx
git commit -m "feat(final-reflection): wire subscribe form to Supabase"
```

---

## Task 7: Scroll-reveal motion + reduced-motion fallback

**Files:**
- Modify: `src/components/sections/FinalReflectionCta.tsx`

- [ ] **Step 1: Add the GSAP scroll-reveal effect**

Open `src/components/sections/FinalReflectionCta.tsx`.

Change the imports at the top from:

```tsx
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { subscribe, type SubscribeResult } from './newsletter-actions';
```

…to:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { supabase } from '@/lib/supabase';
import { subscribe, type SubscribeResult } from './newsletter-actions';

gsap.registerPlugin(ScrollTrigger);
```

Inside the `FinalReflectionCta` function body, just below the existing `inputRef` line, add:

```tsx
const sectionRef = useRef<HTMLElement>(null);

useEffect(() => {
  const section = sectionRef.current;
  if (!section) return;

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const ctx = gsap.context(() => {
    gsap.fromTo(
      section,
      { opacity: 0, y: 30, filter: 'blur(8px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        ease: 'power2.out',
        duration: 1,
        scrollTrigger: {
          trigger: section,
          start: 'top 90%',
          end: 'top 30%',
          scrub: 5,
          invalidateOnRefresh: true,
        },
      },
    );
  }, section);

  return () => ctx.revert();
}, []);
```

Then update the `<section …>` opening tag from:

```tsx
<section
  className="final-reflection-cta py-32 md:py-40 px-4 md:px-8"
  style={{ background: 'var(--app-bg)' }}
  aria-label="Final reflection"
>
```

…to:

```tsx
<section
  ref={sectionRef}
  className="final-reflection-cta py-32 md:py-40 px-4 md:px-8"
  style={{ background: 'var(--app-bg)' }}
  aria-label="Final reflection"
>
```

- [ ] **Step 2: Lint and typecheck**

Run: `npm run lint && npm run build`

Expected: No errors.

- [ ] **Step 3: Manually verify the motion**

Run: `npm run dev`. Reload the home route at the top, then scroll down slowly toward the new section.

- The section should fade from `opacity: 0 / y: 30 / blur(8px)` to fully resolved as it enters the viewport (`top 90%` → `top 30%`), tied to scroll position.
- Reload, scroll quickly past it, then scroll back up — the reveal should reverse cleanly.
- Toggle "Reduce motion" in macOS System Settings → Accessibility → Display, reload — the section should appear without any fade or transform on mount.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/FinalReflectionCta.tsx
git commit -m "feat(final-reflection): add scrubbed scroll reveal + reduced-motion fallback"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: All tests pass, including the 16 in `newsletter-actions.test.ts`.

- [ ] **Step 2: Run lint + build**

Run: `npm run lint && npm run build`

Expected: No errors.

- [ ] **Step 3: Cross-browser manual check**

Open the dev server in the browser you normally test with. Confirm on the home route:

- [ ] Section renders at the bottom, above the footer reveal.
- [ ] Footer's clip-path "lift" reveal still works as expected — the new section should disappear under the rising footer as you scroll past it.
- [ ] Notepad CTA navigates correctly.
- [ ] Subscribe form: idle → submitting → success → "You're already in." on resubmit.
- [ ] Tab order: notepad CTA → email input → subscribe button.
- [ ] Mobile (≤768px): newsletter label stacks above the form; column still left-aligned.
- [ ] The section does NOT appear on `/notepad`, `/login`, `/welcome`, `/profile`, `/purpose`, or `/purpose/:id` (gated by `!hideFooter`).

- [ ] **Step 4: Confirm migration is staged / applied**

The migration file `supabase/migrations/005_newsletter_subscribers.sql` is committed. Apply it to your live Supabase project before considering this shippable:

```bash
# If using the Supabase CLI:
supabase db push
```

Otherwise, paste the SQL into the Supabase dashboard SQL editor.

- [ ] **Step 5: No final commit needed**

If everything above passes there is nothing left to commit — Tasks 1–7 each ended in their own commit. Verify with:

```bash
git log --oneline -8
```

Expected: 7 commits matching the messages from Tasks 1–7.
