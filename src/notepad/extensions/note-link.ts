import { Mark } from '@tiptap/core';
import type { Editor } from '@tiptap/core';

/**
 * Inserts a `noteLink` mark at the editor's current selection.
 * Colocated with the mark definition so the attr shape lives in one file.
 */
export function insertNoteLinkAt(
  editor: Editor,
  noteId: string,
  noteTitle: string,
): void {
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'text',
      text: noteTitle,
      marks: [{ type: 'noteLink', attrs: { noteId, noteTitle } }],
    })
    .run();
}

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
        style: 'text-decoration: underline; text-decoration-color: #7A9BAE; text-underline-offset: 3px; cursor: pointer;',
      },
      0,
    ];
  },
});
