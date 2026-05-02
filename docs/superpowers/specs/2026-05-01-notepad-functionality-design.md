# Psalms' Notepad — Functionality Design Spec

**Date:** May 1, 2026
**Scope:** All Notepad functionality except the graph pane (deferred)

---

## 1. Architecture: Data Layer

### Storage Adapter Pattern

A `StorageAdapter` interface defines all CRUD operations for notes, folders, and tags. A `LocalStorageAdapter` implements it using localStorage (JSON-serialized). All components interact with data through a React context (`NotepadProvider`) that wraps the adapter. When a backend is added later, only the adapter implementation changes.

### Data Models

```typescript
interface Note {
  id: string;           // uuid
  title: string;
  content: string;      // TipTap JSON (stringified) — preserves custom marks (verse links, note links)
  folderId: string;
  type: 'devotion' | 'sermon' | 'theme';
  tags: string[];       // derived from #tagname patterns in content
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}

interface Folder {
  id: string;           // uuid
  name: string;
  parentId: string | null;  // null = root level
  order: number;
}

interface StorageAdapter {
  // Notes
  getNotes(): Promise<Note[]>;
  getNote(id: string): Promise<Note | null>;
  createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note>;
  updateNote(id: string, updates: Partial<Note>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  duplicateNote(id: string): Promise<Note>;

  // Folders
  getFolders(): Promise<Folder[]>;
  createFolder(folder: Omit<Folder, 'id'>): Promise<Folder>;
  updateFolder(id: string, updates: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;
}
```

### Derived Data (Not Stored)

- **Tags:** Extracted from `#tagname` patterns in note content. The sidebar tag list is computed by scanning all notes.
- **Bible verse references:** Detected at render time by the TipTap editor using regex pattern matching. Not stored separately.
- **Backlinks:** Computed by scanning all notes for `[[note title]]` patterns pointing to the current note.

---

## 2. Editor: TipTap Rich-Text Editor

### Library

TipTap (headless, extensible, built on ProseMirror).

### Extensions

| Extension | Purpose |
|-----------|---------|
| **StarterKit** | Bold, italic, headings (H1-H3), bullet/numbered lists, blockquote, code, undo/redo |
| **Placeholder** | "Start writing..." hint text in empty documents |
| **FloatingMenu** | Formatting toolbar on text selection: bold, italic, heading, list, blockquote |
| **Custom: BibleVerse** | TipTap Mark using input rule regex to detect verse patterns (e.g. "Romans 8:28", "1 Peter 5:7", "Jer 29:11"). Decorates matches with italic + gold underline. Hover fetches full verse text from bible-api.com and displays in a tooltip. |
| **Custom: NoteLink** | Typing `[[` opens a floating search popup listing all notes. Selecting inserts a blue-underlined link storing the note's ID as an attribute. Clicking navigates to that note. |
| **Custom: TagMark** | `#tagname` patterns styled with muted background pills. Automatically aggregated in sidebar. |

### Bible Verse Regex Patterns

Matches common formats:
- Full name: "Romans 8:28", "1 Peter 5:7", "Psalm 46:10"
- Abbreviated: "Rom 8:28", "1 Pet 5:7", "Ps 46:10", "Jer 29:11", "Gen 22:8"
- With ranges: "Romans 8:28-30", "John 3:16-17"

### Verse API

- Source: bible-api.com (free, no API key required)
- Fetched on hover over a detected verse reference
- Displayed in a tooltip with the verse text and translation

### Auto-Save

Editor content saves on a debounced basis (500ms after the user stops typing) through the storage adapter. No manual save button.

---

## 3. File Management: Sidebar

### Drag-and-Drop

Uses `@dnd-kit/core` + `@dnd-kit/sortable`. Notes and folders can be dragged between folders. Drag handles visible on hover.

### Right-Click Context Menus

Uses shadcn `ContextMenu` component (already in the project).

**Folder context menu:**
- Rename
- New Note Inside
- New Subfolder
- Delete (confirmation dialog if folder contains notes)

**Note context menu:**
- Rename
- Move to Folder (opens a folder picker)
- Duplicate
- Delete (confirmation dialog)

### New Folder Creation

A "+ New Folder" button at the bottom of the file tree. Creates a folder at root level with an inline editable name field.

### Note Type Assignment

