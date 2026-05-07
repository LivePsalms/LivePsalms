import { describe, it, expect } from 'vitest';
import { buildFolderTreeView, NOTE_TYPE_ORDER } from './folder-tree-view';
import type { Note, Folder, NoteType } from '../types';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n',
    title: 'Untitled',
    content: '',
    folderId: 'root',
    type: 'devotion',
    tags: [],
    wordCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'f',
    name: 'Folder',
    parentId: null,
    order: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty / trivial
// ---------------------------------------------------------------------------

describe('buildFolderTreeView — empty inputs', () => {
  it('returns empty everything for empty inputs', () => {
    const v = buildFolderTreeView([], [], '', null);
    expect(v.rootFolders).toEqual([]);
    expect([...v.rootNotesByType.entries()]).toEqual([]);
    expect([...v.notesByFolder.entries()]).toEqual([]);
    expect([...v.childFoldersByParent.entries()]).toEqual([]);
    expect(v.allTags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Orphan rule
// ---------------------------------------------------------------------------

describe('buildFolderTreeView — orphan rule', () => {
  it('treats Notes with folderId === "root" as root Notes', () => {
    const note = makeNote({ id: 'a', folderId: 'root' });
    const v = buildFolderTreeView([note], [], '', null);
    expect(v.rootNotesByType.get('devotion')?.map((n) => n.id)).toEqual(['a']);
  });

  it('treats Notes whose folderId points at a non-existent folder as root Notes (orphans)', () => {
    const note = makeNote({ id: 'orph', folderId: 'gone-folder' });
    const v = buildFolderTreeView([note], [], '', null);
    expect(v.rootNotesByType.get('devotion')?.map((n) => n.id)).toEqual(['orph']);
    expect(v.notesByFolder.has('gone-folder')).toBe(false);
  });

  it('places a Note in its folder when folderId matches an existing folder', () => {
    const folder = makeFolder({ id: 'f1' });
    const note = makeNote({ id: 'n1', folderId: 'f1' });
    const v = buildFolderTreeView([note], [folder], '', null);
    expect(v.notesByFolder.get('f1')?.map((n) => n.id)).toEqual(['n1']);
    expect(v.rootNotesByType.has('devotion')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('buildFolderTreeView — text filter', () => {
  it('keeps Notes whose title contains the filter (case-insensitive)', () => {
    const a = makeNote({ id: 'a', title: 'Forgiveness reflections' });
    const b = makeNote({ id: 'b', title: 'Patience' });
    const v = buildFolderTreeView([a, b], [], 'FORGIVE', null);
    expect(v.rootNotesByType.get('devotion')?.map((n) => n.id)).toEqual(['a']);
  });

  it('drops Notes that do not match the filter', () => {
    const a = makeNote({ id: 'a', title: 'Forgiveness' });
    const v = buildFolderTreeView([a], [], 'zeta', null);
    expect(v.rootNotesByType.has('devotion')).toBe(false);
  });
});

describe('buildFolderTreeView — tag filter', () => {
  it('keeps only Notes whose tags include the active tag', () => {
    const a = makeNote({ id: 'a', tags: ['#hope'] });
    const b = makeNote({ id: 'b', tags: ['#patience'] });
    const v = buildFolderTreeView([a, b], [], '', '#hope');
    expect(v.rootNotesByType.get('devotion')?.map((n) => n.id)).toEqual(['a']);
  });

  it('combines text and tag filters with AND semantics', () => {
    const a = makeNote({ id: 'a', title: 'Hope today', tags: ['#hope'] });
    const b = makeNote({ id: 'b', title: 'Hope tomorrow', tags: ['#patience'] });
    const c = makeNote({ id: 'c', title: 'Forgive', tags: ['#hope'] });
    const v = buildFolderTreeView([a, b, c], [], 'hope', '#hope');
    expect(v.rootNotesByType.get('devotion')?.map((n) => n.id)).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// Folder ordering
// ---------------------------------------------------------------------------

describe('buildFolderTreeView — folder ordering', () => {
  it('sorts root folders by `order` ascending', () => {
    const f1 = makeFolder({ id: 'f1', order: 5 });
    const f2 = makeFolder({ id: 'f2', order: 1 });
    const f3 = makeFolder({ id: 'f3', order: 3 });
    const v = buildFolderTreeView([], [f1, f2, f3], '', null);
    expect(v.rootFolders.map((f) => f.id)).toEqual(['f2', 'f3', 'f1']);
  });

  it('sorts child folders within each parent bucket by `order` ascending', () => {
    const parent = makeFolder({ id: 'p', order: 0 });
    const c1 = makeFolder({ id: 'c1', parentId: 'p', order: 2 });
    const c2 = makeFolder({ id: 'c2', parentId: 'p', order: 0 });
    const v = buildFolderTreeView([], [parent, c1, c2], '', null);
    expect(v.childFoldersByParent.get('p')?.map((f) => f.id)).toEqual(['c2', 'c1']);
  });
});

// ---------------------------------------------------------------------------
// NoteType grouping
// ---------------------------------------------------------------------------

describe('buildFolderTreeView — NoteType grouping', () => {
  it('groups root Notes by NoteType', () => {
    const a = makeNote({ id: 'a', type: 'devotion' });
    const b = makeNote({ id: 'b', type: 'sermon' });
    const c = makeNote({ id: 'c', type: 'theme' });
    const v = buildFolderTreeView([a, b, c], [], '', null);
    expect(v.rootNotesByType.get('devotion')?.map((n) => n.id)).toEqual(['a']);
    expect(v.rootNotesByType.get('sermon')?.map((n) => n.id)).toEqual(['b']);
    expect(v.rootNotesByType.get('theme')?.map((n) => n.id)).toEqual(['c']);
  });

  it('drops empty NoteType buckets', () => {
    const a = makeNote({ id: 'a', type: 'devotion' });
    const v = buildFolderTreeView([a], [], '', null);
    expect(v.rootNotesByType.has('devotion')).toBe(true);
    expect(v.rootNotesByType.has('sermon')).toBe(false);
    expect(v.rootNotesByType.has('theme')).toBe(false);
  });

  it('exposes NOTE_TYPE_ORDER for stable iteration', () => {
    expect(NOTE_TYPE_ORDER).toEqual(['devotion', 'sermon', 'theme']);
  });

  it('iterates NoteType buckets in NOTE_TYPE_ORDER', () => {
    // Insertion order in the Map matches NOTE_TYPE_ORDER even when notes are
    // added in a different order, because we seed the Map first.
    const sermon = makeNote({ id: 's', type: 'sermon' });
    const devotion = makeNote({ id: 'd', type: 'devotion' });
    const theme = makeNote({ id: 't', type: 'theme' });
    const v = buildFolderTreeView([sermon, devotion, theme], [], '', null);
    const ordered = [...v.rootNotesByType.keys()] satisfies NoteType[];
    expect(ordered).toEqual(['devotion', 'sermon', 'theme']);
  });
});

// ---------------------------------------------------------------------------
// Tag counts
// ---------------------------------------------------------------------------

describe('buildFolderTreeView — tag counts', () => {
  it('counts every (note, tag) occurrence and sorts by count descending', () => {
    const a = makeNote({ id: 'a', tags: ['#hope', '#faith'] });
    const b = makeNote({ id: 'b', tags: ['#hope'] });
    const c = makeNote({ id: 'c', tags: ['#hope', '#love'] });
    const v = buildFolderTreeView([a, b, c], [], '', null);
    expect(v.allTags).toEqual([
      ['#hope', 3],
      ['#faith', 1],
      ['#love', 1],
    ]);
  });

  it('computes tag counts from ALL Notes, not the filtered subset (active tag pivot stays visible)', () => {
    const a = makeNote({ id: 'a', tags: ['#hope'] });
    const b = makeNote({ id: 'b', tags: ['#patience'] });
    // Tag filter active — would reduce the visible Notes — but tag counts must
    // still reflect all Notes so #patience remains clickable.
    const v = buildFolderTreeView([a, b], [], '', '#hope');
    expect(v.allTags).toEqual([
      ['#hope', 1],
      ['#patience', 1],
    ]);
  });
});
