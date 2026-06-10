# Inline Verify-Email (Swap the Card In Place) — Design

**Date:** 2026-06-10
**Status:** Approved (pending spec review)

## Problem

The just-shipped flow navigates to a dedicated `/verify-email` route after sign-up.
We instead want the sign-up card to swap **in place** to the "check your email"
state — keeping the user in the same card (and, for the mobile auth modal, not
navigating out of the modal). This supersedes the route-based approach.

## Decisions (from brainstorming)

1. **Extract a shared `VerifyEmailNotice`** component (the verify card content +
   resend/cooldown + auto-advance), reused by `AuthCard` inline.
2. **Remove** the `/verify-email` route and `VerifyEmailPage` — nothing links there
   once sign-up is inline. (Accepted trade-off: refreshing during "check your email"
   drops back to the sign-in form, since state is no longer persisted.)
3. Keep `session.signUp`'s `emailRedirectTo` and `resendSignupEmail` unchanged.

## Current state (for reference)

- `AuthCard.tsx`: signup success currently does `sessionStorage.setItem('lp.verifyEmail',
  email)` + `navigate('/verify-email')` (uses `useNavigate`). Header block shows a logo
  `<img>` + an `<h1>` whose text depends on `mode`.
- `VerifyEmailPage.tsx`: full-page (`min-h-screen`) wrapper around a card with the
  logo, "Check your email", the email, spam hint, Resend (45s cooldown via
  `session.resendSignupEmail`), "Back to sign in", auto-advance via
  `useAuthSession().user`, and a sessionStorage email read with a redirect-to-login
  fallback. Wired at `/verify-email` in `App.tsx` (import + route + `isVerifyEmailPage`
  in `hideFooter`/`dockMounted`).
- `LoginPage.tsx`: `if (user) { navigate('/notepad/notes'); return null; }` — so on
  `/login`, an authenticated session auto-redirects (AuthCard unmounts).
- `AuthCard` is shared by `/login` and the mobile auth modal; both pass
  `onAuthenticated`.

## Architecture

### Unit 1 — `VerifyEmailNotice` (new: `src/auth/VerifyEmailNotice.tsx`)

The reusable inner content + behavior, extracted from `VerifyEmailPage` (drop the
`min-h-screen` page wrapper, the logo, the sessionStorage read, and the no-email
redirect — those are caller concerns).

Props:
```ts
interface VerifyEmailNoticeProps {
  email: string;
  onBack: () => void;
  onVerified?: () => void;
  cooldownSeconds?: number; // default 45
}
```
Behavior (ported verbatim from the page where applicable):
- `const { user, session } = useAuthSession();`
- Auto-advance: `useEffect(() => { if (user) onVerified?.(); }, [user, onVerified]);`
- Resend with cooldown: local `cooldown`/`resending` state + an interval ref;
  `startCooldown` clears any prior interval, sets `cooldownSeconds`, decrements each
  second to 0; cleared on unmount. `handleResend` guards `(!email || resending ||
  cooldown > 0)`, `await session.resendSignupEmail(email)`, `toast.success(...)`,
  start cooldown; on error `toast.error(...)`. Button label: `Resend in M:SS`
  (disabled) / `Sending…` / `Resend email`.
- Renders a `text-center` block (no page wrapper): an `<h2>` "Check your email", "We
  sent a verification link to", `{email}` (medium weight), the spam hint, the Resend
  button, and a "← Back to sign in" button calling `onBack`. Uses the existing card
  CSS tokens.

### Unit 2 — `AuthCard` swaps inline (`src/auth/AuthCard.tsx`)

- Remove `useNavigate` from the import and its usage; remove the
  `sessionStorage.setItem('lp.verifyEmail', …)` + `navigate('/verify-email')`.
- Add `const [verifyEmail, setVerifyEmail] = useState<string | null>(null);`.
- Signup success path: `setVerifyEmail(email);` (replaces the stash + navigate).
- Render: keep the logo `<img>` at the top of the card always. Then branch:
  - When `verifyEmail` is set → render `<VerifyEmailNotice email={verifyEmail}
    onBack={() => setVerifyEmail(null)} onVerified={() => onAuthenticated?.()} />`
    in place of the heading + OAuth buttons + divider + form + mode-toggle.
  - Otherwise → the existing content (the `<h1>` mode heading, OAuth, divider, form,
    toggle) exactly as today. (The `<h1>` moves from the shared logo block into this
    non-verify branch so the verify state shows the notice's own heading.)
- Mode-switch handlers also `setVerifyEmail(null)` where they reset other state (so
  toggling away from a verify state returns to a clean form). Reset/login flows are
  otherwise unchanged.

### Unit 3 — Remove the route + page

- Delete `src/auth/VerifyEmailPage.tsx` and `src/auth/VerifyEmailPage.test.tsx`.
- In `src/App.tsx`: remove the `import { VerifyEmailPage } …`, the `<Route
  path="/verify-email" …/>`, the `const isVerifyEmailPage = …`, and its terms in
  `hideFooter` and `dockMounted`.

## Testing

- **`VerifyEmailNotice.test.tsx`** (jsdom; mock `useAuthSession`, `sonner`): renders
  the `email` prop; clicking Resend calls `session.resendSignupEmail(email)` then
  disables the button + shows the countdown (`cooldownSeconds={3}`); Back calls
  `onBack`; when `useAuthSession` returns a `user`, `onVerified` is called.
- **`AuthCard.test.tsx`:** update the signup-submit test — after a matching-password
  Create Account, assert the card swaps **inline** to the notice (e.g. "Check your
  email" heading + the entered email visible) and `session.signUp` was called; it does
  NOT navigate and does NOT write `sessionStorage`. The other AuthCard tests are
  unchanged.
- Removing `VerifyEmailPage.test.tsx` removes its 5 tests; the equivalent behavior is
  covered by `VerifyEmailNotice.test.tsx`.
- Full `src/auth` suite stays green; lint only the touched files.

## Out of scope

- Persisting the verify state across a page refresh (accepted trade-off of inline).
- Changing `signUp` / `resendSignupEmail` / `emailRedirectTo` or the Supabase config.
- The mobile auth modal host code (it already passes `onAuthenticated`; inline works
  without changes there).
