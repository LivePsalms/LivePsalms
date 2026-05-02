# Notepad Functionality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Notepad shell with a fully functional note-taking workspace — real CRUD, rich-text editing with Bible verse detection and note linking, file management with drag-and-drop, upload support, and global search.

**Architecture:** Storage adapter pattern with localStorage implementation behind a React context. TipTap editor with custom extensions for Bible verses, note links, and tags. @dnd-kit for sidebar drag-and-drop. All data flows through a `NotepadProvider` context.

**Tech Stack:** TipTap, @dnd-kit/react, react-dropzone, pdfjs-dist, mammoth, uuid, shadcn/ui (ContextMenu, CommandDialog, Dialog, AlertDialog, Select, Checkbox, DropdownMenu)

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install TipTap packages**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/pm
```

- [ ] **Step 2: Install drag-and-drop packages**

```bash
npm install @dnd-kit/react
```

Note: `@dnd-kit/react` is the v4 React package — it bundles core, sortable, and utilities.

- [ ] **Step 3: Install file handling packages**

```bash
npm install react-dropzone pdfjs-dist mammoth uuid
npm install -D @types/uuid
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install notepad dependencies (tiptap, dnd-kit, dropzone, pdf/docx parsers)"
```

---

## Task 2: Types & Storage Adapter

**Files:**
- Create: `src/notepad/types.ts`
- Create: `src/notepad/storage/adapter.ts`
- Create: `src/notepad/storage/local-storage.ts`

- [ ] **Step 1: Create types**

Create `src/notepad/types.ts`:

```typescript
export type NoteType = 'devotion' | 'sermon' | 'theme';

export interface Note {
  id: string;
  title: string;
  content: string; // TipTap JSON stringified
  folderId: string;
  type: NoteType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
}
```

- [ ] **Step 2: Create storage adapter interface**

Create `src/notepad/storage/adapter.ts`:

```typescript
import type { Note, Folder } from '../types';

export interface StorageAdapter {
  getNotes(): Promise<Note[]>;
  getNote(id: string): Promise<Note | null>;
  createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note>;
  updateNote(id: string, updates: Partial<Note>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  duplicateNote(id: string): Promise<Note>;

  getFolders(): Promise<Folder[]>;
  createFolder(folder: Omit<Folder, 'id'>): Promise<Folder>;
  updateFolder(id: string, updates: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;
}
```

- [ ] **Step 3: Create localStorage implementation**

Create `src/notepad/storage/local-storage.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { Note, Folder } from '../types';
import type { StorageAdapter } from './adapter';

const NOTES_KEY = 'notepad_notes';
const FOLDERS_KEY = 'notepad_folders';

export class LocalStorageAdapter implements StorageAdapter {
  private readNotes(): Note[] {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private writeNotes(notes: Note[]): void {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  private readFolders(): Folder[] {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private writeFolders(folders: Folder[]): void {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }

  async getNotes(): Promise<Note[]> {
    return this.readNotes();
  }

  async getNote(id: string): Promise<Note | null> {
    return this.readNotes().find((n) => n.id === id) ?? null;
  }

  async createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const now = new Date().toISOString();
    const newNote: Note = { ...note, id: uuidv4(), createdAt: now, updatedAt: now };
    const notes = this.readNotes();
    notes.push(newNote);
    this.writeNotes(notes);
    return newNote;
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    const notes = this.readNotes();
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) throw new Error(`Note ${id} not found`);
    notes[index] = { ...notes[index], ...updates, updatedAt: new Date().toISOString() };
    this.writeNotes(notes);
    return notes[index];
  }

  async deleteNote(id: string): Promise<void> {
    this.writeNotes(this.readNotes().filter((n) => n.id !== id));
  }

  async duplicateNote(id: string): Promise<Note> {
    const note = this.readNotes().find((n) => n.id === id);
    if (!note) throw new Error(`Note ${id} not found`);
    const now = new Date().toISOString();
    const dup: Note = { ...note, id: uuidv4(), title: `${note.title} (copy)`, createdAt: now, updatedAt: now };
    const notes = this.readNotes();
    notes.push(dup);
    this.writeNotes(notes);
    return dup;
  }

  async getFolders(): Promise<Folder[]> {
    return this.readFolders();
  }

  async createFolder(folder: Omit<Folder, 'id'>): Promise<Folder> {
    const newFolder: Folder = { ...folder, id: uuidv4() };
    const folders = this.readFolders();
    folders.push(newFolder);
    this.writeFolders(folders);
    return newFolder;
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
    const folders = this.readFolders();
    const index = folders.findIndex((f) => f.id === id);
    if (index === -1) throw new Error(`Folder ${id} not found`);
    folders[index] = { ...folders[index], ...updates };
    this.writeFolders(folders);
    return folders[index];
  }

  async deleteFolder(id: string): Promise<void> {
    this.writeFolders(this.readFolders().filter((f) => f.id !== id));
    // Also move notes in this folder to root (folderId = 'root')
    const notes = this.readNotes().map((n) => (n.folderId === id ? { ...n, folderId: 'root' } : n));
    this.writeNotes(notes);
  }
}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/
git commit -m "feat(notepad): add types and localStorage storage adapter"
```

---

## Task 3: NotepadProvider Context

**Files:**
- Create: `src/notepad/context/NotepadProvider.tsx`
- Create: `src/notepad/context/useNotepad.ts`

- [ ] **Step 1: Create the context provider**

Create `src/notepad/context/NotepadProvider.tsx`:

```tsx
import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Note, Folder, NoteType } from '../types';
import type { StorageAdapter } from '../storage/adapter';
import { LocalStorageAdapter } from '../storage/local-storage';

export interface NotepadContextValue {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  activeNote: Note | null;

  // Note actions
  openNote: (id: string) => void;
  createNote: (folderId: string, type: NoteType) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  duplicateNote: (id: string) => Promise<void>;
  moveNote: (id: string, folderId: string) => Promise<void>;
  renameNote: (id: string, title: string) => Promise<void>;

  // Folder actions
  createFolder: (name: string, parentId: string | null) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;

  // Bulk
  importNotes: (notes: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<Note[]>;

  // Refresh
  refresh: () => Promise<void>;
}

export const NotepadContext = createContext<NotepadContextValue | null>(null);

export function NotepadProvider({ children }: { children: ReactNode }) {
  const adapterRef = useRef<StorageAdapter>(new LocalStorageAdapter());
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [n, f] = await Promise.all([
      adapterRef.current.getNotes(),
      adapterRef.current.getFolders(),
    ]);
    setNotes(n);
    setFolders(f);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  const openNote = useCallback((id: string) => {
    setActiveNoteId(id);
  }, []);

  const createNote = useCallback(async (folderId: string, type: NoteType) => {
    const note = await adapterRef.current.createNote({
      title: 'Untitled',
      content: '',
      folderId,
      type,
      tags: [],
    });
    await refresh();
    setActiveNoteId(note.id);
    return note;
  }, [refresh]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    await adapterRef.current.updateNote(id, updates);
    await refresh();
  }, [refresh]);

  const deleteNote = useCallback(async (id: string) => {
    await adapterRef.current.deleteNote(id);
    if (activeNoteId === id) setActiveNoteId(null);
    await refresh();
  }, [activeNoteId, refresh]);

  const duplicateNote = useCallback(async (id: string) => {
    const dup = await adapterRef.current.duplicateNote(id);
    await refresh();
    setActiveNoteId(dup.id);
  }, [refresh]);

  const moveNote = useCallback(async (id: string, folderId: string) => {
    await adapterRef.current.updateNote(id, { folderId });
    await refresh();
  }, [refresh]);

  const renameNote = useCallback(async (id: string, title: string) => {
    await adapterRef.current.updateNote(id, { title });
    await refresh();
  }, [refresh]);

  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    const allFolders = await adapterRef.current.getFolders();
    const order = allFolders.filter((f) => f.parentId === parentId).length;
    const folder = await adapterRef.current.createFolder({ name, parentId, order });
    await refresh();
    return folder;
  }, [refresh]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    await adapterRef.current.updateFolder(id, { name });
    await refresh();
  }, [refresh]);

  const deleteFolder = useCallback(async (id: string) => {
    await adapterRef.current.deleteFolder(id);
    await refresh();
  }, [refresh]);

  const importNotes = useCallback(async (noteDrafts: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    const created: Note[] = [];
    for (const draft of noteDrafts) {
      const note = await adapterRef.current.createNote(draft);
      created.push(note);
    }
    await refresh();
    return created;
  }, [refresh]);

  return (
    <NotepadContext.Provider
      value={{
        notes,
        folders,
        activeNoteId,
        activeNote,
        openNote,
        createNote,
        updateNote,
        deleteNote,
        duplicateNote,
        moveNote,
        renameNote,
        createFolder,
        renameFolder,
        deleteFolder,
        importNotes,
        refresh,
      }}
    >
      {children}
    </NotepadContext.Provider>
  );
}
```

- [ ] **Step 2: Create the useNotepad hook**

Create `src/notepad/context/useNotepad.ts`:

```typescript
import { useContext } from 'react';
import { NotepadContext } from './NotepadProvider';
import type { NotepadContextValue } from './NotepadProvider';

