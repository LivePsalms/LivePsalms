/**
 * Extract plain text from a TipTap JSON string and count words.
 * Returns 0 for empty or invalid content.
 */
export function countWordsFromTipTapJSON(jsonString: string): number {
  if (!jsonString) return 0;

  try {
    const doc = JSON.parse(jsonString);
    const text = extractText(doc);
    return countWords(text);
  } catch {
    // If content is plain text (not JSON), count directly
    return countWords(jsonString);
  }
}

function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;

  if (n.type === 'text' && typeof n.text === 'string') {
    return n.text;
  }

  if (Array.isArray(n.content)) {
    return n.content.map(extractText).join(' ');
  }

  return '';
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
