import { Mark, markPasteRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const TAG_REGEX = /#\w+/g;
const TAG_PASTE_REGEX = /(#\w+)/g;

const tagPluginKey = new PluginKey('tagHighlight');

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
        style:
          'background: rgba(188, 179, 163, 0.25); border-radius: 4px; padding: 1px 6px; font-size: 0.85em;',
      },
      0,
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: tagPluginKey,
        state: {
          init(_, { doc }) {
            return findTagDecorations(doc);
          },
          apply(tr, oldDecorations) {
            if (tr.docChanged) {
              return findTagDecorations(tr.doc);
            }
            return oldDecorations;
          },
        },
        props: {
          decorations(state) {
            return tagPluginKey.getState(state) as DecorationSet;
          },
        },
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

function findTagDecorations(doc: Parameters<typeof Decoration.inline>[0]): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const regex = new RegExp(TAG_REGEX.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(node.text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      decorations.push(
        Decoration.inline(from, to, {
          'data-tag-mark': '',
          'data-tag': match[0],
          style:
            'background: rgba(188, 179, 163, 0.25); border-radius: 4px; padding: 1px 6px; font-size: 0.85em;',
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