export function useNotepad(): NotepadContextValue {
  const ctx = useContext(NotepadContext);
  if (!ctx) throw new Error('useNotepad must be used within a NotepadProvider');
  return ctx;
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/context/
git commit -m "feat(notepad): add NotepadProvider context and useNotepad hook"
```

---

## Task 4: Bible Verse Utilities & TipTap Extension

**Files:**
- Create: `src/notepad/extensions/bible-verse-utils.ts`
- Create: `src/notepad/extensions/bible-verse.ts`

- [ ] **Step 1: Create verse regex utilities**

Create `src/notepad/extensions/bible-verse-utils.ts`:

```typescript
// All 66 books with common abbreviations
const BOOK_PATTERNS = [
  'Genesis|Gen', 'Exodus|Exod|Ex', 'Leviticus|Lev', 'Numbers|Num',
  'Deuteronomy|Deut', 'Joshua|Josh', 'Judges|Judg',
  'Ruth', '1 Samuel|1 Sam', '2 Samuel|2 Sam',
  '1 Kings|1 Kgs', '2 Kings|2 Kgs',
  '1 Chronicles|1 Chr', '2 Chronicles|2 Chr',
  'Ezra', 'Nehemiah|Neh', 'Esther|Est',
  'Job', 'Psalms?|Ps', 'Proverbs|Prov',
  'Ecclesiastes|Eccl', 'Song of Solomon|Song', 'Isaiah|Isa',
  'Jeremiah|Jer', 'Lamentations|Lam', 'Ezekiel|Ezek',
  'Daniel|Dan', 'Hosea|Hos', 'Joel', 'Amos',
  'Obadiah|Obad', 'Jonah', 'Micah|Mic', 'Nahum|Nah',
  'Habakkuk|Hab', 'Zephaniah|Zeph', 'Haggai|Hag',
  'Zechariah|Zech', 'Malachi|Mal',
  'Matthew|Matt', 'Mark', 'Luke', 'John',
  'Acts', 'Romans|Rom', '1 Corinthians|1 Cor',
  '2 Corinthians|2 Cor', 'Galatians|Gal', 'Ephesians|Eph',
  'Philippians|Phil', 'Colossians|Col',
  '1 Thessalonians|1 Thess', '2 Thessalonians|2 Thess',
  '1 Timothy|1 Tim', '2 Timothy|2 Tim', 'Titus',
  'Philemon|Phlm', 'Hebrews|Heb', 'James|Jas',
  '1 Peter|1 Pet', '2 Peter|2 Pet',
  '1 John', '2 John', '3 John', 'Jude',
  'Revelation|Rev',
];

const bookGroup = BOOK_PATTERNS.map((p) => `(?:${p})`).join('|');

// Matches: "Romans 8:28", "1 Peter 5:7", "Gen 22:8", "Romans 8:28-30"
export const VERSE_REGEX = new RegExp(
  `(?:${bookGroup})\\s+\\d{1,3}:\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?`,
  'g'
);

// Same pattern but for TipTap inline decoration (no global flag, anchored to end for inputRule)
export const VERSE_INPUT_REGEX = new RegExp(
  `((?:${bookGroup})\\s+\\d{1,3}:\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)$`
);

// Same but for paste rules (surrounded by optional whitespace)
export const VERSE_PASTE_REGEX = new RegExp(
  `((?:${bookGroup})\\s+\\d{1,3}:\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)`,
  'g'
);

/**
 * Normalize a verse reference string into an API-friendly format
 * e.g. "Romans 8:28" -> "Romans+8:28", "1 Peter 5:7" -> "1Peter+5:7"
 */
export function normalizeVerseRef(ref: string): string {
  return ref.trim().replace(/\s+(\d+:\d+)/, '+$1').replace(/\s+/g, '');
}

/**
 * Fetch verse text from bible-api.com
 */
export async function fetchVerseText(ref: string): Promise<{ text: string; reference: string; translation: string } | null> {
  try {
    const normalized = normalizeVerseRef(ref);
    const res = await fetch(`https://bible-api.com/${encodeURIComponent(normalized)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      text: data.text?.trim() ?? '',
      reference: data.reference ?? ref,
      translation: data.translation_name ?? 'KJV',
    };
  } catch {
    return null;
  }
}

/**
 * Extract all verse references from a text string
 */
export function extractVerseRefs(text: string): string[] {
  const matches = text.match(VERSE_REGEX);
  return matches ? [...new Set(matches)] : [];
}
```

- [ ] **Step 2: Create TipTap Bible verse Mark extension**

Create `src/notepad/extensions/bible-verse.ts`:

```typescript
import { Mark, markInputRule, markPasteRule } from '@tiptap/core';
import { VERSE_INPUT_REGEX, VERSE_PASTE_REGEX } from './bible-verse-utils';

export const BibleVerse = Mark.create({
  name: 'bibleVerse',

  addAttributes() {
    return {
      reference: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-reference'),
        renderHTML: (attrs) => ({ 'data-reference': attrs.reference }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-bible-verse]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-bible-verse': '',
        style: 'font-style: italic; text-decoration: underline; text-decoration-color: #F59E0B; text-underline-offset: 3px; cursor: pointer;',
      },
      0,
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: VERSE_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({ reference: match[1] }),
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: VERSE_PASTE_REGEX,
        type: this.type,
        getAttributes: (match) => ({ reference: match[1] }),
      }),
    ];
  },
});
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/extensions/
git commit -m "feat(notepad): add Bible verse regex utils and TipTap mark extension"
```

---

## Task 5: Note Link TipTap Extension

**Files:**
- Create: `src/notepad/extensions/note-link.ts`

- [ ] **Step 1: Create note link Mark extension**

Create `src/notepad/extensions/note-link.ts`:

```typescript
import { Mark } from '@tiptap/core';

export const NoteLink = Mark.create({
  name: 'noteLink',

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-note-id'),
        renderHTML: (attrs) => ({ 'data-note-id': attrs.noteId }),
      },
      noteTitle: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-note-title'),
        renderHTML: (attrs) => ({ 'data-note-title': attrs.noteTitle }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-note-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-note-link': '',
        style: 'text-decoration: underline; text-decoration-color: #38BDF8; text-underline-offset: 3px; cursor: pointer;',
      },
      0,
    ];
  },
});
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/notepad/extensions/note-link.ts
git commit -m "feat(notepad): add note link TipTap mark extension"
```

---

## Task 6: Tag Mark TipTap Extension

**Files:**
- Create: `src/notepad/extensions/tag-mark.ts`

- [ ] **Step 1: Create tag Mark extension**

Create `src/notepad/extensions/tag-mark.ts`:

```typescript
import { Mark, markInputRule, markPasteRule } from '@tiptap/core';

// Matches #tagname (word characters, no spaces)
const TAG_INPUT_REGEX = /(#\w+)$/;
const TAG_PASTE_REGEX = /(#\w+)/g;

export const TagMark = Mark.create({
  name: 'tagMark',

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-tag'),
        renderHTML: (attrs) => ({ 'data-tag': attrs.tag }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tag-mark]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-tag-mark': '',
        style: 'background: rgba(188, 179, 163, 0.25); border-radius: 4px; padding: 1px 6px; font-size: 0.85em;',
      },
      0,
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: TAG_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({ tag: match[1] }),
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: TAG_PASTE_REGEX,
        type: this.type,
        getAttributes: (match) => ({ tag: match[1] }),
      }),
    ];
  },
});
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/notepad/extensions/tag-mark.ts
git commit -m "feat(notepad): add tag mark TipTap extension"
```

---

## Task 7: TipTap Editor Component

**Files:**
- Create: `src/notepad/components/Editor.tsx`

- [ ] **Step 1: Create the editor component**

Create `src/notepad/components/Editor.tsx`:

```tsx
import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';
import { BibleVerse } from '../extensions/bible-verse';
import { NoteLink } from '../extensions/note-link';
import { TagMark } from '../extensions/tag-mark';
import { fetchVerseText } from '../extensions/bible-verse-utils';
import { useNotepad } from '../context/useNotepad';

// Verse tooltip state
interface VerseTooltip {
  text: string;
  reference: string;
  translation: string;
  x: number;
  y: number;
}

export function NotepadEditor() {
  const { activeNote, updateNote, notes, openNote } = useNotepad();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [verseTooltip, setVerseTooltip] = useState<VerseTooltip | null>(null);
  const [noteLinkPopup, setNoteLinkPopup] = useState<{ x: number; y: number } | null>(null);
  const [noteLinkSearch, setNoteLinkSearch] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      BibleVerse,
      NoteLink,
      TagMark,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (!activeNote) return;
      const json = JSON.stringify(editor.getJSON());

      // Extract tags from text content
      const text = editor.getText();
      const tagMatches = text.match(/#\w+/g);
      const tags = tagMatches ? [...new Set(tagMatches)] : [];

      // Debounced save
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateNote(activeNote.id, { content: json, tags });
      }, 500);
    },
  });

  // Load note content when active note changes
  useEffect(() => {
    if (!editor || !activeNote) return;
    try {
      const content = activeNote.content ? JSON.parse(activeNote.content) : { type: 'doc', content: [] };
      editor.commands.setContent(content);
    } catch {
      editor.commands.setContent('');
    }
  }, [editor, activeNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle [[  trigger for note linking
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '[') {
        const { state } = editor;
        const { from } = state.selection;
        const textBefore = state.doc.textBetween(Math.max(0, from - 1), from);
        if (textBefore === '[') {
          event.preventDefault();
          // Remove the first [
          editor.commands.deleteRange({ from: from - 1, to: from });
          // Show note link popup
          const coords = editor.view.coordsAtPos(from - 1);
          setNoteLinkPopup({ x: coords.left, y: coords.bottom + 4 });
          setNoteLinkSearch('');
        }
      }
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener('keydown', handleKeyDown);
    return () => editorDom.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  // Handle verse hover for tooltip
  const handleEditorMouseOver = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.hasAttribute('data-bible-verse')) {
      const ref = target.getAttribute('data-reference') || target.textContent || '';
      const rect = target.getBoundingClientRect();
      const data = await fetchVerseText(ref);
      if (data) {
        setVerseTooltip({ ...data, x: rect.left, y: rect.bottom + 8 });
      }
    }
  }, []);

  const handleEditorMouseOut = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.hasAttribute('data-bible-verse')) {
      setVerseTooltip(null);
    }
  }, []);

  // Handle note link click
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.hasAttribute('data-note-link')) {
      const noteId = target.getAttribute('data-note-id');
      if (noteId) openNote(noteId);
    }
  }, [openNote]);

  // Insert a note link
  const insertNoteLink = useCallback((note: { id: string; title: string }) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: note.title,
        marks: [{ type: 'noteLink', attrs: { noteId: note.id, noteTitle: note.title } }],
      })
      .run();
    setNoteLinkPopup(null);
  }, [editor]);

  const filteredNotes = notes.filter((n) =>
    n.id !== activeNote?.id && n.title.toLowerCase().includes(noteLinkSearch.toLowerCase())
  );

  if (!activeNote) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          Select a note or create a new one
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 p-8 md:p-12 lg:p-16 max-w-3xl relative"
      onMouseOver={handleEditorMouseOver}
      onMouseOut={handleEditorMouseOut}
      onClick={handleEditorClick}
    >
      {/* Note Title */}
      <input
        type="text"
        value={activeNote.title}
        onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
        className="w-full text-3xl md:text-4xl font-light mb-3 bg-transparent border-none outline-none"
        style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--charred)' }}
        placeholder="Untitled"
      />

      {/* Date & Tags display */}
      <div className="flex items-center gap-4 mb-2">
        <span className="text-[12px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          {new Date(activeNote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {activeNote.tags.length > 0 && (
        <div className="flex items-center gap-2 mb-8">
          {activeNote.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded"
              style={{ background: 'rgba(188, 179, 163, 0.25)', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="h-px w-16 mb-8" style={{ background: 'var(--pale-stone)' }} />

      {/* TipTap Editor */}
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}>
          <div
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg"
            style={{ background: 'rgba(240, 236, 232, 0.97)', border: '1px solid var(--pale-stone)' }}
          >
            {[
              { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
              { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
              { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
              { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
              { icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
              { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
              { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
              { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
            ].map(({ icon: Icon, action, active }, i) => (
              <button
                key={i}
                onClick={action}
                className="p-1.5 rounded hover:bg-black/5 transition-colors"
                style={{ color: active ? 'var(--charred)' : 'var(--silica)' }}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </BubbleMenu>
      )}

      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none notepad-editor"
      />

      {/* Verse Tooltip */}
      {verseTooltip && (
        <div
          className="fixed z-50 max-w-sm p-4 rounded-lg shadow-lg"
          style={{
            left: verseTooltip.x,
            top: verseTooltip.y,
            background: 'rgba(240, 236, 232, 0.97)',
            border: '1px solid var(--pale-stone)',
          }}
        >
          <p className="text-[13px] leading-relaxed mb-2" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
            {verseTooltip.text}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            {verseTooltip.reference} ({verseTooltip.translation})
          </p>
        </div>
      )}

      {/* Note Link Popup */}
      {noteLinkPopup && (
        <div
          className="fixed z-50 w-64 rounded-lg shadow-lg overflow-hidden"
          style={{
            left: noteLinkPopup.x,
            top: noteLinkPopup.y,
            background: 'rgba(240, 236, 232, 0.97)',
            border: '1px solid var(--pale-stone)',
          }}
        >
          <input
            type="text"
            autoFocus
            value={noteLinkSearch}
            onChange={(e) => setNoteLinkSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setNoteLinkPopup(null);
              if (e.key === 'Enter' && filteredNotes.length > 0) insertNoteLink(filteredNotes[0]);
            }}
            className="w-full px-3 py-2 text-[12px] bg-transparent border-b outline-none"
            style={{ borderColor: 'var(--pale-stone)', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            placeholder="Search notes..."
          />
          <div className="max-h-48 overflow-y-auto">
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => insertNoteLink(note)}
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-black/5 transition-colors"
                style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
              >
                {note.title}
              </button>
            ))}
            {filteredNotes.length === 0 && (
              <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--silica)' }}>No notes found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add editor styles**

Add to `src/index.css` (at the end of the file):

```css
/* TipTap Notepad Editor */
.notepad-editor .tiptap {
  font-family: 'Outfit', sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: var(--deep-umber);
  outline: none;
}

.notepad-editor .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--silica);
  pointer-events: none;
  height: 0;
}

.notepad-editor .tiptap h1 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.75rem;
  font-weight: 300;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  color: var(--charred);
}

.notepad-editor .tiptap h2 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.35rem;
  font-weight: 400;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--charred);
}

