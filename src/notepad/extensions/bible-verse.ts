import { Mark, markInputRule, markPasteRule } from '@tiptap/core';
import { VERSE_INPUT_REGEX, VERSE_PASTE_REGEX } from './bible-verse-utils';

export const BibleVerse = Mark.create({
  name: 'bibleVerse',

  addAttributes() {
    return {
      reference: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-reference'),
        renderHTML: (attrs) => ({ 'data-reference': attrs.reference }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-bible-verse]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-bible-verse': '',
        style:
          'font-style: italic; text-decoration: underline; text-decoration-color: #F59E0B; text-underline-offset: 3px; cursor: pointer;',
      },
      0,
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: VERSE_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({ reference: match[1] }),
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: VERSE_PASTE_REGEX,
        type: this.type,
        getAttributes: (match) => ({ reference: match[1] }),
      }),
    ];
  },
});
