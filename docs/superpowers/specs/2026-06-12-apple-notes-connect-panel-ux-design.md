# Connect Apple Notes — Settings Panel UX — Design Spec

**Date:** 2026-06-12
**Status:** Approved (brainstorm) — pending spec review
**Component touched:** `src/auth/components/ApplePersonalTokensSection.tsx` (the "Connect Apple Notes" panel in `ProfilePage.tsx`)

## Goal

Make the Connect Apple Notes panel feel finished and trustworthy:
1. Stop showing the raw Supabase endpoint URL (users never need it).
2. Add a one-tap **Install Shortcut** button + a **Get the Shortcuts app** fallback, with copy tuned to the visitor's device.
3. Be **platform-aware** — full flow on iPhone/iPad/Mac; a friendly "needs an Apple device" note on Android/Windows (token generation still allowed).
4. Add a **status/feedback banner** that confirms imports are working ("✅ N notes imported · last import 2 min ago") or nudges when nothing has arrived yet.

Non-goals (YAGNI): no real-time/per-note import progress (the import runs on-device via the Shortcut; the web app cannot observe a run live — `last_used_at` + imported-note count is the honest signal). No AI processing of imported notes.

## Background / constraints

- The import runs entirely inside the user's Apple Shortcut, which POSTs to the `import-apple-note` edge function. The Psalms web app is **not** in that request path, so it has no live view of a run. The only post-hoc signals available client-side under RLS are: the token's `last_used_at`, and a count of `notes WHERE source = 'apple_notes'`.
- Apple Notes import only works on Apple platforms (iOS/iPadOS/macOS). Psalms is a web app reachable from any browser.
- An iCloud Shortcut link (`icloud.com/shortcuts/…`) opens directly in Shortcuts on both iOS and macOS — one link serves both Apple platforms.

## Constants

- `APPLE_SHORTCUT_ICLOUD_URL = "https://www.icloud.com/shortcuts/bcf5f879ac954f3cbf7d99c3d5ffe29a"`
- `SHORTCUTS_APP_STORE_URL = "https://apps.apple.com/app/shortcuts/id915249334"`
- The existing endpoint constant (`IMPORT_ENDPOINT`) stays in code (the Shortcut needs it baked in for maintainers) but is **no longer rendered** in the panel.

## Architecture (Approach B — decompose, pure logic extracted)

Keep `ApplePersonalTokensSection` as the composition root; extract the testable logic into pure helpers.

### New: `src/auth/apple-import-status.ts` (pure, unit-tested)

```ts
export type ApplePlatform = 'ios' | 'macos' | 'other';

// Best-effort from navigator.userAgent. iPadOS Safari reports as Mac; that's fine
// — both are Apple and the iCloud link works on both. Only Apple-vs-not is load-bearing.
export function detectApplePlatform(userAgent: string): ApplePlatform;

export type ImportTone = 'idle' | 'waiting' | 'success';
export interface ImportStatus { tone: ImportTone; headline: string; detail: string | null; }

// Pure derivation from data the panel already has.
export function deriveImportStatus(input: {
  tokenCount: number;
  lastUsedAt: string | null;   // most recent across the user's active tokens
  importedCount: number;
  now?: number;                // injectable for deterministic relative-time tests
}): ImportStatus;
```

**Status rules (`deriveImportStatus`):**
| Condition | tone | headline | detail |
|---|---|---|---|
| `tokenCount === 0` | `idle` | "Generate a token to get started." | null |
| token(s) exist, `lastUsedAt == null` && `importedCount === 0` | `waiting` | "Almost there — run the Shortcut on your device to import." | null |
| `importedCount > 0` or `lastUsedAt != null` | `success` | "✅ {importedCount} notes imported" | "last import {relative(lastUsedAt)}" (omit if `lastUsedAt == null`) |

Relative time: a small inline formatter ("just now", "N minutes/hours/days ago") driven by `now` for testability. Pluralize "note/notes".

