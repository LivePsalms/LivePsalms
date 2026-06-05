# Deepen TipTap Text Extraction + SearchIndex — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate five drifted copies of `extractText` (over TipTap JSON) by lifting them to a single canonical `tiptap-text` utility, and extract `SearchDialog`'s verse/tag dedup logic into a tested `SearchIndex` module.

**Architecture:** Two pure modules, no state machines. `tiptap-text` exports `extractPlainText(node)`, `extractTextFromNote(note)`, and `countWordsFromTipTapJSON(jsonString)` — the third is preserved from the file's previous incarnation as `word-count.ts`, just refactored to reuse `extractPlainText`. `SearchIndex` exports `buildSearchIndex(notes): { verses, tags }`, each a deduped first-occurrence-wins list. Both are testable in node with no React, no DOM.

**Tech Stack:** TypeScript 5.9, Vitest, existing `extractVerseRefs` and `Note` type.

**Domain language:** see [docs/CONTEXT.md](../../CONTEXT.md) §`tiptap-text` and §`SearchIndex`. The names, the three-export shape of `tiptap-text`, and the `buildSearchIndex(notes): { verses, tags }` signature come from there — use them exactly.

**Behavior preservation note (InfoPanel):** the previous `InfoPanel.tsx:16` `extractText` was missing the `type === 'text'` gate, returning `node.text` on any node that happened to have a `text` field. On valid TipTap docs (where only leaf text nodes have a `text` field) this is observationally identical to the canonical version. The migration converges on the safer canonical implementation — effectively a defensive fix.

---

## File Structure

### New files
- `src/notepad/utils/tiptap-text.ts` — canonical `extractPlainText`, `extractTextFromNote`, `countWordsFromTipTapJSON`
- `src/notepad/utils/tiptap-text.test.ts` — node-only tests for all three exports
- `src/notepad/components/search-index.ts` — `buildSearchIndex(notes): { verses, tags }`
- `src/notepad/components/search-index.test.ts` — node-only tests for the dedup index

### Deleted files
- `src/notepad/utils/word-count.ts` — replaced by `tiptap-text.ts`

### Modified files
- `src/notepad/storage/local-storage.ts` — import `countWordsFromTipTapJSON` from `tiptap-text`
- `src/notepad/storage/supabase-adapter.ts` — same
- `src/notepad/import/document-importer.ts` — drop local `extractTextFromNote` and `extractTextRecursive`; import both `countWordsFromTipTapJSON` and `extractTextFromNote` from `tiptap-text`
- `src/notepad/import/document-importer.test.ts` — update import path of `extractTextFromNote` from `./document-importer` to the canonical `../utils/tiptap-text`
- `src/notepad/graph/reference-parser.ts` — drop local `extractPlainText`; import canonical
- `src/notepad/components/InfoPanel.tsx` — drop local `extractText` and the inline parse/fallback; consume `extractTextFromNote`
- `src/notepad/components/SearchDialog.tsx` — drop local `extractText`, drop the three inline `useMemo`s for `searchData`/`uniqueVerses`/`uniqueTags`; consume `buildSearchIndex` (single `useMemo`)
- `docs/CONTEXT.md` — already updated in design phase

### No changes
- `src/notepad/extensions/bible-verse-utils.ts` — `extractVerseRefs` is the layer above text extraction and stays as is
- `src/notepad/utils/tags.ts` — tag parsing is independent of TipTap traversal

---

## Task 1: Create `tiptap-text.ts` with all three canonical exports

