# Contact Form → Resend — Design

**Date:** 2026-06-10
**Status:** Approved (design), pending implementation plan

## Goal

Wire the existing `/contact` form to actually deliver messages. When a visitor
submits their **name**, **email**, and **subject**, an email is sent to the
LivePsalms support inbox via Resend. On success the form is replaced **inline**
(same route, no modal, no navigation) with an appreciative, first-name
personalized message telling them we'll respond as soon as we can.

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Backend | New Supabase Edge Function `contact-message` (matches existing `embed-note` / `lamplight-generate` pattern) |
| Email provider | Resend (API key already in Supabase secrets via the Supabase↔Resend integration) |
| Destination (`to`) | `support@livepsalms.com` |
| Sender (`from`) | `contact@livepsalms.com` (domain `livepsalms.com` is verified in Resend) |
| `reply_to` | The submitter's email from the form — replies in the inbox go straight back to them |
| Confirmation UX | **Inline swap** — replace the form with the thank-you message on the same `/contact` route. No new route, no modal. |
| Personalization | Greet by **first name**: `name.trim().split(/\s+/)[0]` |
| Extra scope | None. No DB persistence, no auto-reply to sender. (YAGNI) |

## Architecture & data flow

```
Contact.tsx (browser)
   │  supabase.functions.invoke('contact-message', { body: { name, email, subject } })
   ▼
supabase/functions/contact-message/index.ts   (Deno Edge Function)
   │  • CORS via _shared/cors.ts (resolveAllowedOrigins + corsHeaders)
   │  • validate + build payload via _shared/contact-message.ts (pure, testable)
   │  • POST https://api.resend.com/emails  (Authorization: Bearer RESEND_API_KEY)
   ▼
Resend  →  email delivered to support@livepsalms.com
            from: contact@livepsalms.com,  reply_to: <submitter's email>
```

Two pieces:

1. A new **`contact-message` Edge Function** that holds the server-side Resend call.
2. The **rewired `Contact.tsx`** with an inline thank-you swap.

Pure logic (validation + payload building) is extracted into
`_shared/contact-message.ts` so it unit-tests without Deno or network — same
discipline as `_shared/process-job.ts`.

## Component 1 — Edge Function

### `supabase/functions/_shared/contact-message.ts` (pure)

- `validateContactInput(raw): { ok: boolean; errors: string[]; value?: ContactInput }`
  - `name`: trimmed, required, 1–100 chars.
  - `email`: trimmed, required, basic email-format check.
  - `subject`: trimmed, required, 1–2000 chars.
- `buildResendPayload(input: ContactInput): ResendEmail`
  - `from`: `"LivePsalms Contact <contact@livepsalms.com>"`
  - `to`: `["support@livepsalms.com"]`
  - `reply_to`: submitter's email
  - `subject`: `"New contact form message: <subject snippet>"` (snippet = first ~80 chars)
  - `text` + minimal `html` body containing Name / Email / Subject.

### `supabase/functions/contact-message/index.ts`

- `OPTIONS` → CORS preflight response (`corsHeaders(req, resolveAllowedOrigins(Deno.env))`).
- Non-`POST` → 405.
- Reads `RESEND_API_KEY` from `Deno.env`; **500** if missing.
  - *Implementation note:* confirm the exact secret name with `supabase secrets list` before deploy. The Supabase↔Resend integration standardly sets `RESEND_API_KEY`.
- Parse JSON body (400 on bad JSON).
- `validateContactInput` → **400** with `{ error }` on invalid input.
- `buildResendPayload` → `fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer <key>', 'content-type': 'application/json' }, body })`.
- On Resend non-2xx → **502** `{ error }` (surface a generic message to the client).
- On success → **200** `{ ok: true }`.
- Every response carries the CORS headers.

### Trust model

Deployed with **default JWT verification** (do NOT pass `--no-verify-jwt`).
The browser invokes with the Supabase anon key, which is a valid JWT — identical
to every other Edge Function in this project. No new auth surface.

## Component 2 — Client (`src/components/sections/Contact.tsx`)

- Keep the existing fields, labels, and styling.
- Submit state machine: `idle → submitting → success | error`.
- On submit:
  - Guard against double-submit while `submitting`.
  - `await supabase.functions.invoke('contact-message', { body: { name, email, subject } })`.
  - Success → set `success`, capture `firstName = name.trim().split(/\s+/)[0]`.
  - Error (network or non-2xx) → set `error`, keep field values, re-enable Submit.
- **Success view (inline swap):** hide the form, render the appreciative message
  in the existing Cormorant Garamond italic styling (reused from the current
  dialog), e.g.:
  > *"Thank you, {firstName}. We'll respond as soon as we can. God bless."*
- **Error view:** inline error line beneath the form (e.g. "Something went wrong
  sending your message. Please try again."), Submit re-enabled.
- **Remove** the `Dialog` / modal imports and markup entirely.

## Testing

- **Vitest unit tests — `_shared/contact-message.ts`:**
  - `validateContactInput`: rejects missing name/email/subject, over-length
    name/subject, malformed email; accepts a valid trio and trims whitespace.
  - `buildResendPayload`: asserts `from`, `to`, `reply_to` (= submitter email),
    subject prefix/snippet, and that name/email/subject appear in the body.
- **Vitest component test — `Contact.tsx`:**
  - Mock `supabase.functions.invoke`.
  - Success → personalized first-name thank-you shown, form hidden.
  - Error → form still present and populated, error message shown.
  - While submitting → Submit button disabled.

## Out of scope

- Database persistence of submissions.
- Auto-reply / confirmation email to the submitter.
- Spam protection (captcha, rate limiting) — can be a follow-up if abuse appears.
- New routes.
