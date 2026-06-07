// src/notepad/prettify/quote-locator.ts
import type { Node as PMNode } from '@tiptap/pm/model';

export interface DocText {
  text: string;
  /** PM position of each character in `text`; -1 for synthetic separators. */
  map: number[];
}

export function buildDocText(doc: PMNode): DocText {
  let text = '';
  const map: number[] = [];
  let lastEnd = -1;
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      if (lastEnd >= 0 && pos > lastEnd) {
        text += '\n\n';
        map.push(-1, -1);
      }
      for (let i = 0; i < node.text.length; i += 1) {
        text += node.text[i];
        map.push(pos + i);
      }
      lastEnd = pos + node.text.length;
    }
    return true;
  });
  return { text, map };
}

export interface QuoteLocation {
  from: number;
  to: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function locateQuote(
  doc: PMNode,
  quote: string,
  occurrence = 1,
): QuoteLocation | null {
  const trimmed = quote.trim();
  if (!trimmed) return null;
  const { text, map } = buildDocText(doc);
  const pattern = trimmed.split(/\s+/).map(escapeRegExp).join('\\s+');
  const re = new RegExp(pattern, 'gi');
  const target = Math.max(1, Math.floor(occurrence));
  let seen = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    seen += 1;
    if (seen === target) {
      const startIdx = match.index;
      const endIdx = match.index + match[0].length - 1;
      let from = -1;
      for (let i = startIdx; i <= endIdx; i += 1) {
        if (map[i] >= 0) { from = map[i]; break; }
      }
      let lastPos = -1;
      for (let i = endIdx; i >= startIdx; i -= 1) {
        if (map[i] >= 0) { lastPos = map[i]; break; }
      }
      if (from < 0 || lastPos < 0) return null;
      return { from, to: lastPos + 1 };
    }
    if (match.index === re.lastIndex) re.lastIndex += 1;
  }
  return null;
}
