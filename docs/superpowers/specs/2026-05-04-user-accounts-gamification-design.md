# User Accounts, Profiles & Gamification — Design Spec

**Date:** 2026-05-04
**Status:** Draft

## Overview

Add user accounts, cloud-persisted notes, and a gamification tier system to the Psalms notepad app. The app currently runs entirely client-side with localStorage. This design introduces Supabase as the backend (PostgreSQL + Auth + Storage), a user profile page, and a 7-tier "Covenant Fire" ranking system driven by note count.

## Architecture: Approach A — Supabase Adapter

Extend the existing `StorageAdapter` pattern with a `SupabaseStorageAdapter` implementation. Add a lightweight `AuthProvider` context for auth state and user profile. The `NotepadProvider` continues to receive an adapter — it doesn't know or care which backend it talks to.

- **Logged in** → `SupabaseStorageAdapter` (reads/writes to Supabase, scoped to `auth.uid()`)
- **Not logged in** → `LocalStorageAdapter` (current behavior, unchanged)

## 1. Database Schema

### `profiles` table

Extends Supabase's built-in `auth.users`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | References `auth.users.id` |
| `full_name` | text | Required |
| `date_of_birth` | date | Optional |
| `avatar_url` | text | Path in Supabase Storage |
| `note_count` | integer | Current count of qualifying notes (20+ words) |
| `highest_note_count` | integer | High-water mark — tiers never drop |
| `created_at` | timestamptz | Auto-set |
| `updated_at` | timestamptz | Auto-updated |

### `notes` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | References `profiles.id` |
| `title` | text | |
| `content` | text | TipTap JSON stringified |
| `folder_id` | uuid (FK) | References `folders.id` |
| `type` | text | 'devotion' / 'sermon' / 'theme' |
| `tags` | text[] | PostgreSQL array |
| `word_count` | integer | Word count of plain text content |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `folders` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | References `profiles.id` |
| `name` | text | |
| `parent_id` | uuid | Self-referencing FK, nullable |
| `order` | integer | |
| `icon` | text | Optional |
| `color` | text | Optional |

### Row Level Security (RLS)

All three tables have RLS policies so users can only read/write their own rows:
- `SELECT`: `auth.uid() = user_id`
- `INSERT`: `auth.uid() = user_id`
- `UPDATE`: `auth.uid() = user_id`
- `DELETE`: `auth.uid() = user_id`

### Storage Bucket

- **`avatars`** bucket for profile pictures
- Policy: users can only upload/read/delete their own avatar (path pattern: `{user_id}/*`)

### Database Triggers

**`on_auth_user_created`** — when a new auth user is created, automatically insert a `profiles` row with `full_name` from signup metadata.

**`update_note_count`** — on every INSERT, UPDATE, or DELETE on `notes`:
1. Count notes where `user_id` matches and `word_count >= 20`
2. Update `profiles.note_count` with the result
3. If `note_count > highest_note_count`, update `highest_note_count` too

Note: `word_count` is computed client-side before saving (stripping TipTap JSON to plain text). No server-side word count trigger is needed — the `update_note_count` trigger reads the already-populated `word_count` column.

## 2. Authentication

### Providers

- **Email/password** — classic signup with email verification, password reset via email
- **Google OAuth** — "Sign in with Google" button

### AuthProvider Context

Wraps the app and exposes:
- `user` — Supabase auth user (or null)
- `profile` — profile row data (or null)
- `signUp(email, password, fullName)` — creates account, triggers profile creation
- `signIn(email, password)` — email/password login
- `signInWithGoogle()` — Google OAuth flow
- `signOut()` — clears session
- `updateProfile(updates)` — update name, DOB, avatar
- `loading` — boolean for auth state resolution
- `isOnline` — boolean for connection status

### Route Protection

- `/notepad` — accessible without auth (localStorage mode)
- `/profile` — requires auth, redirects to login if not authenticated

### Toolbar Integration

- **Not logged in:** "Sign In" button in the notepad toolbar
- **Logged in:** User avatar + tier badge in the toolbar, dropdown with: Profile, Sign Out

## 3. Adapter Switching

The `AuthProvider` determines which adapter to use:

```
AuthProvider
  └── determines adapter based on auth state
       ├── logged in → SupabaseStorageAdapter
       └── not logged in → LocalStorageAdapter
            └── NotepadProvider receives adapter (unchanged interface)
```

The `StorageAdapter` interface remains the same. `SupabaseStorageAdapter` implements all methods using Supabase client queries, scoped to the authenticated user's ID.

## 4. First Login Migration

When a user logs in for the first time and localStorage contains existing notes:

1. Detect: check if localStorage has notes (`notepad_notes` key)
2. Prompt: show a dialog — "You have X notes saved locally. Would you like to import them to your account?"
3. If **yes**: bulk insert notes + folders to Supabase, then clear localStorage notepad keys
4. If **no**: localStorage is left as-is, cloud account starts empty

## 5. Gamification — Covenant Fire Tiers

