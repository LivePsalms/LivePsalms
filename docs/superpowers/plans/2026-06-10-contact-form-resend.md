# Contact Form → Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `/contact` form to send each submission (name, email, subject) to `support@livepsalms.com` via Resend, then swap the form inline for a first-name-personalized thank-you message.

**Architecture:** A new Supabase Edge Function `contact-message` holds the server-side Resend call; pure validation + payload-building logic lives in `_shared/contact-message.ts` (Vitest-tested, no Deno/network). The browser invokes the function with the Supabase anon key via `supabase.functions.invoke`. `Contact.tsx` is rewired to call it and swap to an inline thank-you on success (the modal is removed).

**Tech Stack:** React 19, Vite, react-router-dom v7, Supabase Edge Functions (Deno), Resend REST API, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-10-contact-form-resend-design.md`

**Conventions for this repo (from project memory):**
- Commit small, reviewed work **directly to `main`**. Stage **only this task's own files** — never `git add .`, never touch unrelated uncommitted churn.
- `npm run lint` has ~100 pre-existing errors in unrelated files. **Lint only the files you touch.**

---

## File Structure

| File | Responsibility |
|------|----------------|
| `supabase/functions/_shared/contact-message.ts` (create) | Pure: `validateContactInput`, `buildResendPayload`, types. No I/O. |
| `supabase/functions/_shared/contact-message.test.ts` (create) | Vitest unit tests for the pure module. |
| `supabase/functions/contact-message/index.ts` (create) | Deno handler: CORS, auth model, reads `RESEND_API_KEY`, calls Resend. |
| `supabase/functions/contact-message/deno.json` (create) | Deno import map (consistency with other functions). |
| `src/components/sections/Contact.tsx` (modify) | Call the function, inline thank-you swap, error state; remove modal. |
| `src/components/sections/Contact.test.tsx` (create) | Component tests: success / error / submitting states. |

---

## Task 1: Pure validation + Resend payload module

**Files:**
- Create: `supabase/functions/_shared/contact-message.ts`
- Test: `supabase/functions/_shared/contact-message.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/contact-message.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateContactInput, buildResendPayload } from './contact-message';

describe('validateContactInput', () => {
  it('accepts a valid trio and trims whitespace', () => {
    const r = validateContactInput({
      name: '  Sarah Lee  ',
      email: ' sarah@example.com ',
      subject: '  Hello there  ',
    });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({
      name: 'Sarah Lee',
      email: 'sarah@example.com',
      subject: 'Hello there',
    });
  });

  it('rejects missing fields with one error each', () => {
    const r = validateContactInput({ name: '', email: '', subject: '' });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('name is required');
    expect(r.errors).toContain('email is required');
    expect(r.errors).toContain('subject is required');
  });

  it('rejects a malformed email', () => {
    const r = validateContactInput({ name: 'Sarah', email: 'not-an-email', subject: 'Hi' });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('email is invalid');
  });

  it('rejects an over-length name', () => {
    const r = validateContactInput({ name: 'a'.repeat(101), email: 'a@b.com', subject: 'Hi' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('name must be at most'))).toBe(true);
  });

  it('rejects an over-length subject', () => {
    const r = validateContactInput({ name: 'Sarah', email: 'a@b.com', subject: 'a'.repeat(2001) });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('subject must be at most'))).toBe(true);
  });

  it('handles null / undefined / non-object input without throwing', () => {
    expect(validateContactInput(null).ok).toBe(false);
    expect(validateContactInput(undefined).ok).toBe(false);
    expect(validateContactInput('nope').ok).toBe(false);
  });
});

