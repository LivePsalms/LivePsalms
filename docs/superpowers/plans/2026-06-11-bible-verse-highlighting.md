# Bible Verse Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user highlight whole Bible verses using the same swatch palette as notes, with highlights persisted to their account (localStorage when signed out, Supabase when signed in).

**Architecture:** A new `BibleHighlightAdapter` interface with a localStorage implementation (signed-out) and a Supabase implementation backed by a new RLS-protected `bible_highlights` table (signed-in) — mirroring the notes adapter pattern. A `useBibleHighlights(book, chapter)` hook selects the adapter from auth state, loads the visible chapter's highlights into a `verse → swatchId` map, and exposes `setHighlight`/`removeHighlight`. `BibleReader` renders the swatch background on highlighted verses (reusing the notes' `highlightBackgroundStyle` helper) and opens the existing swatch-picker components (`HighlightSwatchPopover` desktop / `HighlightPill` mobile) anchored to a tapped verse.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Supabase (Postgres + RLS). Typecheck with `tsc -b`. Edge/DB migrations deploy manually (`supabase db push` / project migration flow) — not via CI.

**Scope note:** Session restore (open note / view / Bible passage) is a separate plan (`2026-06-11-session-restore.md`). This plan covers only verse highlighting. Whole-verse granularity only; no sub-verse ranges, no multi-verse drag-select (YAGNI per spec).

**Spec:** `docs/superpowers/specs/2026-06-11-session-restore-and-bible-highlights-design.md`

---

## Reused building blocks (verified in the codebase)

- Swatch palette + lookup: `getStyleAsset(id)` and `filterAssets(assets, 'highlight', query)` from `src/notepad/styles/manifest.ts`; `STYLE_ASSETS` is the full asset array.
- Swatch background CSS: `highlightBackgroundStyle(displayUrl)` from `src/notepad/extensions/style-highlight.ts` (returns a `style` string).
- Picker UIs (already presentational, `onPick(swatchId)` / `onRemove` / `onClose` / `anchor`): `src/notepad/components/HighlightSwatchPopover.tsx`, `src/notepad/components/HighlightPill.tsx`.
- Verse DOM: each verse is `<span id="bible-verse-{n}">` in `src/notepad/bible/BibleReader.tsx` (lines 256-271); verse id format matches `bible_passages` ids: `{book}.{chapter}.{verse}` (e.g. `jhn.1.1`).
- Supabase client: `import { supabase } from '@/lib/supabase'` (may be null when unconfigured).
- Auth: `useAuthSession()` returns `{ user }`; `user?.id` is the signed-in user id.
- Mobile detection: `useIsMobile()` from `@/hooks/use-mobile`.

---

## File Structure

- **Create** `supabase/migrations/<next-number>_bible_highlights.sql` — table + RLS.
- **Create** `src/notepad/bible/highlights/types.ts` — `BibleHighlight`, `BibleHighlightAdapter`, `verseId()` helper.
- **Create** `src/notepad/bible/highlights/local-bible-highlight-adapter.ts` — localStorage implementation.
- **Create** `src/notepad/bible/highlights/local-bible-highlight-adapter.test.ts` — unit tests.
- **Create** `src/notepad/bible/highlights/supabase-bible-highlight-adapter.ts` — Supabase implementation.
- **Create** `src/notepad/bible/highlights/useBibleHighlights.ts` — React hook.
- **Modify** `src/notepad/bible/BibleReader.tsx` — render highlights + picker, emit set/remove.
- **Modify** `src/notepad/bible/BibleStudyPane.tsx` — instantiate the hook and pass props to `BibleReader`.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/<next-number>_bible_highlights.sql`

Pick the next sequential migration number by listing `supabase/migrations/` (the latest is the highest-numbered file; e.g. if `009_bible_passages.sql` and higher exist, use the next integer). Match the SQL style (RLS pattern) of an existing user-scoped table migration in that folder before finalizing.

- [ ] **Step 1: Determine the next migration number**

Run: `ls supabase/migrations/ | sort | tail -5`
Use the next integer after the highest-numbered migration. Open a recent user-scoped migration (one that does `enable row level security` with `auth.uid()` policies) and mirror its exact policy idioms.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/<next-number>_bible_highlights.sql`:

