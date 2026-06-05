// src/notepad-landing/sections/garden-scene/compute-item-index.ts
import { STATION_META, TOTAL_SPACER_VH } from './station-meta';

/**
 * Computes which item-index to show for a list station given overall
 * scroll progress. Returns 0 for non-list stations.
 */
export function computeItemIndex(
  currentStation: number,
  progress: number,
): number {
  const meta = STATION_META[currentStation];
  if (!meta || meta.itemCount <= 1) return 0;

  // Find this station's local progress within its [start, end] slice.
  let runningStart = 0;
  for (let i = 0; i < currentStation; i++) {
    const m = STATION_META[i];
    runningStart += m.baseVh + m.extraVh;
  }
  const ownLength = meta.baseVh + meta.extraVh;
  const localStart = runningStart / TOTAL_SPACER_VH;
  const localEnd = (runningStart + ownLength) / TOTAL_SPACER_VH;
  if (progress <= localStart) return 0;
  if (progress >= localEnd) return meta.itemCount - 1;
  const localT = (progress - localStart) / (localEnd - localStart);
  return Math.min(meta.itemCount - 1, Math.floor(localT * meta.itemCount));
}
