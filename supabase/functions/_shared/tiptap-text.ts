// supabase/functions/_shared/tiptap-text.ts
//
// MUST stay byte-identical to src/notepad/utils/tiptap-text.ts. Enforced by
// src/__tests__/tiptap-text.iso.test.ts which imports both and asserts every
// fixture produces the same string from both implementations.

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

export function extractTextFromNoteContent(contentJsonOrText: string): string {
  try {
    const doc = JSON.parse(contentJsonOrText);
    return extractPlainText(doc);
  } catch {
    return contentJsonOrText;
  }
}
