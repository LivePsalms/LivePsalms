// TipTap-specific verse utilities. Canonical parsing lives in graph/reference-parser.ts.
import { VERSE_REGEX } from '../graph/reference-parser';

export {
  BOOK_PATTERNS,
  VERSE_REGEX,
  normalizeVerseRef,
  fetchVerseText,
} from '../graph/reference-parser';
export type { VerseResult } from '../graph/reference-parser';

const corePatternCapturing = `(${VERSE_REGEX.source})`;

export const VERSE_INPUT_REGEX = new RegExp(`${corePatternCapturing}$`);
export const VERSE_PASTE_REGEX = new RegExp(corePatternCapturing, 'g');

/**
 * Extracts all unique verse references found in the given text.
 */
export function extractVerseRefs(text: string): string[] {
  const regex = new RegExp(VERSE_REGEX.source, 'g');
  const matches = text.match(regex);
  if (!matches) return [];
  return [...new Set(matches)];
}
