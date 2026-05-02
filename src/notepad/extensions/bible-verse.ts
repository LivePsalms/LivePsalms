import { Mark, markPasteRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { VERSE_REGEX, VERSE_PASTE_REGEX } from './bible-verse-utils';

const bibleVersePluginKey = new PluginKey('bibleVerseHighlight');

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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: bibleVersePluginKey,
        state: {
          init(_, { doc }) {
            return findVerseDecorations(doc);
          },
          apply(tr, oldDecorations) {
            if (tr.docChanged) {
              return findVerseDecorations(tr.doc);
            }
            return oldDecorations;
          },
        },
        props: {
          decorations(state) {
            return bibleVersePluginKey.getState(state) as DecorationSet;
          },
        },
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

function findVerseDecorations(doc: Parameters<typeof Decoration.inline>[0]): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const regex = new RegExp(VERSE_REGEX.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(node.text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      decorations.push(
        Decoration.inline(from, to, {
          'data-bible-verse': '',
          'data-reference': match[0],
          style:
            'font-style: italic; text-decoration: underline; text-decoration-color: #F59E0B; text-underline-offset: 3px; cursor: pointer;',
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
