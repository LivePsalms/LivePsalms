// Re-exports canonical parsing primitives. Canonical source: reference-parser.ts
// This file is kept for back-compat; it will be deleted in Task 14.
export {
  BOOK_PATTERNS,
  VERSE_REGEX,
  normalizeVerseRef,
  fetchVerseText,
  toCanonicalScriptureId,
  parseVerseRef,
  parseReferencesFromContent,
} from './reference-parser';

// Back-compat alias: callers that used parseEdgesFromContent still work.
export { parseReferencesFromContent as parseEdgesFromContent } from './reference-parser';