**Files:**
- Create: `src/notepad/utils/tiptap-text.ts`
- Create: `src/notepad/utils/tiptap-text.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/notepad/utils/tiptap-text.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  extractPlainText,
  extractTextFromNote,
  countWordsFromTipTapJSON,
} from './tiptap-text';
import type { Note } from '../types';

const makeNote = (overrides: Partial<Note> & { id: string; content: string }): Note => ({
  title: 'Untitled',
  folderId: 'root',
  type: 'devotion',
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  wordCount: 0,
  ...overrides,
} as Note);

describe('extractPlainText', () => {
  it('returns the text of a single text leaf', () => {
    expect(extractPlainText({ type: 'text', text: 'hello' })).toBe('hello');
  });

  it('joins children of a paragraph on a single space', () => {
    const doc = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'hello' },
        { type: 'text', text: 'world' },
      ],
    };
    expect(extractPlainText(doc)).toBe('hello world');
  });

  it('recurses through doc → paragraph → text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'first paragraph' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'second paragraph' }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('first paragraph second paragraph');
  });

  it('returns empty string for non-objects', () => {
    expect(extractPlainText(null)).toBe('');
    expect(extractPlainText(undefined)).toBe('');
    expect(extractPlainText('hello')).toBe('');
    expect(extractPlainText(42)).toBe('');
  });

  it('returns empty string for an object with no text and no content', () => {
    expect(extractPlainText({ type: 'horizontalRule' })).toBe('');
  });

  it('ignores a `text` field on a node whose type is not "text" (gates on type === "text")', () => {
    // A non-text node with a stray `text` field — should NOT be picked up.
    const doc = {
      type: 'paragraph',
      text: 'IGNORED',
      content: [{ type: 'text', text: 'real content' }],
    };
    expect(extractPlainText(doc)).toBe('real content');
  });

  it('ignores a node with type === "text" but a non-string `text` field', () => {
    expect(extractPlainText({ type: 'text', text: 42 })).toBe('');
  });
});

describe('extractTextFromNote', () => {
  it('parses note.content as TipTap JSON and returns the joined text', () => {
    const note = makeNote({
      id: 'n1',
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] },
        ],
      }),
    });
    expect(extractTextFromNote(note)).toBe('hello world');
  });

  it('falls back to note.content as raw text when JSON.parse throws', () => {
    const note = makeNote({ id: 'n1', content: 'not json {{{' });
    expect(extractTextFromNote(note)).toBe('not json {{{');
  });

  it('returns empty string for an empty TipTap doc', () => {
    const note = makeNote({
      id: 'n1',
      content: JSON.stringify({ type: 'doc', content: [] }),
    });
    expect(extractTextFromNote(note)).toBe('');
  });
});

describe('countWordsFromTipTapJSON', () => {
  it('returns 0 for empty input', () => {
    expect(countWordsFromTipTapJSON('')).toBe(0);
  });

  it('counts words in a parsed TipTap JSON document', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one two three' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'four five' }] },
      ],
    });
    expect(countWordsFromTipTapJSON(json)).toBe(5);
  });

  it('treats non-JSON input as plain text and counts words', () => {
    expect(countWordsFromTipTapJSON('plain text content here')).toBe(4);
  });

  it('returns 0 for a TipTap doc that contains only whitespace', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }],
    });
    expect(countWordsFromTipTapJSON(json)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/utils/tiptap-text.test.ts`
Expected: FAIL — `Cannot find module './tiptap-text'`.

- [ ] **Step 3: Create the module**

Create `src/notepad/utils/tiptap-text.ts`:

```ts
import type { Note } from '../types';

/**
 * Recursively extracts plain text from a parsed TipTap JSON tree.
 * Canonical implementation — every TipTap text-extraction in the codebase
 * routes through here. Defensive on `unknown` input: returns '' on any
 * non-object. Joins child text on a single space.
 */
export function extractPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  if (n.type === 'text' && typeof n.text === 'string') {
    return n.text;
  }
  if (Array.isArray(n.content)) {
    return n.content.map(extractPlainText).join(' ');
  }
  return '';
}

/**
 * Tries to parse `note.content` as TipTap JSON and extract its text.
 * Falls back to the raw `note.content` string when parsing fails — a
 * note authored as plain text (or stored via legacy paths) still yields
 * usable text for word count, search, and reference detection.
 */
export function extractTextFromNote(note: Note): string {
  try {
    const doc = JSON.parse(note.content);
    return extractPlainText(doc);
  } catch {
    return note.content;
  }
}

/**
 * Counts whitespace-separated words in `note.content` after extracting
 * plain text from its TipTap JSON. Treats non-JSON input as plain text.
 * Returns 0 for empty or whitespace-only input.
 */
export function countWordsFromTipTapJSON(jsonString: string): number {
  if (!jsonString) return 0;
  let text: string;
  try {
    text = extractPlainText(JSON.parse(jsonString));
  } catch {
    text = jsonString;
  }
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/utils/tiptap-text.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/utils/tiptap-text.ts src/notepad/utils/tiptap-text.test.ts docs/CONTEXT.md
git commit -m "feat(utils): canonical tiptap-text utility (extractPlainText, extractTextFromNote, countWords)"
```

