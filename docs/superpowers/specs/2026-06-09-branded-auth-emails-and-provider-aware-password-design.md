# Branded Auth Emails & Provider-Aware Password Change

**Date:** 2026-06-09
**Status:** Approved (design)
**Company:** LivePsalms

## Problem

Two related issues in the Profile → Security section:

1. **Change Password is shown to everyone.** [`ProfilePage.tsx`](../../../src/auth/ProfilePage.tsx) always calls `session.resetPassword(user.email)` regardless of how the user signed up. Users who registered only via Google or Apple have **no password**, so offering "Change Password" is confusing.
2. **Auth emails are unbranded.** Supabase sends its default templates from its default sender (`noreply@mail.app.supabase.io`). These should look and read like LivePsalms.

## Goals

- Gate the password-change affordance on whether the account actually has a password.
- Send all active Supabase auth emails from a LivePsalms sender, styled and worded on-brand.
- Keep templates version-controlled and consistent.

## Non-Goals

- No "set a password for OAuth users" feature (deferred — visible-but-disabled was chosen over an add-password flow).
- No server-side enforcement of the gate (it is presentational only; see Security note).
- No changes to OAuth sign-in, edge functions, or DB schema.

## Decisions (from brainstorm)

| Decision | Choice |
| --- | --- |
| OAuth-only UX | **Visible but disabled**, with helper text explaining the password is managed by the provider |
| Email scope | **All active auth emails** under one shared template system |
| SMTP provider | **Resend** (custom SMTP) |
| Sender | `LivePsalms <noreply@livepsalms.com>` |
| Reply-To | Not configurable in Supabase auth email; `support@livepsalms.com` shown in footer instead |
| Visual direction | **Direction A — "Lamplight"**: centered cream card, logo, `LIVEPSALMS` kicker, serif headline, gentle body, pill CTA, reassurance line, Scripture footer |
| password_changed notification | **Enabled** (pairs with this feature) |
| Scripture footer (all emails) | *"Your word is a lamp to my feet and a light to my path. — Psalm 119:105"* |

## Section 1 — Provider-aware Security section (frontend)

### Capability helper

New pure module `src/auth/passwordCapability.ts`:

```ts
type PasswordCapability = {
  canChange: boolean;
  managedBy: 'Google' | 'Apple' | 'your linked account' | null;
};

function getPasswordCapability(user): PasswordCapability;
```

- `canChange = Boolean(user?.app_metadata?.providers?.includes('email'))`.
  - Naturally true once an OAuth user later adds a password (email gets added to `providers`).
- When `canChange` is false, `managedBy` is derived from the present providers:
  - includes `google` → `'Google'`
  - else includes `apple` → `'Apple'`
  - else → `'your linked account'`
- When `canChange` is true, `managedBy` is `null`.
- Pure function, no Supabase calls → unit-testable in isolation.

### UI changes in `ProfilePage.tsx`

