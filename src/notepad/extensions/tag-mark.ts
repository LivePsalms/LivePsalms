import { Mark, markInputRule, markPasteRule } from '@tiptap/core';

const TAG_INPUT_REGEX = /(#\w+)$/;
const TAG_PASTE_REGEX = /(#\w+)/g;

export const TagMark = Mark.create({
  name: 'tagMark',

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-tag'),
        renderHTML: (attrs) => ({ 'data-tag': attrs.tag }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tag-mark]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-tag-mark': '',
        style: 'background: rgba(188, 179, 163, 0.25); border-radius: 4px; padding: 1px 6px; font-size: 0.85em;',
      },
      0,
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: TAG_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({ tag: match[1] }),
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: TAG_PASTE_REGEX,
        type: this.type,
        getAttributes: (match) => ({ tag: match[1] }),
      }),
    ];
  },
});
