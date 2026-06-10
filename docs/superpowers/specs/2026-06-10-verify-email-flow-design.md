# Post-Signup Verify-Email Flow — Design

**Date:** 2026-06-10
**Status:** Approved (pending spec review)

## Problem

After a user clicks "Create Account", they must verify their email — but the app
stays on the sign-up screen with only a small green "Check your email…" line under
the still-rendered form. Nothing visibly changes, so it reads as a stale dead-end:
users re-click, get confused, or don't realize an email was sent. Replace that with a
clear, dedicated post-signup state, make the verification link land coherently in the
app, and auto-advance the waiting screen once the account is verified.

## Decisions (from brainstorming)

1. **Dedicated route** `/verify-email` (not an in-card swap).
2. **Contents:** clear "check your email" message + **Resend** (with cooldown) +
   **auto-advance** (the waiting tab moves into the app when verification completes).
3. **Also fix the link landing:** set `emailRedirectTo` on signup so the verification
   link lands in-app, making sign up → verify → onboarding one coherent loop.

## Current state (for reference)

- `AuthCard.handleSubmit` signup branch: `await session.signUp(email, password,
  fullName)` then `setSuccess('Check your email to verify your account.')` — inline,
  form stays rendered. (Reset mode also uses `setSuccess` — keep that.)
- `AuthSession.signUp` (`src/auth/session/auth-session.ts`) calls
  `client.auth.signUp({ email, password, options: { data: { full_name } } })` — no
  `emailRedirectTo`.
- `AuthSession` subscribes to `client.auth.onAuthStateChange` → `applySession(user)`,
  so `AuthSessionState.user` updates reactively, including when another tab in the
  same browser establishes a session (Supabase syncs sessions cross-tab via storage).
  `useAuthSession()` exposes `{ user, ... }`.
- Routes live in `src/App.tsx`. `AuthCard` is shared by the `/login` page and the
  mobile auth modal. `auth-session.test.ts` uses a `FakeSupabaseAuth` recording
  `signUpCalls`.

## Architecture

### Unit 1 — Session methods (`src/auth/session/auth-session.ts`)

- `signUp` gains `emailRedirectTo`:
  ```ts
  const emailRedirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/notepad/notes` : undefined;
  const { error } = await this.client.auth.signUp({
    email, password,
    options: { data: { full_name: fullName }, emailRedirectTo },
  });
  ```
  New users hitting `/notepad/notes` are routed by `useNotepadFirstLoad` into
  `/welcome` onboarding — so the link landing flows into the existing onboarding.
- New `resendSignupEmail`:
  ```ts
  resendSignupEmail = async (email: string): Promise<void> => {
    if (!this.client) throw new Error('Supabase not configured');
    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/notepad/notes` : undefined;
    const { error } = await this.client.auth.resend({ type: 'signup', email, options: { emailRedirectTo } });
    if (error) throw error;
  };
  ```

### Unit 2 — `VerifyEmailPage` (`src/auth/VerifyEmailPage.tsx`) + route

- **Email source:** read `sessionStorage.getItem('lp.verifyEmail')`. `AuthCard`
  writes it before navigating (survives a refresh of `/verify-email`). If it is
  absent (someone opens the URL directly), `navigate('/login', { replace: true })`.
- **Auto-advance:** `const { user } = useAuthSession();` + a `useEffect` — when `user`
  becomes non-null (verification established a session, synced into this tab),
  `navigate('/notepad/notes', { replace: true })`. (Same-browser verification, the
  common case; cross-device verification simply signs the user in on that device.)
- **Resend with cooldown:** local state `cooldown` (seconds, starts at 0 so the first
  press is allowed). On press: `await session.resendSignupEmail(email)` →
  `toast.success('Verification email sent.')` → start a 45s countdown
  (`setInterval`, cleared on unmount and at 0). While `cooldown > 0` the button is
  disabled and reads `Resend in 0:NN`. On error → `toast.error(...)`, no cooldown.
  Accept an optional `cooldownSeconds` prop (default 45) so tests can use a small
  value.
- **UI:** the existing auth card chrome (logo, `--alabaster`/`--pale-stone` card,
  Cormorant heading "Check your email", Outfit body). Body: "We sent a verification
  link to **{email}**. Click it to finish creating your account." + a small "Don't
  see it? Check spam." hint. Buttons: "Resend email" (primary, cooldown-gated) and a
  "← Back to sign in" link → `/login`.
- **Route:** `src/App.tsx` gains `<Route path="/verify-email" element={<VerifyEmailPage />} />`.
  (Footer/dock hidden like other auth routes if the app keys off the path — match the
  existing `/login` treatment in `App.tsx` if present.)

### Unit 3 — `AuthCard` change (`src/auth/AuthCard.tsx`)

- Add `import { useNavigate } from 'react-router-dom';` and `const navigate =
  useNavigate();`.
- Signup success path: replace `setSuccess('Check your email to verify your
  account.')` with:
  ```ts
  try { sessionStorage.setItem('lp.verifyEmail', email); } catch { /* best effort */ }
  navigate('/verify-email');
  ```
- Reset-mode success message is unchanged. Login flow unchanged.

## Testing

- **`auth-session.test.ts`:** extend `FakeSupabaseAuth.signUp` to capture
  `options.emailRedirectTo`; assert `signUp` passes an `emailRedirectTo` ending in
  `/notepad/notes`. Add a `resend` method to the fake and a test that
  `resendSignupEmail('a@b.com')` calls `auth.resend` with `{ type: 'signup', email,
  options: { emailRedirectTo } }`.
- **`VerifyEmailPage.test.tsx`** (jsdom; mock `useAuthSession`, `sonner`,
  `react-router-dom`'s `useNavigate`; provide a fake `session.resendSignupEmail`):
  - Renders the stashed email from `sessionStorage`.
  - No stashed email → navigates to `/login`.
  - Clicking "Resend email" calls `session.resendSignupEmail(email)` and then disables
    the button / shows a countdown (use a small `cooldownSeconds`, fake timers).
  - "Back to sign in" navigates to `/login`.
  - When `useAuthSession` returns a `user`, the page navigates to `/notepad/notes`.
- **`AuthCard.test.tsx`:** update the signup-submit test — after a matching-password
  Create Account, assert it stashed `lp.verifyEmail` and navigated to `/verify-email`
  (mock `useNavigate`), instead of the old inline message.
- Lint only the touched files.

## Out of scope

- Changing Supabase's email template or the project's confirmation requirement.
- A server-side polling/getUser approach (cross-tab session sync via
  `onAuthStateChange` is sufficient and already wired).
- Magic-link / OTP-code entry on the verify page (link-click only).
- Rate-limiting beyond the client-side resend cooldown (Supabase enforces its own).
