# Bible Studies Tab — Phase 1 Implementation Plan (Tabbed Study Window + Free Bible Reader)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the right-hand `/notepad` pane into a tabbed window (Bible first, Graph second) and ship a free, navigable Bible reader on the Bible tab, reading from the existing `bible_passages` table.

**Architecture:** A new `StudyWindow` component owns the right-pane chrome (sizing, border, tab bar, expand footer) and renders one of two bodies: the new `BibleReader` (Bible tab) or the existing `GraphPane` in its `embedded` mode (Graph tab). `BibleReader` reads chapter text via a `useBiblePassages` hook; a static `bible-books` table drives book/chapter navigation. No AI in this phase — the chat is Phase 2.

**Tech Stack:** React 19 + Vite + TypeScript, TailwindCSS, Supabase JS client (`src/lib/supabase.ts`), Vitest + @testing-library/react (jsdom). Bible data already ingested into `bible_passages` by `scripts/ingest-bsb.ts`.

**Scope boundary (read before starting):** This plan delivers ONLY the tabs + reader. The Lamplight chat, its `lamplight-chat` Edge Function, the `lamplight_chat_threads`/`_messages` tables, entitlement gating of chat, proactive insights, and mobile parity are explicitly OUT of scope here and will land in Phase 2+ plans. Design `BibleReader`'s callback surface (Tasks 4–5) to be chat-ready, but do not build chat.

---

## Data conventions (verified against `scripts/ingest-bsb.ts` + migration 009)

- `bible_passages` columns: `id text pk, book text, chapter int, verse_start int, verse_end int, translation text, text text, pericope_id text`.
- `book` is a lowercase OSIS-style 3-letter abbrev: Genesis→`gen`, John→`jhn`, **Psalm→`psa`** (singular), Revelation→`rev`.
- Verse rows have ids shaped `"{book}.{chapter}.{verse}"` (e.g. `jhn.10.11`). One whole-chapter **pericope row** also exists per chapter with id `"{book}.{chapter}"` (e.g. `jhn.10`).
- Therefore a chapter's verses are selected with `.like('id', '{book}.{chapter}.%')` — this matches `jhn.10.1…jhn.10.42` and **excludes** the pericope row `jhn.10`.
- `bible_passages` has public-read RLS (`Anyone can read bible_passages`), so the reader needs no auth and no new policy.

## Ops prerequisite (not a code task)

The reader shows nothing until `bible_passages` is populated. If the target Supabase project's `bible_passages` table is empty, run the existing one-shot ingest before/after deploying Phase 1:

```bash
# Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ VOYAGE_AI_KEY for embeddings) in env.
npx tsx scripts/ingest-bsb.ts
```

This is idempotent (upsert on `id`). It is infrastructure, not application code — no test step.

## File structure

- Create `src/notepad/bible/bible-books.ts` — canonical 66-book metadata (name, abbrev, testament, chapterCount) + ordered list + name lookup helpers.
- Create `src/notepad/bible/bible-books.test.ts` — metadata integrity.
- Create `src/notepad/bible/useBiblePassages.ts` — hook fetching a chapter's verses from `bible_passages`.
- Create `src/notepad/bible/useBiblePassages.test.ts` — query + mapping + error/empty behavior.
- Create `src/notepad/bible/BibleReader.tsx` — navigator + verse list + verse selection.
- Create `src/notepad/bible/BibleReader.test.tsx` — render, navigation, selection.
- Create `src/components/sections/notepad/StudyWindow.tsx` — tabbed container hosting `BibleReader` and `GraphPane`.
- Create `src/components/sections/notepad/StudyWindow.test.tsx` — tab switching + default tab.
- Modify `src/notepad/components/../GraphPane.tsx` (`src/components/sections/notepad/GraphPane.tsx`) — remove the now-redundant internal `GRAPH` `<h3>` header.
- Modify `src/components/sections/Notepad.tsx:261` — swap `<GraphPane .../>` for `<StudyWindow .../>`.

---

### Task 1: Bible book metadata table

