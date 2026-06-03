import { describe, it, expect } from 'vitest';
import { buildNoteFromTranscription } from './build-note-from-transcription';

describe('buildNoteFromTranscription', () => {
  it('splits paragraphs and sets the title + verse tags', () => {
    const note = buildNoteFromTranscription({
      title: 'My scan',
      text: 'Trusting in Psalm 23:1\n\nHe restores my soul',
      folderId: 'f1',
      autoDetectVerses: true,
    });
    expect(note.title).toBe('My scan');
    expect(note.folderId).toBe('f1');
    expect(note.tags).toContain('Psalm 23:1');
    const doc = JSON.parse(note.content);
    expect(doc.content).toHaveLength(2);
    expect(note.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('omits tags when autoDetectVerses is false', () => {
    const note = buildNoteFromTranscription({
      title: 'x', text: 'Psalm 23:1', folderId: 'f1', autoDetectVerses: false,
    });
    expect(note.tags).toEqual([]);
  });
});