---

## Task 2: Migrate storage adapters and document-importer to `tiptap-text`

**Files:**
- Modify: `src/notepad/storage/local-storage.ts`
- Modify: `src/notepad/storage/supabase-adapter.ts`
- Modify: `src/notepad/import/document-importer.ts`
- Modify: `src/notepad/import/document-importer.test.ts`

The mechanical bulk: swap the import paths and delete the now-redundant local helper in `document-importer.ts`.

- [ ] **Step 1: Update `local-storage.ts` import**

In `src/notepad/storage/local-storage.ts`, replace:

```ts
import { countWordsFromTipTapJSON } from '../utils/word-count';
```

with:

```ts
import { countWordsFromTipTapJSON } from '../utils/tiptap-text';
```

- [ ] **Step 2: Update `supabase-adapter.ts` import**

Same change in `src/notepad/storage/supabase-adapter.ts`:

```ts
import { countWordsFromTipTapJSON } from '../utils/tiptap-text';
```

- [ ] **Step 3: Update `document-importer.ts` — drop local helpers, import canonical**

In `src/notepad/import/document-importer.ts`:

Replace the existing import:

```ts
import { countWordsFromTipTapJSON } from '../utils/word-count';
```

with:

```ts
import {
  countWordsFromTipTapJSON,
  extractTextFromNote,
} from '../utils/tiptap-text';
```

Then delete the local definitions of `extractTextFromNote` (line ~140) and `extractTextRecursive` (line ~149). The file currently has:

```ts
export function extractTextFromNote(note: Note): string {
  try {
    const doc = JSON.parse(note.content) as Record<string, unknown>;
    return extractTextRecursive(doc);
  } catch {
    return note.content;
  }
}

function extractTextRecursive(node: Record<string, unknown>): string {
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractTextRecursive).join(' ');
  }
  return '';
}
```

Delete both. The internal call at line 123 (`extractTextFromNote(n)`) now binds to the imported version.

- [ ] **Step 4: Update `document-importer.test.ts` import**

In `src/notepad/import/document-importer.test.ts`, replace the existing import block at the top:

```ts
import {
  buildNoteFromText,
  linkNotesByVerses,
  extractTextFromNote,
} from './document-importer';
```

with:

```ts
import {
  buildNoteFromText,
  linkNotesByVerses,
} from './document-importer';
import { extractTextFromNote } from '../utils/tiptap-text';
```

- [ ] **Step 5: Run tests + type-check**

Run: `npx tsc -b && npm test`
Expected: type-check clean, all tests still pass — `document-importer.test.ts`'s assertions on `extractTextFromNote` continue to hold because the canonical implementation is behaviorally identical.

- [ ] **Step 6: Commit**

```bash
git add src/notepad/storage/local-storage.ts src/notepad/storage/supabase-adapter.ts src/notepad/import/document-importer.ts src/notepad/import/document-importer.test.ts
git commit -m "refactor(storage,import): migrate to canonical tiptap-text utility"
```

---

## Task 3: Migrate `reference-parser.ts` and `InfoPanel.tsx`; delete `word-count.ts`

**Files:**
- Modify: `src/notepad/graph/reference-parser.ts`
- Modify: `src/notepad/components/InfoPanel.tsx`
- Delete: `src/notepad/utils/word-count.ts`

- [ ] **Step 1: Update `reference-parser.ts`**

In `src/notepad/graph/reference-parser.ts`:

Add import at the top of the file (alongside the other imports):

```ts
import { extractPlainText } from '../utils/tiptap-text';
```

Then delete the local `extractPlainText` function (lines ~189–203 today):

