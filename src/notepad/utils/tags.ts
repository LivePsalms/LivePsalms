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
 * The canonical hashtag grammar. Single source of truth: the editor's
 * `tagMark` decoration/paste rules build their RegExps from this same source,
 * so what gets highlighted can never drift from what gets persisted.
 */
export const TAG_PATTERN_SOURCE = '#\\w+';

export interface TagMatch {
  /** The full match including the `#` marker, e.g. `'#hope'`. */
  raw: string;
  /** The bare token with the marker stripped, e.g. `'hope'`. */
  value: string;
  /** Start offset of the match within the input text. */
  index: number;
}

/**
 * Iterates every hashtag occurrence in plain text, with positions. Does not
 * deduplicate — the editor decoration highlights each occurrence, so callers
 * that want uniqueness (e.g. `extractTags`) dedup the `value`s themselves.
 */
export function matchTags(text: string): TagMatch[] {
  const re = new RegExp(TAG_PATTERN_SOURCE, 'g');
  const out: TagMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ raw: m[0], value: m[0].replace(/^#+/, ''), index: m.index });
  }
  return out;
}

/**
 * Extracts unique hashtag values from plain text. Returns the bare tokens
 * without the `#` marker.
 */
export function extractTags(text: string): string[] {
  return [...new Set(matchTags(text).map((m) => m.value))];
}

/**
 * Formats a tag for display by prefixing with `#`. Defensively strips any
 * leading `#`s already present, so legacy data stored as `'#hope'` renders
 * as `'#hope'` instead of `'##hope'`.
 */
export function formatTag(tag: string): string {
  return `#${tag.replace(/^#+/, '')}`;
}
