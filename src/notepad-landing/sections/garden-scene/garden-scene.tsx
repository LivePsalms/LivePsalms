// src/notepad-landing/sections/garden-scene/garden-scene.tsx
import { useCallback, useEffect, useState } from 'react';
import { useGardenScroll } from './use-garden-scroll';
import { GardenCanvas } from './garden-canvas';
import { PaperOverlay } from './paper-overlay';
import { GardenContentLayer } from './garden-content-layer';
import { GardenProgress } from './garden-progress';
import { FallbackStack } from './fallback-stack';

interface GardenSceneProps { prm: boolean }

export function GardenScene({ prm }: GardenSceneProps) {
  if (prm) {
    return (
      <div className="garden-scene garden-scene--fallback">
        <FallbackStack prm={prm} />
      </div>
    );
  }
  return <ActiveGardenScene />;
}

// Split into its own component so hooks aren't called conditionally
// in <GardenScene/>.
function ActiveGardenScene() {
  const { scrollProgress, currentStation, jumpTo } = useGardenScroll();

  // Force a re-render at ~60Hz only while we are inside a list station
  // (4 = Seven Papers, 5 = Tier Path). Outside those stations re-rendering
  // is driven solely by currentStation changes — nearly zero per-frame work.
  const [renderTick, setRenderTick] = useState(0);
  useEffect(() => {
    const isList = currentStation === 4 || currentStation === 5;
    if (!isList) return;
    let raf = 0;
    const loop = () => {
      setRenderTick((t) => (t + 1) % 1024);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [currentStation]);

  // currentStation already drives React state via useGardenScroll, so this
  // callback is a noop. It exists only because mount-garden's option type
  // includes onStationChange for future analytics use.
  const onStationChange = useCallback(() => {}, []);

  return (
    // The outer container's height (set in CSS to 950vh) provides the
    // scroll runway. id="garden-spacer" is the scroll measurement anchor
    // that useGardenScroll reads.
    <div className="garden-scene" id="garden-spacer">
      {/* Sticky viewport — pins at top:0 while the container is in view,
          then releases naturally past the bottom into the closing CTA. */}
      <div className="garden-scene-viewport">
        <p className="garden-scene-label" aria-hidden="true">Garden of Psalms</p>
        <GardenCanvas scrollProgress={scrollProgress} onStationChange={onStationChange} />
        <PaperOverlay />
        <GardenContentLayer currentStation={currentStation} />
        <GardenProgress current={currentStation} onJump={jumpTo} />
      </div>
      {/* renderTick used only as a re-render trigger for list-station item reveals */}
      <span style={{ display: 'none' }} aria-hidden="true">{renderTick}</span>
    </div>
  );
}
