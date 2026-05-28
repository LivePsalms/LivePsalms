import { describe, it, expect } from 'vitest';
import { chunkNotePlaintext, MIN_TOKENS, MAX_TOKENS } from './chunker';

// Helper: build a string of approximately N tokens (4 chars per token).
const t = (tokens: number): string => 'a'.repeat(tokens * 4);

describe('chunkNotePlaintext', () => {
  it('returns [] for empty string', () => {
    expect(chunkNotePlaintext('')).toEqual([]);
  });

  it('returns [] for whitespace-only string', () => {
    expect(chunkNotePlaintext('   \n\n  \n')).toEqual([]);
  });

  it('emits one chunk for a single short paragraph', () => {
    const chunks = chunkNotePlaintext('Hello world.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].text).toBe('Hello world.');
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('merges two short paragraphs into one chunk under MIN_TOKENS', () => {
    // Each ~10 tokens; combined ~20 tokens — still well under MIN_TOKENS.
    const plaintext = `${t(10)}\n\n${t(10)}`;
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('\n\n');
    expect(chunks[0].tokenCount).toBeLessThan(MIN_TOKENS * 2);
  });

  it('does not merge when the buffer has reached MIN_TOKENS', () => {
    // First paragraph ≥ MIN_TOKENS → flushes; second starts a new chunk.
    const plaintext = `${t(MIN_TOKENS + 10)}\n\n${t(50)}`;
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].index).toBe(0);
    expect(chunks[1].index).toBe(1);
  });

  it('sentence-splits a paragraph that exceeds MAX_TOKENS', () => {
    // ~1000-token paragraph composed of multiple sentences.
    const sentence = `${t(150)}. `;
    const plaintext = sentence.repeat(7).trim(); // ~1050 tokens, 7 sentences
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
    }
  });

  it('emits an over-cap chunk when a single sentence exceeds MAX_TOKENS', () => {
    // One sentence, no boundary char inside, well over MAX_TOKENS.
    const plaintext = t(MAX_TOKENS + 200);
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokenCount).toBeGreaterThan(MAX_TOKENS);
    // Relies on Voyage truncation: true at the wire — chunker does not truncate.
  });

  it('emits dense 0-based indexes', () => {
    const plaintext = ['a', 'b', 'c'].map(s => t(MIN_TOKENS + 10) + ' ' + s).join('\n\n');
    const chunks = chunkNotePlaintext(plaintext);
    expect(chunks.map(c => c.index)).toEqual(chunks.map((_, i) => i));
  });
});
