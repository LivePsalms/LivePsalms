import { Mark } from '@tiptap/core';

export const NoteLink = Mark.create({
  name: 'noteLink',

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-note-id'),
        renderHTML: (attrs) => ({ 'data-note-id': attrs.noteId }),
      },
      noteTitle: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-note-title'),
        renderHTML: (attrs) => ({ 'data-note-title': attrs.noteTitle }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-note-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-note-link': '',
        style: 'text-decoration: underline; text-decoration-color: #38BDF8; text-underline-offset: 3px; cursor: pointer;',
      },
      0,
    ];
  },
});
