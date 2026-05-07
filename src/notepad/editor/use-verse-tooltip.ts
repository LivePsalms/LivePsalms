import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import { fetchVerseText } from '../extensions/bible-verse-utils';
import type { VerseResult } from '../extensions/bible-verse-utils';
import type { ReferenceGraph } from '../graph/reference-graph';
import { toCanonicalScriptureId } from '../graph/reference-parser';

export interface VerseTooltipAnchor {
  x: number;
  y: number;
  verse: VerseResult;
}

interface Opts {
  graph: ReferenceGraph | null;
}

/**
 * Verse-tooltip controller — owns hover detection over `[data-bible-verse]`,
 * tooltip anchor, and verse resolution. Reads from `ReferenceGraph`'s
 * `ScriptureNode` cache first; falls back to the network. Does NOT write the
 * cache on miss — that path is reserved for `ReferenceGraph.syncNote`.
 *
 * In-flight fetches are race-fenced with `AbortController`: a new hover
 * aborts any pending request so the tooltip never shows stale text under a
 * different verse.
 */
export function useVerseTooltip({ graph }: Opts): {
  tooltip: VerseTooltipAnchor | null;
  onMouseOver: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseOut: (e: React.MouseEvent<HTMLDivElement>) => void;
} {
  const [tooltip, setTooltip] = useState<VerseTooltipAnchor | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onMouseOver = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const verseEl = target.closest('[data-bible-verse]') as HTMLElement | null;
      if (!verseEl) {
        setTooltip(null);
        return;
      }
      const reference = verseEl.getAttribute('data-reference');
      if (!reference) return;

      const rect = verseEl.getBoundingClientRect();

      // Cache-read first (no write on miss).
      if (graph) {
        const cached = graph.getScriptureNode(toCanonicalScriptureId(reference));
        if (cached?.text) {
          setTooltip({
            x: rect.left,
            y: rect.bottom + 8,
            verse: {
              text: cached.text,
              reference,
              translation: cached.translation,
            },
          });
          return;
        }
      }

      // Fetch fallback. Cancel any in-flight stale request.
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const result = await fetchVerseText(reference, { signal: ac.signal });
      if (ac.signal.aborted) return;
      if (result) {
        setTooltip({ x: rect.left, y: rect.bottom + 8, verse: result });
      }
    },
    [graph],
  );

  const onMouseOut = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.relatedTarget as HTMLElement | null;
    if (!target?.closest?.('[data-bible-verse]')) {
      setTooltip(null);
    }
  }, []);

  return { tooltip, onMouseOver, onMouseOut };
}
