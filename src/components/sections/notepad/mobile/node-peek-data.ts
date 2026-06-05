import type { Note, NoteType } from '../../../../notepad/types';
import type { ReferenceGraph } from '../../../../notepad/graph/reference-graph';
import { extractTextFromNote } from '../../../../notepad/utils/tiptap-text';

export interface PeekTarget {
  id: string;
  kind: 'note' | 'scripture';
}

export interface LinkedVerse {
  id: string;
  label: string;
}

export interface PeekNoteData {
  kind: 'note';
  id: string;
  title: string;
  noteType: NoteType;
  connectionCount: number;
  /** Full plain-text of the note body; the peek view renders it in a scroll area (no truncation here). */
  preview: string;
  linkedVerses: LinkedVerse[];
}

export interface ReferencingNote {
  id: string;
  title: string;
  type: NoteType;
}

export interface PeekScriptureData {
  kind: 'scripture';
  id: string;
  reference: string;
  translation: string;
  text: string;
  referencedBy: ReferencingNote[];
}

export type PeekData = PeekNoteData | PeekScriptureData;

function verseLabel(graph: ReferenceGraph, scriptureId: string): string {
  const sn = graph.getScriptureNode(scriptureId);
  if (!sn) return scriptureId;
  return `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`;
}

export function buildPeekData(
  target: PeekTarget,
  notes: Note[],
  graph: ReferenceGraph,
): PeekData | null {
  if (target.kind === 'note') {
    const note = notes.find((n) => n.id === target.id);
    if (!note) return null;

    const outgoing = graph.getReferencesBy({ source: note.id });
    const incoming = graph.getReferencesBy({ target: note.id });

    const seen = new Set<string>();
    const linkedVerses: LinkedVerse[] = [];
    for (const r of outgoing) {
      if (r.type !== 'scripture-reference' || seen.has(r.target)) continue;
      seen.add(r.target);
      linkedVerses.push({ id: r.target, label: verseLabel(graph, r.target) });
    }

    return {
      kind: 'note',
      id: note.id,
      title: note.title,
      noteType: note.type,
      // Counts all edge types both ways. Cross-reference edges are scripture↔scripture
      // (a note is never their source), so there is no double-count risk here.
      connectionCount: outgoing.length + incoming.length,
      preview: extractTextFromNote(note),
      linkedVerses,
    };
  }

  const sn = graph.getScriptureNode(target.id);
  if (!sn) return null;

  const seen = new Set<string>();
  const referencedBy: ReferencingNote[] = [];
  for (const r of graph.getReferencesBy({ target: target.id })) {
    const note = notes.find((n) => n.id === r.source);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    referencedBy.push({ id: note.id, title: note.title, type: note.type });
  }

  return {
    kind: 'scripture',
    id: target.id,
    reference: `${sn.book} ${sn.chapter}:${sn.verseStart}${sn.verseEnd ? `-${sn.verseEnd}` : ''}`,
    translation: sn.translation,
    text: sn.text,
    referencedBy,
  };
}