```sql
-- Per-user whole-verse Bible highlights. verse_id matches bible_passages ids
-- (OSIS book + chapter + verse, e.g. 'jhn.1.1'); swatch_id is a style-asset id
-- from the highlight palette (e.g. 'highlight-03').
create table if not exists public.bible_highlights (
  user_id    uuid not null references auth.users (id) on delete cascade,
  verse_id   text not null,
  swatch_id  text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, verse_id)
);

-- Fast lookup of a single chapter's highlights for a user (prefix scan on verse_id).
create index if not exists bible_highlights_user_verse_idx
  on public.bible_highlights (user_id, verse_id text_pattern_ops);

alter table public.bible_highlights enable row level security;

-- A user may only read/write their own highlights.
create policy "bible_highlights_select_own"
  on public.bible_highlights for select
  using (auth.uid() = user_id);

create policy "bible_highlights_insert_own"
  on public.bible_highlights for insert
  with check (auth.uid() = user_id);

create policy "bible_highlights_update_own"
  on public.bible_highlights for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bible_highlights_delete_own"
  on public.bible_highlights for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 3: Apply locally and verify (if a local Supabase / linked project is available)**

Run the project's migration command (e.g. `supabase db push` against the dev project, per the team's existing flow). Expected: table created, RLS enabled. If no local DB is available, record that this migration must be applied manually before the Supabase adapter path is testable, and continue — the local adapter path (Task 3) is fully testable without it.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(bible-highlights): add bible_highlights table with RLS"
```

---

## Task 2: Types + verseId helper

**Files:**
- Create: `src/notepad/bible/highlights/types.ts`

- [ ] **Step 1: Write the types and helper**

Create `src/notepad/bible/highlights/types.ts`:

```ts
// A single whole-verse highlight. verseId is the OSIS verse key
// ("{book}.{chapter}.{verse}", e.g. "jhn.1.1"); swatchId is a highlight
// style-asset id (e.g. "highlight-03").
export interface BibleHighlight {
  verseId: string;
  swatchId: string;
}

export function verseId(book: string, chapter: number, verse: number): string {
  return `${book}.${chapter}.${verse}`;
}

export interface BibleHighlightAdapter {
  /** All highlights for a single chapter. */
  getChapterHighlights(book: string, chapter: number): Promise<BibleHighlight[]>;
  /** Create or recolor a verse highlight. */
  setHighlight(verseId: string, swatchId: string): Promise<void>;
  /** Remove a verse highlight (no-op if absent). */
  removeHighlight(verseId: string): Promise<void>;
}
```

- [ ] **Step 2: Typecheck**

Run: `tsc -b`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/bible/highlights/types.ts
git commit -m "feat(bible-highlights): add highlight types and verseId helper"
```

---

## Task 3: localStorage adapter (signed-out path)

**Files:**
- Create: `src/notepad/bible/highlights/local-bible-highlight-adapter.ts`
- Test: `src/notepad/bible/highlights/local-bible-highlight-adapter.test.ts`

Stores a flat `{ [verseId]: swatchId }` JSON map under one key; chapter reads filter by the `{book}.{chapter}.` prefix.

- [ ] **Step 1: Write the failing test**

Create `src/notepad/bible/highlights/local-bible-highlight-adapter.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { localBibleHighlightAdapter } from './local-bible-highlight-adapter';

afterEach(() => localStorage.clear());

