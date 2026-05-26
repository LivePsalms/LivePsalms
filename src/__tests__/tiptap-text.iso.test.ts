import { describe, it, expect } from 'vitest';
import {
  extractPlainText as clientExtract,
  extractTextFromNote as clientFromNote,
} from '@/notepad/utils/tiptap-text';
import {
  extractPlainText as serverExtract,
  extractTextFromNoteContent as serverFromContent,
} from '../../supabase/functions/_shared/tiptap-text';

const FIXTURES: Array<{ name: string; doc: unknown }> = [
  { name: 'empty doc', doc: { type: 'doc', content: [] } },
  {
    name: 'simple paragraph',
    doc: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    },
  },
  {
    name: 'multiple paragraphs',
    doc: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Line one.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Line two.' }] },
      ],
    },
  },
  {
    name: 'bible verse mark',
    doc: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [
          { type: 'text', text: 'See ', marks: [] },
          { type: 'text', text: 'John 3:16', marks: [{ type: 'bibleVerse' }] },
          { type: 'text', text: '.', marks: [] },
        ]},
      ],
    },
  },
];

describe('tiptap-text isomorphism (client ↔ Edge Function)', () => {
  for (const { name, doc } of FIXTURES) {
    it(`agrees on "${name}"`, () => {
      const c = clientExtract(doc);
      const s = serverExtract(doc);
      expect(s).toBe(c);
    });
    it(`agrees on "${name}" via stringified content`, () => {
      const json = JSON.stringify(doc);
      const c = clientFromNote({ content: json } as never);
      const s = serverFromContent(json);
      expect(s).toBe(c);
    });
  }
});
