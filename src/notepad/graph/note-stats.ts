import type { Reference } from './types';

export interface NoteStats {
  backlinkCount: number;     // distinct Notes with inbound 'explicit' Reference targeting this Note
  outgoingLinkCount: number; // distinct Notes this Note explicitly links to
  verseCount: number;        // distinct scripture passages (outbound 'scripture-reference' refs)
}

export function buildNoteStats(noteId: string, references: Reference[]): NoteStats {
  let backlinkCount = 0;
  let outgoingLinkCount = 0;
  let verseCount = 0;

  for (const ref of references) {
    if (ref.source === ref.target) continue; // a Note is not its own Backlink
    if (ref.type === 'explicit') {
      if (ref.target === noteId) backlinkCount++;
      else if (ref.source === noteId) outgoingLinkCount++;
    } else if (ref.type === 'scripture-reference' && ref.source === noteId) {
      verseCount++;
    }
  }

  return { backlinkCount, outgoingLinkCount, verseCount };
}