**Files:**
- Create: `src/notepad/bible/bible-books.ts`
- Test: `src/notepad/bible/bible-books.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/notepad/bible/bible-books.test.ts
import { describe, it, expect } from 'vitest';
import { BIBLE_BOOKS, bookByAbbrev, OLD_TESTAMENT, NEW_TESTAMENT } from './bible-books';

describe('bible-books', () => {
  it('has all 66 canonical books in order', () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS[0].name).toBe('Genesis');
    expect(BIBLE_BOOKS[65].name).toBe('Revelation');
  });

  it('splits 39 OT / 27 NT', () => {
    expect(OLD_TESTAMENT).toHaveLength(39);
    expect(NEW_TESTAMENT).toHaveLength(27);
  });

  it('uses unique lowercase 3-letter abbrevs matching the ingest', () => {
    const abbrevs = BIBLE_BOOKS.map((b) => b.abbrev);
    expect(new Set(abbrevs).size).toBe(66);
    for (const a of abbrevs) expect(a).toMatch(/^[0-9a-z]{3}$/);
    expect(bookByAbbrev('jhn')?.name).toBe('John');
    expect(bookByAbbrev('psa')?.name).toBe('Psalm'); // singular, per ingest BOOK_ABBREV
  });

  it('has positive chapter counts with known anchors', () => {
    for (const b of BIBLE_BOOKS) expect(b.chapterCount).toBeGreaterThan(0);
    expect(bookByAbbrev('psa')?.chapterCount).toBe(150);
    expect(bookByAbbrev('jhn')?.chapterCount).toBe(21);
    expect(bookByAbbrev('gen')?.chapterCount).toBe(50);
    expect(bookByAbbrev('oba')?.chapterCount).toBe(1);
  });

  it('returns undefined for an unknown abbrev', () => {
    expect(bookByAbbrev('zzz')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/bible-books.test.ts`
Expected: FAIL — cannot resolve `./bible-books`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/notepad/bible/bible-books.ts
// Canonical 66-book metadata for the Bible reader navigator. abbrev values are
// the lowercase OSIS-style codes used as the `book` column + id prefix in
// bible_passages (see scripts/ingest-bsb.ts BOOK_ABBREV). Chapter counts are the
// Berean Standard Bible (BSB) canon.

export type Testament = 'OT' | 'NT';

export interface BibleBook {
  name: string;
  abbrev: string;
  testament: Testament;
  chapterCount: number;
}

