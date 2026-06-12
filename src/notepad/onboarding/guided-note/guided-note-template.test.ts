import { describe, it, expect } from 'vitest';
import { buildGuidedNote } from './guided-note-template';

describe('buildGuidedNote', () => {
  it('returns a titled note with valid TipTap doc JSON', () => {
    const note = buildGuidedNote();
    expect(note.title.length).toBeGreaterThan(0);
    const doc = JSON.parse(note.content);
    expect(doc.type).toBe('doc');
    expect(Array.isArray(doc.content)).toBe(true);
  });

  it('includes the three inline try-it prompts as plain text', () => {
    const text = JSON.stringify(JSON.parse(buildGuidedNote().content));
    expect(text).toMatch(/link a verse/i);
    expect(text).toMatch(/highlight/i);
    expect(text).toMatch(/lamplight/i);
  });
});