```ts
function extractPlainText(doc: unknown): string {
  const parts: string[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && typeof n.text === 'string') {
      parts.push(n.text);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(doc);
  return parts.join(' ');
}
```

The internal call at line ~333 (`const plainText = extractPlainText(doc)`) now binds to the import.

Note on output equivalence: the deleted `walk + parts.push` shape and the canonical recursive `map + join` shape both produce text-leaf strings joined by `' '`. For the same input doc the strings are identical.

- [ ] **Step 2: Update `InfoPanel.tsx`**

In `src/notepad/components/InfoPanel.tsx`:

Add the import:

```ts
import { extractTextFromNote } from '../utils/tiptap-text';
```

Then delete the local `TipTapNode` interface (lines ~10–14) and `extractText` function (lines ~16–22):

```ts
interface TipTapNode {
  text?: string;
  content?: TipTapNode[];
  [key: string]: unknown;
}

function extractText(node: TipTapNode): string {
  if (node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractText).join(' ');
  }
  return '';
}
```

Then replace the inline parse/extract block inside the `useMemo`. Currently:

```tsx
    let plainText = '';
    try {
      const json = JSON.parse(activeNote.content) as TipTapNode;
      plainText = extractText(json);
    } catch {
      plainText = activeNote.content;
    }
```

becomes:

```tsx
    const plainText = extractTextFromNote(activeNote);
```

This collapses 7 lines into 1 and routes through the canonical helper. Behavior preservation: the previous local implementation was missing the `type === 'text'` gate, but on valid TipTap docs (the only kind `activeNote.content` ever holds via `useNoteEditor` saves) the output is identical.

- [ ] **Step 3: Delete `word-count.ts`**

```bash
rm src/notepad/utils/word-count.ts
```

- [ ] **Step 4: Run tests + type-check**

Run: `npx tsc -b && npm test`
Expected: type-check clean, all tests pass. `word-count.ts` had no test file, so no tests are lost.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/graph/reference-parser.ts src/notepad/components/InfoPanel.tsx
git rm src/notepad/utils/word-count.ts
git commit -m "refactor: migrate reference-parser + InfoPanel to tiptap-text; delete word-count.ts"
```

---

## Task 4: Create `search-index.ts` with `buildSearchIndex`

**Files:**
- Create: `src/notepad/components/search-index.ts`
- Create: `src/notepad/components/search-index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/notepad/components/search-index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSearchIndex } from './search-index';
import type { Note } from '../types';

const makeNote = (overrides: Partial<Note> & { id: string }): Note => ({
  title: 'Untitled',
  content: JSON.stringify({ type: 'doc', content: [] }),
  folderId: 'root',
  type: 'devotion',
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  wordCount: 0,
  ...overrides,
} as Note);

const docWithText = (text: string) =>
  JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });

describe('buildSearchIndex — empty input', () => {
  it('returns empty arrays for an empty notes list', () => {
    expect(buildSearchIndex([])).toEqual({ verses: [], tags: [] });
  });

  it('returns empty arrays for notes with no verses or tags', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'Hello', content: docWithText('just plain text') }),
    ];
    expect(buildSearchIndex(notes)).toEqual({ verses: [], tags: [] });
  });
});

describe('buildSearchIndex — verses', () => {
  it('extracts verse refs from each note’s plain text', () => {
    const notes = [
      makeNote({
        id: 'n1',
        title: 'On Hope',
        content: docWithText('See Psalm 23:1 for context'),
      }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses).toEqual([
      { ref: 'Psalm 23:1', noteId: 'n1', noteTitle: 'On Hope' },
    ]);
  });

  it('dedups by ref string, first-occurrence wins', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'First', content: docWithText('Psalm 23:1 here') }),
      makeNote({
        id: 'n2',
        title: 'Second',
        content: docWithText('Psalm 23:1 again'),
      }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses).toEqual([
      { ref: 'Psalm 23:1', noteId: 'n1', noteTitle: 'First' },
    ]);
  });

  it('preserves multiple distinct verses across notes', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'A', content: docWithText('Psalm 23:1 first') }),
      makeNote({ id: 'n2', title: 'B', content: docWithText('John 3:16 second') }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses).toHaveLength(2);
    expect(result.verses.map((v) => v.ref)).toEqual(['Psalm 23:1', 'John 3:16']);
  });

  it('falls back to raw note.content when JSON.parse fails (extractTextFromNote contract)', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'Raw', content: 'plain text Psalm 23:1 still found' }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses.map((v) => v.ref)).toEqual(['Psalm 23:1']);
  });
});