.notepad-editor .tiptap h3 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.1rem;
  font-weight: 500;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  color: var(--charred);
}

.notepad-editor .tiptap blockquote {
  border-left: 2px solid var(--warm-sand);
  padding-left: 1rem;
  margin-left: 0;
  color: var(--deep-umber);
  opacity: 0.8;
}

.notepad-editor .tiptap ul,
.notepad-editor .tiptap ol {
  padding-left: 1.25rem;
}

.notepad-editor .tiptap p {
  margin-bottom: 0.75rem;
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/notepad/components/Editor.tsx src/index.css
git commit -m "feat(notepad): add TipTap editor with bubble menu, verse tooltip, and note linking"
```

---

## Task 8: Sidebar Component

**Files:**
- Create: `src/notepad/components/Sidebar.tsx`

- [ ] **Step 1: Create the sidebar component**

Create `src/notepad/components/Sidebar.tsx`:

```tsx
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderPlus,
  PenLine,
  Mic,
  Sparkles,
  GripVertical,
} from 'lucide-react';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable, isSortable } from '@dnd-kit/react/sortable';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useNotepad } from '../context/useNotepad';
import type { Note, Folder, NoteType } from '../types';

const typeConfig: Record<NoteType, { icon: typeof PenLine; color: string; label: string }> = {
  devotion: { icon: PenLine, color: '#34D399', label: 'Devotion' },
  sermon: { icon: Mic, color: '#38BDF8', label: 'Sermon' },
  theme: { icon: Sparkles, color: '#A78BFA', label: 'Theme' },
};

