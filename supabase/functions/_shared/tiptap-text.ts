// supabase/functions/_shared/tiptap-text.ts
//
// MUST stay byte-identical to src/notepad/utils/tiptap-text.ts. Enforced by
// src/__tests__/tiptap-text.iso.test.ts which imports both and asserts every
// fixture produces the same string from both implementations.

export function extractPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  if (n.type === 'text' && typeof n.text === 'string') {
    return n.text;
  }
  if (Array.isArray(n.content)) {
    return (n.content as unknown[]).map(extractPlainText).join(' ');
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
