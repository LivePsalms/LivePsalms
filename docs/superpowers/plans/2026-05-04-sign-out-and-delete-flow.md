# Sign-Out & Delete-Account Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reroute both sign-out paths to `/notepad` so the toolbar's SIGN IN button replaces the avatar dropdown in the same slot, and update the delete-account confirmation copy to ask for confirmation and remind users to export notes first.

**Architecture:** Three small text/route edits across two files. No backend, no schema, no new components. The toolbar's existing `user ? <dropdown> : <SIGN IN>` conditional already handles the visible swap — only the post-`signOut()` `navigate(...)` target needs to change.

**Tech Stack:** TypeScript, React, react-router-dom, Radix UI `AlertDialog`. Verification via `tsc -b` and a Playwright smoke pass on `http://localhost:5173`.

**Note on TDD:** This project has no test runner or `*.test.*` files (verified during the prior task; no `test` script in `package.json`). Scaffolding a test runner for two `navigate(...)` argument changes and one description string would be disproportionate. Verification is `tsc -b` plus the manual Playwright steps in Task 4.

---

## File Structure

| File | Change |
|---|---|
| `src/notepad/components/NotepadToolbar.tsx` | Toolbar dropdown's Sign Out handler: `navigate('/')` → `navigate('/notepad')` |
| `src/auth/ProfilePage.tsx` | `handleSignOut`: `navigate('/')` → `navigate('/notepad')`. `AlertDialogDescription` body text replaced. |

---

### Task 1: Reroute toolbar Sign Out to /notepad

**Files:**
- Modify: `src/notepad/components/NotepadToolbar.tsx` (around line 237–245)

- [ ] **Step 1: Read the current Sign Out handler**

Run:
```bash
sed -n '237,245p' src/notepad/components/NotepadToolbar.tsx
```

Expected: a `<DropdownMenuItem onClick={async () => { await signOut(); navigate('/'); }} ...>Sign Out</DropdownMenuItem>` block.

- [ ] **Step 2: Change the navigate target**

Locate this block:

```tsx
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      navigate('/');
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Sign Out
                  </DropdownMenuItem>
```

Replace with:

```tsx
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      navigate('/notepad');
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Sign Out
                  </DropdownMenuItem>
```

The only character-level change is `'/'` → `'/notepad'` in the `navigate(...)` call. Every other line is preserved.

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc -b 2>&1 | grep -E "NotepadToolbar\.tsx" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/components/NotepadToolbar.tsx
git commit -m "$(cat <<'EOF'
fix: route toolbar sign-out to /notepad so SIGN IN button is visible

The user is already on /notepad when they sign out via the toolbar
dropdown; navigating to / hid the auth control entirely. Staying on
/notepad lets the existing user ? <dropdown> : <SIGN IN> conditional
swap the avatar dropdown for the SIGN IN button in the same slot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Reroute profile-page Sign Out to /notepad

**Files:**
- Modify: `src/auth/ProfilePage.tsx` (`handleSignOut`, around line 99–102)

- [ ] **Step 1: Read the current handler**

Run:
```bash
sed -n '99,102p' src/auth/ProfilePage.tsx
```

Expected:
```tsx
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
```

- [ ] **Step 2: Change the navigate target**

Replace this block:

```tsx
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
```

with:

```tsx
  const handleSignOut = async () => {
    await signOut();
    navigate('/notepad');
  };
```

The only change is `'/'` → `'/notepad'`. Do not touch `handleDeleteAccount`, which keeps its existing `navigate('/')` (delete sends the user to the home page intentionally — they no longer have an account, so landing back on the notepad would feel odd).

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc -b 2>&1 | grep -E "ProfilePage\.tsx" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/auth/ProfilePage.tsx
git commit -m "$(cat <<'EOF'
fix: route profile sign-out to /notepad so SIGN IN button is visible

Same intent as the toolbar handler: after sign-out, land the user on
the page where the auth control lives so they immediately see the
SIGN IN affordance replace the dropdown.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Update delete-account confirmation copy

**Files:**
- Modify: `src/auth/ProfilePage.tsx` (`AlertDialogDescription`, around line 368–373)

- [ ] **Step 1: Read the current dialog body**

Run:
```bash
sed -n '361,375p' src/auth/ProfilePage.tsx
```

Expected: an `<AlertDialogTitle>Delete Account?</AlertDialogTitle>` followed by an `<AlertDialogDescription>` with the body text "This will permanently delete your account, all your notes, folders, and profile data. This action cannot be undone."

- [ ] **Step 2: Replace the description body**

Locate this block:

```tsx
                  <AlertDialogDescription
                    style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13 }}
                  >
                    This will permanently delete your account, all your notes,
                    folders, and profile data. This action cannot be undone.
                  </AlertDialogDescription>
```

