import type { Note, NoteType } from '../types';
import type { Reference } from '../graph/types';
import { findNoteLinkSnippet } from '../graph/reference-parser';

export interface BacklinkCard {
  note: Note;
  snippet: string;
}

export type GroupedBacklinks = Partial<Record<NoteType, BacklinkCard[]>>;

/**
 * Joins inbound `explicit` References with their source Notes and groups by
 * NoteType. Source-of-truth for which Notes appear is the ReferenceGraph;
 * title-substring mentions are intentionally excluded (see CONTEXT.md §Backlink).
 */
export function buildBacklinks(
  activeNoteId: string,
  allNotes: Note[],
  references: Reference[],
): GroupedBacklinks {
  const noteById = new Map(allNotes.map((n) => [n.id, n]));
  const result: GroupedBacklinks = {};
  const seenSources = new Set<string>();

  for (const ref of references) {
    if (ref.target !== activeNoteId) continue;
    if (ref.type !== 'explicit') continue;
    if (ref.source === activeNoteId) continue;
    if (seenSources.has(ref.source)) continue;
    seenSources.add(ref.source);

    const note = noteById.get(ref.source);
    if (!note) continue;

    const snippet = note.content ? findNoteLinkSnippet(note.content, activeNoteId) ?? '' : '';
    const list = result[note.type] ?? [];
    list.push({ note, snippet });
    result[note.type] = list;
  }

  return result;
}
