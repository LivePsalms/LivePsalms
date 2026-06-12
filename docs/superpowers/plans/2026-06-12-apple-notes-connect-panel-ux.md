# Connect Apple Notes — Panel UX Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the "Connect Apple Notes" settings panel — drop the raw endpoint URL, add a platform-aware Install Shortcut button + Get-the-Shortcuts-app link, and a post-hoc status banner ("✅ N notes imported · last import 2 min ago" / nudges) — with the pure logic extracted into a unit-tested module.

**Architecture:** Approach B (decompose). `ApplePersonalTokensSection` stays the composition root. Two pure helpers (`detectApplePlatform`, `deriveImportStatus`) move into a new `src/auth/apple-import-status.ts` so they're testable without a DOM. A new `countImportedNotes` data helper lands in `src/auth/personal-tokens.ts`. The component composes these: parallel mount queries → derive `lastUsedAt`/`importedCount` → banner; sync `detectApplePlatform(navigator.userAgent)` → branch copy/controls. Frontend-only — no migration, no edge-function change, ships with a normal Vercel deploy.

**Tech Stack:** React + TypeScript (Vite), Supabase JS client (RLS), vitest (+ jsdom for component tests), `@testing-library/react` `fireEvent` (no `user-event` in this repo).

---

## File Structure

- **New:** `src/auth/apple-import-status.ts` — pure logic: `detectApplePlatform`, `deriveImportStatus`, internal relative-time formatter. Zero React/DOM imports.
- **New:** `src/auth/apple-import-status.test.ts` — vitest unit tests for the above.
- **Modify:** `src/auth/personal-tokens.ts` — add `countImportedNotes(client)`.
- **Modify:** `src/auth/personal-tokens.test.ts` — add `countImportedNotes` query-shape test.
- **Modify:** `src/auth/components/ApplePersonalTokensSection.tsx` — banner, install row, platform branch, remove rendered endpoint.
- **Modify:** `src/auth/components/ApplePersonalTokensSection.test.tsx` — banner/platform/URL-removal coverage; add `countImportedNotes` to the mock.
- **Modify:** `docs/runbooks/apple-notes-import.md` — "User setup" references the in-panel Install button + iCloud link.

## Baseline guard

Repo ships RED: ~114 lint errors, 4 tsc errors (`force-sphere.test.ts`), ~2 flaky animation test files. **Gate on zero NEW errors vs that baseline, not a green repo.** Typecheck the real build with `tsc -b` (or `npm run build`), never bare `tsc --noEmit` (root tsconfig has `files: []`). Run only the touched test files for fast iteration.

---

## Task 1: Pure logic — `apple-import-status.ts`

**Files:**
- Create: `src/auth/apple-import-status.ts`
- Test: `src/auth/apple-import-status.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/auth/apple-import-status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectApplePlatform, deriveImportStatus } from './apple-import-status';

describe('detectApplePlatform', () => {
  it('detects iOS from an iPhone UA', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
    )).toBe('ios');
  });
  it('detects iOS from an iPad UA', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
    )).toBe('ios');
  });
  it('treats iPadOS-reports-as-Mac UA as macos (Apple either way)', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
    )).toBe('macos');
  });
  it('detects other from an Android UA', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
    )).toBe('other');
  });
  it('detects other from a Windows UA', () => {
    expect(detectApplePlatform(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    )).toBe('other');
  });
  it('returns other for an empty UA', () => {
    expect(detectApplePlatform('')).toBe('other');
  });
});

describe('deriveImportStatus', () => {
  const T0 = Date.parse('2026-06-12T12:00:00Z');

  it('idle when no tokens exist', () => {
    expect(deriveImportStatus({ tokenCount: 0, lastUsedAt: null, importedCount: 0, now: T0 }))
      .toEqual({ tone: 'idle', headline: 'Generate a token to get started.', detail: null });
  });

  it('waiting when a token exists but nothing imported yet', () => {
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: null, importedCount: 0, now: T0 }))
      .toEqual({
        tone: 'waiting',
        headline: 'Almost there — run the Shortcut on your device to import.',
        detail: null,
      });
  });

  it('success with pluralized count and relative last-import', () => {
    const lastUsedAt = new Date(T0 - 2 * 60_000).toISOString(); // 2 min ago
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt, importedCount: 5, now: T0 }))
      .toEqual({ tone: 'success', headline: '✅ 5 notes imported', detail: 'last import 2 minutes ago' });
  });

  it('success singularizes "note" for a count of 1', () => {
    const lastUsedAt = new Date(T0 - 30_000).toISOString(); // 30s ago
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt, importedCount: 1, now: T0 }))
      .toEqual({ tone: 'success', headline: '✅ 1 note imported', detail: 'last import just now' });
  });

  it('success omits the detail line when lastUsedAt is null', () => {
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: null, importedCount: 3, now: T0 }))
      .toEqual({ tone: 'success', headline: '✅ 3 notes imported', detail: null });
  });

  it('formats hours and days relative time', () => {
    const threeHours = new Date(T0 - 3 * 3_600_000).toISOString();
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: threeHours, importedCount: 2, now: T0 }).detail)
      .toBe('last import 3 hours ago');
    const twoDays = new Date(T0 - 2 * 86_400_000).toISOString();
    expect(deriveImportStatus({ tokenCount: 1, lastUsedAt: twoDays, importedCount: 2, now: T0 }).detail)
      .toBe('last import 2 days ago');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/apple-import-status.test.ts`
