import { describe, it, expect } from 'vitest';
import {
  extractVerseRefsFromNoteContent,
  intersectTagsAndVerseRefs,
} from './note-signals';

const tipTapWithRefs = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Reading Psalm 23 today, and also Romans 8:28-30.' },
      ],
    },
  ],
});

const tipTapNoRefs = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'just words no refs here' }] },
  ],
});

describe('extractVerseRefsFromNoteContent', () => {
  it('picks up Romans 8:28-30', () => {
    const refs = extractVerseRefsFromNoteContent(tipTapWithRefs);
    expect(refs.some((r) => r.startsWith('Romans 8:28'))).toBe(true);
  });

  it('picks up chapter-only Psalm 23', () => {
    const refs = extractVerseRefsFromNoteContent(tipTapWithRefs);
    expect(refs.some((r) => r === 'Psalm 23' || r.startsWith('Psalm 23:'))).toBe(true);
  });

  it('returns [] for empty', () => {
    expect(extractVerseRefsFromNoteContent(tipTapNoRefs)).toEqual([]);
  });

  it('handles non-JSON gracefully', () => {
    const refs = extractVerseRefsFromNoteContent('plain text Psalm 23');
    expect(refs.length).toBeGreaterThan(0);
  });
});

describe('intersectTagsAndVerseRefs', () => {
  it('is case-insensitive on tags', () => {
    const result = intersectTagsAndVerseRefs(
      { tags: ['Prayer', 'doubt'], verseRefs: ['Psalm 23:1'] },
      { tags: ['prayer', 'wisdom'], verseRefs: ['Psalm 23:1', 'Proverbs 3:5'] },
    );
    expect(result.sharedTags.some((t) => t.toLowerCase() === 'prayer')).toBe(true);
    expect(result.sharedVerseRefs).toContain('Psalm 23:1');
  });

  it('returns empty arrays when nothing overlaps', () => {
    const result = intersectTagsAndVerseRefs(
      { tags: ['a'], verseRefs: ['Genesis 1:1'] },
      { tags: ['b'], verseRefs: ['Revelation 1:1'] },
    );
    expect(result.sharedTags).toEqual([]);
    expect(result.sharedVerseRefs).toEqual([]);
  });

  it('dedupes', () => {
    const result = intersectTagsAndVerseRefs(
      { tags: ['x', 'x'], verseRefs: ['Genesis 1:1', 'Genesis 1:1'] },
      { tags: ['x'], verseRefs: ['Genesis 1:1'] },
    );
    expect(result.sharedTags).toEqual(['x']);
    expect(result.sharedVerseRefs).toEqual(['Genesis 1:1']);
  });
});

describe('parity with browser connection-signals', () => {
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
    const refs = extractVerseRefsFromNoteContent(fixture);
    expect([...refs].sort()).toEqual(['Psalm 23', 'Romans 8:28-30'].sort());
  });
});