When creating a new note, a small dropdown lets the user pick the type (Devotion, Sermon, Theme). The type icon and color appear next to the note title in the sidebar:
- Devotion: PenLine icon, Emerald Green (#34D399)
- Sermon: Mic icon, Sky Blue (#38BDF8)
- Theme: Sparkles icon, Violet (#A78BFA)

### Active Note

Currently open note gets a warm sand background accent (`rgba(188, 179, 163, 0.3)`) in the sidebar.

---

## 4. Upload Flow

### Trigger

Upload button in the workspace toolbar opens a modal dialog.

### Drop Zone

Uses `react-dropzone` for drag-and-drop file selection. Also supports click-to-browse.

### Supported Formats

| Format | Parsing Library | Handling |
|--------|----------------|----------|
| `.md` | Native `FileReader` | Read as text directly. Existing `[[links]]` preserved. |
| `.txt` | Native `FileReader` | Read as text, treated as markdown. |
| `.pdf` | `pdfjs-dist` | Text extraction, converted to markdown. |
| `.docx` | `mammoth.js` | Converts to markdown preserving headings, bold, italic, lists. |

### Post-Upload Processing

Two checkboxes (both enabled by default):

1. **Auto-detect Bible verse references** — runs the verse regex over imported content so verses are linked when the note opens in the editor.
2. **Auto-create links between uploaded notes** — scans the uploaded batch for shared verse references. If two notes share a verse, a `[[note title]]` link is appended under a "Related Notes" heading at the bottom of each.

### Options

- **Folder destination:** Dropdown to select target folder. Defaults to root.
- **Bulk support:** Multiple files can be dropped/selected. Each file becomes one note, titled from the filename (minus extension).

---

## 5. Toolbar & Search

### Global Search (Cmd+K)

Keyboard shortcut `Ctrl+K` / `Cmd+K` opens a shadcn `CommandDialog` (cmdk, already installed).

Results grouped into three sections:
- **Notes** — fuzzy matches against note titles and content
- **Verses** — matches against Bible verse reference patterns found across notes
- **Tags** — matches against tag names

Selecting a result opens that note in the editor (scrolling to the match for content matches). Search is client-side against localStorage data.

### Sidebar Filter

The filter input at the top of the file tree does real-time filtering of note titles. Separate from global search — only narrows the visible sidebar list.

### Tag Click

Clicking a tag in the sidebar filters the file tree to show only notes containing that tag. Clicking the same tag again clears the filter.

---

## 6. Backlinks & Info Tabs

### Backlinks Tab

Scans all notes for `[[current note title]]` links pointing to the open note. Results grouped by note type (Devotion, Sermon, Theme) with type icon and color. Each entry shows:
- Note title
- Context snippet (the sentence surrounding the link)

Clicking an entry opens that note in the editor.

### Info Tab

Displays computed metadata for the current note:
- Date created
- Date last modified
- Word count (from editor content)
- Linked verses count (detected Bible references)
- Outgoing links count (`[[...]]` links in this note)
- Incoming backlinks count
- Folder path
- Note type

All values computed live from note content and collection state.

---

## 7. File Structure

```
src/
  notepad/
    types.ts                  # Note, Folder, StorageAdapter interfaces
    storage/
      adapter.ts              # StorageAdapter interface
      local-storage.ts        # LocalStorageAdapter implementation
    context/
      NotepadProvider.tsx      # React context wrapping storage adapter
      useNotepad.ts            # Hook for accessing notepad state & actions
    extensions/
      bible-verse.ts           # TipTap Bible verse detection extension
      note-link.ts             # TipTap [[ ]] note linking extension
      tag-mark.ts              # TipTap #tag detection extension
    components/
      NotepadToolbar.tsx       # Top workspace toolbar
      Sidebar.tsx              # File tree + tags
      Editor.tsx               # TipTap editor wrapper
      EditorTabs.tsx           # Content / Backlinks / Info tab bar
      BacklinksPanel.tsx       # Backlinks tab content
      InfoPanel.tsx            # Info tab content
      UploadModal.tsx          # Upload flow modal
      SearchDialog.tsx         # Cmd+K global search
      FolderContextMenu.tsx    # Right-click menu for folders
      NoteContextMenu.tsx      # Right-click menu for notes
  components/sections/
    Notepad.tsx                # Page shell (updated to compose new components)
```

---

## 8. New Dependencies

| Package | Purpose |
|---------|---------|
| `@tiptap/react` | TipTap React bindings |
| `@tiptap/starter-kit` | Core editor extensions |
| `@tiptap/extension-placeholder` | Placeholder text |
| `@tiptap/extension-floating-menu` | Floating toolbar |
| `@tiptap/pm` | ProseMirror utilities |
| `@dnd-kit/core` | Drag-and-drop framework |
| `@dnd-kit/sortable` | Sortable lists for file tree |
| `@dnd-kit/utilities` | DnD utility functions |
| `react-dropzone` | File drop zone for uploads |
| `pdfjs-dist` | PDF text extraction |
| `mammoth` | DOCX to markdown conversion |
| `uuid` | UUID generation for note/folder IDs |