Expected: FAIL — `Failed to resolve import './apple-import-status'` (module not yet created).

- [ ] **Step 3: Write minimal implementation**

Create `src/auth/apple-import-status.ts`:

```ts
// src/auth/apple-import-status.ts
// Pure, DOM-free logic for the Connect Apple Notes panel. Unit-tested in isolation.

export type ApplePlatform = 'ios' | 'macos' | 'other';

// Best-effort from navigator.userAgent. iPadOS Safari reports as Mac; that's fine —
// both are Apple and the iCloud Shortcut link works on both. Only Apple-vs-not is
// load-bearing here.
export function detectApplePlatform(userAgent: string): ApplePlatform {
  const ua = userAgent ?? '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macos';
  return 'other';
}

export type ImportTone = 'idle' | 'waiting' | 'success';
export interface ImportStatus {
  tone: ImportTone;
  headline: string;
  detail: string | null;
}

// "just now" / "N minute(s)/hour(s)/day(s) ago", driven by an injectable `now`.
function formatRelative(iso: string, now: number): string {
  const sec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

// Pure derivation from data the panel already has. Never throws on missing data.
export function deriveImportStatus(input: {
  tokenCount: number;
  lastUsedAt: string | null; // most recent across the user's active tokens
  importedCount: number;
  now?: number; // injectable for deterministic relative-time tests
}): ImportStatus {
  const { tokenCount, lastUsedAt, importedCount } = input;
  const now = input.now ?? Date.now();

  if (tokenCount === 0) {
    return { tone: 'idle', headline: 'Generate a token to get started.', detail: null };
  }
  if (lastUsedAt == null && importedCount === 0) {
    return {
      tone: 'waiting',
      headline: 'Almost there — run the Shortcut on your device to import.',
      detail: null,
    };
  }
  const noun = importedCount === 1 ? 'note' : 'notes';
  return {
    tone: 'success',
    headline: `✅ ${importedCount} ${noun} imported`,
    detail: lastUsedAt == null ? null : `last import ${formatRelative(lastUsedAt, now)}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/apple-import-status.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc -b` — Expected: no NEW errors (the 4 pre-existing `force-sphere.test.ts` errors may remain; nothing from `src/auth/apple-import-status*`).

```bash
git add src/auth/apple-import-status.ts src/auth/apple-import-status.test.ts
git commit -m "feat(apple-notes): extract pure platform + import-status logic"
```

---

## Task 2: Data helper — `countImportedNotes`

**Files:**
- Modify: `src/auth/personal-tokens.ts`
- Test: `src/auth/personal-tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the top import of `src/auth/personal-tokens.test.ts` so it reads:

```ts
import { hashToken, generateRawToken, createToken, revokeToken, countImportedNotes } from './personal-tokens';
```

Append this block to `src/auth/personal-tokens.test.ts`:

```ts
describe('countImportedNotes', () => {
  it('counts only apple_notes-sourced notes via a head/exact count query', async () => {
    const eq = vi.fn(async () => ({ count: 7, error: null }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as never;

    const n = await countImportedNotes(client);

    expect(n).toBe(7);
    expect(from).toHaveBeenCalledWith('notes');
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(eq).toHaveBeenCalledWith('source', 'apple_notes');
  });

  it('returns 0 when the count comes back null', async () => {
    const eq = vi.fn(async () => ({ count: null, error: null }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: () => ({ select }) } as never;
    expect(await countImportedNotes(client)).toBe(0);
  });

  it('throws when the query errors', async () => {
    const eq = vi.fn(async () => ({ count: null, error: { message: 'boom' } }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: () => ({ select }) } as never;
    await expect(countImportedNotes(client)).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/personal-tokens.test.ts`
