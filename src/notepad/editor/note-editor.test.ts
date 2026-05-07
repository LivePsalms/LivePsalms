import { describe, it, expect } from 'vitest';
import { parseNoteContent } from './note-editor';

// ---------------------------------------------------------------------------
// parseNoteContent
// ---------------------------------------------------------------------------

describe('parseNoteContent', () => {
  it('returns null for null', () => {
    expect(parseNoteContent(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseNoteContent(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseNoteContent('')).toBeNull();
  });

  it('returns null for malformed JSON without throwing', () => {
    expect(() => parseNoteContent('{not json')).not.toThrow();
    expect(parseNoteContent('{not json')).toBeNull();
  });

  it('returns the parsed doc for valid TipTap JSON', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] };
    expect(parseNoteContent(JSON.stringify(doc))).toEqual(doc);
  });

  it('returns the parsed value for any valid JSON (caller validates shape)', () => {
    expect(parseNoteContent('{"x":1}')).toEqual({ x: 1 });
  });
});
