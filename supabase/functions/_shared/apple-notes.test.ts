import { describe, it, expect } from 'vitest';
import { textToTipTap, countWords, computeExternalId } from './apple-notes';

describe('textToTipTap', () => {
  it('wraps a single line in one paragraph', () => {
    expect(textToTipTap('hello')).toBe(
      JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] }),
    );
  });

  it('preserves blank lines as empty paragraphs', () => {
    const out = JSON.parse(textToTipTap('a\n\nb'));
    expect(out.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
    ]);
  });

  it('returns a single empty paragraph for empty input', () => {
    expect(textToTipTap('')).toBe(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }));
  });
});

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('the Lord is my shepherd')).toBe(5);
  });
  it('returns 0 for blank text', () => {
    expect(countWords('   \n  ')).toBe(0);
  });
});

describe('computeExternalId', () => {
  it('matches the known parity vector', async () => {
    expect(await computeExternalId('2026-05-01T12:00:00Z', 'Psalm 23'))
      .toBe('6de20b52e8be3ca03f11b0189b2969a337609b28699d9a23187abbe0982b688c');
  });
  it('changes when the title changes', async () => {
    const a = await computeExternalId('2026-05-01T12:00:00Z', 'Psalm 23');
    const b = await computeExternalId('2026-05-01T12:00:00Z', 'Psalm 24');
    expect(a).not.toBe(b);
  });
});