describe('localBibleHighlightAdapter', () => {
  it('returns an empty list when nothing is stored', async () => {
    expect(await localBibleHighlightAdapter.getChapterHighlights('jhn', 1)).toEqual([]);
  });

  it('sets and reads back a highlight scoped to its chapter', async () => {
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-03');
    await localBibleHighlightAdapter.setHighlight('jhn.2.5', 'highlight-04');

    const ch1 = await localBibleHighlightAdapter.getChapterHighlights('jhn', 1);
    expect(ch1).toEqual([{ verseId: 'jhn.1.1', swatchId: 'highlight-03' }]);

    const ch2 = await localBibleHighlightAdapter.getChapterHighlights('jhn', 2);
    expect(ch2).toEqual([{ verseId: 'jhn.2.5', swatchId: 'highlight-04' }]);
  });

  it('does not bleed across chapters with a shared numeric prefix', async () => {
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-01');
    await localBibleHighlightAdapter.setHighlight('jhn.11.1', 'highlight-02');
    const ch1 = await localBibleHighlightAdapter.getChapterHighlights('jhn', 1);
    expect(ch1.map((h) => h.verseId)).toEqual(['jhn.1.1']);
  });

  it('recolors an existing highlight', async () => {
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-01');
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-09');
    const ch1 = await localBibleHighlightAdapter.getChapterHighlights('jhn', 1);
    expect(ch1).toEqual([{ verseId: 'jhn.1.1', swatchId: 'highlight-09' }]);
  });

  it('removes a highlight', async () => {
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-01');
    await localBibleHighlightAdapter.removeHighlight('jhn.1.1');
    expect(await localBibleHighlightAdapter.getChapterHighlights('jhn', 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/bible/highlights/local-bible-highlight-adapter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/notepad/bible/highlights/local-bible-highlight-adapter.ts`:

```ts
import type { BibleHighlight, BibleHighlightAdapter } from './types';

const KEY = 'psalms.bible.highlights.local';

type HighlightMap = Record<string, string>;

function readMap(): HighlightMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as HighlightMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: HighlightMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // best-effort
  }
}

export const localBibleHighlightAdapter: BibleHighlightAdapter = {
  async getChapterHighlights(book: string, chapter: number): Promise<BibleHighlight[]> {
    const prefix = `${book}.${chapter}.`;
    const map = readMap();
    return Object.entries(map)
      .filter(([id]) => id.startsWith(prefix))
      .map(([verseId, swatchId]) => ({ verseId, swatchId }));
  },

  async setHighlight(verseId: string, swatchId: string): Promise<void> {
    const map = readMap();
    map[verseId] = swatchId;
    writeMap(map);
  },

  async removeHighlight(verseId: string): Promise<void> {
    const map = readMap();
    delete map[verseId];
    writeMap(map);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/bible/highlights/local-bible-highlight-adapter.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/highlights/local-bible-highlight-adapter.ts src/notepad/bible/highlights/local-bible-highlight-adapter.test.ts
git commit -m "feat(bible-highlights): localStorage adapter for signed-out highlights"
```

---

## Task 4: Supabase adapter (signed-in path)

**Files:**
- Create: `src/notepad/bible/highlights/supabase-bible-highlight-adapter.ts`

Uses the typed Supabase client. RLS enforces the `user_id` scope; we still set `user_id` on writes (required by the insert/`with check` policy).

- [ ] **Step 1: Write the implementation**

Create `src/notepad/bible/highlights/supabase-bible-highlight-adapter.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BibleHighlight, BibleHighlightAdapter } from './types';

interface HighlightRow {
  verse_id: string;
  swatch_id: string;
}

// Backed by the bible_highlights table (RLS-scoped to the signed-in user).
export class SupabaseBibleHighlightAdapter implements BibleHighlightAdapter {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async getChapterHighlights(book: string, chapter: number): Promise<BibleHighlight[]> {
    const { data, error } = await this.client
      .from('bible_highlights')
      .select('verse_id, swatch_id')
      .like('verse_id', `${book}.${chapter}.%`);
    if (error) throw error;
    return ((data ?? []) as HighlightRow[]).map((r) => ({
      verseId: r.verse_id,
      swatchId: r.swatch_id,
    }));
  }

  async setHighlight(verseId: string, swatchId: string): Promise<void> {
    const { error } = await this.client
      .from('bible_highlights')
      .upsert(
        {
          user_id: this.userId,
          verse_id: verseId,
          swatch_id: swatchId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,verse_id' },
      );
    if (error) throw error;
  }

  async removeHighlight(verseId: string): Promise<void> {
    const { error } = await this.client
      .from('bible_highlights')
      .delete()
      .eq('user_id', this.userId)
      .eq('verse_id', verseId);
    if (error) throw error;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `tsc -b`
Expected: no new errors. (If `@supabase/supabase-js` `SupabaseClient` import path differs from how `@/lib/supabase` types it, mirror the existing import used in `supabase-lamplight-adapter.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/notepad/bible/highlights/supabase-bible-highlight-adapter.ts
git commit -m "feat(bible-highlights): Supabase adapter for signed-in highlights"
```

---

## Task 5: useBibleHighlights hook

**Files:**
- Create: `src/notepad/bible/highlights/useBibleHighlights.ts`

Selects the adapter from auth state (Supabase when `supabase` + signed-in user; localStorage otherwise), loads the chapter into a `verse → swatchId` record, and exposes optimistic `setHighlight`/`removeHighlight` keyed by verse number.

- [ ] **Step 1: Write the hook**

Create `src/notepad/bible/highlights/useBibleHighlights.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/auth/context/useAuthSession';
import type { BibleHighlightAdapter } from './types';
import { verseId } from './types';
import { localBibleHighlightAdapter } from './local-bible-highlight-adapter';
import { SupabaseBibleHighlightAdapter } from './supabase-bible-highlight-adapter';

export interface UseBibleHighlightsResult {
  /** verse number -> swatchId for the current chapter. */
  swatchByVerse: Record<number, string>;
  setHighlight: (verse: number, swatchId: string) => void;
  removeHighlight: (verse: number) => void;
}

export function useBibleHighlights(book: string, chapter: number): UseBibleHighlightsResult {
  const { user } = useAuthSession();
  const userId = user?.id ?? null;

  const adapter: BibleHighlightAdapter = useMemo(() => {
    if (supabase && userId) return new SupabaseBibleHighlightAdapter(supabase, userId);
    return localBibleHighlightAdapter;
  }, [userId]);

  const [swatchByVerse, setSwatchByVerse] = useState<Record<number, string>>({});

  // Load the visible chapter whenever book/chapter/adapter changes.
  useEffect(() => {
    let cancelled = false;
    setSwatchByVerse({});
    (async () => {
      try {
        const rows = await adapter.getChapterHighlights(book, chapter);
        if (cancelled) return;
        const next: Record<number, string> = {};
        for (const r of rows) {
          const verse = Number(r.verseId.split('.')[2]);
          if (!Number.isNaN(verse)) next[verse] = r.swatchId;
        }
        setSwatchByVerse(next);
      } catch (err) {
        if (!cancelled) console.warn('[useBibleHighlights] load failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, book, chapter]);

  const setHighlight = useCallback(
    (verse: number, swatchId: string) => {
      setSwatchByVerse((prev) => ({ ...prev, [verse]: swatchId }));
      adapter.setHighlight(verseId(book, chapter, verse), swatchId).catch((err) => {
        console.warn('[useBibleHighlights] setHighlight failed:', err);
      });
    },
    [adapter, book, chapter],
  );

  const removeHighlight = useCallback(
    (verse: number) => {
      setSwatchByVerse((prev) => {
        const next = { ...prev };
        delete next[verse];
        return next;
      });
      adapter.removeHighlight(verseId(book, chapter, verse)).catch((err) => {
        console.warn('[useBibleHighlights] removeHighlight failed:', err);
      });
    },
    [adapter, book, chapter],
  );

  return { swatchByVerse, setHighlight, removeHighlight };
}
```

Note: the import line must read exactly `import { useCallback, useEffect, useMemo, useState } from 'react';` — all four hooks are used in this file.

- [ ] **Step 2: Typecheck**

Run: `tsc -b`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/bible/highlights/useBibleHighlights.ts
git commit -m "feat(bible-highlights): useBibleHighlights hook with adapter selection"
```

---

## Task 6: Render highlights + picker in BibleReader

**Files:**
- Modify: `src/notepad/bible/BibleReader.tsx`

Add highlight props; render the persisted swatch background on highlighted verses; open the swatch picker (desktop popover / mobile pill) anchored to a tapped verse; emit set/remove.

- [ ] **Step 1: Extend the props and imports**

In `src/notepad/bible/BibleReader.tsx`:

Update the React import (line 2) to add `useCallback`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Add imports after the existing imports (after line 6):

```ts
import { useIsMobile } from '@/hooks/use-mobile';
import { STYLE_ASSETS, getStyleAsset } from '../styles/manifest';
import { highlightBackgroundStyle } from '../extensions/style-highlight';
import { HighlightSwatchPopover } from '../components/HighlightSwatchPopover';
import { HighlightPill } from '../components/HighlightPill';
```

Extend `BibleReaderProps` (lines 17-24) with optional highlight wiring (optional so existing call sites/tests keep compiling):

```ts
export interface BibleReaderProps {
  initialBook?: string;
  initialChapter?: number;
  /** Fires whenever the displayed book/chapter changes (mount + navigation). */
  onPassageChange?: (ref: PassageRef) => void;
  /** Fires when the user taps a verse (chat focus in Phase 2). */
  onSelectVerse?: (ref: VerseRef) => void;
  /** verse number -> swatchId for the current chapter. */
  highlightSwatchByVerse?: Record<number, string>;
  /** Persist (or recolor) a verse highlight. */
  onSetHighlight?: (verse: number, swatchId: string) => void;
  /** Remove a verse highlight. */
  onRemoveHighlight?: (verse: number) => void;
}
```

Destructure the new props in the component signature (lines 26-31):

```ts
export function BibleReader({
  initialBook = 'jhn',
  initialChapter = 1,
  onPassageChange,
  onSelectVerse,
  highlightSwatchByVerse = {},
  onSetHighlight,
  onRemoveHighlight,
}: BibleReaderProps) {
```

- [ ] **Step 2: Add picker state and anchor math**

Inside the component, after the existing `selectedVerse` state (line 34), add:

```ts
  const isMobile = useIsMobile();
  // The verse whose swatch picker is open (null = closed).
  const [pickerVerse, setPickerVerse] = useState<number | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<{ top: number; left: number } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const highlightingEnabled = !!onSetHighlight;
```

Replace `selectVerse` (lines 96-99) so tapping a verse also opens the picker anchored beneath it:

```ts
  const selectVerse = (verse: number) => {
    setSelectedVerse(verse);
    onSelectVerse?.({ book, chapter, verse });
    if (highlightingEnabled) {
      const rect = document.getElementById(`bible-verse-${verse}`)?.getBoundingClientRect();
      if (rect) {
        // Clamp left so a wide popover/pill stays on-screen.
        const left = Math.min(rect.left, window.innerWidth - 210);
        setPickerAnchor({ top: rect.bottom + 6, left: Math.max(8, left) });
        setPickerVerse(verse);
        setPickerQuery('');
      }
    }
  };

  const closePicker = useCallback(() => {
    setPickerVerse(null);
    setPickerAnchor(null);
  }, []);
```

When the chapter changes, close any open picker. Extend the existing passage effect (lines 84-95 area) is about prev/next; instead add a dedicated effect after the `onPassageChange` effect (after line 71):

```ts
  // Close the picker on chapter navigation.
  useEffect(() => {
    setPickerVerse(null);
    setPickerAnchor(null);
  }, [book, chapter]);
```

- [ ] **Step 3: Apply the persisted swatch background to verses**

Replace the verse `<span>` block (lines 256-271) so a highlighted verse shows its swatch background (falling back to the transient selection tint):

```ts
            {verses.map((v) => {
              const swatchId = highlightSwatchByVerse[v.verse];
              const asset = swatchId ? getStyleAsset(swatchId) : undefined;
              const highlightStyle = asset
                ? highlightBackgroundStyle(asset.displayUrl)
                : '';
              return (
                <span
                  key={v.verse}
                  id={`bible-verse-${v.verse}`}
                  onClick={() => selectVerse(v.verse)}
                  className="cursor-pointer"
                  // A persisted swatch wins; otherwise show the transient tap tint.
                  style={
                    asset
                      ? cssTextToStyle(highlightStyle)
                      : {
                          background:
                            selectedVerse === v.verse ? 'rgba(196,154,120,0.22)' : 'transparent',
                          borderRadius: 3,
                          padding: '0 2px',
                        }
                  }
                >
                  <sup className="text-[9px] font-bold mr-1" style={{ color: '#C49A78' }}>{v.verse}</sup>
                  {v.text}{' '}
                </span>
              );
            })}
```

Add this small helper near the bottom of the file (outside the component, next to `NavSection`), since `highlightBackgroundStyle` returns a CSS text string and React needs a style object:

```ts
// Convert a "prop:value;prop:value;" CSS string into a React style object.
function cssTextToStyle(cssText: string): Record<string, string> {
  const style: Record<string, string> = {};
  for (const decl of cssText.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!prop) continue;
    // camelCase the CSS property (e.g. background-image -> backgroundImage).
    const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[camel] = value;
  }
  return style;
}
```

- [ ] **Step 4: Render the picker**

Just before the closing `</div>` of the body container (after the `</p>` that wraps the verses, around line 273), render the picker when open:

```ts
        {highlightingEnabled && pickerVerse != null && pickerAnchor && (
          isMobile ? (
            <HighlightPill
              assets={STYLE_ASSETS}
              anchor={{ top: pickerAnchor.top, left: pickerAnchor.left }}
              onPick={(swatchId) => {
                onSetHighlight?.(pickerVerse, swatchId);
                closePicker();
              }}
              onRemove={() => {
                onRemoveHighlight?.(pickerVerse);
                closePicker();
              }}
              onClose={closePicker}
            />
          ) : (
            <HighlightSwatchPopover
              assets={STYLE_ASSETS}
              query={pickerQuery}
              onQueryChange={setPickerQuery}
              anchor={pickerAnchor}
              autoFocus
              onPick={(swatchId) => {
                onSetHighlight?.(pickerVerse, swatchId);
                closePicker();
              }}
              onRemove={() => {
                onRemoveHighlight?.(pickerVerse);
                closePicker();
              }}
              onClose={closePicker}
            />
          )
        )}
```

- [ ] **Step 5: Typecheck**

Run: `tsc -b`
Expected: no new errors. Confirm `getStyleAsset` and `STYLE_ASSETS` are exported from `../styles/manifest` (they are used by `style-highlight.ts` and `HighlightPill.tsx` respectively).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/bible/BibleReader.tsx
git commit -m "feat(bible-highlights): render swatch highlights and picker in BibleReader"
```

---

## Task 7: Wire the hook into BibleStudyPane

**Files:**
- Modify: `src/notepad/bible/BibleStudyPane.tsx`

`BibleStudyPane` already tracks `passage` (after the session-restore plan, or `{book:'jhn',chapter:1}` before it). Feed that into `useBibleHighlights` and pass the result to `BibleReader`.

- [ ] **Step 1: Instantiate the hook and pass props**

In `src/notepad/bible/BibleStudyPane.tsx`:

Add the import (after the `BibleReader` import on line 12):

```ts
import { useBibleHighlights } from './highlights/useBibleHighlights';
```

After the `passage` state is established (the `useState`/`handlePassageChange` block), add:

```ts
  const { swatchByVerse, setHighlight, removeHighlight } = useBibleHighlights(
    passage.book,
    passage.chapter,
  );
```

Pass the highlight props into `BibleReader` (the `<BibleReader ... />` element near line 98):

```ts
          <BibleReader
            initialBook={passage.book}
            initialChapter={passage.chapter}
            onPassageChange={handlePassageChange}
            highlightSwatchByVerse={swatchByVerse}
            onSetHighlight={setHighlight}
            onRemoveHighlight={removeHighlight}
          />
```

(If the session-restore plan has not been applied, the `initialBook`/`initialChapter` props are still valid — `passage` defaults to `{book:'jhn',chapter:1}`.)

- [ ] **Step 2: Typecheck**

Run: `tsc -b`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/bible/BibleStudyPane.tsx
git commit -m "feat(bible-highlights): wire highlight hook into the Bible study pane"
```

---

## Task 8: Verification pass

- [ ] **Step 1: Run the highlight unit tests**

Run: `npx vitest run src/notepad/bible/highlights`
Expected: PASS (local adapter tests).

- [ ] **Step 2: Typecheck + lint changed files**

Run: `tsc -b`
Expected: only the 4 pre-existing `force-sphere.test.ts` errors.

Run: `npx eslint src/notepad/bible/highlights src/notepad/bible/BibleReader.tsx src/notepad/bible/BibleStudyPane.tsx`
Expected: zero new errors over the baseline.

- [ ] **Step 3: Manual smoke — signed out (localStorage)**

`npm run dev`, open the Bible reader, tap a verse → the picker appears → pick a swatch → the verse shows the swatch background. Change chapter and return → still highlighted. Tap it again → pick "remove" (✕) → cleared. Refresh → highlights persist (localStorage).

- [ ] **Step 4: Manual smoke — signed in (Supabase)**

(Requires the Task 1 migration applied to the dev project.) Sign in, highlight a verse, reload → highlight round-trips through `bible_highlights`. In a second account, confirm the highlight is NOT visible (RLS isolation).

- [ ] **Step 5: Mobile check**

Switch to a mobile viewport, tap a verse → the `HighlightPill` appears (not the desktop popover) → pick/remove works.

---

## Deployment Note

The `bible_highlights` migration must be applied to the Supabase project manually (the team's migration flow; edge/DB changes are not carried by a frontend/Vercel deploy). Until applied, signed-in highlighting will error on read/write while signed-out (localStorage) highlighting works.

---

## Self-Review Notes

- **Spec coverage:** Whole-verse highlighting with shared swatches → Tasks 6-7. Notes adapter pattern (local → Supabase + RLS) → Tasks 1, 3, 4, 5. Reuse of the swatch palette + picker UIs → Task 6. Decoupling note (picker `onPick` drives `setHighlight` instead of an editor command) → satisfied because `HighlightSwatchPopover`/`HighlightPill` are already presentational; no editor-coupling refactor was needed.
- **Type consistency:** `BibleHighlightAdapter` (`getChapterHighlights`/`setHighlight`/`removeHighlight`) defined in Task 2 is implemented identically by the local (Task 3) and Supabase (Task 4) adapters and consumed by the hook (Task 5). `verseId(book, chapter, verse)` is defined once and used in the hook and (implicitly via verse ids) the adapters. `swatchByVerse` (verse number → swatchId) flows hook (Task 5) → `BibleStudyPane` (Task 7) → `BibleReader` prop `highlightSwatchByVerse` (Task 6).
- **Watch item:** in Task 5, ensure the React import line includes all four hooks: `import { useCallback, useEffect, useMemo, useState } from 'react';`.