### Tier Definitions (frontend constant)

| Threshold | Name | Scripture |
|-----------|------|-----------|
| 10 | Spark | "The Lord is my light and my salvation" — Psalm 27:1 |
| 50 | Ember | "Fan into flame the gift of God" — 2 Timothy 1:6 |
| 150 | Flame | "He makes His ministers a flame of fire" — Hebrews 1:7 |
| 300 | Lamp | "Your word is a lamp to my feet" — Psalm 119:105 |
| 500 | Pillar of Fire | "A pillar of fire by night to give them light" — Exodus 13:21 |
| 1,000 | Refiner | "He will sit as a refiner and purifier" — Malachi 3:3 |
| 5,000 | Glory | "The glory of the Lord shone around them" — Luke 2:9 |

### Qualification Rules

- A note only counts toward `note_count` if it has **20 or more words** of content (plain text, stripped of formatting)
- `note_count` is recalculated on every note insert/update/delete to reflect current qualifying notes
- `highest_note_count` is a high-water mark — only increases, never decreases
- Tier is determined by `highest_note_count`, so tiers are permanent once earned

### Word Count

- Computed client-side by stripping TipTap JSON to plain text and counting words
- Stored on the `notes.word_count` column on every save
- The database trigger uses this column (not raw content) to determine qualifying notes

### Level-Up Detection

- `useUserTier` hook compares previous tier (stored in a ref) against current tier after `highest_note_count` changes
- When a new tier is reached, trigger the celebratory modal
- Only triggers on upward transitions (never on deletion/downgrade)

### Level-Up Modal

- Celebratory modal/dialog with:
  - Tier name in large text
  - Fire/light animation (on brand with the app's aesthetic)
  - Scripture verse
  - Dismiss button
- Appears immediately when the threshold is crossed

### Tier Display

- **Profile page:** Current tier name, scripture, and total note count (all notes, not just qualifying). No progress bar.
- **Notepad toolbar:** Small tier badge (tier name) next to user avatar. Clicking opens a popover with scripture and note count. No badge shown before first tier (< 10 qualifying notes).

## 6. Profile Page (`/profile`)

Requires authentication. Contains:

### Profile Header
- Avatar (clickable to upload new photo)
- Full name
- Email (read-only, from auth)

### Edit Profile Form
- Full name (text input)
- Date of birth (date picker, optional)
- Upload/change avatar

### Tier Display
- Current tier name and scripture
- Total note count
- No progress bar

### Auth Management
- Change password button (sends password reset email)
- Linked Google account indicator (linked / not linked)

### Account Actions
- **Export data** — download all notes and folders as JSON
- **Delete account** — confirmation dialog with warning, deletes profile + notes + folders + avatar
- **Log out**

### Design

The profile page must stay on brand with the existing Psalms app aesthetic — warm tones, spiritual feel, consistent with journal themes and the overall devotional tone.

## 7. Offline Behavior

**Read-only when offline:**

- On login, notes and folders are cached locally (localStorage or IndexedDB as a read cache)
- When offline is detected, the app switches to read-only mode:
  - Editor toolbar is disabled
  - A subtle banner appears: "You're offline — viewing cached notes"
  - Create, edit, and delete operations are blocked
  - Profile page shows cached info, edit actions disabled
- When connection restores, the banner disappears and full functionality returns

**Connection detection:**

- `navigator.onLine` + `online`/`offline` browser events
- Optional: ping Supabase endpoint to confirm (since `navigator.onLine` can give false positives)

## 8. New Dependencies

- `@supabase/supabase-js` — Supabase client SDK

## 9. File Structure (New/Modified)

### New Files
- `src/auth/AuthProvider.tsx` — auth context provider
- `src/auth/useAuth.ts` — auth context hook
- `src/auth/LoginPage.tsx` — login/signup page
- `src/auth/ProfilePage.tsx` — user profile page
- `src/notepad/storage/supabase-adapter.ts` — Supabase storage adapter
- `src/notepad/hooks/useUserTier.ts` — tier computation hook
- `src/notepad/hooks/useOnlineStatus.ts` — connection detection hook
- `src/notepad/components/LevelUpModal.tsx` — celebratory tier-up modal
- `src/notepad/components/TierBadge.tsx` — toolbar tier badge + popover
- `src/notepad/components/MigrationDialog.tsx` — localStorage import prompt
- `src/notepad/gamification/tiers.ts` — tier definitions constant
- `supabase/migrations/` — SQL migration files for schema, RLS, triggers

### Modified Files
- `src/notepad/storage/adapter.ts` — no changes needed (interface stays the same)
- `src/notepad/context/NotepadProvider.tsx` — receive adapter from AuthProvider instead of hardcoding LocalStorageAdapter
- `src/notepad/components/NotepadToolbar.tsx` — add sign-in button / avatar + tier badge
- `src/App.tsx` — wrap with AuthProvider, add /profile route
- `src/notepad/types.ts` — add `wordCount` to Note type
