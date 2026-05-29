import { useEffect, useRef } from 'react';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';
import type { HeroProps } from './HeroDesktop';

const SILHOUETTE_SRC = '/tropical_jungle.png';
const SILHOUETTE_ALT = ''; // Decorative — hero copy carries the meaning. Matches HeroDesktop's <img alt="">.

/**
 * Mobile-specific Hero composition. Same 4 beats as desktop — wordmark intro,
 * scroll-collapse (shortened, Task 5), static silhouette image (no video),
 * quote sequence (cross-fade, Task 6), bridge copy (Task 7) — rebuilt for
 * one-thumb scroll.
 *
 * Mobile does NOT run the long letter-spread intro from HeroDesktop. The
 * wordmark renders settled. When `introActive` is true, we fire the intro
 * callbacks once on mount so App.tsx's intro gate advances past the intro
 * state without delay.
 */
export function HeroMobile({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
  const introFiredRef = useRef(false);

  useEffect(() => {
    if (!introActive || introFiredRef.current) return;
    introFiredRef.current = true;
    onIntroComplete?.();
    onHandoff?.();
  }, [introActive, onIntroComplete, onHandoff]);

  return (
    <div
      data-testid="hero-mobile"
      data-intro-active={introActive ? 'true' : 'false'}
      className="relative w-full min-h-[100svh] bg-[color:var(--deep-umber)] text-white"
    >
      <div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
        <PsalmsWordmarkSvg className="w-[88vw] max-w-md" />
        <img
          src={SILHOUETTE_SRC}
          alt={SILHOUETTE_ALT}
          className="w-[88vw] max-w-md aspect-[4/5] object-cover opacity-90"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
}
