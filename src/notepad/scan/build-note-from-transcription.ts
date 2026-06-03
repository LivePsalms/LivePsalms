import { buildNoteFromText, type BuildNoteOpts } from '../import/document-importer';
import type { Note } from '../types';

/**
 * Map an edited transcript to a Note via the SAME builder the file-import path
 * uses, so verse-tagging / word-count / TipTap doc shape are identical. The
 * caller passes the user-edited transcript text; downstream importNote +
 * linkNotesByVerses are invoked by the review component exactly as in import.
 */
export function buildNoteFromTranscription(opts: BuildNoteOpts): Note {
  return buildNoteFromText(opts);
}
