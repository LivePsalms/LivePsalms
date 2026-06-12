// A single whole-verse highlight. verseId is the OSIS verse key
// ("{book}.{chapter}.{verse}", e.g. "jhn.1.1"); swatchId is a highlight
// style-asset id (e.g. "highlight-03").
export interface BibleHighlight {
  verseId: string;
  swatchId: string;
}

export function verseId(book: string, chapter: number, verse: number): string {
  return `${book}.${chapter}.${verse}`;
}

export interface BibleHighlightAdapter {
  /** All highlights for a single chapter. */
  getChapterHighlights(book: string, chapter: number): Promise<BibleHighlight[]>;
  /** Create or recolor a verse highlight. */
  setHighlight(verseId: string, swatchId: string): Promise<void>;
  /** Remove a verse highlight (no-op if absent). */
  removeHighlight(verseId: string): Promise<void>;
}