Expected: FAIL — `countImportedNotes is not a function` / import has no matching export.

- [ ] **Step 3: Write minimal implementation**

Append to `src/auth/personal-tokens.ts` (after `revokeToken`):

```ts
// Count of the signed-in user's Apple-Notes-imported notes (RLS scopes to own rows).
// head:true => no rows returned, just the exact count. The `source` column exists
// from migration 028.
export async function countImportedNotes(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'apple_notes');
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/personal-tokens.test.ts`
Expected: PASS (existing token tests + the 3 new ones).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc -b` — Expected: no NEW errors.

```bash
git add src/auth/personal-tokens.ts src/auth/personal-tokens.test.ts
git commit -m "feat(apple-notes): add countImportedNotes data helper"
```

---

## Task 3: Panel rewrite — `ApplePersonalTokensSection.tsx`

**Files:**
- Modify: `src/auth/components/ApplePersonalTokensSection.tsx`
- Test: `src/auth/components/ApplePersonalTokensSection.test.tsx`

- [ ] **Step 1: Update the test mock and write the failing tests**

Replace the mock + `beforeEach` at the top of `src/auth/components/ApplePersonalTokensSection.test.tsx` so `countImportedNotes` is mocked, and add an afterEach to restore the UA:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplePersonalTokensSection } from './ApplePersonalTokensSection';
import * as tokens from '../personal-tokens';

vi.mock('../personal-tokens', async (orig) => {
  const actual = await orig<typeof import('../personal-tokens')>();
  return {
    ...actual,
    createToken: vi.fn(),
    listTokens: vi.fn(),
    revokeToken: vi.fn(),
    countImportedNotes: vi.fn(),
  };
});

const client = {} as never;

const REAL_UA = window.navigator.userAgent;
function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

beforeEach(() => {
  vi.mocked(tokens.listTokens).mockResolvedValue([]);
  vi.mocked(tokens.createToken).mockResolvedValue('psalms_pat_RAWVALUE123');
  vi.mocked(tokens.revokeToken).mockResolvedValue();
  vi.mocked(tokens.countImportedNotes).mockResolvedValue(0);
});

afterEach(() => {
  setUserAgent(REAL_UA);
});
```

Keep the two existing tests (`reveals the raw token once after generating`, `lists existing tokens and revokes one`) exactly as they are. Then append these inside the same `describe('ApplePersonalTokensSection', ...)` block:

```ts
  it('shows a success banner with imported count when notes have been imported', async () => {
    vi.mocked(tokens.listTokens).mockResolvedValue([
      { id: 't1', name: 'Apple Notes Shortcut', lastUsedAt: '2026-06-12T11:58:00Z', createdAt: '2026-06-11T00:00:00Z' },
    ]);
    vi.mocked(tokens.countImportedNotes).mockResolvedValue(3);
    render(<ApplePersonalTokensSection client={client} userId="u-1" />);
    await waitFor(() => expect(screen.getByText(/3 notes imported/i)).toBeInTheDocument());
  });

  it('shows the non-Apple note but still offers token generation', async () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    render(<ApplePersonalTokensSection client={client} userId="u-1" />);
    expect(screen.getByText(/needs an iPhone, iPad, or Mac/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate token/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /install shortcut/i })).toBeNull();
  });

  it('shows the Install Shortcut link pointing at the iCloud shortcut on Apple devices', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15');
    render(<ApplePersonalTokensSection client={client} userId="u-1" />);
    const install = screen.getByRole('link', { name: /install shortcut/i });
    expect(install).toHaveAttribute('href', 'https://www.icloud.com/shortcuts/bcf5f879ac954f3cbf7d99c3d5ffe29a');
    expect(screen.getByRole('link', { name: /get the shortcuts app/i }))
      .toHaveAttribute('href', 'https://apps.apple.com/app/shortcuts/id915249334');
  });

  it('never renders the raw import endpoint URL', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15');
    render(<ApplePersonalTokensSection client={client} userId="u-1" />);
    expect(screen.queryByText(/functions\/v1\/import-apple-note/)).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/auth/components/ApplePersonalTokensSection.test.tsx`
Expected: FAIL — new assertions can't find the banner/install link / still find the endpoint (component not yet rewritten). The two original tests should still pass.

