import type { Note, Folder, NoteType } from '../types';

/**
 * FolderTreeView — pure preparation of `(Notes, Folders, filterText, tagFilter)`
 * into the indexed shape the sidebar needs to render. Replaces the inline
 * computations that were scattered between the main shell and per-folder
 * filter loops, and pins the load-bearing invariants in tests:
 *
 *   - **Orphan rule**: a Note whose `folderId` is `'root'` OR points at a
 *     non-existent folder is treated as a root Note. Preserved verbatim from
 *     the prior implementation.
 *   - Folders are sorted by `order` ascending, both at the root and within
 *     each parent bucket.
 *   - Tag counts are computed from ALL Notes, not the filtered subset, so the
 *     active tag pivot doesn't disappear from the list when applied.
 *   - Empty `NoteType` buckets are dropped from `rootNotesByType`.
 */

export interface FolderTreeView {
  rootFolders: Folder[];
  rootNotesByType: Map<NoteType, Note[]>;
  notesByFolder: Map<string, Note[]>;
  childFoldersByParent: Map<string, Folder[]>;
  allTags: Array<[string, number]>;
}

export const NOTE_TYPE_ORDER: NoteType[] = ['general', 'devotion', 'sermon', 'theme'];

export function buildFolderTreeView(
  notes: Note[],
  folders: Folder[],
  filterText: string,
  tagFilter: string | null,
): FolderTreeView {
  const lowerFilter = filterText.toLowerCase();
  const folderIds = new Set(folders.map((f) => f.id));

  function passesFilter(n: Note): boolean {
    if (filterText && !n.title.toLowerCase().includes(lowerFilter)) return false;
    if (tagFilter && !n.tags.includes(tagFilter)) return false;
    return true;
  }

  const rootNotes: Note[] = [];
  const notesByFolder = new Map<string, Note[]>();
  for (const note of notes) {
    if (!passesFilter(note)) continue;
    const isRoot = note.folderId === 'root' || !folderIds.has(note.folderId);
    if (isRoot) {
      rootNotes.push(note);
    } else {
      const list = notesByFolder.get(note.folderId) ?? [];
      list.push(note);
      notesByFolder.set(note.folderId, list);
    }
  }

  const rootNotesByType = new Map<NoteType, Note[]>();
  for (const type of NOTE_TYPE_ORDER) rootNotesByType.set(type, []);
  for (const note of rootNotes) {
    rootNotesByType.get(note.type)!.push(note);
  }
  for (const type of NOTE_TYPE_ORDER) {
    if (rootNotesByType.get(type)!.length === 0) rootNotesByType.delete(type);
  }

  const rootFolders: Folder[] = [];
  const childFoldersByParent = new Map<string, Folder[]>();
  for (const folder of folders) {
    if (folder.parentId === null) {
      rootFolders.push(folder);
    } else {
      const list = childFoldersByParent.get(folder.parentId) ?? [];
      list.push(folder);
      childFoldersByParent.set(folder.parentId, list);
    }
  }
  rootFolders.sort((a, b) => a.order - b.order);
  for (const list of childFoldersByParent.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  const tagCounts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const allTags: Array<[string, number]> = Array.from(tagCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  return { rootFolders, rootNotesByType, notesByFolder, childFoldersByParent, allTags };
}
