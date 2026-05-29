import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';
import { MOBILE_TIME_SCALE } from '@/lib/motion-scale';
import type { HeroProps } from './HeroDesktop';

gsap.registerPlugin(ScrollTrigger);

const SILHOUETTE_SRC = '/tropical_jungle.png';
const SILHOUETTE_ALT = '';

// Per-letter SVG-userspace destinations toward the central A, matching the
// desktop COLLAPSE values from HeroDesktop.tsx.
const COLLAPSE = { P: 653.3, S1: 339.8, L: -313.9, M: -690.5, S2: -1076.4 } as const;

// Scroll distance the collapse plays over, expressed as a fraction of viewport
// height. Spec requires ≤ 60vh.
const MOBILE_COLLAPSE_VH = 60;

/**
 * Mobile-specific Hero composition. Same 4 beats as desktop — wordmark intro
 * (instant on mobile), shortened scroll-collapse (no pin), static silhouette
 * image (no video), quote sequence (Task 6), bridge copy (Task 7) — rebuilt
 * for one-thumb scroll.
 */
export function HeroMobile({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!introActive) return;
    onIntroComplete?.();
    onHandoff?.();
  }, [introActive, onIntroComplete, onHandoff]);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || prefersReducedMotion) return;

    const letters = {
      P: svg.querySelector<SVGGElement>('#letter-P'),
      S1: svg.querySelector<SVGGElement>('#letter-S1'),
      L: svg.querySelector<SVGGElement>('#letter-L'),
      M: svg.querySelector<SVGGElement>('#letter-M'),
      S2: svg.querySelector<SVGGElement>('#letter-S2'),
    };
    if (!letters.P || !letters.S1 || !letters.L || !letters.M || !letters.S2) return;

    const distancePx = window.innerHeight * (MOBILE_COLLAPSE_VH / 100);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: svg,
        start: 'top top',
        end: `+=${distancePx}`,
        scrub: 1 * MOBILE_TIME_SCALE,
        pin: false,
      },
    });

    tl.to(letters.P,  { x: COLLAPSE.P,  ease: 'power2.inOut' }, 0)
      .to(letters.S1, { x: COLLAPSE.S1, ease: 'power2.inOut' }, 0)
      .to(letters.L,  { x: COLLAPSE.L,  ease: 'power2.inOut' }, 0)
      .to(letters.M,  { x: COLLAPSE.M,  ease: 'power2.inOut' }, 0)
      .to(letters.S2, { x: COLLAPSE.S2, ease: 'power2.inOut' }, 0);

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [prefersReducedMotion]);

  return (
    <div
      data-testid="hero-mobile"
      data-intro-active={introActive ? 'true' : 'false'}
      className="relative w-full min-h-[100svh] bg-[color:var(--deep-umber)] text-white"
    >
      <div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
        <PsalmsWordmarkSvg ref={svgRef} className="w-[88vw] max-w-md" />
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
