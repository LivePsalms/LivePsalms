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

function readMaxScroll(): number {
  const spacer = document.getElementById(SPACER_ID);
  if (!spacer) return 0;
  return Math.max(0, spacer.offsetHeight - window.innerHeight);
}

export function useGardenScroll(): GardenScrollState {
  const scrollProgress = useRef(0);
  const [currentStation, setCurrentStation] = useState(0);

  useEffect(() => {
    const lastIndex = STATION_META.length - 1; // 6
    function handleScroll() {
      const max = readMaxScroll();
      const p = max > 0 ? clamp01(window.scrollY / max) : 0;
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
    const max = readMaxScroll();
    const lastIndex = STATION_META.length - 1;
    const top = (i / lastIndex) * max;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  return { scrollProgress, currentStation, jumpTo };
}
