import { v4 as uuidv4 } from 'uuid';
import { countWordsFromTipTapJSON } from '../utils/tiptap-text';
import { extractVerseRefs } from '../extensions/bible-verse-utils';
import type { Note } from '../types';

const MAX_AUTO_TAGS = 10;

export interface BuildNoteFromDocOpts {
  title: string;
  doc: object;        // editor.getJSON()
  plainText: string;  // editor.getText() — used only for verse-ref detection
  folderId: string;
  type?: Note['type'];
  autoDetectVerses?: boolean;
}

/**
 * Build a Note from the review editor's TipTap JSON directly, preserving any
 * formatting / hard-breaks the user added (editor.getText() would flatten them).
 * Verse tags are detected from the plain-text projection. Mirrors buildNoteFromText's
 * field shape, reusing the same shared utils.
 */
export function buildNoteFromTranscriptionDoc(opts: BuildNoteFromDocOpts): Note {
  const content = JSON.stringify(opts.doc);
  const tags = opts.autoDetectVerses ? extractVerseRefs(opts.plainText).slice(0, MAX_AUTO_TAGS) : [];
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: opts.title,
    content,
    folderId: opts.folderId,
    type: opts.type ?? 'devotion',
    tags,
    wordCount: countWordsFromTipTapJSON(content),
    createdAt: now,
    updatedAt: now,
  };
}
