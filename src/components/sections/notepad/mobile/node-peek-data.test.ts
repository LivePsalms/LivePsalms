import { describe, it, expect } from 'vitest';
import { buildPeekData } from './node-peek-data';
import type { ReferenceGraph } from '../../../../notepad/graph/reference-graph';
import type { Note } from '../../../../notepad/types';
import type { Reference } from '../../../../notepad/graph/types';

function makeNote(over: Partial<Note> & { id: string }): Note {
  return {
    id: over.id,
    title: over.title ?? over.id,
    content: over.content ?? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] }] }),
    folderId: over.folderId ?? 'root',
    type: over.type ?? 'devotion',
    tags: over.tags ?? [],
    wordCount: over.wordCount ?? 2,
    createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: over.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

function makeGraph(opts: {
  references?: Reference[];
  scripture?: Record<string, { book: string; chapter: number; verseStart: number; verseEnd: number | null; translation: string; text: string }>;
}): ReferenceGraph {
  const references = opts.references ?? [];
  const scripture = opts.scripture ?? {};
  // Structural stub — only the two methods buildPeekData uses.
  return {
    getReferencesBy: ({ source, target }: { source?: string; target?: string }) =>
      references.filter((r) => (source === undefined || r.source === source) && (target === undefined || r.target === target)),
    getScriptureNode: (id: string) => {
      const s = scripture[id];
      return s ? { id, createdAt: '2026-01-01T00:00:00.000Z', ...s } : null;
    },
  } as unknown as ReferenceGraph;
}

const ref = (over: Partial<Reference> & { id: string; source: string; target: string }): Reference => ({
  id: over.id, source: over.source, target: over.target,
  type: over.type ?? 'explicit', weight: over.weight ?? 1, createdAt: over.createdAt ?? 'x',
});

describe('buildPeekData', () => {
  it('returns null for a missing note', () => {
    expect(buildPeekData({ id: 'nope', kind: 'note' }, [], makeGraph({}))).toBeNull();
  });

  it('returns null for a missing scripture node', () => {
    expect(buildPeekData({ id: 'scripture:nope', kind: 'scripture' }, [], makeGraph({}))).toBeNull();
  });

  it('builds a note peek with connection count, preview, and linked verses', () => {
    const notes = [makeNote({ id: 'n1', title: 'Shepherd', type: 'devotion' })];
    const graph = makeGraph({
      references: [
        ref({ id: 'e1', source: 'n1', target: 'scripture:ps-23-1', type: 'scripture-reference' }),
        ref({ id: 'e2', source: 'n1', target: 'n2', type: 'explicit' }),
      ],
      scripture: { 'scripture:ps-23-1': { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: null, translation: 'WEB', text: '...' } },
    });
    expect(buildPeekData({ id: 'n1', kind: 'note' }, notes, graph)).toEqual({
      kind: 'note',
      id: 'n1',
      title: 'Shepherd',
      noteType: 'devotion',
      connectionCount: 2,
      preview: 'hello world',
      linkedVerses: [{ id: 'scripture:ps-23-1', label: 'Psalm 23:1' }],
    });
  });

  it('builds a scripture peek with deduped referenced-by notes', () => {
    const notes = [
      makeNote({ id: 'n1', title: 'Shepherd', type: 'devotion' }),
      makeNote({ id: 'n2', title: 'Sermon', type: 'sermon' }),
    ];
    const graph = makeGraph({
      references: [
        ref({ id: 'e1', source: 'n1', target: 'scripture:ps-23-1', type: 'scripture-reference' }),
        ref({ id: 'e2', source: 'n2', target: 'scripture:ps-23-1', type: 'scripture-reference' }),
      ],
      scripture: { 'scripture:ps-23-1': { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 4, translation: 'WEB', text: 'The Lord is my shepherd' } },
    });
    expect(buildPeekData({ id: 'scripture:ps-23-1', kind: 'scripture' }, notes, graph)).toEqual({
      kind: 'scripture',
      id: 'scripture:ps-23-1',
      reference: 'Psalm 23:1-4',
      translation: 'WEB',
      text: 'The Lord is my shepherd',
      referencedBy: [
        { id: 'n1', title: 'Shepherd', type: 'devotion' },
        { id: 'n2', title: 'Sermon', type: 'sermon' },
      ],
    });
  });
});