Replace with:

```tsx
                  <AlertDialogDescription
                    style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13 }}
                  >
                    Are you sure you want to go ahead with this feature? This will
                    permanently delete your account, all your notes, folders, and
                    profile data. This action cannot be undone. If you'd like to
                    keep a copy of your notes, use 'Export All Notes' above
                    before deleting.
                  </AlertDialogDescription>
```

The element, props, and indentation level are unchanged — only the body text changes. Line wrapping inside JSX text is purely visual; React renders text nodes as a single space-separated string.

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc -b 2>&1 | grep -E "ProfilePage\.tsx" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/auth/ProfilePage.tsx
git commit -m "$(cat <<'EOF'
feat: add explicit confirmation and export reminder to delete dialog

Replaces the delete-account dialog body with copy that asks 'Are you
sure you want to go ahead with this feature?' and points the user at
the Export All Notes button on the same page. Preserves the existing
'permanent + cannot be undone' warning.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Manual smoke test via Playwright

**Files:** none (verification only — no commits)

This task uses the existing Playwright MCP browser to confirm the visible behavior. The dev server is expected to already be running on `http://localhost:5173` (verified in the prior session).

- [ ] **Step 1: Confirm dev server is running**

Run:
```bash
lsof -i :5173 -t > /dev/null && echo "running" || echo "not running"
```

Expected: `running`. If not, start it: `npm run dev` in a background terminal, then re-check.

- [ ] **Step 2: Verify the new delete-dialog copy is rendered in the source bundle**

Vite serves the JSX from disk; this confirms the build picked up the new text without needing an authenticated session.

```bash
curl -s 'http://localhost:5173/src/auth/ProfilePage.tsx' | grep -F "Are you sure you want to go ahead with this feature"
```

Expected: one matching line printed.

```bash
curl -s 'http://localhost:5173/src/auth/ProfilePage.tsx' | grep -F "Export All Notes' above"
```

Expected: one matching line printed.

- [ ] **Step 3: Verify the new sign-out destinations are in the source**

```bash
grep -n "navigate('/notepad')" src/notepad/components/NotepadToolbar.tsx src/auth/ProfilePage.tsx
```

Expected: at least two matches — one in `NotepadToolbar.tsx` (inside the Sign Out `DropdownMenuItem` handler) and one in `ProfilePage.tsx` (inside `handleSignOut`).

```bash
grep -n "navigate('/')" src/auth/ProfilePage.tsx
```

Expected: exactly one match, inside `handleDeleteAccount` (the delete flow intentionally still routes home).

- [ ] **Step 4: Browser sanity check (skipped if auth still blocked)**

The Supabase secret-key issue from the earlier test report blocks signed-in flows. If that key has not been rotated, skip this step. If it has:

1. Open `http://localhost:5173/login` and sign in with a test account.
2. Navigate to the toolbar avatar → Sign Out. Confirm the URL stays at `/notepad` and the SIGN IN button replaces the dropdown in the same slot.
3. Sign back in, navigate to `/profile`, click Sign Out at the bottom of the page. Confirm the URL goes to `/notepad` and SIGN IN is visible.
4. Sign back in, navigate to `/profile`, click Delete Account. Confirm the dialog body shows the new copy verbatim, including the "Are you sure…" lead and the Export reminder.
5. Cancel the dialog (do not confirm — that would actually delete the test account).

- [ ] **Step 5: Final type-check**

Run:
```bash
npx tsc -b 2>&1 | grep -E "(NotepadToolbar\.tsx|ProfilePage\.tsx)" || echo "clean"
```

Expected: `clean`. Pre-existing errors in unrelated files (Editor.tsx, UploadModal.tsx, bible-verse.ts, tag-mark.ts, edge-parser.ts) may still appear in unfiltered output — they are out of scope for this plan.

No commit for this task — it is verification only.

---

## Self-Review Notes

- **Spec coverage.** Spec §1 (sign-out destination) → Tasks 1 and 2. Spec §2 (delete confirmation copy) → Task 3. Spec §3 (files touched) matches the Tasks. Spec §4 (verification) → Task 4.
- **Placeholders.** None — every code change shows the full before/after text and every command shows expected output.
- **String consistency.** The literal "Are you sure you want to go ahead with this feature?" appears once (in Task 3 step 2) and is exactly the phrase from spec §2. The Export reference uses single quotes inside the JSX text (`'Export All Notes' above`) which renders as `'Export All Notes' above` — same wording the user requested.
- **Order safety.** Task 3 modifies a different region of `ProfilePage.tsx` than Task 2 (~line 99 vs ~line 368). They could be combined, but keeping them as separate commits makes the intent of each commit message clearer in `git log`.
