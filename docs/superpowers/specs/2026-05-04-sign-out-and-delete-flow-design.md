# Sign-Out & Delete-Account Flow — Design Spec

**Date:** 2026-05-04
**Status:** Draft

## Overview

Two related cleanups to the auth flow on the profile page (and a related sign-out path in the notepad toolbar):

1. **Sign-out lands the user where the auth control is visible.** Today both sign-out paths navigate to `/`, the home page, which has no auth UI. The user can't see the "SIGN IN" affordance appear after they sign out, which makes the action feel incomplete. Redirect to `/notepad` instead, where the toolbar's `user ? <dropdown> : <SIGN IN button>` conditional already handles the swap.
2. **Delete-account confirmation makes the consequences and the export option explicit.** The current confirmation dialog warns about permanence but does not (a) ask "are you sure" in plain language, or (b) remind the user that they can export their notes first.

The `deleteAccount()` function itself already removes the profile row from Supabase (notes/folders cascade-delete via FK), signs the user out, and resets the storage adapter to localStorage. No backend change is needed.

## Scope

- Modify the toolbar dropdown's sign-out handler in [src/notepad/components/NotepadToolbar.tsx](../../../src/notepad/components/NotepadToolbar.tsx).
- Modify the profile page's sign-out handler in [src/auth/ProfilePage.tsx](../../../src/auth/ProfilePage.tsx).
- Replace the `AlertDialogDescription` body of the delete confirmation in the same file.

## Non-Goals

- No deletion of the `auth.users` row in Supabase. That requires a server-side function with the service-role key (a separate setup not present in this branch). The profile + cascaded notes/folders are gone, which matches the user-facing meaning of "delete account" for this app.
- No new auth control on the global home `<Header>`. Adding an auth area to the home page is out of scope; sign-out is rerouted to a page where the existing toolbar control is already visible.
- No confirmation dialog on sign-out. Sign-out is reversible (sign back in); only delete needs the additional warning.
- No change to `deleteAccount()`, `signOut()`, or `AuthProvider` state-management logic.

## 1. Sign-Out Destination

Today both handlers navigate to `/` after `signOut()` resolves:

```ts
// src/notepad/components/NotepadToolbar.tsx (~line 238)
onClick={async () => {
  await signOut();
  navigate('/');
}}

// src/auth/ProfilePage.tsx (~line 99)
const handleSignOut = async () => {
  await signOut();
  navigate('/');
};
```

Update both to `navigate('/notepad')`.

The notepad toolbar already renders different auth controls based on the `user` value from `AuthProvider`:

- When `user` is non-null: avatar dropdown with Profile / Sign Out
- When `user` is null: a `<button>` linking to `/login` with "SIGN IN" copy

After sign-out, `user` becomes null, the conditional re-evaluates, and the SIGN IN button replaces the dropdown in the same toolbar slot. No additional component or prop wiring is needed.

For the toolbar handler specifically, `navigate('/notepad')` is a no-op route change (the user is already on `/notepad`). React Router's behavior here is benign — the auth state change drives the re-render either way. Keeping the explicit navigate call preserves parity with the profile-page handler and makes intent obvious.

## 2. Delete-Account Confirmation Copy

The current `AlertDialogDescription` at [src/auth/ProfilePage.tsx:368-373](../../../src/auth/ProfilePage.tsx#L368-L373):

> "This will permanently delete your account, all your notes, folders, and profile data. This action cannot be undone."

Replace with:

> "Are you sure you want to go ahead with this feature? This will permanently delete your account, all your notes, folders, and profile data. This action cannot be undone. If you'd like to keep a copy of your notes, use 'Export All Notes' above before deleting."

This:

- Adds the literal "Are you sure…" prompt the user requested.
- Preserves the existing "permanent + cannot be undone" warning.
- Points the user at the **Export All Notes** button which already lives on the same profile page, directly above the Delete button (see [ProfilePage.tsx:333-340](../../../src/auth/ProfilePage.tsx#L333-L340)).

No structural change to the dialog: same `AlertDialogHeader` / `Description` / `Footer` / `Cancel` / `Action` setup, just new body text.

## 3. Files Touched

| File | Change |
|---|---|
| `src/notepad/components/NotepadToolbar.tsx` | Toolbar dropdown's Sign Out handler: `navigate('/')` → `navigate('/notepad')` |
| `src/auth/ProfilePage.tsx` | `handleSignOut` body: `navigate('/')` → `navigate('/notepad')`. `AlertDialogDescription` body text replaced. |

## 4. Verification

- Manual (toolbar): in the notepad toolbar, click avatar → Sign Out. Avatar dropdown disappears; the SIGN IN button appears in the same slot. URL stays at `/notepad`.
- Manual (profile): on the profile page, click Sign Out. Page navigates to `/notepad`; the toolbar's SIGN IN button is visible.
- Manual (delete): on the profile page, click Delete Account. The confirmation modal shows the new copy verbatim, including the "Are you sure…" lead and the Export reminder. Cancel dismisses; confirming triggers `deleteAccount()` and lands the now-signed-out user on the home `/` route (existing behavior of `handleDeleteAccount`, unchanged).
- Type check: `npx tsc -b` clean for both touched files.
