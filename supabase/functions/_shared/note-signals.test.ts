import {
  extractVerseRefsFromNoteContent,
  intersectTagsAndVerseRefs,
} from './note-signals.ts';

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

Deno.test('extractVerseRefsFromNoteContent picks up Romans 8:28-30', () => {
  const refs = extractVerseRefsFromNoteContent(tipTapWithRefs);
  if (!refs.some((r) => r.startsWith('Romans 8:28'))) {
    throw new Error(`expected Romans 8:28-30 in ${JSON.stringify(refs)}`);
  }
});

Deno.test('extractVerseRefsFromNoteContent picks up chapter-only Psalm 23', () => {
  const refs = extractVerseRefsFromNoteContent(tipTapWithRefs);
  if (!refs.some((r) => r === 'Psalm 23' || r.startsWith('Psalm 23:'))) {
    throw new Error(`expected Psalm 23 in ${JSON.stringify(refs)}`);
  }
});

Deno.test('extractVerseRefsFromNoteContent returns [] for empty', () => {
  const refs = extractVerseRefsFromNoteContent(tipTapNoRefs);
  if (refs.length !== 0) throw new Error(`expected [], got ${JSON.stringify(refs)}`);
});

Deno.test('extractVerseRefsFromNoteContent handles non-JSON gracefully', () => {
  const refs = extractVerseRefsFromNoteContent('plain text Psalm 23');
  if (!refs.length) throw new Error('expected at least Psalm 23 from plaintext');
});

Deno.test('intersectTagsAndVerseRefs is case-insensitive on tags', () => {
  const result = intersectTagsAndVerseRefs(
    { tags: ['Prayer', 'doubt'], verseRefs: ['Psalm 23:1'] },
    { tags: ['prayer', 'wisdom'], verseRefs: ['Psalm 23:1', 'Proverbs 3:5'] },
  );
  if (!result.sharedTags.some((t) => t.toLowerCase() === 'prayer')) {
    throw new Error(`expected 'prayer' in sharedTags, got ${JSON.stringify(result.sharedTags)}`);
  }
  if (!result.sharedVerseRefs.includes('Psalm 23:1')) {
    throw new Error(`expected 'Psalm 23:1' in sharedVerseRefs, got ${JSON.stringify(result.sharedVerseRefs)}`);
  }
});

Deno.test('intersectTagsAndVerseRefs returns empty arrays when nothing overlaps', () => {
  const result = intersectTagsAndVerseRefs(
    { tags: ['a'], verseRefs: ['Genesis 1:1'] },
    { tags: ['b'], verseRefs: ['Revelation 1:1'] },
  );
  if (result.sharedTags.length !== 0) throw new Error('sharedTags should be empty');
  if (result.sharedVerseRefs.length !== 0) throw new Error('sharedVerseRefs should be empty');
});

Deno.test('intersectTagsAndVerseRefs dedupes', () => {
  const result = intersectTagsAndVerseRefs(
    { tags: ['x', 'x'], verseRefs: ['Genesis 1:1', 'Genesis 1:1'] },
    { tags: ['x'], verseRefs: ['Genesis 1:1'] },
  );
  if (result.sharedTags.length !== 1) {
    throw new Error(`expected dedupe, got ${JSON.stringify(result.sharedTags)}`);
  }
  if (result.sharedVerseRefs.length !== 1) {
    throw new Error(`expected dedupe, got ${JSON.stringify(result.sharedVerseRefs)}`);
  }
});

Deno.test('parity: known fixture produces stable output across runtimes', () => {
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
  // The browser-side connection-signals.test.ts hashes the same fixture and
  // asserts the identical sorted array. Any drift here must be mirrored
  // on the browser side (and vice versa).
  const expected = ['Psalm 23', 'Romans 8:28-30'];
  const sortedRefs = [...refs].sort();
  const sortedExp = [...expected].sort();
  if (JSON.stringify(sortedRefs) !== JSON.stringify(sortedExp)) {
    throw new Error(
      `parity drift: got ${JSON.stringify(sortedRefs)}, expected ${JSON.stringify(sortedExp)}`,
    );
  }
});
