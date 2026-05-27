import { describe, it, expect } from 'vitest';
import {
  computeSharedSignals,
  extractVerseRefsFromNote,
} from './connection-signals';
import type { Note } from '../types';

function fakeNote(overrides: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Untitled',
    content: JSON.stringify({ type: 'doc', content: [] }),
    folderId: 'folder-1',
    type: 'devotion',
    tags: [],
    wordCount: 0,
    createdAt: '2026-05-27T00:00:00.000Z',
    updatedAt: '2026-05-27T00:00:00.000Z',
    ...overrides,
  };
}

const refContent = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Reading Psalm 23 today, and Romans 8:28-30.' },
      ],
    },
  ],
});

describe('extractVerseRefsFromNote', () => {
  it('extracts canonical refs from TipTap content', () => {
    const refs = extractVerseRefsFromNote(fakeNote({ content: refContent }));
    expect(refs.some((r) => r.startsWith('Romans 8:28'))).toBe(true);
    expect(refs.some((r) => r === 'Psalm 23' || r.startsWith('Psalm 23:'))).toBe(true);
  });

  it('returns [] for empty content', () => {
    expect(extractVerseRefsFromNote(fakeNote({ content: '' }))).toEqual([]);
  });

  it('handles non-JSON content via tiptap-text fallback', () => {
    const refs = extractVerseRefsFromNote(fakeNote({ content: 'plain text Psalm 23' }));
    expect(refs.length).toBeGreaterThan(0);
  });
});

describe('computeSharedSignals', () => {
  it('intersects tags case-insensitively', () => {
    const a = fakeNote({ tags: ['Prayer', 'doubt'] });
    const b = fakeNote({ id: 'note-2', tags: ['prayer', 'wisdom'] });
    const result = computeSharedSignals(a, b);
    expect(result.sharedTags.map((t) => t.toLowerCase())).toEqual(['prayer']);
  });

  it('intersects verse refs', () => {
    const a = fakeNote({ content: refContent });
    const b = fakeNote({
      id: 'note-2',
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Came back to Romans 8:28-30 again.' }],
          },
        ],
      }),
    });
    const result = computeSharedSignals(a, b);
    expect(result.sharedVerseRefs.some((r) => r.startsWith('Romans 8:28'))).toBe(true);
  });

  it('returns empty arrays when nothing overlaps', () => {
    const a = fakeNote({ tags: ['a'], content: refContent });
    const b = fakeNote({
      id: 'note-2',
      tags: ['b'],
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'no refs' }] }],
      }),
    });
    const result = computeSharedSignals(a, b);
    expect(result.sharedTags).toEqual([]);
    expect(result.sharedVerseRefs).toEqual([]);
  });

  it('dedupes', () => {
    const a = fakeNote({ tags: ['x', 'x'] });
    const b = fakeNote({ id: 'note-2', tags: ['x'] });
    const result = computeSharedSignals(a, b);
    expect(result.sharedTags).toEqual(['x']);
  });
});

describe('parity with Deno note-signals', () => {
  it('extracts the same canonical refs from the shared fixture', () => {
    const fixture = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'In Psalm 23 the shepherd theme returns. Compare Romans 8:28-30.',
            },
          ],
        },
      ],
    });
    const refs = extractVerseRefsFromNote(fakeNote({ content: fixture }));
    expect([...refs].sort()).toEqual(['Psalm 23', 'Romans 8:28-30'].sort());
  });
});