export const BIBLE_BOOKS: readonly BibleBook[] = [
  { name: 'Genesis', abbrev: 'gen', testament: 'OT', chapterCount: 50 },
  { name: 'Exodus', abbrev: 'exo', testament: 'OT', chapterCount: 40 },
  { name: 'Leviticus', abbrev: 'lev', testament: 'OT', chapterCount: 27 },
  { name: 'Numbers', abbrev: 'num', testament: 'OT', chapterCount: 36 },
  { name: 'Deuteronomy', abbrev: 'deu', testament: 'OT', chapterCount: 34 },
  { name: 'Joshua', abbrev: 'jos', testament: 'OT', chapterCount: 24 },
  { name: 'Judges', abbrev: 'jdg', testament: 'OT', chapterCount: 21 },
  { name: 'Ruth', abbrev: 'rut', testament: 'OT', chapterCount: 4 },
  { name: '1 Samuel', abbrev: '1sa', testament: 'OT', chapterCount: 31 },
  { name: '2 Samuel', abbrev: '2sa', testament: 'OT', chapterCount: 24 },
  { name: '1 Kings', abbrev: '1ki', testament: 'OT', chapterCount: 22 },
  { name: '2 Kings', abbrev: '2ki', testament: 'OT', chapterCount: 25 },
  { name: '1 Chronicles', abbrev: '1ch', testament: 'OT', chapterCount: 29 },
  { name: '2 Chronicles', abbrev: '2ch', testament: 'OT', chapterCount: 36 },
  { name: 'Ezra', abbrev: 'ezr', testament: 'OT', chapterCount: 10 },
  { name: 'Nehemiah', abbrev: 'neh', testament: 'OT', chapterCount: 13 },
  { name: 'Esther', abbrev: 'est', testament: 'OT', chapterCount: 10 },
  { name: 'Job', abbrev: 'job', testament: 'OT', chapterCount: 42 },
  { name: 'Psalm', abbrev: 'psa', testament: 'OT', chapterCount: 150 },
  { name: 'Proverbs', abbrev: 'pro', testament: 'OT', chapterCount: 31 },
  { name: 'Ecclesiastes', abbrev: 'ecc', testament: 'OT', chapterCount: 12 },
  { name: 'Song of Solomon', abbrev: 'sng', testament: 'OT', chapterCount: 8 },
  { name: 'Isaiah', abbrev: 'isa', testament: 'OT', chapterCount: 66 },
  { name: 'Jeremiah', abbrev: 'jer', testament: 'OT', chapterCount: 52 },
  { name: 'Lamentations', abbrev: 'lam', testament: 'OT', chapterCount: 5 },
  { name: 'Ezekiel', abbrev: 'ezk', testament: 'OT', chapterCount: 48 },
  { name: 'Daniel', abbrev: 'dan', testament: 'OT', chapterCount: 12 },
  { name: 'Hosea', abbrev: 'hos', testament: 'OT', chapterCount: 14 },
  { name: 'Joel', abbrev: 'jol', testament: 'OT', chapterCount: 3 },
  { name: 'Amos', abbrev: 'amo', testament: 'OT', chapterCount: 9 },
  { name: 'Obadiah', abbrev: 'oba', testament: 'OT', chapterCount: 1 },
  { name: 'Jonah', abbrev: 'jon', testament: 'OT', chapterCount: 4 },
  { name: 'Micah', abbrev: 'mic', testament: 'OT', chapterCount: 7 },
  { name: 'Nahum', abbrev: 'nam', testament: 'OT', chapterCount: 3 },
  { name: 'Habakkuk', abbrev: 'hab', testament: 'OT', chapterCount: 3 },
  { name: 'Zephaniah', abbrev: 'zep', testament: 'OT', chapterCount: 3 },
  { name: 'Haggai', abbrev: 'hag', testament: 'OT', chapterCount: 2 },
  { name: 'Zechariah', abbrev: 'zec', testament: 'OT', chapterCount: 14 },
  { name: 'Malachi', abbrev: 'mal', testament: 'OT', chapterCount: 4 },
  { name: 'Matthew', abbrev: 'mat', testament: 'NT', chapterCount: 28 },
  { name: 'Mark', abbrev: 'mrk', testament: 'NT', chapterCount: 16 },
  { name: 'Luke', abbrev: 'luk', testament: 'NT', chapterCount: 24 },
  { name: 'John', abbrev: 'jhn', testament: 'NT', chapterCount: 21 },
  { name: 'Acts', abbrev: 'act', testament: 'NT', chapterCount: 28 },
  { name: 'Romans', abbrev: 'rom', testament: 'NT', chapterCount: 16 },
  { name: '1 Corinthians', abbrev: '1co', testament: 'NT', chapterCount: 16 },
  { name: '2 Corinthians', abbrev: '2co', testament: 'NT', chapterCount: 13 },
  { name: 'Galatians', abbrev: 'gal', testament: 'NT', chapterCount: 6 },
  { name: 'Ephesians', abbrev: 'eph', testament: 'NT', chapterCount: 6 },
  { name: 'Philippians', abbrev: 'php', testament: 'NT', chapterCount: 4 },
  { name: 'Colossians', abbrev: 'col', testament: 'NT', chapterCount: 4 },
  { name: '1 Thessalonians', abbrev: '1th', testament: 'NT', chapterCount: 5 },
  { name: '2 Thessalonians', abbrev: '2th', testament: 'NT', chapterCount: 3 },
  { name: '1 Timothy', abbrev: '1ti', testament: 'NT', chapterCount: 6 },
  { name: '2 Timothy', abbrev: '2ti', testament: 'NT', chapterCount: 4 },
  { name: 'Titus', abbrev: 'tit', testament: 'NT', chapterCount: 3 },
  { name: 'Philemon', abbrev: 'phm', testament: 'NT', chapterCount: 1 },
  { name: 'Hebrews', abbrev: 'heb', testament: 'NT', chapterCount: 13 },
  { name: 'James', abbrev: 'jas', testament: 'NT', chapterCount: 5 },
  { name: '1 Peter', abbrev: '1pe', testament: 'NT', chapterCount: 5 },
  { name: '2 Peter', abbrev: '2pe', testament: 'NT', chapterCount: 3 },
  { name: '1 John', abbrev: '1jn', testament: 'NT', chapterCount: 5 },
  { name: '2 John', abbrev: '2jn', testament: 'NT', chapterCount: 1 },
  { name: '3 John', abbrev: '3jn', testament: 'NT', chapterCount: 1 },
  { name: 'Jude', abbrev: 'jud', testament: 'NT', chapterCount: 1 },
  { name: 'Revelation', abbrev: 'rev', testament: 'NT', chapterCount: 22 },
];

const BY_ABBREV = new Map(BIBLE_BOOKS.map((b) => [b.abbrev, b]));

export function bookByAbbrev(abbrev: string): BibleBook | undefined {
  return BY_ABBREV.get(abbrev);
}

export const OLD_TESTAMENT = BIBLE_BOOKS.filter((b) => b.testament === 'OT');
export const NEW_TESTAMENT = BIBLE_BOOKS.filter((b) => b.testament === 'NT');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/bible-books.test.ts`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/bible-books.ts src/notepad/bible/bible-books.test.ts
git commit -m "feat(bible): canonical 66-book metadata for the reader navigator"
```

---

### Task 2: `useBiblePassages` chapter-fetch hook