describe('buildResendPayload', () => {
  const input = { name: 'Sarah Lee', email: 'sarah@example.com', subject: 'Prayer request' };

  it('sends from contact@ to support@ with reply_to = submitter email', () => {
    const p = buildResendPayload(input);
    expect(p.from).toBe('LivePsalms Contact <contact@livepsalms.com>');
    expect(p.to).toEqual(['support@livepsalms.com']);
    expect(p.reply_to).toBe('sarah@example.com');
  });

  it('prefixes the subject line and includes the message snippet', () => {
    const p = buildResendPayload(input);
    expect(p.subject).toBe('New contact form message: Prayer request');
  });

  it('truncates a long subject snippet with an ellipsis', () => {
    const p = buildResendPayload({ ...input, subject: 'a'.repeat(100) });
    expect(p.subject.startsWith('New contact form message: ')).toBe(true);
    expect(p.subject.endsWith('…')).toBe(true);
  });

  it('includes name, email, and subject in the text body', () => {
    const p = buildResendPayload(input);
    expect(p.text).toContain('Sarah Lee');
    expect(p.text).toContain('sarah@example.com');
    expect(p.text).toContain('Prayer request');
  });

  it('escapes HTML-significant characters in the html body', () => {
    const p = buildResendPayload({ ...input, name: `A<b>&"'` });
    expect(p.html).toContain('A&lt;b&gt;&amp;&quot;&#39;');
    expect(p.html).not.toContain('<b>');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/contact-message.test.ts`
Expected: FAIL — `Failed to resolve import './contact-message'` / module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `supabase/functions/_shared/contact-message.ts`:

```ts
// supabase/functions/_shared/contact-message.ts
//
// Pure validation + Resend payload building for the public contact form.
// No I/O, no Deno APIs — unit-tested under Vitest (Node), the same discipline
// as _shared/process-job.ts. The Deno handler (contact-message/index.ts) wraps
// these with CORS, secret reading, and the actual fetch to Resend.

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  value?: ContactInput;
}

const NAME_MAX = 100;
const SUBJECT_MAX = 2000;
// Pragmatic shape check: non-space + @ + non-space + . + non-space.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactInput(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  const email = typeof obj.email === 'string' ? obj.email.trim() : '';
  const subject = typeof obj.subject === 'string' ? obj.subject.trim() : '';

  if (!name) errors.push('name is required');
  else if (name.length > NAME_MAX) errors.push(`name must be at most ${NAME_MAX} characters`);

  if (!email) errors.push('email is required');
  else if (!EMAIL_RE.test(email)) errors.push('email is invalid');

  if (!subject) errors.push('subject is required');
  else if (subject.length > SUBJECT_MAX) errors.push(`subject must be at most ${SUBJECT_MAX} characters`);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: { name, email, subject } };
}

export interface ResendEmail {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  html: string;
}

const FROM_ADDRESS = 'LivePsalms Contact <contact@livepsalms.com>';
const TO_ADDRESS = 'support@livepsalms.com';
const SUBJECT_SNIPPET_MAX = 80;

// Escape the five HTML-significant chars so submitted text can't inject markup
// into the notification email body.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildResendPayload(input: ContactInput): ResendEmail {
  const snippet =
    input.subject.length > SUBJECT_SNIPPET_MAX
      ? `${input.subject.slice(0, SUBJECT_SNIPPET_MAX)}…`
      : input.subject;

  const text = [
    'New contact form submission from livepsalms.com',
    '',
    `Name:    ${input.name}`,
    `Email:   ${input.email}`,
    '',
    'Subject / Message:',
    input.subject,
  ].join('\n');

  const html = [
    '<h2>New contact form submission</h2>',
    `<p><strong>Name:</strong> ${escapeHtml(input.name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>`,
    '<p><strong>Subject / Message:</strong></p>',
    `<p style="white-space:pre-wrap">${escapeHtml(input.subject)}</p>`,
  ].join('\n');

  return {
    from: FROM_ADDRESS,
    to: [TO_ADDRESS],
    reply_to: input.email,
    subject: `New contact form message: ${snippet}`,
    text,
    html,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/contact-message.test.ts`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/contact-message.ts supabase/functions/_shared/contact-message.test.ts
git commit -m "feat: pure contact-message validation + Resend payload builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Edge Function handler

**Files:**
- Create: `supabase/functions/contact-message/index.ts`
- Create: `supabase/functions/contact-message/deno.json`

> No Vitest test here — this is the Deno runtime glue (imports `https://deno.land/...`, uses `Deno.env`/`serve`). All testable logic was covered in Task 1, matching the repo pattern (`embed-note/index.ts` has no unit test; `_shared/process-job.ts` does). It is verified live in Task 4.

- [ ] **Step 1: Create the import map**

Create `supabase/functions/contact-message/deno.json`:

```json
{
  "imports": {}
}
```

- [ ] **Step 2: Write the handler**

Create `supabase/functions/contact-message/index.ts`:

```ts
// supabase/functions/contact-message/index.ts
//
// Public contact form endpoint. Validates { name, email, subject } and relays
// the message to support@livepsalms.com via Resend, with reply_to set to the
// submitter so replying in the inbox goes straight back to them.
//
// Trust model: deployed with default JWT verification (do NOT pass
// --no-verify-jwt). The browser invokes with the Supabase anon key — a valid
// JWT — identical to every other Edge Function in this project. The handler
// does no privileged DB work; its only side effect is sending one email.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { resolveAllowedOrigins, corsHeaders } from '../_shared/cors.ts';
import { validateContactInput, buildResendPayload } from '../_shared/contact-message.ts';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

serve(async (req) => {
  const cors = corsHeaders(req, resolveAllowedOrigins(Deno.env));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'content-type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return jsonResp({ error: 'RESEND_API_KEY missing' }, 500);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResp({ error: 'bad json' }, 400);
  }

  const validation = validateContactInput(raw);
  if (!validation.ok || !validation.value) {
    return jsonResp({ error: validation.errors.join(', ') }, 400);
  }

  const payload = buildResendPayload(validation.value);

  let resendRes: Response;
  try {
    resendRes = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (_err) {
    return jsonResp({ error: 'failed to reach email provider' }, 502);
  }

  if (!resendRes.ok) {
    // Log the provider detail server-side; return a generic error to the client.
    const detail = await resendRes.text().catch(() => '');
    console.error('Resend error', resendRes.status, detail);
    return jsonResp({ error: 'failed to send message' }, 502);
  }

  return jsonResp({ ok: true });
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/contact-message/index.ts supabase/functions/contact-message/deno.json
git commit -m "feat: contact-message Edge Function (relays to Resend)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Rewire Contact.tsx + component tests

**Files:**
- Modify: `src/components/sections/Contact.tsx`
- Test: `src/components/sections/Contact.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/sections/Contact.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }));

