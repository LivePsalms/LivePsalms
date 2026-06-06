# Forgot Password — Inline Reset in AuthCard

## Goal

Add a "Forgot password?" entry point to the sign-in card and an inline flow
that lets a user request a password-reset email. The card is shared by the
desktop `/login` page and the mobile auth modal, so both inherit the feature.

## Existing infrastructure (no changes needed)

- `AuthSession.resetPassword(email)` — sends the reset email via Supabase,
  with `redirectTo` set to `${origin}/update-password`.
- `/update-password` route → `UpdatePasswordPage` (complete): exchanges the
  recovery token and calls `AuthSession.updatePassword`.
- `ProfilePage` already calls `session.resetPassword` — reference pattern.

The only gap is the request-a-reset UI in `AuthCard.tsx`.

## Scope

Single file edited: `src/auth/AuthCard.tsx`. No routing, session, or backend
changes.

## Design

**Mode model.** Extend `type Mode = 'login' | 'signup'` to
`'login' | 'signup' | 'reset'`, reusing the card's existing mode-toggle pattern.

**Login view.** Add a right-aligned, muted "Forgot password?" link directly
under the password field, rendered only when `mode === 'login'`. Clicking it
sets `mode = 'reset'` and clears `error`/`success`.

**Reset view (`mode === 'reset'`).** The card shows:
- Heading "Reset Password" (extend the existing conditional heading).
- A single email input, prefilled from the current `email` state.
- A "Send reset link" submit button.
- Hidden: Google/Apple buttons, the OR divider, the password field, the
  signup-only fields. These are gated on `mode !== 'reset'`.
- A "← Back to sign in" link that returns to `mode = 'login'`.

**Submit handler.** Add a `reset` branch to `handleSubmit`:
- Calls `session.resetPassword(email)`.
- On success, sets the existing `success` state to a generic message:
  *"If an account exists for that email, a reset link is on its way."*
- Errors flow through the existing `error` state and `mapAuthError`
  (no login/signup-specific mapping applies, so the raw message passes through).

**Security note.** The success message is intentionally generic and shown
regardless of whether the email is registered, so the UI does not reveal which
emails have accounts (standard reset-flow practice). Supabase's
`resetPasswordForEmail` does not error on unknown emails, so this is the
natural behavior.

## Testing

- Manual: open `/login`, click "Forgot password?", confirm the card swaps to
  the reset view, submit an email, confirm the success message appears, and
  confirm "Back to sign in" returns to the login view.
- Verify the mobile modal (`MobileAuthModal`) shows the same flow since it
  renders `AuthCard`.
- Lint only the touched file.

## Out of scope

- Changes to `UpdatePasswordPage` (already complete).
- Rate-limiting / captcha on reset requests.
- Email template customization.
