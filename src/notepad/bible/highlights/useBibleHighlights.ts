import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/auth/context/useAuthSession';
import type { BibleHighlightAdapter } from './types';
import { verseId } from './types';
import { localBibleHighlightAdapter } from './local-bible-highlight-adapter';
import { SupabaseBibleHighlightAdapter } from './supabase-bible-highlight-adapter';

export interface UseBibleHighlightsResult {
  /** verse number -> swatchId for the current chapter. */
  swatchByVerse: Record<number, string>;
  setHighlight: (verse: number, swatchId: string) => void;
  removeHighlight: (verse: number) => void;
}

export function useBibleHighlights(book: string, chapter: number): UseBibleHighlightsResult {
  const { user } = useAuthSession();
  const userId = user?.id ?? null;

  const adapter: BibleHighlightAdapter = useMemo(() => {
    if (supabase && userId) return new SupabaseBibleHighlightAdapter(supabase, userId);
    return localBibleHighlightAdapter;
  }, [userId]);

  const [swatchByVerse, setSwatchByVerse] = useState<Record<number, string>>({});

  // Load the visible chapter whenever book/chapter/adapter changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Clear stale highlights from the previous chapter before loading.
      setSwatchByVerse({});
      try {
        const rows = await adapter.getChapterHighlights(book, chapter);
        if (cancelled) return;
        const next: Record<number, string> = {};
        for (const r of rows) {
          const verse = Number(r.verseId.split('.')[2]);
          if (!Number.isNaN(verse)) next[verse] = r.swatchId;
        }
        setSwatchByVerse(next);
      } catch (err) {
        if (!cancelled) console.warn('[useBibleHighlights] load failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, book, chapter]);

  const setHighlight = useCallback(
    (verse: number, swatchId: string) => {
      setSwatchByVerse((prev) => ({ ...prev, [verse]: swatchId }));
      adapter.setHighlight(verseId(book, chapter, verse), swatchId).catch((err) => {
        console.warn('[useBibleHighlights] setHighlight failed:', err);
      });
    },
    [adapter, book, chapter],
  );

  const removeHighlight = useCallback(
    (verse: number) => {
      setSwatchByVerse((prev) => {
        const next = { ...prev };
        delete next[verse];
        return next;
      });
      adapter.removeHighlight(verseId(book, chapter, verse)).catch((err) => {
        console.warn('[useBibleHighlights] removeHighlight failed:', err);
      });
    },
    [adapter, book, chapter],
  );

  return { swatchByVerse, setHighlight, removeHighlight };
}