// Keep the button's accessible name simple ("Submit") and avoid pulling in
// the animation internals of the real component.
vi.mock('@/components/ui/text-stagger-hover', () => ({
  TextStaggerHover: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TextStaggerHoverActive: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TextStaggerHoverHidden: () => null,
}));

import { Contact } from './Contact';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fillForm() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sarah Lee' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sarah@example.com' } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'A prayer request' } });
}

describe('Contact', () => {
  it('on success invokes the function and shows a first-name thank-you, hiding the form', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    render(<Contact />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('contact-message', {
        body: { name: 'Sarah Lee', email: 'sarah@example.com', subject: 'A prayer request' },
      }),
    );
    expect(await screen.findByText(/thank you, sarah/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('on error keeps the form populated and shows an error message', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    render(<Contact />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Sarah Lee');
  });

  it('disables the submit button while submitting', async () => {
    let resolveInvoke: (v: unknown) => void = () => {};
    invoke.mockReturnValueOnce(new Promise((r) => { resolveInvoke = r; }));
    render(<Contact />);
    fillForm();
    const btn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(btn);

    await waitFor(() => expect(btn).toBeDisabled());
    resolveInvoke({ data: { ok: true }, error: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/sections/Contact.test.tsx`
Expected: FAIL — the current `Contact.tsx` never calls `supabase.functions.invoke` (so the success assertion times out / invoke not called), and there is no "something went wrong" text.

- [ ] **Step 3: Rewrite `Contact.tsx`**

Replace the **entire contents** of `src/components/sections/Contact.tsx` with:

```tsx
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TextStaggerHover,
  TextStaggerHoverActive,
  TextStaggerHoverHidden,
} from '@/components/ui/text-stagger-hover';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const FIELD_LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '10px',
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: 'hsl(var(--mersi-dark) / 0.55)',
  marginBottom: '6px',
  display: 'block',
};

const FIELD_INPUT_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '14px',
  color: 'hsl(var(--mersi-dark))',
  width: '100%',
  background: 'transparent',
  border: 0,
  outline: 0,
  padding: '6px 0 10px',
  borderBottom: '1px solid hsl(var(--mersi-dark) / 0.22)',
};

const EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '11px',
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: 'hsl(var(--mersi-dark) / 0.6)',
  margin: '0 0 24px',
};

const SERIF_HEADING_STYLE: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontWeight: 400,
  fontStyle: 'italic',
  fontSize: 'clamp(28px, 3.6vw, 40px)',
  lineHeight: 1.3,
  color: 'hsl(var(--mersi-dark))',
  margin: '0 auto 40px',
  maxWidth: '560px',
};

// First token of the trimmed name, used to personalize the thank-you message.
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [submittedFirstName, setSubmittedFirstName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    try {
      if (!supabase) throw new Error('messaging unavailable');
      const { error } = await supabase.functions.invoke('contact-message', {
        body: { name, email, subject },
      });
      if (error) throw error;
      setSubmittedFirstName(firstNameOf(name));
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const isSubmitting = status === 'submitting';

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 md:px-8 py-32"
      style={{ background: 'var(--app-bg)' }}
      aria-label="Contact"
    >
      <div className="max-w-[640px] w-full text-center">
        <p style={EYEBROW_STYLE}>Contact</p>

        {status === 'success' ? (
          <div aria-live="polite">
            <h1 style={SERIF_HEADING_STYLE}>Thank you, {submittedFirstName}.</h1>
            <p
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: '18px',
                lineHeight: 1.5,
                color: 'hsl(var(--mersi-dark) / 0.78)',
                margin: '0 auto',
                maxWidth: '480px',
              }}
            >
              We will reach out to you as soon as we can. God bless.
            </p>
          </div>
        ) : (
          <>
            <h1 style={SERIF_HEADING_STYLE}>
              Feel free to reach out to us with any Prayer Request or any questions.
              We'd love to hear from you and any feedback you have.
            </h1>

            <form
              onSubmit={handleSubmit}
              className="w-full max-w-[480px] mx-auto text-left flex flex-col gap-6"
              aria-label="Contact form"
            >
              <div>
                <label htmlFor="contact-name" style={FIELD_LABEL_STYLE}>
                  Name
                </label>
                <input
                  id="contact-name"
                  ref={nameInputRef}
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  style={FIELD_INPUT_STYLE}
                />
              </div>

              <div>
                <label htmlFor="contact-email" style={FIELD_LABEL_STYLE}>
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  style={FIELD_INPUT_STYLE}
                />
              </div>

              <div>
                <label htmlFor="contact-subject" style={FIELD_LABEL_STYLE}>
                  Subject
                </label>
                <textarea
                  id="contact-subject"
                  name="subject"
                  required
                  rows={4}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    ...FIELD_INPUT_STYLE,
                    resize: 'vertical',
                    minHeight: '96px',
                  }}
                />
              </div>

              {status === 'error' && (
                <p
                  role="alert"
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '12px',
                    color: 'hsl(var(--mersi-dark) / 0.8)',
                    margin: 0,
                  }}
                >
                  Something went wrong sending your message. Please try again.
                </p>
              )}

              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '10px',
                    letterSpacing: '0.24em',
                    padding: '12px 28px',
                    border: '1px solid hsl(var(--mersi-dark))',
                    background: 'transparent',
                    color: 'hsl(var(--mersi-dark))',
                    textTransform: 'uppercase',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.5 : 1,
                  }}
                >
                  {isSubmitting ? (
                    '…'
                  ) : (
                    <TextStaggerHover as="span">
                      <TextStaggerHoverActive animation="blur">Submit</TextStaggerHoverActive>
                      <TextStaggerHoverHidden animation="blur">Submit</TextStaggerHoverHidden>
                    </TextStaggerHover>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
```

> Note: this removes the `Dialog`/modal imports and markup entirely (the four `@/components/ui/dialog` imports are gone).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/sections/Contact.test.tsx`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Lint the touched files**

Run: `npx eslint src/components/sections/Contact.tsx src/components/sections/Contact.test.tsx`
Expected: no errors. (Lint only these files — the repo has unrelated pre-existing lint errors.)

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/Contact.tsx src/components/sections/Contact.test.tsx
git commit -m "feat: wire contact form to Resend with inline thank-you

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Deploy + live verification

> No code; this deploys the function and verifies the end-to-end flow. Prerequisite: the Supabase CLI is installed and the project is linked (`supabase/.temp/linked-project.json` exists).

- [ ] **Step 1: Confirm the Resend secret name**

Run: `supabase secrets list`
Expected: a `RESEND_API_KEY` entry is listed.
- If the integration named it differently (e.g. `RESEND_KEY`), update the `Deno.env.get('RESEND_API_KEY')` line in `supabase/functions/contact-message/index.ts` to match, then re-run Task 2 Step 3's commit with an amended message.

- [ ] **Step 2: Deploy the function**

Run: `supabase functions deploy contact-message --use-api --no-verify-jwt`
Expected: "Deployed Functions … contact-message" success output.

> **Two corrections discovered at deploy time:**
> 1. **No Docker** — `supabase functions deploy` bundles with Docker by default. If Docker Desktop isn't running, the deploy hangs. Use `--use-api` to bundle server-side without Docker.
> 2. **Public endpoint, `verify_jwt = false`** — this project's client key is a **non-JWT publishable key** (`sb_publishable_…`). The default JWT gate 401s it, so the anonymous form can't submit. Pin `verify_jwt = false` for `contact-message` in `supabase/config.toml` and deploy with `--no-verify-jwt`. (The original trust-model note in Task 2 — "default JWT verification, anon key works" — was wrong for this project.)

- [ ] **Step 3: Confirm the production CORS allow-list**

The function reads `ALLOWED_ORIGINS` (comma-separated) for its CORS allow-list; unset falls back to localhost only. For the deployed site to call it from the browser, ensure the production origin is included:

Run: `supabase secrets list` and check `ALLOWED_ORIGINS`.
- If it does not include the production origin (e.g. `https://livepsalms.com`), set it (preserving any existing origins):
  `supabase secrets set ALLOWED_ORIGINS=https://livepsalms.com,https://www.livepsalms.com`
- Local dev (`localhost:5173`) works via the built-in fallback with `ALLOWED_ORIGINS` unset, but once it is set it must list every origin you need, including localhost during testing.

- [ ] **Step 4: Verify in the live preview**

Using the preview server (port 5173):
1. Navigate to `/contact`.
2. Fill Name = a test name, Email = an address you can check, Subject = a short message.
3. Submit.
4. Confirm the form is replaced inline by "Thank you, <FirstName>. We will reach out to you as soon as we can. God bless."
5. Confirm an email arrives at `support@livepsalms.com`, sent from `contact@livepsalms.com`, and that hitting reply addresses the submitter's email.
6. Check the function logs for errors: `supabase functions logs contact-message`.

- [ ] **Step 5: Negative check (optional)**

Temporarily submit with the network throttled/offline (or point at a non-deployed function) and confirm the form stays put and shows "Something went wrong sending your message. Please try again."

---

## Self-Review

- **Spec coverage:**
  - Edge Function `contact-message` → Task 2. ✓
  - Pure validation + payload (`_shared/contact-message.ts`) → Task 1. ✓
  - from/to/reply_to wiring → Task 1 (`buildResendPayload`) + tests. ✓
  - `RESEND_API_KEY` read + missing-key 500 → Task 2; secret-name confirmation → Task 4 Step 1. ✓
  - Default JWT verification / anon-key invocation → Task 2 trust-model comment + Task 4 Step 2. ✓
  - Inline thank-you swap, first-name personalization, modal removed → Task 3. ✓
  - Error state keeps form + message → Task 3 tests + impl. ✓
  - Vitest unit + component tests → Tasks 1 & 3. ✓
  - CORS production origin → Task 4 Step 3. ✓ (covers the spec's reliance on `_shared/cors.ts`.)
- **Placeholder scan:** No TBD/TODO/"handle edge cases"; all steps carry complete code or exact commands.
- **Type consistency:** `ContactInput`, `ValidationResult`, `ResendEmail`, `validateContactInput`, `buildResendPayload` names are identical across Task 1 (def), Task 1 tests, and Task 2 (import). Client body `{ name, email, subject }` matches `validateContactInput`'s expected keys. `firstNameOf` defined and used in Task 3; asserted via `/thank you, sarah/i` in the test.
