import { Mark, markPasteRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { VERSE_REGEX } from '../graph/reference-parser';
import { VERSE_PASTE_REGEX } from './bible-verse-utils';
import { emitOnboardingEvent } from '../onboarding/onboarding-events';

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
          'font-style: italic; text-decoration: underline; text-decoration-color: #C49A78; text-underline-offset: 3px; cursor: pointer;',
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
        getAttributes: (match) => {
          // The paste rule is the single user-driven path in this file that
          // commits a bibleVerse mark to the doc (the decoration plugin only
          // auto-highlights on render). Treat a matched verse paste as the
          // representative "user linked a verse" action.
          //
          // Idempotency contract: getAttributes fires once PER regex match in a
          // paste, so a single paste of multiple verses emits 'verse-linked'
          // multiple times. Consumers of 'verse-linked' must therefore be
          // idempotent (the provider's reportOnboardingEvent is).
          emitOnboardingEvent('verse-linked');
          return { reference: match[1] };
        },
      }),
    ];
  },
});

function findVerseDecorations(doc: ProseMirrorNode): DecorationSet {
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
            'font-style: italic; text-decoration: underline; text-decoration-color: #C49A78; text-underline-offset: 3px; cursor: pointer;',
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
