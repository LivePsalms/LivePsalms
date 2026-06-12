import type { BibleHighlight, BibleHighlightAdapter } from './types';

const KEY = 'psalms.bible.highlights.local';

type HighlightMap = Record<string, string>;

function readMap(): HighlightMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as HighlightMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: HighlightMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // best-effort
  }
}

export const localBibleHighlightAdapter: BibleHighlightAdapter = {
  async getChapterHighlights(book: string, chapter: number): Promise<BibleHighlight[]> {
    const prefix = `${book}.${chapter}.`;
    const map = readMap();
    return Object.entries(map)
      .filter(([id]) => id.startsWith(prefix))
      .map(([verseId, swatchId]) => ({ verseId, swatchId }));
  },

  async setHighlight(verseId: string, swatchId: string): Promise<void> {
    const map = readMap();
    map[verseId] = swatchId;
    writeMap(map);
  },

  async removeHighlight(verseId: string): Promise<void> {
    const map = readMap();
    delete map[verseId];
    writeMap(map);
  },
};