function InlineEdit({ value, onSave, autoFocus }: { value: string; onSave: (v: string) => void; autoFocus?: boolean }) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <span onDoubleClick={() => setEditing(true)} className="truncate">
        {value}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { onSave(text); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSave(text); setEditing(false); }
        if (e.key === 'Escape') { setText(value); setEditing(false); }
      }}
      className="bg-transparent border-b outline-none text-[12px] w-full"
      style={{ borderColor: 'var(--warm-sand)', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
    />
  );
}

function SortableNote({ note, index, folderId }: { note: Note; index: number; folderId: string }) {
  const { activeNoteId, openNote, renameNote, deleteNote, duplicateNote } = useNotepad();
  const [showDelete, setShowDelete] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const cfg = typeConfig[note.type];
  const Icon = cfg.icon;

  const { ref } = useSortable({
    id: note.id,
    index,
    group: folderId,
    type: 'note',
    accept: 'note',
  });

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={ref}
            onClick={() => openNote(note.id)}
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group"
            style={{
              background: note.id === activeNoteId ? 'rgba(188, 179, 163, 0.3)' : 'transparent',
            }}
          >
            <GripVertical className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab" style={{ color: 'var(--silica)' }} />
            <Icon className="w-3 h-3 shrink-0" style={{ color: cfg.color }} />
            <span
              className="text-[11px] truncate"
              style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            >
              {note.title}
            </span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => {
            const newTitle = prompt('Rename note:', note.title);
            if (newTitle) renameNote(note.id, newTitle);
          }}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setShowMove(true)}>
            Move to Folder
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => duplicateNote(note.id)}>
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setShowDelete(true)} className="text-red-600">
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              "{note.title}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteNote(note.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MoveToFolderDialog
        open={showMove}
        onOpenChange={setShowMove}
        noteId={note.id}
      />
    </>
  );
}

function MoveToFolderDialog({ open, onOpenChange, noteId }: { open: boolean; onOpenChange: (v: boolean) => void; noteId: string }) {
  const { folders, moveNote } = useNotepad();
  const [selectedFolder, setSelectedFolder] = useState('root');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
        </DialogHeader>
        <Select value={selectedFolder} onValueChange={setSelectedFolder}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="root">Root</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <button
            onClick={() => { moveNote(noteId, selectedFolder); onOpenChange(false); }}
            className="px-4 py-2 text-[12px] font-medium rounded-md"
            style={{ background: 'var(--deep-umber)', color: 'var(--plaster)', fontFamily: 'Outfit, sans-serif' }}
          >
            Move
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderItem({ folder, notes }: { folder: Folder; notes: Note[] }) {
  const { createNote, renameFolder, deleteFolder, createFolder } = useNotepad();
  const [isOpen, setIsOpen] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteType, setNewNoteType] = useState<NoteType>('devotion');
  const folderNotes = notes.filter((n) => n.folderId === folder.id);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 w-full px-1 py-1 rounded hover:bg-black/5 transition-colors"
          >
            {isOpen ? (
              <ChevronDown className="w-3 h-3" style={{ color: 'var(--silica)' }} />
            ) : (
              <ChevronRight className="w-3 h-3" style={{ color: 'var(--silica)' }} />
            )}
            <span className="text-[12px] font-medium" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
              <InlineEdit value={folder.name} onSave={(name) => renameFolder(folder.id, name)} />
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => {
            const name = prompt('Rename folder:', folder.name);
            if (name) renameFolder(folder.id, name);
          }}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setShowNewNote(true)}>
            New Note Inside
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => {
            const name = prompt('New subfolder name:');
            if (name) createFolder(name, folder.id);
          }}>
            New Subfolder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setShowDelete(true)} className="text-red-600">
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isOpen && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {folderNotes.map((note, index) => (
            <SortableNote key={note.id} note={note} index={index} folderId={folder.id} />
          ))}
        </div>
      )}

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              "{folder.name}" will be deleted. Notes inside will be moved to the root.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFolder(folder.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewNoteDialog
        open={showNewNote}
        onOpenChange={setShowNewNote}
        folderId={folder.id}
        noteType={newNoteType}
        onTypeChange={setNewNoteType}
        onCreate={(type) => createNote(folder.id, type)}
      />
    </>
  );
}

