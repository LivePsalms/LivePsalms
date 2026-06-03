import { describe, it, expect } from 'vitest';
import { buildNoteFromTranscriptionDoc } from './build-note-from-transcription';

describe('buildNoteFromTranscriptionDoc', () => {
  it('preserves the provided doc as content and detects verse tags from plain text', () => {
    const doc = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Trusting in ' }, { type: 'text', marks: [{ type: 'bold' }], text: 'Psalm 23:1' }] },
    ]};
    const note = buildNoteFromTranscriptionDoc({
      title: 'Scan', doc, plainText: 'Trusting in Psalm 23:1', folderId: 'f1', autoDetectVerses: true,
    });
    expect(JSON.parse(note.content)).toEqual(doc); // formatting preserved
    expect(note.tags).toContain('Psalm 23:1');
    expect(note.folderId).toBe('f1');
    expect(note.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('omits tags when autoDetectVerses is false', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] };
    const note = buildNoteFromTranscriptionDoc({ title: 'x', doc, plainText: 'Psalm 23:1', folderId: 'f1', autoDetectVerses: false });
    expect(note.tags).toEqual([]);
  });
});