### Changed: `src/auth/personal-tokens.ts`

Add:
```ts
export async function countImportedNotes(client: SupabaseClient): Promise<number>;
// notes where source = 'apple_notes', count exact head:true, under RLS (own notes only).
```

### Changed: `src/auth/components/ApplePersonalTokensSection.tsx`

- On mount: `listTokens` (existing) + `countImportedNotes` (new); compute `lastUsedAt` = max of active tokens' `lastUsedAt`; `detectApplePlatform(navigator.userAgent)` once.
- Render a **status banner** at the top from `deriveImportStatus(...)`, styled by tone (success = soft green check; waiting = neutral nudge; idle = quiet prompt). Refresh after generate/revoke.
- **Install row:** primary `Install Shortcut` button → `APPLE_SHORTCUT_ICLOUD_URL` (opens in new tab/Shortcuts); secondary `Get the Shortcuts app` link → `SHORTCUTS_APP_STORE_URL`.
- **Platform-aware copy:**
  - `ios`/`macos`: full panel; device phrase "on your iPhone/iPad" vs "on your Mac".
  - `other`: replace install/steps with an info note — "Apple Notes import needs an iPhone, iPad, or Mac. You can still generate a token here to use on your Apple device." Token generate + list still render.
- **Remove** the rendered endpoint `<code>{IMPORT_ENDPOINT}</code>` block.
- Preserve existing behavior/contract: Generate token (reveal-once + Copy), token list with last-used + Revoke, error `role="alert"`, the reveal `role="status"`, `aria-labelledby` heading.

## Data flow

mount → `listTokens` + `countImportedNotes` (parallel) → derive `lastUsedAt`, `importedCount` → `deriveImportStatus` → banner. `detectApplePlatform` (sync) → branch copy/controls. Generate/Revoke → mutate → refresh both queries → re-derive.

## Error handling

- Query failures set the existing `error` state (`role="alert"`); the status banner falls back to `idle`/`waiting` (never throws on missing data).
- `countImportedNotes` failure → treat as `0` for the banner (don't block the panel); surface the error text as today.
- Clipboard/install links degrade gracefully (optional-chained clipboard as today; links are plain anchors).

## Testing

- `apple-import-status.test.ts` (pure): `detectApplePlatform` for iOS/iPadOS/macOS/Android/Windows UA strings; `deriveImportStatus` for each of the 3 tones incl. pluralization and relative-time via injected `now`; `lastUsedAt == null` omits the detail line.
- `personal-tokens.test.ts`: `countImportedNotes` builds the right query (mock client asserts `from('notes')`, `eq('source','apple_notes')`, count head).
- `ApplePersonalTokensSection.test.tsx`: renders success banner when `countImportedNotes` resolves > 0; renders the non-Apple info note when platform is `other` (mock `navigator.userAgent`) while still showing Generate; Install button has the iCloud href; endpoint URL is **not** in the document.
- Zero NEW build/lint errors vs the known pre-existing baseline (`tsc -b` / `npm run build`).

## Acceptance criteria

1. Endpoint URL no longer appears in the panel.
2. Install Shortcut button links to the iCloud shortcut; Get-the-app links to the App Store Shortcuts page.
3. Non-Apple visitor sees the "needs an Apple device" note but can still generate a token; Apple visitor sees the full flow with device-tuned copy.
4. Status banner shows success with imported count + relative last-import when imports exist; nudges when a token exists but nothing has imported; prompts when no token.
5. All new pure logic unit-tested; component tests cover banner + platform branch + URL removal; no new build errors.

## File summary

- **New:** `src/auth/apple-import-status.ts` + `.test.ts`
- **Change:** `src/auth/personal-tokens.ts` (+`countImportedNotes`) + its test
- **Change:** `src/auth/components/ApplePersonalTokensSection.tsx` + its test
- **Docs:** update `docs/runbooks/apple-notes-import.md` "User setup" to reference the in-panel Install button + iCloud link.
