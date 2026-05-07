/**
 * Tag conventions.
 *
 * Tags are stored as the bare value, never with the `#` marker. The marker
 * is presentation: callers wrap the value with `formatTag` for display.
 *
 * Legacy data may have `#`-prefixed values (extractTags previously returned
 * with the marker baked in). `formatTag` strips any leading `#`s so old data
 * shows correctly until the user re-saves the note, at which point the new
 * extractTags writes a clean value.
 *
 * Verse-reference tags (e.g. `'Romans 8:28'`) and hashtag tags (`'hope'`)
 * coexist in the same `note.tags` array and both render with a `#` prefix
 * via `formatTag`. Differentiating the two visually is a future concern.
 */

/**
 * Extracts unique hashtag values from plain text. Returns the bare tokens
 * without the `#` marker.
 */
export function extractTags(text: string): string[] {
  const matches = text.match(/#(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/^#+/, '')))];
}

/**
 * Formats a tag for display by prefixing with `#`. Defensively strips any
 * leading `#`s already present, so legacy data stored as `'#hope'` renders
 * as `'#hope'` instead of `'##hope'`.
 */
export function formatTag(tag: string): string {
  return `#${tag.replace(/^#+/, '')}`;
}