**Files:**
- Create: `src/notepad/bible/useBiblePassages.ts`
- Test: `src/notepad/bible/useBiblePassages.test.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/bible/useBiblePassages.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

// Chainable supabase query builder mock. select/like/order return `this`; the
// builder resolves (await) to { data, error }.
const order = vi.fn();
const like = vi.fn(() => builder);
const select = vi.fn(() => builder);
const from = vi.fn(() => builder);
const builder: {
  select: typeof select; like: typeof like; order: typeof order;
  then: (r: (v: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
} = {
  select, like, order,
  then: (resolve) => Promise.resolve(resolve(orderResult)),
};
let orderResult: { data: unknown; error: unknown } = { data: [], error: null };
order.mockImplementation(() => builder);

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));

import { useBiblePassages } from './useBiblePassages';

beforeEach(() => {
  from.mockClear(); select.mockClear(); like.mockClear(); order.mockClear();
  orderResult = { data: [], error: null };
});
afterEach(cleanup);

describe('useBiblePassages', () => {
  it('queries verse rows for a chapter and maps them to {verse,text}', async () => {
    orderResult = {
      data: [
        { id: 'jhn.10.1', verse_start: 1, text: 'Truly, truly...' },
        { id: 'jhn.10.2', verse_start: 2, text: 'But he who enters...' },
      ],
      error: null,
    };
    const { result } = renderHook(() => useBiblePassages('jhn', 10));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(from).toHaveBeenCalledWith('bible_passages');
    expect(like).toHaveBeenCalledWith('id', 'jhn.10.%');
    expect(order).toHaveBeenCalledWith('verse_start', { ascending: true });
    expect(result.current.verses).toEqual([
      { verse: 1, text: 'Truly, truly...' },
      { verse: 2, text: 'But he who enters...' },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a query error and empties verses', async () => {
    orderResult = { data: null, error: { message: 'boom' } };
    const { result } = renderHook(() => useBiblePassages('jhn', 10));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.verses).toEqual([]);
    expect(result.current.error).toBe('boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/useBiblePassages.test.ts`
Expected: FAIL — cannot resolve `./useBiblePassages`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/notepad/bible/useBiblePassages.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ReaderVerse {
  verse: number;
  text: string;
}

export interface UseBiblePassagesResult {
  verses: ReaderVerse[];
  loading: boolean;
  error: string | null;
}

interface PassageRow {
  id: string;
  verse_start: number;
  text: string;
}

/**
 * Fetch a single chapter's verse rows from bible_passages. `book` is the OSIS
 * abbrev (e.g. "jhn"); verse rows are selected via the id prefix so the
 * whole-chapter pericope row ("jhn.10") is excluded.
 */
