/**
 * Pure helper(s) used by the NoteEditor hook. Tag-related helpers live in
 * `utils/tags.ts` so they can be shared with display sites.
 */

/**
 * Parses a Note's TipTap-JSON `content` string. Returns the parsed doc on
 * success, or `null` for empty/missing/invalid content. Callers use the null
 * to fall back to a blank editor without throwing.
 */
export function parseNoteContent(content: string | null | undefined): unknown | null {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
