// TipTap-specific verse utilities. Canonical parsing lives in graph/reference-parser.ts.
import { BOOK_PATTERNS, VERSE_REGEX } from '../graph/reference-parser';

export {
  BOOK_PATTERNS,
  VERSE_REGEX,
  normalizeVerseRef,
  fetchVerseText,
} from '../graph/reference-parser';
export type { VerseResult } from '../graph/reference-parser';

// Build a regex group that matches any book name or abbreviation
const bookGroup = `(?:${BOOK_PATTERNS.join('|')})`;

// Verse range suffix: optional "-30" or "–30"
const rangeSuffix = `(?:\\s*[-–]\\s*\\d{1,3})?`;

// Core pattern with a capturing group around the whole match (for input/paste rules)
const corePatternCapturing = `(${bookGroup}\\s+\\d{1,3}:\\d{1,3}${rangeSuffix})`;

/**
 * Anchored regex for TipTap input rules (end-of-input detection).
 * Must end with "$" and have a capturing group.
 */
export const VERSE_INPUT_REGEX = new RegExp(`${corePatternCapturing}$`);

/**
 * Global regex with capturing group for TipTap paste rules.
 */
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