function NewNoteDialog({
  open,
  onOpenChange,
  folderId,
  noteType,
  onTypeChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string;
  noteType: NoteType;
  onTypeChange: (t: NoteType) => void;
  onCreate: (type: NoteType) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Note</DialogTitle>
        </DialogHeader>
        <Select value={noteType} onValueChange={(v) => onTypeChange(v as NoteType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="devotion">Devotion</SelectItem>
            <SelectItem value="sermon">Sermon</SelectItem>
            <SelectItem value="theme">Theme</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <button
            onClick={() => { onCreate(noteType); onOpenChange(false); }}
            className="px-4 py-2 text-[12px] font-medium rounded-md"
            style={{ background: 'var(--deep-umber)', color: 'var(--plaster)', fontFamily: 'Outfit, sans-serif' }}
          >
            Create
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NotepadSidebar() {
  const { notes, folders, activeNoteId, createFolder, createNote, moveNote } = useNotepad();
  const [filter, setFilter] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteType, setNewNoteType] = useState<NoteType>('devotion');

  // Compute tags from all notes
  const allTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    notes.forEach((n) => n.tags.forEach((t) => tagMap.set(t, (tagMap.get(t) ?? 0) + 1)));
    return [...tagMap.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    let result = notes;
    if (filter) result = result.filter((n) => n.title.toLowerCase().includes(filter.toLowerCase()));
    if (tagFilter) result = result.filter((n) => n.tags.includes(tagFilter));
    return result;
  }, [notes, filter, tagFilter]);

  // Root-level notes (no folder or folderId = 'root')
  const rootNotes = filteredNotes.filter(
    (n) => n.folderId === 'root' || !folders.some((f) => f.id === n.folderId)
  );

  // Root-level folders
  const rootFolders = folders.filter((f) => f.parentId === null);

  return (
    <div className="p-4 h-full flex flex-col">
      <h3
        className="text-[10px] font-medium tracking-[0.2em] mb-3"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        COLLECTION
      </h3>

      {/* Filter input */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md mb-4"
        style={{ background: 'rgba(188, 179, 163, 0.15)', border: '1px solid rgba(206, 204, 202, 0.5)' }}
      >
        <Search className="w-3 h-3" style={{ color: 'var(--silica)' }} />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter notes..."
          className="text-[11px] bg-transparent outline-none w-full"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
        />
      </div>

      {tagFilter && (
        <button
          onClick={() => setTagFilter(null)}
          className="text-[10px] mb-3 px-2 py-1 rounded-md"
          style={{ background: 'rgba(188, 179, 163, 0.3)', color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
        >
          Filtered by: {tagFilter} (click to clear)
        </button>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto space-y-1">
        <DragDropProvider
          onDragEnd={(event) => {
            const { source } = event.operation;
            if (isSortable(source) && source.group != null && source.initialGroup != null) {
              if (source.group !== source.initialGroup) {
                moveNote(String(source.id), String(source.group));
              }
            }
          }}
        >
          {rootFolders.map((folder) => (
            <FolderItem key={folder.id} folder={folder} notes={filteredNotes} />
          ))}

          {/* Root-level notes */}
          {rootNotes.map((note, index) => (
            <SortableNote key={note.id} note={note} index={index} folderId="root" />
          ))}
        </DragDropProvider>
      </div>

      {/* New Folder button */}
      <button
        onClick={() => {
          const name = prompt('New folder name:');
          if (name) createFolder(name, null);
        }}
        className="flex items-center gap-2 w-full px-2 py-2 mt-3 rounded hover:bg-black/5 transition-colors"
      >
        <FolderPlus className="w-3.5 h-3.5" style={{ color: 'var(--silica)' }} />
        <span className="text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          New Folder
        </span>
      </button>

      {/* Tags */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(206, 204, 202, 0.5)' }}>
        <h3
          className="text-[10px] font-medium tracking-[0.2em] mb-3"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          TAGS
        </h3>
        <div className="space-y-1.5">
          {allTags.map(([tag, count]) => (
            <div
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-black/5 transition-colors"
              style={{ background: tagFilter === tag ? 'rgba(188, 179, 163, 0.3)' : 'transparent' }}
            >
              <span className="text-[11px]" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
                {tag}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--silica)' }}>
                ({count})
              </span>
            </div>
          ))}
          {allTags.length === 0 && (
            <p className="text-[10px] px-2" style={{ color: 'var(--silica)' }}>No tags yet</p>
          )}
        </div>
      </div>

      <NewNoteDialog
        open={showNewNote}
        onOpenChange={setShowNewNote}
        folderId="root"
        noteType={newNoteType}
        onTypeChange={setNewNoteType}
        onCreate={(type) => createNote('root', type)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/notepad/components/Sidebar.tsx
git commit -m "feat(notepad): add sidebar with folder tree, tags, drag-and-drop, and context menus"
```

---

## Task 9: Backlinks & Info Panels

**Files:**
- Create: `src/notepad/components/BacklinksPanel.tsx`
- Create: `src/notepad/components/InfoPanel.tsx`

- [ ] **Step 1: Create BacklinksPanel**

Create `src/notepad/components/BacklinksPanel.tsx`:

```tsx
import { useMemo } from 'react';
import { PenLine, Mic, Sparkles } from 'lucide-react';
import { useNotepad } from '../context/useNotepad';
import type { NoteType } from '../types';

const typeConfig: Record<NoteType, { icon: typeof PenLine; color: string; label: string }> = {
  devotion: { icon: PenLine, color: '#34D399', label: 'DEVOTION NOTES' },
  sermon: { icon: Mic, color: '#38BDF8', label: 'SERMON NOTES' },
  theme: { icon: Sparkles, color: '#A78BFA', label: 'THEMES' },
};

export function BacklinksPanel() {
  const { activeNote, notes, openNote } = useNotepad();

  const backlinks = useMemo(() => {
    if (!activeNote) return [];
    const title = activeNote.title;
    return notes
      .filter((n) => n.id !== activeNote.id && n.content.includes(title))
      .map((n) => {
        // Extract context snippet
        let snippet = '';
        try {
          const parsed = JSON.parse(n.content);
          const text = extractText(parsed);
          const idx = text.indexOf(title);
          if (idx >= 0) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(text.length, idx + title.length + 40);
            snippet = `...${text.slice(start, end)}...`;
          }
        } catch {
          snippet = '';
        }
        return { note: n, snippet };
      });
  }, [activeNote, notes]);

  // Group by type
  const grouped = useMemo(() => {
    const groups: Record<NoteType, typeof backlinks> = { devotion: [], sermon: [], theme: [] };
    backlinks.forEach((bl) => groups[bl.note.type].push(bl));
    return groups;
  }, [backlinks]);

  if (!activeNote) return null;

  return (
    <div className="p-8 md:p-12 lg:p-16 max-w-3xl space-y-6">
      <h2
        className="text-xl font-light mb-6"
        style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--charred)' }}
      >
        Backlinks
      </h2>

      {backlinks.length === 0 && (
        <p className="text-[13px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          No other notes link to this one yet.
        </p>
      )}

      {(Object.entries(grouped) as [NoteType, typeof backlinks][]).map(([type, items]) => {
        if (items.length === 0) return null;
        const cfg = typeConfig[type];
        const Icon = cfg.icon;
        return (
          <div key={type}>
            <h3
              className="text-[10px] font-medium tracking-[0.2em] mb-3 flex items-center gap-2"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              <Icon className="w-3 h-3" style={{ color: cfg.color }} />
              {cfg.label}
            </h3>
            <div className="space-y-2">
              {items.map(({ note, snippet }) => (
                <div
                  key={note.id}
                  onClick={() => openNote(note.id)}
                  className="p-3 rounded-md cursor-pointer hover:bg-black/5 transition-colors"
                  style={{ border: '1px solid rgba(206, 204, 202, 0.5)' }}
                >
                  <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
                    {note.title}
                  </p>
                  {snippet && (
                    <p className="text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                      {snippet}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Recursively extract text from TipTap JSON */
function extractText(node: Record<string, unknown>): string {
  if (node.text) return node.text as string;
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractText).join(' ');
  }
  return '';
}
```

- [ ] **Step 2: Create InfoPanel**

Create `src/notepad/components/InfoPanel.tsx`:

```tsx
import { useMemo } from 'react';
import { useNotepad } from '../context/useNotepad';
import { VERSE_REGEX } from '../extensions/bible-verse-utils';

function extractText(node: Record<string, unknown>): string {
  if (node.text) return node.text as string;
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractText).join(' ');
  }
  return '';
}

export function InfoPanel() {
  const { activeNote, notes, folders } = useNotepad();

  const stats = useMemo(() => {
    if (!activeNote) return null;

    let text = '';
    try {
      const parsed = JSON.parse(activeNote.content);
      text = extractText(parsed);
    } catch {
      text = '';
    }

    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const verseMatches = text.match(VERSE_REGEX);
    const verseCount = verseMatches ? new Set(verseMatches).size : 0;

    // Count outgoing [[ ]] links (search for noteLink marks in content)
    const outgoingLinks = (activeNote.content.match(/"noteLink"/g) || []).length;

    // Count incoming backlinks
    const backlinks = notes.filter(
      (n) => n.id !== activeNote.id && n.content.includes(activeNote.title)
    ).length;

    const folder = folders.find((f) => f.id === activeNote.folderId);

    return {
      created: new Date(activeNote.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      modified: new Date(activeNote.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      wordCount,
      verseCount,
      outgoingLinks,
      backlinks,
      folder: folder?.name ?? 'Root',
      type: activeNote.type.charAt(0).toUpperCase() + activeNote.type.slice(1),
    };
  }, [activeNote, notes, folders]);

  if (!activeNote || !stats) return null;

  const rows = [
    { label: 'Created', value: stats.created },
    { label: 'Last modified', value: stats.modified },
    { label: 'Word count', value: String(stats.wordCount) },
    { label: 'Linked verses', value: String(stats.verseCount) },
    { label: 'Outgoing links', value: String(stats.outgoingLinks) },
    { label: 'Incoming backlinks', value: String(stats.backlinks) },
    { label: 'Folder', value: stats.folder },
    { label: 'Type', value: stats.type },
  ];

  return (
    <div className="p-8 md:p-12 lg:p-16 max-w-3xl space-y-4">
      <h2
        className="text-xl font-light mb-6"
        style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--charred)' }}
      >
        Note Info
      </h2>

      <div className="space-y-3">
        {rows.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(206, 204, 202, 0.3)' }}>
            <span className="text-[12px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>{item.label}</span>
            <span className="text-[12px]" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/notepad/components/BacklinksPanel.tsx src/notepad/components/InfoPanel.tsx
git commit -m "feat(notepad): add backlinks and info tab panels"
```

---

## Task 10: Search Dialog

**Files:**
- Create: `src/notepad/components/SearchDialog.tsx`

- [ ] **Step 1: Create the search dialog**

Create `src/notepad/components/SearchDialog.tsx`:

```tsx
import { useEffect, useState, useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { FileText, BookOpen, Hash } from 'lucide-react';
import { useNotepad } from '../context/useNotepad';
import { extractVerseRefs } from '../extensions/bible-verse-utils';

function extractText(node: Record<string, unknown>): string {
  if (node.text) return node.text as string;
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractText).join(' ');
  }
  return '';
}

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const { notes, openNote } = useNotepad();

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Precompute searchable data
  const searchData = useMemo(() => {
    return notes.map((note) => {
      let text = '';
      try {
        const parsed = JSON.parse(note.content);
        text = extractText(parsed);
      } catch {
        text = '';
      }
      const verses = extractVerseRefs(text);
      return { note, text, verses };
    });
  }, [notes]);

  // Unique verses across all notes
  const allVerses = useMemo(() => {
    const set = new Set<string>();
    searchData.forEach((d) => d.verses.forEach((v) => set.add(v)));
    return [...set];
  }, [searchData]);

  // Unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return [...set];
  }, [notes]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search notes, verses, tags..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Notes">
          {searchData.map(({ note }) => (
            <CommandItem
              key={note.id}
              value={`note-${note.title}`}
              onSelect={() => { openNote(note.id); setOpen(false); }}
            >
              <FileText className="mr-2 h-4 w-4" style={{ color: 'var(--silica)' }} />
              <span>{note.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {allVerses.length > 0 && (
          <CommandGroup heading="Verses">
            {allVerses.map((verse) => {
              // Find the first note containing this verse
              const match = searchData.find((d) => d.verses.includes(verse));
              return (
                <CommandItem
                  key={verse}
                  value={`verse-${verse}`}
                  onSelect={() => {
                    if (match) { openNote(match.note.id); setOpen(false); }
                  }}
                >
                  <BookOpen className="mr-2 h-4 w-4" style={{ color: '#F59E0B' }} />
                  <span>{verse}</span>
                  {match && (
                    <span className="ml-2 text-[11px]" style={{ color: 'var(--silica)' }}>
                      in {match.note.title}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {allTags.length > 0 && (
          <CommandGroup heading="Tags">
            {allTags.map((tag) => {
              const match = notes.find((n) => n.tags.includes(tag));
              return (
                <CommandItem
                  key={tag}
                  value={`tag-${tag}`}
                  onSelect={() => {
                    if (match) { openNote(match.id); setOpen(false); }
                  }}
                >
                  <Hash className="mr-2 h-4 w-4" style={{ color: 'var(--silica)' }} />
                  <span>{tag}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/notepad/components/SearchDialog.tsx
git commit -m "feat(notepad): add Cmd+K global search dialog"
```

---

## Task 11: Upload Modal

**Files:**
- Create: `src/notepad/components/UploadModal.tsx`

- [ ] **Step 1: Create the upload modal**

Create `src/notepad/components/UploadModal.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useNotepad } from '../context/useNotepad';
import { extractVerseRefs } from '../extensions/bible-verse-utils';
import type { NoteType, Note } from '../types';

async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'md' || ext === 'txt') {
    return file.text();
  }

  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    // Set worker source
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: Record<string, unknown>) => (item as { str: string }).str).join(' ');
      pages.push(text);
    }
    return pages.join('\n\n');
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToMarkdown({ arrayBuffer });
    return result.value;
  }

  return file.text();
}

function fileTitle(file: File): string {
  return file.name.replace(/\.(md|txt|pdf|docx)$/i, '');
}

export function UploadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { folders, importNotes } = useNotepad();
  const [files, setFiles] = useState<File[]>([]);
  const [folderId, setFolderId] = useState('root');
  const [autoDetectVerses, setAutoDetectVerses] = useState(true);
  const [autoCreateLinks, setAutoCreateLinks] = useState(true);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const noteDrafts: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>[] = [];

      for (const file of files) {
        const content = await parseFile(file);
        noteDrafts.push({
          title: fileTitle(file),
          content: JSON.stringify({
            type: 'doc',
            content: content.split('\n\n').filter(Boolean).map((p) => ({
              type: 'paragraph',
              content: [{ type: 'text', text: p }],
            })),
          }),
          folderId,
          type: 'devotion' as NoteType,
          tags: [],
        });
      }

      // Auto-create links between uploaded notes with shared verses
      if (autoCreateLinks && noteDrafts.length > 1) {
        for (let i = 0; i < noteDrafts.length; i++) {
          const textI = extractTextFromDraft(noteDrafts[i].content);
          const versesI = extractVerseRefs(textI);

          for (let j = i + 1; j < noteDrafts.length; j++) {
            const textJ = extractTextFromDraft(noteDrafts[j].content);
            const versesJ = extractVerseRefs(textJ);
            const shared = versesI.filter((v) => versesJ.includes(v));

            if (shared.length > 0) {
              // Append related note link at end
              appendRelatedLink(noteDrafts[i], noteDrafts[j].title);
              appendRelatedLink(noteDrafts[j], noteDrafts[i].title);
            }
          }
        }
      }

      await importNotes(noteDrafts);
      setFiles([]);
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Cormorant Garamond', serif" }}>Upload Notes</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
          style={{
            borderColor: isDragActive ? 'var(--deep-umber)' : 'var(--pale-stone)',
            background: isDragActive ? 'rgba(188, 179, 163, 0.1)' : 'transparent',
          }}
        >
          <input {...getInputProps()} />
          <Upload className="w-6 h-6 mx-auto mb-3" style={{ color: 'var(--silica)' }} />
          <p className="text-[13px] mb-1" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
            Drag & drop files here or click to browse
          </p>
          <p className="text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            .md  .txt  .pdf  .docx
          </p>
        </div>

        {/* Processing options */}
        <div className="space-y-3 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={autoDetectVerses} onCheckedChange={(v) => setAutoDetectVerses(v === true)} />
            <span className="text-[12px]" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
              Auto-detect Bible verse references
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={autoCreateLinks} onCheckedChange={(v) => setAutoCreateLinks(v === true)} />
            <span className="text-[12px]" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
              Auto-create links between uploaded notes
            </span>
          </label>
        </div>

        {/* Folder destination */}
        <div className="mt-2">
          <label className="text-[11px] mb-1 block" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            Upload to folder:
          </label>
          <Select value={folderId} onValueChange={setFolderId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Root</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected files */}
        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Selected files:
            </p>
            {files.map((file, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded" style={{ background: 'rgba(188, 179, 163, 0.1)' }}>
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" style={{ color: 'var(--silica)' }} />
                  <span className="text-[12px]" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
                    {file.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px]" style={{ color: 'var(--silica)' }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                  <button onClick={() => removeFile(i)}>
                    <X className="w-3 h-3" style={{ color: 'var(--silica)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-[12px] font-medium rounded-md hover:bg-black/5 transition-colors"
            style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-4 py-2 text-[12px] font-medium rounded-md transition-opacity disabled:opacity-40"
            style={{ background: 'var(--deep-umber)', color: 'var(--plaster)', fontFamily: 'Outfit, sans-serif' }}
          >
            {uploading ? 'Processing...' : 'Upload & Process'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function extractTextFromDraft(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return extractTextRecursive(parsed);
  } catch {
    return content;
  }
}

function extractTextRecursive(node: Record<string, unknown>): string {
  if (node.text) return node.text as string;
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractTextRecursive).join(' ');
  }
  return '';
}

function appendRelatedLink(draft: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>, linkedTitle: string) {
  try {
    const parsed = JSON.parse(draft.content);
    if (Array.isArray(parsed.content)) {
      parsed.content.push(
        { type: 'paragraph', content: [{ type: 'text', text: '' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Related Notes' }] },
        { type: 'paragraph', content: [{ type: 'text', text: `[[${linkedTitle}]]` }] }
      );
      draft.content = JSON.stringify(parsed);
    }
  } catch {
    // leave content unchanged
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/notepad/components/UploadModal.tsx
git commit -m "feat(notepad): add upload modal with PDF/DOCX parsing and auto-linking"
```

---

## Task 12: Toolbar Component

**Files:**
- Create: `src/notepad/components/NotepadToolbar.tsx`

- [ ] **Step 1: Create the toolbar**

Create `src/notepad/components/NotepadToolbar.tsx`:

```tsx
import { useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Plus,
  Upload,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotepad } from '../context/useNotepad';
import { UploadModal } from './UploadModal';
import type { NoteType } from '../types';

interface NotepadToolbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  graphOpen: boolean;
  onToggleGraph: () => void;
  onOpenSearch: () => void;
}

export function NotepadToolbar({
  sidebarOpen,
  onToggleSidebar,
  graphOpen,
  onToggleGraph,
  onOpenSearch,
}: NotepadToolbarProps) {
  const { createNote } = useNotepad();
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleNewNote = (type: NoteType) => {
    createNote('root', type);
  };

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 h-14 border-b shrink-0"
        style={{
          background: 'rgba(240, 236, 232, 0.97)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pale-stone)',
          paddingTop: '60px',
          height: '108px',
        }}
      >
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-black/5 transition-colors"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
          ) : (
            <PanelLeftOpen className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
          )}
        </button>

        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 flex-1 max-w-md px-3 py-1.5 rounded-md text-left"
          style={{ background: 'rgba(188, 179, 163, 0.2)', border: '1px solid var(--pale-stone)' }}
        >
          <Search className="w-3.5 h-3.5" style={{ color: 'var(--silica)' }} />
          <span className="text-xs tracking-wide" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            Search notes, verses, tags...
          </span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(188, 179, 163, 0.3)', color: 'var(--silica)' }}>
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-black/5 transition-colors">
                <Plus className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />
                <span
                  className="text-[10px] font-medium tracking-widest"
                  style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
                >
                  NEW NOTE
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => handleNewNote('devotion')}>
                Devotion
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleNewNote('sermon')}>
                Sermon
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleNewNote('theme')}>
                Theme
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-black/5 transition-colors"
            title="Upload"
          >
            <Upload className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />
            <span
              className="text-[10px] font-medium tracking-widest hidden lg:inline"
              style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            >
              UPLOAD
            </span>
          </button>

          <div className="w-px h-5 mx-1" style={{ background: 'var(--pale-stone)' }} />

          <button
            onClick={onToggleGraph}
            className="p-2 rounded-md hover:bg-black/5 transition-colors"
            title={graphOpen ? 'Hide graph' : 'Show graph'}
          >
            {graphOpen ? (
              <PanelRightClose className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
            ) : (
              <PanelRightOpen className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
            )}
          </button>
        </div>
      </div>

      <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
    </>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/notepad/components/NotepadToolbar.tsx
git commit -m "feat(notepad): add workspace toolbar with new note dropdown and upload trigger"
```

---

## Task 13: Wire Everything Into the Notepad Page Shell

**Files:**
- Modify: `src/components/sections/Notepad.tsx`

- [ ] **Step 1: Rewrite Notepad.tsx to compose real components**

Replace the entire contents of `src/components/sections/Notepad.tsx` with:

```tsx
import { useState, useCallback } from 'react';
import { NotepadProvider } from '@/notepad/context/NotepadProvider';
import { NotepadToolbar } from '@/notepad/components/NotepadToolbar';
import { NotepadSidebar } from '@/notepad/components/Sidebar';
import { NotepadEditor } from '@/notepad/components/Editor';
import { BacklinksPanel } from '@/notepad/components/BacklinksPanel';
import { InfoPanel } from '@/notepad/components/InfoPanel';
import { SearchDialog } from '@/notepad/components/SearchDialog';
import { GraphPane } from './notepad/GraphPane';

function NotepadWorkspace() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'backlinks' | 'info'>('content');

  const handleOpenSearch = useCallback(() => {
    // Trigger Cmd+K programmatically
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ top: 0 }}>
      <NotepadToolbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        graphOpen={graphOpen}
        onToggleGraph={() => setGraphOpen(!graphOpen)}
        onOpenSearch={handleOpenSearch}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="shrink-0 overflow-y-auto overflow-x-hidden border-r"
          style={{
            width: sidebarOpen ? 220 : 0,
            borderColor: sidebarOpen ? 'var(--pale-stone)' : 'transparent',
            background: 'rgba(240, 236, 232, 0.6)',
            opacity: sidebarOpen ? 1 : 0,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
          }}
        >
          <NotepadSidebar />
        </aside>

        {/* Editor Pane */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* Tab Bar */}
          <div className="flex items-center gap-0 border-b shrink-0" style={{ borderColor: 'var(--pale-stone)' }}>
            {(['content', 'backlinks', 'info'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-3 text-[11px] font-medium tracking-wider transition-colors relative"
                style={{
                  color: activeTab === tab ? 'var(--deep-umber)' : 'var(--silica)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-5 right-5 h-px" style={{ background: 'var(--deep-umber)' }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'content' && <NotepadEditor />}
          {activeTab === 'backlinks' && <BacklinksPanel />}
          {activeTab === 'info' && <InfoPanel />}
        </main>

        {/* Graph Pane (static placeholder — functionality deferred) */}
        <GraphPane graphOpen={graphOpen} />
      </div>

      <SearchDialog />
    </div>
  );
}

export function Notepad() {
  return (
    <NotepadProvider>
      <NotepadWorkspace />
    </NotepadProvider>
  );
}
```

- [ ] **Step 2: Extract the static graph pane into its own file**

Create `src/components/sections/notepad/GraphPane.tsx` — move the existing graph SVG and filter UI from the current Notepad.tsx into this file:

```tsx
import { useState } from 'react';
import { BookOpen, Mic, PenLine, Sparkles, Maximize2 } from 'lucide-react';

const graphNodes = [
  { id: 1, x: 55, y: 35, type: 'scripture' as const, label: 'Rom 8:28' },
  { id: 2, x: 40, y: 55, type: 'devotion' as const, label: 'Hard season' },
  { id: 3, x: 70, y: 58, type: 'sermon' as const, label: "Trusting God's Plan" },
  { id: 4, x: 30, y: 75, type: 'theme' as const, label: 'Sovereignty' },
  { id: 5, x: 60, y: 80, type: 'scripture' as const, label: 'Jer 29:11' },
  { id: 6, x: 80, y: 40, type: 'devotion' as const, label: 'Peace in the storm' },
  { id: 7, x: 45, y: 20, type: 'scripture' as const, label: 'Ps 46:10' },
  { id: 8, x: 75, y: 72, type: 'theme' as const, label: 'Trust' },
];

const graphEdges = [
  { from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 4 },
  { from: 2, to: 5 }, { from: 3, to: 1 }, { from: 5, to: 4 },
  { from: 6, to: 7 }, { from: 6, to: 1 }, { from: 8, to: 5 }, { from: 8, to: 3 },
];

const nodeColors: Record<string, string> = {
  scripture: '#F59E0B', sermon: '#38BDF8', devotion: '#34D399', theme: '#A78BFA',
};

const nodeIcons: Record<string, typeof BookOpen> = {
  scripture: BookOpen, sermon: Mic, devotion: PenLine, theme: Sparkles,
};

export function GraphPane({ graphOpen }: { graphOpen: boolean }) {
  const [graphMode, setGraphMode] = useState<'global' | 'local'>('global');
  const [graphFilters, setGraphFilters] = useState({
    scripture: true, sermon: true, devotion: true, theme: true,
  });

  const toggleFilter = (key: keyof typeof graphFilters) => {
    setGraphFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredNodes = graphNodes.filter((n) => graphFilters[n.type]);
  const filteredEdges = graphEdges.filter(
    (e) => filteredNodes.some((n) => n.id === e.from) && filteredNodes.some((n) => n.id === e.to)
  );

  return (
    <aside
      className="shrink-0 overflow-hidden border-l flex-col hidden md:flex"
      style={{
        width: graphOpen ? '35%' : 0,
        borderColor: graphOpen ? 'var(--pale-stone)' : 'transparent',
        background: 'rgba(240, 236, 232, 0.4)',
        opacity: graphOpen ? 1 : 0,
        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
      }}
    >
      <div className="p-4 space-y-3 shrink-0">
        <h3 className="text-[10px] font-medium tracking-[0.2em]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          GRAPH
        </h3>

        <div className="inline-flex rounded-md overflow-hidden" style={{ border: '1px solid var(--pale-stone)' }}>
          <button
            onClick={() => setGraphMode('global')}
            className="px-3 py-1.5 text-[10px] font-medium tracking-wider transition-colors"
            style={{
              background: graphMode === 'global' ? 'rgba(188, 179, 163, 0.35)' : 'transparent',
              color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif',
            }}
          >
            Global
          </button>
          <button
            onClick={() => setGraphMode('local')}
            className="px-3 py-1.5 text-[10px] font-medium tracking-wider transition-colors"
            style={{
              background: graphMode === 'local' ? 'rgba(188, 179, 163, 0.35)' : 'transparent',
              color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif',
            }}
          >
            Local
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(graphFilters) as Array<keyof typeof graphFilters>).map((key) => {
            const Icon = nodeIcons[key];
            return (
              <button
                key={key}
                onClick={() => toggleFilter(key)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium tracking-wider transition-all"
                style={{
                  border: `1px solid ${graphFilters[key] ? nodeColors[key] : 'var(--pale-stone)'}`,
                  background: graphFilters[key] ? `${nodeColors[key]}15` : 'transparent',
                  color: graphFilters[key] ? nodeColors[key] : 'var(--silica)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <Icon className="w-3 h-3" />
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 relative">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {filteredEdges.map((edge, i) => {
            const from = graphNodes.find((n) => n.id === edge.from);
            const to = graphNodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--warm-sand)" strokeWidth="0.3" opacity="0.6" />;
          })}
          {filteredNodes.map((node) => {
            const isActive = node.label === 'Hard season';
            return (
              <g key={node.id} className="cursor-pointer">
                {isActive && <circle cx={node.x} cy={node.y} r="4" fill={nodeColors[node.type]} opacity="0.15" />}
                <circle cx={node.x} cy={node.y} r={isActive ? 2.5 : 1.8} fill={nodeColors[node.type]} opacity={isActive ? 1 : 0.8} />
                <text x={node.x} y={node.y + 4.5} textAnchor="middle" fontSize="2.2" fill="var(--deep-umber)" opacity="0.7" fontFamily="Outfit, sans-serif">
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="p-4 shrink-0 space-y-3" style={{ borderTop: '1px solid rgba(206, 204, 202, 0.5)' }}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
            </div>
          ))}
        </div>
        <button className="flex items-center gap-2 w-full justify-center py-2 rounded-md hover:bg-black/5 transition-colors">
          <Maximize2 className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />
          <span className="text-[10px] font-medium tracking-widest" style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
            EXPAND FULL SCREEN
          </span>
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

Expected: No errors, successful build.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Notepad.tsx src/components/sections/notepad/
git commit -m "feat(notepad): wire all functional components into page shell"
```

---

## Task 14: Manual Testing & Polish

**Files:**
- Potentially modify: any file from previous tasks

- [ ] **Step 1: Start dev server**

```bash
npx vite --port 5174
```

- [ ] **Step 2: Test core flow**

Open `http://localhost:5174/notepad` in a browser and verify:

1. Click "NEW NOTE" dropdown — select Devotion — new note opens in editor with cursor in title
2. Type a title, then write content in the editor body
3. Type "Romans 8:28" — verify it gets gold underline styling
4. Hover over the verse reference — verify tooltip appears with verse text from API
5. Type `#trust` — verify tag pill styling appears
6. Check sidebar — the note appears under root, tag count updates
7. Create a folder — verify it appears in sidebar
8. Drag the note into the folder — verify it moves
9. Right-click the note — test Rename, Duplicate, Delete
10. Press Cmd+K — verify search dialog opens and finds the note
11. Click Upload — drop a .txt file — verify it imports
12. Check Backlinks tab and Info tab show correct data
13. Reload the page — verify all data persists from localStorage

- [ ] **Step 3: Fix any issues found during testing**

Address any bugs, styling mismatches, or UX issues discovered in Step 2.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix(notepad): polish and bug fixes from manual testing"
```
