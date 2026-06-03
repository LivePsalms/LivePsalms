import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { UncertainWord } from './types';

export interface Span { from: number; to: number }

/**
 * Locate each uncertain word in the plaintext. When `context` is given, prefer
 * the occurrence inside that context; otherwise use the first occurrence.
 * Offsets are plain-string indices into `text`.
 */
export function locateUncertainSpans(text: string, words: UncertainWord[]): Span[] {
  const spans: Span[] = [];
  for (const w of words) {
    if (!w.text) continue;
    let from = -1;
    if (w.context) {
      const ctxAt = text.indexOf(w.context);
      if (ctxAt >= 0) {
        const within = w.context.indexOf(w.text);
        if (within >= 0) from = ctxAt + within;
      }
    }
    if (from < 0) from = text.indexOf(w.text);
    if (from < 0) continue;
    spans.push({ from, to: from + w.text.length });
  }
  return spans;
}

export const uncertainPluginKey = new PluginKey('uncertain-words');

/**
 * ProseMirror plugin that paints a highlight decoration over uncertain spans.
 * Decorations (not marks) so they never persist into the saved note content and
 * naturally disappear as the document changes. mapPlainToDoc maps a plain-string
 * index to a ProseMirror doc position for the paragraph-per-line document the
 * review editor builds.
 */
export function uncertainDecorationPlugin(spans: Span[]) {
  return new Plugin({
    key: uncertainPluginKey,
    props: {
      decorations(state) {
        const decos: Decoration[] = [];
        for (const s of spans) {
          const from = mapPlainToDoc(state.doc, s.from);
          const to = mapPlainToDoc(state.doc, s.to);
          if (from != null && to != null && to > from) {
            decos.push(Decoration.inline(from, to, { class: 'uncertain-word' }));
          }
        }
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

// Map a plain-text offset (with '\n' between block nodes) to a doc position.
function mapPlainToDoc(doc: PMNode, plainOffset: number): number | null {
  let remaining = plainOffset;
  let result: number | null = null;
  let firstBlock = true;
  doc.descendants((node, pos) => {
    if (result != null) return false;
    if (node.isTextblock) {
      if (!firstBlock) remaining -= 1; // the '\n' separator
      firstBlock = false;
      const textLen = node.textContent.length;
      if (remaining <= textLen) {
        result = pos + 1 + remaining; // +1 to enter the block
        return false;
      }
      remaining -= textLen;
    }
    return true;
  });
  return result;
}
