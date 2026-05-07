import { describe, it, expect } from 'vitest';
import { projectGraph } from './project-graph';
import type { Reference, ScriptureNode } from './types';
import type { Note } from '../types';

const note = (over: Partial<Note> & { id: string; type: Note['type'] }): Note => ({
  id: over.id,
  title: over.title ?? `Note ${over.id}`,
  content: over.content ?? '',
  folderId: over.folderId ?? 'root',
  type: over.type,
  tags: over.tags ?? [],
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: over.updatedAt ?? '2026-01-01T00:00:00.000Z',
  wordCount: over.wordCount ?? 0,
});

const ref = (over: Partial<Reference> & { id: string; source: string; target: string }): Reference => ({
  id: over.id,
  source: over.source,
  target: over.target,
  type: over.type ?? 'explicit',
  weight: over.weight ?? 1,
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
});

const scripture = (over: Partial<ScriptureNode> & { id: string }): ScriptureNode => ({
  id: over.id,
  book: over.book ?? 'Genesis',
  chapter: over.chapter ?? 1,
  verseStart: over.verseStart ?? 1,
  verseEnd: over.verseEnd ?? null,
  translation: over.translation ?? 'WEB',
  text: over.text ?? 'In the beginning...',
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
});

describe('projectGraph', () => {
  it('emits a node per Note with type and title', () => {
    const notes = [note({ id: 'a', type: 'devotion', title: 'A' })];
    const { nodes } = projectGraph(notes, [], []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: 'a', type: 'devotion', title: 'A', weight: 0 });
  });

  it('sums edge weights across both endpoints into node weight', () => {
    const notes = [note({ id: 'a', type: 'devotion' }), note({ id: 'b', type: 'sermon' })];
    const refs = [
      ref({ id: 'r1', source: 'a', target: 'b', weight: 2 }),
      ref({ id: 'r2', source: 'b', target: 'a', weight: 3 }),
    ];
    const { nodes } = projectGraph(notes, refs, []);
    const a = nodes.find((n) => n.id === 'a')!;
    const b = nodes.find((n) => n.id === 'b')!;
    expect(a.weight).toBe(5);
    expect(b.weight).toBe(5);
  });

  it('only emits scripture nodes that participate in at least one edge', () => {
    const notes = [note({ id: 'a', type: 'devotion' })];
    const scriptures = [
      scripture({ id: 'scripture:gen-1-1' }),
      scripture({ id: 'scripture:exo-2-2' }),
    ];
    const refs = [
      ref({ id: 'r1', source: 'a', target: 'scripture:gen-1-1', type: 'scripture-reference' }),
    ];
    const { nodes } = projectGraph(notes, refs, scriptures);
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain('scripture:gen-1-1');
    expect(ids).not.toContain('scripture:exo-2-2');
  });

  it('maps reference type strings to view edge types', () => {
    const notes = [note({ id: 'a', type: 'devotion' }), note({ id: 'b', type: 'sermon' })];
    const refs = [
      ref({ id: 'r1', source: 'a', target: 'b', type: 'explicit' }),
      ref({ id: 'r2', source: 'a', target: 'scripture:x', type: 'scripture-reference' }),
      ref({ id: 'r3', source: 'scripture:x', target: 'scripture:y', type: 'cross-reference' }),
    ];
    const scriptures = [scripture({ id: 'scripture:x' }), scripture({ id: 'scripture:y' })];
    const { edges } = projectGraph(notes, refs, scriptures);
    expect(edges.find((e) => e.id === 'r1')!.type).toBe('explicit');
    expect(edges.find((e) => e.id === 'r2')!.type).toBe('scripture_reference');
    expect(edges.find((e) => e.id === 'r3')!.type).toBe('cross_reference');
  });

  it('preserves edge id, source, target, weight, createdAt', () => {
    const notes = [note({ id: 'a', type: 'devotion' }), note({ id: 'b', type: 'sermon' })];
    const refs = [
      ref({ id: 'r1', source: 'a', target: 'b', weight: 4, createdAt: '2026-02-02T00:00:00.000Z' }),
    ];
    const { edges } = projectGraph(notes, refs, []);
    expect(edges[0]).toMatchObject({
      id: 'r1', source: 'a', target: 'b', weight: 4, createdAt: '2026-02-02T00:00:00.000Z',
    });
  });
});
