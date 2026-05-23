// src/notepad-landing/sections/garden-scene/garden-content-layer.tsx
import { StationThreeVoices } from './stations/01-three-voices';
import { StationLivingGraph } from './stations/02-living-graph';
import { StationLamplight } from './stations/03-lamplight';
import { StationScriptureMargin } from './stations/04-scripture-margin';
import { StationSevenPapers } from './stations/05-seven-papers';
import { StationTierPath } from './stations/06-tier-path';
import { StationTrustImport } from './stations/07-trust-import';
import { STATION_META } from './station-meta';

interface GardenContentLayerProps {
  currentStation: number;
  scrollProgress: { current: number };
}

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
  const localStart = runningStart / 950; // TOTAL_SPACER_VH from meta
  const localEnd = (runningStart + ownLength) / 950;
  if (progress <= localStart) return 0;
  if (progress >= localEnd) return meta.itemCount - 1;
  const localT = (progress - localStart) / (localEnd - localStart);
  return Math.min(meta.itemCount - 1, Math.floor(localT * meta.itemCount));
}

export function GardenContentLayer({
  currentStation,
  scrollProgress,
}: GardenContentLayerProps) {
  const itemIndex = computeItemIndex(currentStation, scrollProgress.current);
  return (
    <div className="garden-content-layer">
      <StationThreeVoices       isActive={currentStation === 0} />
      <StationLivingGraph       isActive={currentStation === 1} />
      <StationLamplight         isActive={currentStation === 2} />
      <StationScriptureMargin   isActive={currentStation === 3} />
      <StationSevenPapers       isActive={currentStation === 4} itemIndex={itemIndex} />
      <StationTierPath          isActive={currentStation === 5} itemIndex={itemIndex} />
      <StationTrustImport       isActive={currentStation === 6} />
    </div>
  );
}
