// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { localBibleHighlightAdapter } from './local-bible-highlight-adapter';

afterEach(() => localStorage.clear());

describe('localBibleHighlightAdapter', () => {
  it('returns an empty list when nothing is stored', async () => {
    expect(await localBibleHighlightAdapter.getChapterHighlights('jhn', 1)).toEqual([]);
  });

  it('sets and reads back a highlight scoped to its chapter', async () => {
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-03');
    await localBibleHighlightAdapter.setHighlight('jhn.2.5', 'highlight-04');

    const ch1 = await localBibleHighlightAdapter.getChapterHighlights('jhn', 1);
    expect(ch1).toEqual([{ verseId: 'jhn.1.1', swatchId: 'highlight-03' }]);

    const ch2 = await localBibleHighlightAdapter.getChapterHighlights('jhn', 2);
    expect(ch2).toEqual([{ verseId: 'jhn.2.5', swatchId: 'highlight-04' }]);
  });

  it('does not bleed across chapters with a shared numeric prefix', async () => {
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-01');
    await localBibleHighlightAdapter.setHighlight('jhn.11.1', 'highlight-02');
    const ch1 = await localBibleHighlightAdapter.getChapterHighlights('jhn', 1);
    expect(ch1.map((h) => h.verseId)).toEqual(['jhn.1.1']);
  });

  it('recolors an existing highlight', async () => {
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-01');
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-09');
    const ch1 = await localBibleHighlightAdapter.getChapterHighlights('jhn', 1);
    expect(ch1).toEqual([{ verseId: 'jhn.1.1', swatchId: 'highlight-09' }]);
  });

  it('removes a highlight', async () => {
    await localBibleHighlightAdapter.setHighlight('jhn.1.1', 'highlight-01');
    await localBibleHighlightAdapter.removeHighlight('jhn.1.1');
    expect(await localBibleHighlightAdapter.getChapterHighlights('jhn', 1)).toEqual([]);
  });
});
