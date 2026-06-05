// src/notepad-landing/sections/garden-scene/use-garden-scroll.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { STATION_META } from './station-meta';

const SPACER_ID = 'garden-spacer';

interface GardenScrollState {
  scrollProgress: { current: number };
  currentStation: number;
  jumpTo: (i: number) => void;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// Progress is 0 while the spacer's top is at or below viewport top, and 1
// once the user has scrolled (spacerHeight - viewportHeight) past it.
// We measure via getBoundingClientRect so the hook works regardless of
// what comes above the garden in the document (hero, nav, etc.).
function readProgress(): number {
  const spacer = document.getElementById(SPACER_ID);
  if (!spacer) return 0;
  const rect = spacer.getBoundingClientRect();
  const range = spacer.offsetHeight - window.innerHeight;
  if (range <= 0) return 0;
  return clamp01(-rect.top / range);
}

function readSpacerTopAbsolute(): number {
  const spacer = document.getElementById(SPACER_ID);
  if (!spacer) return 0;
  return spacer.getBoundingClientRect().top + window.scrollY;
}

export function useGardenScroll(): GardenScrollState {
  const scrollProgress = useRef(0);
  const [currentStation, setCurrentStation] = useState(0);

  useEffect(() => {
    const lastIndex = STATION_META.length - 1; // 6
    function handleScroll() {
      const p = readProgress();
      scrollProgress.current = p;
      const next = Math.round(p * lastIndex);
      setCurrentStation((prev) => (prev === next ? prev : next));
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const jumpTo = useCallback((i: number) => {
    const spacer = document.getElementById(SPACER_ID);
    if (!spacer) return;
    const range = Math.max(0, spacer.offsetHeight - window.innerHeight);
    const lastIndex = STATION_META.length - 1;
    const top = readSpacerTopAbsolute() + (i / lastIndex) * range;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  return { scrollProgress, currentStation, jumpTo };
}
