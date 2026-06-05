# Personalized editor empty state — design

**Date:** 2026-06-02
**Status:** Approved (design), pending implementation plan

## Problem

The notepad editor shows a generic placeholder when no note is selected:

> Select a note or create a new one

It is functional but impersonal. We want a warmer, more enduring, on-brand line
that greets the user by their first name. The same component backs both the
desktop and mobile editor surfaces, so one change covers both.

## Voice

The line lives in the app's contemplative, scripture-anchored register
("the long quiet finally given a voice"). The chosen direction is **quiet
invitation** — gentle, understated, giving the user ownership of the blank page
without pressure or pronouncement. (Consistent with the Lamplight voice
principle: invite, never proclaim.)

## Copy

- **With a first name:** `The page is yours, {firstName}.`
  - Example: `The page is yours, Natalie.`
- **Without a first name** (profile still loading, or no name on file):
  `The page is yours.`

The name-less form is a true subset of the personalized form, so the loading
state never produces a jarring swap — the line reads naturally either way.

## Implementation

Single edit to the no-active-note branch in
`src/notepad/components/Editor.tsx` (currently lines 123–139).

1. Read the active user's profile via the existing `useAccountProfile()` hook.
   `NotepadEditor` already renders under `AuthProvider`
   (`src/App.tsx`), which supplies `AccountProfileContext`, so the hook is safe
   to call from this component for both desktop (`Notepad.tsx`) and mobile
   (`MobileEditorView.tsx`).
2. Derive the first name:
   `const firstName = profile?.fullName?.trim().split(/\s+/)[0];`
   This mirrors the existing precedent in `WelcomePage.tsx`
   (`fullName.trim().split(' ')[0]`).
3. Choose the message:
   - If `firstName` is a non-empty string → `The page is yours, ${firstName}.`
   - Otherwise → `The page is yours.`
4. Render the chosen string in the existing centered placeholder `<div>` with
   no changes to its styling.

## Scope / non-changes

- No styling, layout, font, color, or spacing changes — same centered
  `var(--silica)` Outfit line.
- No new files, components, props, or dependencies.
- One change to the shared `NotepadEditor` covers both mobile and desktop.

## Testing

- Manual: signed-in user sees `The page is yours, {firstName}.`; the name-less
  fallback renders cleanly during profile load / when no name is on file.
- Optional: a small render test asserting both branches (personalized vs.
  fallback) of the no-active-note state.
