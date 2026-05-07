import { describe, it, expect } from 'vitest';
import { buildBacklinks } from './backlinks';
import type { Note } from '../types';
import type { Reference } from '../graph/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Mark = { type: string; attrs?: Record<string, unknown> };
type TextNode = { type: 'text'; text: string; marks?: Mark[] };
type ParagraphNode = { type: 'paragraph'; content?: Array<TextNode | ParagraphNode> };
type DocNode = { type: 'doc'; content?: Array<ParagraphNode | TextNode> };

function textNode(text: string, marks?: Mark[]): TextNode {
  const node: TextNode = { type: 'text', text };
  if (marks) node.marks = marks;
  return node;
}
function paragraph(...children: Array<TextNode | ParagraphNode>): ParagraphNode {
  return { type: 'paragraph', content: children };
}
function doc(...children: Array<ParagraphNode | TextNode>): DocNode {
  return { type: 'doc', content: children };
}
function makeDoc(...children: Array<ParagraphNode | TextNode>): string {
  return JSON.stringify(doc(...children));
}
function noteLink(noteId: string): Mark {
  return { type: 'noteLink', attrs: { noteId } };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
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

function makeRef(overrides: Partial<Reference> = {}): Reference {
  return {
    id: 'r1',
    source: 'src',
    target: 'tgt',
    type: 'explicit',
    weight: 1.0,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildBacklinks
// ---------------------------------------------------------------------------

describe('buildBacklinks — empty cases', () => {
  it('returns {} when there are no References at all', () => {
    expect(buildBacklinks('target', [], [])).toEqual({});
  });

  it('returns {} when no Reference targets the active note', () => {
    const refs = [makeRef({ source: 'a', target: 'b' })];
    const notes = [makeNote({ id: 'a' }), makeNote({ id: 'b' })];
    expect(buildBacklinks('target', notes, refs)).toEqual({});
  });

  it('returns {} when the only inbound Reference is from a Note that no longer exists', () => {
    const refs = [makeRef({ source: 'gone', target: 'target' })];
    expect(buildBacklinks('target', [], refs)).toEqual({});
  });
});

describe('buildBacklinks — explicit edge filtering', () => {
  it('includes a single explicit inbound edge', () => {
    const src = makeNote({ id: 'src', title: 'Source', type: 'devotion' });
    const refs = [makeRef({ source: 'src', target: 'target', type: 'explicit' })];
    const result = buildBacklinks('target', [src], refs);
    expect(result.devotion).toHaveLength(1);
    expect(result.devotion![0].note.id).toBe('src');
  });

  it('excludes scripture-reference edges (not note→note)', () => {
    const src = makeNote({ id: 'src', type: 'devotion' });
    const refs = [makeRef({ source: 'src', target: 'target', type: 'scripture-reference' })];
    expect(buildBacklinks('target', [src], refs)).toEqual({});
  });

  it('excludes cross-reference edges (scripture↔scripture)', () => {
    const src = makeNote({ id: 'src', type: 'devotion' });
    const refs = [makeRef({ source: 'src', target: 'target', type: 'cross-reference' })];
    expect(buildBacklinks('target', [src], refs)).toEqual({});
  });

  it('excludes a self-Reference where source === target', () => {
    const self = makeNote({ id: 'target', type: 'devotion' });
    const refs = [makeRef({ source: 'target', target: 'target', type: 'explicit' })];
    expect(buildBacklinks('target', [self], refs)).toEqual({});
  });

  it('deduplicates two inbound edges from the same source Note', () => {
    const src = makeNote({ id: 'src', type: 'devotion' });
    const refs = [
      makeRef({ id: 'r1', source: 'src', target: 'target' }),
      makeRef({ id: 'r2', source: 'src', target: 'target' }),
    ];
    const result = buildBacklinks('target', [src], refs);
    expect(result.devotion).toHaveLength(1);
  });
});

describe('buildBacklinks — grouping by NoteType', () => {
  it('groups inbound References by the source Note type', () => {
    const a = makeNote({ id: 'a', type: 'devotion', title: 'A' });
    const b = makeNote({ id: 'b', type: 'sermon', title: 'B' });
    const c = makeNote({ id: 'c', type: 'theme', title: 'C' });
    const refs = [
      makeRef({ id: 'r1', source: 'a', target: 'target' }),
      makeRef({ id: 'r2', source: 'b', target: 'target' }),
      makeRef({ id: 'r3', source: 'c', target: 'target' }),
    ];
    const result = buildBacklinks('target', [a, b, c], refs);
    expect(result.devotion).toHaveLength(1);
    expect(result.sermon).toHaveLength(1);
    expect(result.theme).toHaveLength(1);
  });
});

describe('buildBacklinks — title-mention is intentionally NOT a backlink', () => {
  it('does not include a Note that mentions the active title in plain text but has no Reference', () => {
    const target = makeNote({ id: 'target', title: 'Forgiveness', type: 'theme' });
    const mentioner = makeNote({
      id: 'mentioner',
      title: 'Other note',
      type: 'devotion',
      content: makeDoc(paragraph(textNode('A note about Forgiveness without a link.'))),
    });
    // No Reference connecting them.
    expect(buildBacklinks('target', [target, mentioner], [])).toEqual({});
  });
});

describe('buildBacklinks — snippet integration', () => {
  it('produces a snippet wrapping the marked link text in [brackets]', () => {
    const src = makeNote({
      id: 'src',
      type: 'devotion',
      content: makeDoc(
        paragraph(
          textNode('See also '),
          textNode('that other piece', [noteLink('target')]),
          textNode(' for context.'),
        ),
      ),
    });
    const refs = [makeRef({ source: 'src', target: 'target', type: 'explicit' })];
    const result = buildBacklinks('target', [src], refs);
    expect(result.devotion![0].snippet).toContain('[that other piece]');
  });

  it('returns an empty snippet when source Note has no content', () => {
    const src = makeNote({ id: 'src', type: 'devotion', content: '' });
    const refs = [makeRef({ source: 'src', target: 'target' })];
    const result = buildBacklinks('target', [src], refs);
    expect(result.devotion![0].snippet).toBe('');
  });
});