export function useBiblePassages(book: string, chapter: number): UseBiblePassagesResult {
  const [verses, setVerses] = useState<ReaderVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (!supabase) {
      setVerses([]);
      setError('Bible text is unavailable.');
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: qErr } = await supabase
        .from('bible_passages')
        .select('id, verse_start, text')
        .like('id', `${book}.${chapter}.%`)
        .order('verse_start', { ascending: true });
      if (cancelled) return;
      if (qErr) {
        setVerses([]);
        setError(qErr.message);
      } else {
        setVerses(((data ?? []) as PassageRow[]).map((r) => ({ verse: r.verse_start, text: r.text })));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [book, chapter]);

  return { verses, loading, error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/useBiblePassages.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/useBiblePassages.ts src/notepad/bible/useBiblePassages.test.ts
git commit -m "feat(bible): useBiblePassages hook to read a chapter from bible_passages"
```

---

### Task 3: `BibleReader` — verse list + chapter prev/next (no navigator panel yet)

Build the reader in two tasks: Task 3 renders a chapter with prev/next chapter controls and verse selection; Task 4 adds the book/chapter navigator panel. This keeps each step small.

**Files:**
- Create: `src/notepad/bible/BibleReader.tsx`
- Test: `src/notepad/bible/BibleReader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/notepad/bible/BibleReader.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const useBiblePassages = vi.fn();
vi.mock('./useBiblePassages', () => ({ useBiblePassages: (...a: unknown[]) => useBiblePassages(...a) }));

import { BibleReader } from './BibleReader';

beforeEach(() => {
  useBiblePassages.mockReset();
  useBiblePassages.mockReturnValue({
    loading: false,
    error: null,
    verses: [
      { verse: 1, text: 'In the beginning was the Word' },
      { verse: 2, text: 'He was with God in the beginning' },
    ],
  });
});
afterEach(cleanup);

describe('BibleReader', () => {
  it('renders the current passage heading and verses', () => {
    render(<BibleReader initialBook="jhn" initialChapter={1} />);
    expect(screen.getByText('John 1')).toBeInTheDocument();
    expect(screen.getByText(/In the beginning was the Word/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // verse number
  });

  it('advances to the next chapter and reports the passage change', () => {
    const onPassageChange = vi.fn();
    render(<BibleReader initialBook="jhn" initialChapter={1} onPassageChange={onPassageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /next chapter/i }));
    expect(screen.getByText('John 2')).toBeInTheDocument();
    expect(onPassageChange).toHaveBeenLastCalledWith({ book: 'jhn', chapter: 2 });
  });

  it('disables previous at chapter 1 and reports verse selection', () => {
    const onSelectVerse = vi.fn();
    render(<BibleReader initialBook="jhn" initialChapter={1} onSelectVerse={onSelectVerse} />);
    expect(screen.getByRole('button', { name: /previous chapter/i })).toBeDisabled();
    fireEvent.click(screen.getByText(/In the beginning was the Word/));
    expect(onSelectVerse).toHaveBeenLastCalledWith({ book: 'jhn', chapter: 1, verse: 1 });
  });

  it('shows a loading state', () => {
    useBiblePassages.mockReturnValue({ loading: true, error: null, verses: [] });
    render(<BibleReader initialBook="jhn" initialChapter={1} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/BibleReader.test.tsx`
Expected: FAIL — cannot resolve `./BibleReader`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/notepad/bible/BibleReader.tsx
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bookByAbbrev } from './bible-books';
import { useBiblePassages } from './useBiblePassages';

export interface PassageRef {
  book: string;
  chapter: number;
}

export interface VerseRef extends PassageRef {
  verse: number;
}

export interface BibleReaderProps {
  initialBook?: string;
  initialChapter?: number;
  /** Fires whenever the displayed book/chapter changes (mount + navigation). */
  onPassageChange?: (ref: PassageRef) => void;
  /** Fires when the user taps a verse (chat focus in Phase 2). */
  onSelectVerse?: (ref: VerseRef) => void;
}

export function BibleReader({
  initialBook = 'jhn',
  initialChapter = 1,
  onPassageChange,
  onSelectVerse,
}: BibleReaderProps) {
  const [book, setBook] = useState(initialBook);
  const [chapter, setChapter] = useState(initialChapter);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);

  const meta = bookByAbbrev(book);
  const { verses, loading, error } = useBiblePassages(book, chapter);

  useEffect(() => {
    onPassageChange?.({ book, chapter });
  }, [book, chapter, onPassageChange]);

  const goPrev = () => {
    if (chapter > 1) {
      setChapter((c) => c - 1);
      setSelectedVerse(null);
    }
  };
  const goNext = () => {
    if (meta && chapter < meta.chapterCount) {
      setChapter((c) => c + 1);
      setSelectedVerse(null);
    }
  };
  const selectVerse = (verse: number) => {
    setSelectedVerse(verse);
    onSelectVerse?.({ book, chapter, verse });
  };

  const label = `${meta?.name ?? book} ${chapter}`;

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--pale-stone)' }}>
        <span className="text-[13px] font-bold" style={{ color: 'var(--deep-umber)' }}>{label}</span>
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous chapter"
            onClick={goPrev}
            disabled={chapter <= 1}
            className="p-1.5 rounded hover:bg-black/5 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
          </button>
          <button
            aria-label="Next chapter"
            onClick={goNext}
            disabled={!meta || chapter >= meta.chapterCount}
            className="p-1.5 rounded hover:bg-black/5 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
          </button>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ fontFamily: 'Georgia, serif' }}>
        {loading && (
          <p className="text-[11px] tracking-wider" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            Loading passage…
          </p>
        )}
        {error && !loading && (
          <p className="text-[11px] tracking-wider" style={{ color: '#b45454', fontFamily: 'Outfit, sans-serif' }}>
            {error}
          </p>
        )}
        {!loading && !error && verses.length === 0 && (
          <p className="text-[11px] tracking-wider" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            No text found for this chapter.
          </p>
        )}
        {!loading && !error && verses.length > 0 && (
          <p className="text-[13px] leading-[1.9]" style={{ color: 'var(--deep-umber)' }}>
            {verses.map((v) => (
              <span
                key={v.verse}
                onClick={() => selectVerse(v.verse)}
                className="cursor-pointer"
                style={{
                  background: selectedVerse === v.verse ? 'rgba(196,154,120,0.22)' : 'transparent',
                  borderRadius: 3,
                  padding: '0 2px',
                }}
              >
                <sup className="text-[9px] font-bold mr-1" style={{ color: '#C49A78' }}>{v.verse}</sup>
                {v.text}{' '}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/BibleReader.test.tsx`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/BibleReader.tsx src/notepad/bible/BibleReader.test.tsx
git commit -m "feat(bible): BibleReader chapter view with prev/next + verse selection"
```

---

### Task 4: Book/chapter navigator panel inside `BibleReader`

Add a toggleable navigator: clicking the heading opens an OT/NT book picker + chapter grid that jumps the reader.

**Files:**
- Modify: `src/notepad/bible/BibleReader.tsx`
- Test: `src/notepad/bible/BibleReader.test.tsx` (add cases)

- [ ] **Step 1: Write the failing test (append to the existing describe block)**

```tsx
  it('opens the navigator and jumps to a chosen book + chapter', () => {
    const onPassageChange = vi.fn();
    render(<BibleReader initialBook="jhn" initialChapter={1} onPassageChange={onPassageChange} />);

    // Open navigator via the heading button.
    fireEvent.click(screen.getByRole('button', { name: /browse books/i }));

    // Pick a book (Genesis) then chapter 3.
    fireEvent.click(screen.getByRole('button', { name: /^Genesis$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^chapter 3$/i }));

    expect(screen.getByText('Genesis 3')).toBeInTheDocument();
    expect(onPassageChange).toHaveBeenLastCalledWith({ book: 'gen', chapter: 3 });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/notepad/bible/BibleReader.test.tsx`
Expected: FAIL — no "browse books" button / navigator not implemented.

- [ ] **Step 3: Implement the navigator**

Replace the header `<span>` label with a button, and add navigator state + panel. Apply these exact edits to `src/notepad/bible/BibleReader.tsx`:

3a. Update imports:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bookByAbbrev, OLD_TESTAMENT, NEW_TESTAMENT, type BibleBook } from './bible-books';
import { useBiblePassages } from './useBiblePassages';
```

3b. Add navigator state inside the component (after `selectedVerse` state):

```tsx
  const [navOpen, setNavOpen] = useState(false);
  const [navBook, setNavBook] = useState<BibleBook | null>(null);

  const navChapters = useMemo(
    () => (navBook ? Array.from({ length: navBook.chapterCount }, (_, i) => i + 1) : []),
    [navBook],
  );

  const jumpTo = (abbrev: string, ch: number) => {
    setBook(abbrev);
    setChapter(ch);
    setSelectedVerse(null);
    setNavOpen(false);
    setNavBook(null);
  };
```

3c. Replace the header label `<span>…</span>` with a button:

```tsx
        <button
          aria-label="Browse books"
          onClick={() => { setNavOpen((o) => !o); setNavBook(bookByAbbrev(book) ?? null); }}
          className="text-[13px] font-bold flex items-center gap-1"
          style={{ color: 'var(--deep-umber)' }}
        >
          {label}
          <span className="text-[9px]" style={{ color: 'var(--silica)' }}>▾</span>
        </button>
```

3d. Insert the navigator panel immediately after the header `</div>` and before the body `<div className="flex-1 overflow-y-auto …">`:

```tsx
      {navOpen && (
        <div className="px-4 py-3 shrink-0 overflow-y-auto" style={{ borderBottom: '1px solid var(--pale-stone)', maxHeight: '50%' }}>
          {!navBook && (
            <>
              <NavSection title="Old Testament" books={OLD_TESTAMENT} onPick={setNavBook} />
              <NavSection title="New Testament" books={NEW_TESTAMENT} onPick={setNavBook} />
            </>
          )}
          {navBook && (
            <div>
              <button
                onClick={() => setNavBook(null)}
                className="text-[10px] font-medium tracking-wider mb-2 flex items-center gap-1"
                style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
              >
                <ChevronLeft className="w-3 h-3" /> {navBook.name}
              </button>
              <div className="grid grid-cols-8 gap-1.5">
                {navChapters.map((ch) => (
                  <button
                    key={ch}
                    aria-label={`Chapter ${ch}`}
                    onClick={() => jumpTo(navBook.abbrev, ch)}
                    className="text-[10px] py-1 rounded text-center hover:bg-black/5"
                    style={{ border: '1px solid var(--pale-stone)', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
```

3e. Add the `NavSection` helper at the bottom of the file:

```tsx
function NavSection({ title, books, onPick }: { title: string; books: readonly BibleBook[]; onPick: (b: BibleBook) => void }) {
  return (
    <div className="mb-3">
      <div className="text-[9px] font-semibold tracking-[0.16em] mb-1.5" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
        {title.toUpperCase()}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {books.map((b) => (
          <button
            key={b.abbrev}
            onClick={() => onPick(b)}
            className="text-[10px] px-2 py-1 rounded hover:bg-black/5"
            style={{ border: '1px solid var(--pale-stone)', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/notepad/bible/BibleReader.test.tsx`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/bible/BibleReader.tsx src/notepad/bible/BibleReader.test.tsx
git commit -m "feat(bible): book/chapter navigator panel in BibleReader"
```

---

### Task 5: Remove the redundant `GRAPH` header from `GraphPane`

The tab bar will label the graph, so drop the in-pane `<h3>GRAPH</h3>` to avoid double-labeling.

**Files:**
- Modify: `src/components/sections/notepad/GraphPane.tsx`

- [ ] **Step 1: Delete the heading block**

Remove exactly this element (currently the first child of the `<div className="p-4 space-y-3 shrink-0">` block):

```tsx
        <h3 className="text-[10px] font-medium tracking-[0.2em]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          GRAPH
        </h3>
```

- [ ] **Step 2: Verify nothing else references it**

Run: `grep -n ">GRAPH<" src/components/sections/notepad/GraphPane.tsx`
Expected: no output.

- [ ] **Step 3: Run the existing graph tests to confirm no regression**

Run: `npm run test -- src/notepad/graph`
Expected: PASS (existing graph suite unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/notepad/GraphPane.tsx
git commit -m "refactor(graph): drop in-pane GRAPH header (tab label replaces it)"
```

---

### Task 6: `StudyWindow` tabbed container

Owns the right-pane chrome (sizing/opacity/border + expand footer) and a tab bar (Bible first, Graph second). Renders `BibleReader` or `GraphPane` (in `embedded` mode so it fills the body and drops its own outer chrome).

**Files:**
- Create: `src/components/sections/notepad/StudyWindow.tsx`
- Test: `src/components/sections/notepad/StudyWindow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/components/sections/notepad/StudyWindow.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('./GraphPane', () => ({ GraphPane: () => <div data-testid="graph-pane">graph</div> }));
vi.mock('@/notepad/bible/BibleReader', () => ({ BibleReader: () => <div data-testid="bible-reader">bible</div> }));

import { StudyWindow } from './StudyWindow';

afterEach(cleanup);

describe('StudyWindow', () => {
  it('defaults to the Bible tab', () => {
    render(<StudyWindow graphOpen={true} />);
    expect(screen.getByTestId('bible-reader')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-pane')).not.toBeInTheDocument();
  });

  it('renders Bible tab before Graph tab', () => {
    render(<StudyWindow graphOpen={true} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveTextContent(/bible/i);
    expect(tabs[1]).toHaveTextContent(/graph/i);
  });

  it('switches to the Graph tab on click', () => {
    render(<StudyWindow graphOpen={true} />);
    fireEvent.click(screen.getByRole('tab', { name: /graph/i }));
    expect(screen.getByTestId('graph-pane')).toBeInTheDocument();
    expect(screen.queryByTestId('bible-reader')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/sections/notepad/StudyWindow.test.tsx`
Expected: FAIL — cannot resolve `./StudyWindow`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/sections/notepad/StudyWindow.tsx
import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { BibleReader } from '@/notepad/bible/BibleReader';
import { GraphPane } from './GraphPane';

type StudyTab = 'bible' | 'graph';

interface StudyWindowProps {
  /** Whether the right-hand window is open (reuses the prior graph toggle). */
  graphOpen: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function StudyWindow({ graphOpen, expanded = false, onToggleExpand }: StudyWindowProps) {
  const [tab, setTab] = useState<StudyTab>('bible');

  const tabStyle = (active: boolean) => ({
    flex: 1,
    textAlign: 'center' as const,
    padding: '11px 0',
    fontSize: 10,
    letterSpacing: '0.18em',
    fontWeight: 600,
    fontFamily: 'Outfit, sans-serif',
    color: active ? 'var(--deep-umber)' : 'var(--silica)',
    background: active ? 'rgba(196,154,120,0.16)' : 'transparent',
    boxShadow: active ? 'inset 0 -2px 0 #C49A78' : 'none',
    cursor: 'pointer',
  });

  return (
    <aside
      className="overflow-hidden border-l flex-col hidden md:flex"
      style={{
        flex: expanded ? '1 1 0%' : graphOpen ? '0 0 35%' : '0 0 0px',
        borderColor: graphOpen ? 'var(--pale-stone)' : 'transparent',
        background: 'rgba(240, 236, 232, 0.4)',
        opacity: graphOpen ? 1 : 0,
        transition: 'flex 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
      }}
    >
      {/* tab bar */}
      <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--pale-stone)' }} role="tablist">
        <button role="tab" aria-selected={tab === 'bible'} onClick={() => setTab('bible')} style={tabStyle(tab === 'bible')}>
          BIBLE
        </button>
        <button role="tab" aria-selected={tab === 'graph'} onClick={() => setTab('graph')} style={tabStyle(tab === 'graph')}>
          GRAPH
        </button>
      </div>

      {/* body */}
      <div className="flex-1 relative overflow-hidden">
        {tab === 'bible' ? (
          <BibleReader />
        ) : (
          <GraphPane graphOpen={graphOpen} embedded />
        )}
      </div>

      {/* expand footer */}
      <div className="p-4 shrink-0" style={{ borderTop: '1px solid rgba(206, 204, 202, 0.5)' }}>
        <button onClick={onToggleExpand} className="flex items-center gap-2 w-full justify-center py-2 rounded-md hover:bg-black/5 transition-colors">
          {expanded
            ? <Minimize2 className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />
            : <Maximize2 className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />}
          <span className="text-[10px] font-medium tracking-widest" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
            {expanded ? 'COLLAPSE' : 'EXPAND'}
          </span>
        </button>
      </div>
    </aside>
  );
}
```

Note: `GraphPane`'s `embedded` mode already drops its own outer `<aside>`/`hidden md:flex` chrome and its own expand footer, and fills its parent — so it composes cleanly inside this body. Its `embedded` min-height is harmless inside the flex-1 body.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/sections/notepad/StudyWindow.test.tsx`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/notepad/StudyWindow.tsx src/components/sections/notepad/StudyWindow.test.tsx
git commit -m "feat(notepad): StudyWindow tabbed container (Bible | Graph)"
```

---

### Task 7: Mount `StudyWindow` in `Notepad`

**Files:**
- Modify: `src/components/sections/Notepad.tsx` (import line 14; usage line 261)

- [ ] **Step 1: Swap the import**

Replace:

```tsx
import { GraphPane } from './notepad/GraphPane';
```

with:

```tsx
import { StudyWindow } from './notepad/StudyWindow';
```

- [ ] **Step 2: Swap the element**

Replace:

```tsx
        {/* Graph Pane (static placeholder — functionality deferred) */}
        <GraphPane graphOpen={graphOpen} expanded={graphExpanded} onToggleExpand={() => setGraphExpanded(!graphExpanded)} />
```

with:

```tsx
        {/* Study Window — Bible reader + graph, tabbed */}
        <StudyWindow graphOpen={graphOpen} expanded={graphExpanded} onToggleExpand={() => setGraphExpanded(!graphExpanded)} />
```

- [ ] **Step 3: Typecheck + lint + full test run**

Run: `npx tsc -b --noEmit && npm run lint && npm run test`
Expected: no type errors, no lint errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Notepad.tsx
git commit -m "feat(notepad): mount StudyWindow in place of GraphPane"
```

---

### Task 8: Manual verification in the running app

**Files:** none (manual).

- [ ] **Step 1: Ensure `bible_passages` is populated** (see Ops prerequisite). If empty, run `npx tsx scripts/ingest-bsb.ts`.

- [ ] **Step 2: Run the app**

Run: `npm run dev`

- [ ] **Step 3: Verify**
  - Open `/notepad`, open the right-hand window (the existing graph toggle).
  - Confirm two tabs, **BIBLE first**, GRAPH second; Bible is selected by default.
  - John 1 renders with verse numbers; prev is disabled, next advances to John 2.
  - Tap the heading → navigator opens; pick Genesis → chapter 3 → reader shows Genesis 3.
  - Tap a verse → it highlights.
  - Switch to GRAPH → the existing graph renders and behaves as before; EXPAND/COLLAPSE works.

- [ ] **Step 4: No commit** (verification only). If issues are found, fix in the relevant task's files and re-run that task's tests before committing the fix.

---

## Self-Review

- **Spec coverage (Phase 1 rows only):** tabbed window ✓ (Tasks 6–7), Bible first / Graph second ✓ (Task 6 + test), free reader over all 66 books ✓ (Tasks 1–4), reads existing `bible_passages` with public RLS ✓ (Task 2). Chat/entitlement/threads/mobile are intentionally deferred (see Scope boundary).
- **Placeholder scan:** none — every code step contains complete code; every command has expected output.
- **Type consistency:** `PassageRef`/`VerseRef` defined in Task 3 and reused by callbacks; `BibleBook` exported in Task 1 and imported in Tasks 3–4/6; `ReaderVerse` from Task 2 used by Task 3. `bookByAbbrev`, `OLD_TESTAMENT`, `NEW_TESTAMENT` names consistent across tasks.

## Follow-on (separate plans — NOT in this plan)

- **Phase 2 — Lamplight chat backend + gated UI:** `lamplight-chat` Edge Function (streaming, reuses `_shared/retrieval`, `_shared/anthropic`, citation validator + doctrinal guardrail, entitlement), migration `024_lamplight_chat_threads.sql` (+ owner-only RLS), a `'chat'` feature in `useLamplightEntitlement` (gated to `plus`/promo), `LamplightChat`/`ChatMessage` components, and `BibleStudyPane` composing reader + chat with `SignInGate`/`PaywallCard`. Requires reading `_shared/{anthropic,voyage,auth-identity,cors,supabase,usage,quota}.ts` + the existing citation/guardrail modules first.
- **Phase 3 — proactive opening insight + saved-thread restore.**
- **Phase 4 — mobile parity** (wire `BibleStudyPane` into `LamplightMobileView.tsx`).