In the existing SECURITY block ([`ProfilePage.tsx:306-337`](../../../src/auth/ProfilePage.tsx#L306-L337)):

- Compute `const { canChange, managedBy } = getPasswordCapability(user)`.
- If `canChange`: render the existing **"Change Password →"** `<button>` with its current `onClick` (calls `session.resetPassword`, toasts) — unchanged.
- Else: render a **non-interactive row** (not a `<button>`):
  - Muted "Change Password" label in `--silica`, no hover, no pointer cursor.
  - Helper line: `Password managed by {managedBy === 'your linked account' ? 'your linked account' : `your ${managedBy} account`}`.
- Google / Apple "Linked / Not linked" lines unchanged.
- Add `data-testid="security-change-password"` (button) and `data-testid="security-password-managed"` (disabled row) for test targeting.

### Security note

The gate is presentational. Calling `resetPasswordForEmail` for a password-less account is not a vulnerability — Supabase sends a recovery link that lets the user set a password (a legitimate recovery/add-password path). No server guard is added (YAGNI).

## Section 2 — Email infrastructure (Resend custom SMTP)

### Supabase config

In `supabase/config.toml`, under `[auth.email.smtp]`:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 465
user = "resend"
pass = "env(RESEND_SMTP_PASSWORD)"
admin_email = "noreply@livepsalms.com"
sender_name = "LivePsalms"
```

- `RESEND_SMTP_PASSWORD` is the Resend API key, provided via environment / Supabase secret. **Never committed.** `config.toml` uses `env()` interpolation only.

### Resend / DNS setup (operator checklist)

1. Create Resend account; add `livepsalms.com` as a sending domain.
2. Add the SPF, DKIM, and DMARC DNS records Resend provides; wait for verification.
3. Create an API key scoped to sending; store as `RESEND_SMTP_PASSWORD`.

### Reply-To limitation

Supabase auth emails do not expose a configurable `Reply-To`. The `From` will be `LivePsalms <noreply@livepsalms.com>`. `support@livepsalms.com` is surfaced in every email footer for replies/help. Accepted.

## Section 3 — Branded templates (Direction A) for all auth emails

### Build system (DRY)

Email templates cannot include partials, so a tiny composer keeps them consistent:

- `supabase/templates/_base.html` — the Direction-A shell with named slots: headline, body, CTA (label + url var), and optional reassurance line. Contains logo, `LIVEPSALMS` kicker, divider, Scripture footer, support footer.
- `supabase/templates/src/<name>.html` — per-email content fragments (headline/body/CTA copy + which Supabase var to use).
- `scripts/build-email-templates.mjs` — ~40-line Node script composing base + fragments → final `supabase/templates/<name>.html`. Also emits `supabase/templates/preview.html` for visual QA. No runtime dependency; run on demand / pre-commit.
- `config.toml` `[auth.email.template.<name>]` blocks point `content_path` at the built files and set `subject`.

### Templates and copy

All in the gentle LivePsalms voice (offering, never prophetic — per Lamplight voice principle). Correct Supabase variables used per template.

| Template | Subject | Key var |
| --- | --- | --- |
| `confirmation` | Confirm your email to begin | `{{ .ConfirmationURL }}` |
| `recovery` | Let's get you back in | `{{ .ConfirmationURL }}` |
| `magic_link` | Your sign-in link | `{{ .ConfirmationURL }}` |
| `invite` | You're invited to LivePsalms | `{{ .ConfirmationURL }}` |
| `email_change` | Confirm your new email address | `{{ .ConfirmationURL }}`, `{{ .NewEmail }}` |
| `reauthentication` | Your verification code | `{{ .Token }}` |
| `password_changed` (notification) | Your password was changed | — (security confirmation) |

`recovery` copy (canonical example, Direction A):
- Headline: "Let's get you back in"
- Body: "We received a request to reset your password. Choose a new one whenever you're ready — this link rests for 60 minutes."
- CTA: "Reset password"
- Reassurance: "If you didn't ask for this, you can rest easy and ignore it — your password stays exactly as it is."

### Robustness

- Table-based layout, fully inline styles.
- Fonts: Cormorant Garamond + Outfit via Google Fonts `@import`, with `Georgia, serif` and `Arial, Helvetica, sans-serif` fallbacks for clients that strip web fonts.
- Logo referenced by **absolute public URL** (livepsalms.com asset or Supabase Storage public object) — relative `/logo-icon.png` does not work in email.
- Palette: `--plaster #F0ECE8` card, `--deep-umber #3A3426` text/CTA, `--app-bg #988F80` canvas, `--silica #8A8B90` secondary.

## Section 4 — Testing

- **Unit** (`passwordCapability.test.ts`): email-only → `{canChange:true, managedBy:null}`; google-only → `{canChange:false, managedBy:'Google'}`; apple-only → `'Apple'`; google+email → `canChange:true`; empty/undefined providers → `'your linked account'`.
- **Component** (ProfilePage): OAuth-only user renders the disabled managed-by row (no button); email user renders the working "Change Password →" button.
- **Email rendering**: build script `preview.html` visually checked; local send caught by Inbucket (already enabled in `config.toml`).
- **Manual e2e (staging)**: trigger a real password reset for an email account; confirm the branded email arrives from `LivePsalms <noreply@livepsalms.com>` via Resend and renders in Gmail + Apple Mail.
- **Baseline discipline**: introduce **zero new** lint/tsc/test failures; do not gate on the repo-wide pre-existing red baseline.

## Section 5 — Rollout

1. Operator: create Resend account, add + verify `livepsalms.com` DNS, set `RESEND_SMTP_PASSWORD`.
2. Host the email logo at a stable public URL; reference it in `_base.html`.
3. Run `scripts/build-email-templates.mjs` to generate templates.
4. Apply config to the hosted project via `supabase config push` (or Management API / dashboard).
5. No DB migrations; no edge-function changes.

## Affected files

- `src/auth/passwordCapability.ts` (new)
- `src/auth/passwordCapability.test.ts` (new)
- `src/auth/ProfilePage.tsx` (Security section)
- `supabase/config.toml` (`[auth.email.smtp]`, `[auth.email.template.*]`)
- `supabase/templates/_base.html`, `supabase/templates/src/*.html`, built `supabase/templates/*.html` (new)
- `scripts/build-email-templates.mjs` (new)