- [ ] **Step 3: Rewrite the component**

Replace the **entire** contents of `src/auth/components/ApplePersonalTokensSection.tsx` with:

```tsx
// src/auth/components/ApplePersonalTokensSection.tsx
import { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createToken, listTokens, revokeToken, countImportedNotes, type PersonalToken,
} from '../personal-tokens';
import { detectApplePlatform, deriveImportStatus, type ImportTone } from '../apple-import-status';

// Baked into the distributed Apple Shortcut by maintainers; intentionally NOT
// rendered in the panel anymore (users never need the raw endpoint).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const IMPORT_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/import-apple-note`;
const APPLE_SHORTCUT_ICLOUD_URL = 'https://www.icloud.com/shortcuts/bcf5f879ac954f3cbf7d99c3d5ffe29a';
const SHORTCUTS_APP_STORE_URL = 'https://apps.apple.com/app/shortcuts/id915249334';

const TONE_BG: Record<ImportTone, string> = {
  success: 'rgba(120, 160, 110, 0.16)',
  waiting: 'var(--pale-stone)',
  idle: 'var(--pale-stone)',
};

export interface ApplePersonalTokensSectionProps {
  client: SupabaseClient;
  userId: string;
}

export function ApplePersonalTokensSection({ client, userId }: ApplePersonalTokensSectionProps) {
  const [list, setList] = useState<PersonalToken[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [raw, setRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platform] = useState(() => detectApplePlatform(navigator.userAgent));

  const refresh = useCallback(async () => {
    try {
      const [t, count] = await Promise.all([
        listTokens(client),
        // A count failure must not block the panel — treat as 0 (spec error handling).
        countImportedNotes(client).catch(() => 0),
      ]);
      setList(t);
      setImportedCount(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
    }
  }, [client]);

  useEffect(() => { void refresh(); }, [refresh]);

  const onGenerate = async () => {
    setBusy(true); setError(null);
    try {
      const token = await createToken(client, userId, 'Apple Notes Shortcut');
      setRaw(token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create token');
    } finally { setBusy(false); }
  };

  const onRevoke = async (id: string) => {
    setBusy(true); setError(null);
    try { await revokeToken(client, id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to revoke token'); }
    finally { setBusy(false); }
  };

  // Most-recent last-used across active tokens (ISO strings sort lexicographically).
  const lastUsedAt = list.reduce<string | null>((acc, t) => {
    if (!t.lastUsedAt) return acc;
    return !acc || t.lastUsedAt > acc ? t.lastUsedAt : acc;
  }, null);

  const status = deriveImportStatus({ tokenCount: list.length, lastUsedAt, importedCount });

  const isApple = platform === 'ios' || platform === 'macos';
  const devicePhrase = platform === 'ios' ? 'on your iPhone or iPad' : 'on your Mac';

  return (
    <section
      aria-labelledby="apple-notes-heading"
      className="px-6 py-6 rounded-xl"
      style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
    >
      <h3
        id="apple-notes-heading"
        className="text-sm mb-2"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        Connect Apple Notes
      </h3>

      <div
        role="status"
        className="mb-4 px-3 py-2 rounded-lg"
        style={{ background: TONE_BG[status.tone], fontFamily: 'Outfit, sans-serif' }}
      >
        <p
          className="text-xs"
          style={{ color: status.tone === 'idle' ? 'var(--silica)' : 'var(--deep-umber)' }}
        >
          {status.headline}
        </p>
        {status.detail && (
          <p className="text-xs mt-1" style={{ color: 'var(--silica)' }}>{status.detail}</p>
        )}
      </div>

      {isApple ? (
        <>
          <p
            className="text-xs mb-3"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            Generate a token, then install the Shortcut and run it {devicePhrase} to bring
            your Apple Notes into Psalms.
          </p>
          <div className="flex flex-col gap-2 mb-4">
            <a
              href={APPLE_SHORTCUT_ICLOUD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-2 rounded-lg text-center"
              style={{
                background: 'var(--deep-umber)',
                color: 'var(--alabaster)',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              Install Shortcut
            </a>
            <a
              href={SHORTCUTS_APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline text-center"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Get the Shortcuts app
            </a>
          </div>
        </>
      ) : (
        <p
          className="text-xs mb-4"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Apple Notes import needs an iPhone, iPad, or Mac. You can still generate a token
          here to use on your Apple device.
        </p>
      )}

      <button
        type="button"
        onClick={() => void onGenerate()}
        disabled={busy}
        className="text-xs px-3 py-2 rounded-lg mb-2 disabled:opacity-50"
        style={{
          background: 'var(--deep-umber)',
          color: 'var(--alabaster)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        Generate token
      </button>

      {raw && (
        <div
          role="status"
          className="mb-4 px-3 py-3 rounded-lg"
          style={{ background: 'var(--pale-stone)' }}
        >
          <p
            className="text-xs mb-2"
            style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            <strong>Copy this token now &mdash; you won&rsquo;t see it again.</strong>
          </p>
          <code
            className="block text-xs break-all mb-2"
            style={{ color: 'var(--deep-umber)', fontFamily: 'monospace' }}
          >
            {raw}
          </code>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(raw)}
            className="text-xs underline"
            style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            Copy
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-xs mb-3"
          style={{ color: '#b04040', fontFamily: 'Outfit, sans-serif' }}
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {list.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 text-xs"
            style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            <span>{t.name}</span>
            <span style={{ color: 'var(--silica)' }}>
              {t.lastUsedAt
                ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                : 'never used'}
            </span>
            <button
              type="button"
              onClick={() => void onRevoke(t.id)}
              disabled={busy}
              className="underline disabled:opacity-50"
              style={{ color: '#b04040' }}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/auth/components/ApplePersonalTokensSection.test.tsx`
Expected: PASS — all 6 tests (2 original + 4 new) green.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc -b` — Expected: no NEW errors.

```bash
git add src/auth/components/ApplePersonalTokensSection.tsx src/auth/components/ApplePersonalTokensSection.test.tsx
git commit -m "feat(apple-notes): platform-aware install row + status banner, drop endpoint URL"
```

---

## Task 4: Runbook — "User setup"

**Files:**
- Modify: `docs/runbooks/apple-notes-import.md`

- [ ] **Step 1: Update the "User setup" section**

In `docs/runbooks/apple-notes-import.md`, replace the current "## User setup" block (the numbered list of 3 steps) with:

```markdown
## User setup
1. In Psalms → Settings → **Connect Apple Notes**, tap **Generate token** and
   copy the `psalms_pat_…` value (shown once).
2. On an iPhone, iPad, or Mac, tap **Install Shortcut** in the same panel (it opens
   the iCloud Shortcut link directly in the Shortcuts app). If Shortcuts isn't
   installed, use **Get the Shortcuts app** to install it first.
3. On first run the Shortcut prompts for the token and stores it; paste the value.
4. Back in the panel, the status banner confirms imports ("✅ N notes imported ·
   last import …") once a run completes.

> The panel is platform-aware: on a non-Apple browser it shows a "needs an Apple
> device" note but still lets you generate a token to use on your Apple device.
> The raw endpoint URL is no longer shown — it's baked into the distributed Shortcut.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/apple-notes-import.md
git commit -m "docs(apple-notes): runbook user-setup references in-panel Install button"
```

---

## Final verification (after all tasks)

- [ ] Run the three touched test files together:
  `npx vitest run src/auth/apple-import-status.test.ts src/auth/personal-tokens.test.ts src/auth/components/ApplePersonalTokensSection.test.tsx`
  Expected: all PASS.
- [ ] `npx tsc -b` — Expected: only the 4 pre-existing `force-sphere.test.ts` errors; nothing from touched files.
- [ ] `npx eslint src/auth/apple-import-status.ts src/auth/personal-tokens.ts src/auth/components/ApplePersonalTokensSection.tsx` — Expected: zero NEW errors vs baseline.
- [ ] Confirm acceptance criteria 1–5 from the spec are each satisfied by a shipped change.

## Spec → task traceability

| Spec requirement | Task |
|---|---|
| `detectApplePlatform` / `deriveImportStatus` pure + tested | Task 1 |
| Status rules (idle/waiting/success), pluralization, relative time, null-detail | Task 1 |
| `countImportedNotes` query shape under RLS | Task 2 |
| Status banner from `deriveImportStatus`, tone styling, refresh on mutate | Task 3 |
| Install Shortcut button + Get-the-app link | Task 3 |
| Platform-aware copy / non-Apple note (Generate still renders) | Task 3 |
| Remove rendered endpoint `<code>` | Task 3 |
| Preserve generate/reveal/copy/list/revoke/error/aria contract | Task 3 |
| Component tests: banner, platform branch, install href, URL removal | Task 3 |
| Runbook "User setup" references in-panel Install | Task 4 |
| Zero NEW build/lint errors vs baseline | Each task Step 5 + Final verification |
