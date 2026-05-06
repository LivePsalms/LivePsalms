import type { Note } from '../types';
import type { StorageAdapter } from './adapter';

interface NoteLinkMark {
  type: 'noteLink';
  attrs?: { noteId?: string | null; noteTitle?: string | null };
}

/**
 * Walk a TipTap doc and collect every noteLink mark, with the path needed to
 * mutate it back in place. Returns [] if content can't be parsed.
 */
function collectNoteLinks(doc: unknown): NoteLinkMark[] {
  const found: NoteLinkMark[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: string; text?: string; marks?: unknown[]; content?: unknown[] };
    if (node.type === 'text' && Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        const m = mark as NoteLinkMark;
        if (m && m.type === 'noteLink') found.push(m);
      }
    }
    if (Array.isArray(node.content)) for (const child of node.content) walk(child);
  };
  walk(doc);
  return found;
}

/**
 * Scan all notes for `noteLink` marks whose `noteId` no longer points at an
 * existing note. When such a mark also carries a `noteTitle` that matches a
 * current note's title (case-insensitive, trimmed), rewrite `noteId` to the
 * current note's id and persist via `updateNote`.
 *
 * Returns the number of notes that were repaired. Idempotent: a second run
 * over already-healed data does nothing.
 */
export async function repairNoteLinks(
  notes: Note[],
  adapter: StorageAdapter,
): Promise<{ repairedNotes: number; rewiredLinks: number; orphans: number }> {
  if (notes.length === 0) return { repairedNotes: 0, rewiredLinks: 0, orphans: 0 };

  const idSet = new Set(notes.map((n) => n.id));
  const titleToId = new Map<string, string>();
  for (const n of notes) {
    const key = n.title.trim().toLowerCase();
    // First note with a given title wins; collisions are unusual but possible.
    if (!titleToId.has(key)) titleToId.set(key, n.id);
  }

  let repairedNotes = 0;
  let rewiredLinks = 0;
  let orphans = 0;

  for (const note of notes) {
    let doc: unknown;
    try {
      doc = JSON.parse(note.content);
    } catch {
      continue;
    }

    const marks = collectNoteLinks(doc);
    if (marks.length === 0) continue;

    let changedThisNote = 0;
    for (const m of marks) {
      const targetId = m.attrs?.noteId;
      if (typeof targetId === 'string' && idSet.has(targetId)) continue;

      const title = m.attrs?.noteTitle;
      if (typeof title !== 'string' || title.trim().length === 0) {
        orphans++;
        continue;
      }
      const newId = titleToId.get(title.trim().toLowerCase());
      if (!newId || newId === note.id) {
        orphans++;
        continue;
      }
      if (!m.attrs) m.attrs = {};
      m.attrs.noteId = newId;
      changedThisNote++;
    }

    if (changedThisNote > 0) {
      const newContent = JSON.stringify(doc);
      try {
        await adapter.updateNote(note.id, { content: newContent });
        repairedNotes++;
        rewiredLinks += changedThisNote;
      } catch (err) {
        console.warn('[repairNoteLinks] failed to persist repair for', note.id, err);
      }
    }
  }

  return { repairedNotes, rewiredLinks, orphans };
}
