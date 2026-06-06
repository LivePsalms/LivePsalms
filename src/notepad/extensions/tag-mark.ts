import { Mark, markPasteRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { matchTags, TAG_PATTERN_SOURCE } from '../utils/tags';

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
        find: new RegExp(`(${TAG_PATTERN_SOURCE})`, 'g'),
        type: this.type,
        getAttributes: (match) => ({ tag: match[1] }),
      }),
    ];
  },
});

function findTagDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    for (const m of matchTags(node.text)) {
      const from = pos + m.index;
      const to = from + m.raw.length;

      decorations.push(
        Decoration.inline(from, to, {
          'data-tag-mark': '',
          'data-tag': m.raw,
          style:
            'background: rgba(188, 179, 163, 0.25); border-radius: 4px; padding: 1px 6px; font-size: 0.85em;',
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
