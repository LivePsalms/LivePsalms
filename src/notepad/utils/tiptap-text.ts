import type { Note } from '../types';

// Block-level TipTap node types whose children should be separated by \n\n.
const BLOCK_TYPES = new Set([
  'doc', 'blockquote', 'bulletList', 'orderedList', 'listItem',
  'heading', 'codeBlock',
]);

export function extractPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  if (n.type === 'text' && typeof n.text === 'string') {
    return n.text;
  }
  if (Array.isArray(n.content)) {
    const parts = (n.content as unknown[]).map(extractPlainText).filter(s => s.length > 0);
    const sep = BLOCK_TYPES.has(n.type as string) ? '\n\n' : ' ';
    return parts.join(sep);
  }
  return '';
}

export function extractTextFromNote(note: Note): string {
  try {
    const doc = JSON.parse(note.content);
    return extractPlainText(doc);
  } catch {
    return note.content;
  }
}

export function countWordsFromTipTapJSON(jsonString: string): number {
  if (!jsonString) return 0;
  let text: string;
  try {
    text = extractPlainText(JSON.parse(jsonString));
  } catch {
    text = jsonString;
  }
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