describe('buildSearchIndex — tags', () => {
  it('reads tags directly from note.tags (not from content)', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'Tagged', tags: ['hope', 'faith'] }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.tags).toEqual([
      { tag: 'hope', noteId: 'n1', noteTitle: 'Tagged' },
      { tag: 'faith', noteId: 'n1', noteTitle: 'Tagged' },
    ]);
  });

  it('dedups by tag string, first-occurrence wins', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'First', tags: ['hope'] }),
      makeNote({ id: 'n2', title: 'Second', tags: ['hope'] }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.tags).toEqual([
      { tag: 'hope', noteId: 'n1', noteTitle: 'First' },
    ]);
  });
});

describe('buildSearchIndex — verses and tags together', () => {
  it('produces both indexes from a mixed-content note set', () => {
    const notes = [
      makeNote({
        id: 'n1',
        title: 'Mixed',
        content: docWithText('See Psalm 23:1'),
        tags: ['scripture'],
      }),
      makeNote({
        id: 'n2',
        title: 'Other',
        content: docWithText('John 3:16'),
        tags: ['scripture', 'hope'],
      }),
    ];
    const result = buildSearchIndex(notes);
    expect(result.verses.map((v) => v.ref)).toEqual(['Psalm 23:1', 'John 3:16']);
    expect(result.tags.map((t) => t.tag)).toEqual(['scripture', 'hope']);
    expect(result.tags[0].noteId).toBe('n1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/components/search-index.test.ts`
Expected: FAIL — `Cannot find module './search-index'`.

- [ ] **Step 3: Create the module**

Create `src/notepad/components/search-index.ts`:

```ts
import type { Note } from '../types';
import { extractTextFromNote } from '../utils/tiptap-text';
import { extractVerseRefs } from '../extensions/bible-verse-utils';

export interface SearchIndexVerseEntry {
  ref: string;
  noteId: string;
  noteTitle: string;
}

export interface SearchIndexTagEntry {
  tag: string;
  noteId: string;
  noteTitle: string;
}

export interface SearchIndex {
  verses: SearchIndexVerseEntry[];
  tags: SearchIndexTagEntry[];
}

export function buildSearchIndex(notes: Note[]): SearchIndex {
  const verses = new Map<string, SearchIndexVerseEntry>();
  const tags = new Map<string, SearchIndexTagEntry>();

  for (const note of notes) {
    const text = extractTextFromNote(note);
    for (const ref of extractVerseRefs(text)) {
      if (!verses.has(ref)) {
        verses.set(ref, { ref, noteId: note.id, noteTitle: note.title });
      }
    }
    for (const tag of note.tags) {
      if (!tags.has(tag)) {
        tags.set(tag, { tag, noteId: note.id, noteTitle: note.title });
      }
    }
  }

  return {
    verses: [...verses.values()],
    tags: [...tags.values()],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/components/search-index.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/search-index.ts src/notepad/components/search-index.test.ts
git commit -m "feat(search): buildSearchIndex pure module"
```

---

## Task 5: Wire `buildSearchIndex` into `SearchDialog`

**Files:**
- Modify: `src/notepad/components/SearchDialog.tsx`

- [ ] **Step 1: Replace the inline extractText, useMemos, and dedup logic**

Rewrite the top of `src/notepad/components/SearchDialog.tsx`. The new file structure:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, FileText, Hash } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useNoteCollection } from '../context/useNoteCollection';
import { buildSearchIndex } from './search-index';

export function SearchDialog() {
  const { notes, collection } = useNoteCollection();
  const openNote = collection.openNote;
  const [open, setOpen] = useState(false);

  // Cmd+K / Ctrl+K toggles the dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { verses: uniqueVerses, tags: uniqueTags } = useMemo(
    () => buildSearchIndex(notes),
    [notes],
  );

  const handleSelectNote = (id: string) => {
    openNote(id);
    setOpen(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search notes, verses, tags..."
    >
      <CommandInput placeholder="Search notes, verses, tags..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Notes">
          {notes.map((note) => (
            <CommandItem
              key={note.id}
              value={`note-${note.id}-${note.title}`}
              onSelect={() => handleSelectNote(note.id)}
            >
              <FileText style={{ color: 'var(--silica)' }} />
              <span>{note.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Verses">
          {uniqueVerses.map(({ ref, noteId, noteTitle }) => (
            <CommandItem
              key={`verse-${ref}`}
              value={`verse-${ref}`}
              onSelect={() => handleSelectNote(noteId)}
            >
              <BookOpen style={{ color: '#C49A78' }} />
              <span>{ref}</span>
              <span className="ml-auto text-xs opacity-50 truncate max-w-[140px]">{noteTitle}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Tags">
          {uniqueTags.map(({ tag, noteId, noteTitle }) => (
            <CommandItem
              key={`tag-${tag}`}
              value={`tag-${tag}`}
              onSelect={() => handleSelectNote(noteId)}
            >
              <Hash style={{ color: 'var(--silica)' }} />
              <span>{tag}</span>
              <span className="ml-auto text-xs opacity-50 truncate max-w-[140px]">{noteTitle}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

Key diffs from the original:
- Local `extractText` function: deleted
- Local `extractVerseRefs` import: dropped (now flows through `buildSearchIndex`)
- Three separate `useMemo`s (`searchData`, `uniqueVerses`, `uniqueTags`): collapsed into one `useMemo` over `buildSearchIndex(notes)`
- The intermediate `searchData` array (with per-note `plainText` and `verseRefs`): no longer materialized — never read by anything else

- [ ] **Step 2: Type-check + run all tests**

Run: `npx tsc -b && npm test`
Expected: type-check clean, all tests still pass plus the 15 + 10 = 25 new tests across `tiptap-text` and `search-index`.

- [ ] **Step 3: Smoke-test in the browser**

Run: `npm run dev` and exercise:
1. Open the notepad with several existing notes containing verse references and tags.
2. Press Cmd+K (Mac) or Ctrl+K (Windows/Linux).
3. Verify the dialog shows three groups: Notes, Verses, Tags.
4. Type a verse reference (e.g. "Psalm 23") — the verse appears in the Verses group; selecting it opens the first note containing that verse.
5. Type a tag — appears in the Tags group; selecting opens the first note with that tag.
6. Type a note title — appears in the Notes group.
7. Verify dedup: a verse referenced in multiple notes appears only once, mapped to the first note.
8. Verify the InfoPanel still reports correct word/verse counts for the active note (regression check on the `extractTextFromNote` migration).

Expected: behavior matches pre-deepening exactly.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/components/SearchDialog.tsx
git commit -m "refactor(search-dialog): consume buildSearchIndex; drop inline extractText + dedup"
```

---

## Self-review checklist (run after Task 5)

- [ ] No `function extractText` / `function extractPlainText` / `function extractTextRecursive` definition remains anywhere outside `src/notepad/utils/tiptap-text.ts`.
- [ ] `src/notepad/utils/word-count.ts` no longer exists.
- [ ] All 5 previous callsites import from `../utils/tiptap-text` (or its relative path) — verifiable with `grep -rn "from.*tiptap-text" src` returning at least 5 hits.
- [ ] `document-importer.ts` no longer exports `extractTextFromNote` itself; the test imports from `../utils/tiptap-text`.
- [ ] `SearchDialog.tsx` no longer imports `extractVerseRefs` directly.
- [ ] `InfoPanel.tsx` no longer has a local `TipTapNode` interface or `extractText` function.
- [ ] All 25 new tests pass; existing tests still pass (no regressions in `document-importer.test.ts`, `reference-graph.test.ts`, `reference-parser.test.ts`).
- [ ] CONTEXT.md §`tiptap-text` and §`SearchIndex` reflect the implemented modules.
