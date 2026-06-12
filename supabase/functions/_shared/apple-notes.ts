// supabase/functions/_shared/apple-notes.ts
// Pure transforms for the Apple Notes import endpoint. The only platform API
// used is Web Crypto (crypto.subtle is global in both Deno and Node 18+), so
// this is unit-testable under vitest.

// Plain text → stringified TipTap doc. Each line becomes a paragraph; blank
// lines become empty paragraphs so spacing survives the round trip.
export function textToTipTap(text: string): string {
  const lines = (text ?? '').split('\n');
  const content: Array<Record<string, unknown>> = lines.map((line) =>
    line.length > 0
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' },
  );
  if (content.length === 0) content.push({ type: 'paragraph' });
  return JSON.stringify({ type: 'doc', content });
}

// Word count straight from the source plain text (equivalent to counting the
// TipTap body, but simpler since we own the text).
export function countWords(text: string): number {
  const t = (text ?? '').trim();
  return t ? t.split(/\s+/).length : 0;
}

// Stable dedup key for an Apple note. Shortcuts does not reliably expose a
// native note UUID, so we hash creation-date + title. Renaming a note in Apple
// Notes yields a new id (accepted limitation).
export async function computeExternalId(createdAt: string, title: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${createdAt}|${title}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
