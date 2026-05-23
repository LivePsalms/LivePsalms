// src/notepad-landing/sections/garden-scene/garden-content-layer.tsx
import { StationThreeVoices } from './stations/01-three-voices';
import { StationLivingGraph } from './stations/02-living-graph';
import { StationLamplight } from './stations/03-lamplight';
import { StationScriptureMargin } from './stations/04-scripture-margin';
import { StationSevenPapers } from './stations/05-seven-papers';
import { StationTierPath } from './stations/06-tier-path';
import { StationTrustImport } from './stations/07-trust-import';
import { computeItemIndex } from './compute-item-index';

interface GardenContentLayerProps {
  currentStation: number;
  scrollProgress: { current: number };
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
      <StationSevenPapers       isActive={currentStation === 4} />
      <StationTierPath          isActive={currentStation === 5} itemIndex={itemIndex} />
      <StationTrustImport       isActive={currentStation === 6} />
    </div>
  );
}
