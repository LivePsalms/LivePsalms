import { useEffect, useState, useMemo } from 'react';
import { projects as rawProjects } from '@/data/projects';
import { extractDominantColor } from '@/utils/extractDominantColor';
import type { Project } from '@/types';

/**
 * Pre-computes a dominant-colour overlay for every project thumbnail.
 *
 * Returns the full `projects` array with each item's `overlayColor`
 * replaced by the extracted colour once computation finishes. Until
 * then the original fallback colour is used so there's no flash.
 */
export function useProjectColors(): Project[] {
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function compute() {
      const entries = await Promise.all(
        rawProjects.map(async (p) => {
          const color = await extractDominantColor(p.thumbnail);
          return [p.id, color] as const;
        })
      );
      if (!cancelled) {
        setColorMap(new Map(entries));
      }
    }

    compute();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () =>
      rawProjects.map((p) => ({
        ...p,
        overlayColor: colorMap.get(p.id) ?? p.overlayColor,
      })),
    [colorMap]
  );
}
