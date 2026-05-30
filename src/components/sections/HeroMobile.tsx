import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';
import { BRIDGE_COPY } from './hero-bridge-content';
import { MOBILE_TIME_SCALE } from '@/lib/motion-scale';
import { cn } from '@/lib/utils';
import { useIntersectionStage } from '@/notepad-landing/hooks/use-intersection-stage';
import type { HeroProps } from './HeroDesktop';
import { HeroMaskClipDef } from '@/components/ui-custom/HeroMaskClipDef';

gsap.registerPlugin(ScrollTrigger);

// Per-letter SVG-userspace destinations toward the central A, matching the
// desktop COLLAPSE values from HeroDesktop.tsx.
const COLLAPSE = { P: 653.3, S1: 339.8, L: -313.9, M: -690.5, S2: -1076.4 } as const;

// Scroll distance the collapse plays over, expressed as a fraction of viewport
// height. Spec requires ≤ 60vh.
const MOBILE_COLLAPSE_VH = 60;

/**
 * Mobile-specific Hero composition. Same 4 beats as desktop — wordmark intro
 * (instant on mobile), shortened scroll-collapse (no pin), looping ambient
 * video (with poster fallback for reduced-motion), Psalm 23 quote sitting
 * directly under the wordmark, bridge copy — rebuilt for one-thumb scroll.
 */
export function HeroMobile({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const quoteRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);

  // Cross-fade in once the quote enters the viewport. Graceful no-IO fallback
  // makes the content visible immediately when IntersectionObserver is absent.
  const quoteVisible = useIntersectionStage(quoteRef, { threshold: 0.4 });
  const bridgeVisible = useIntersectionStage(bridgeRef, { threshold: 0.3 });

  useEffect(() => {
    if (!introActive) return;
    onIntroComplete?.();
    onHandoff?.();
  }, [introActive, onIntroComplete, onHandoff]);

  // Snapshot at mount only; OS reduced-motion changes mid-session require a
  // reload. Matches HeroDesktop's pattern — listening for changes here would
  // require re-running GSAP setup mid-session with stale state.
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

    // Wrap in a gsap.context so cleanup (ctx.revert) tears down BOTH the
    // timeline AND its ScrollTrigger in one call — matches HeroDesktop's
    // convention and survives future additions of more tweens inside this
    // effect without leaking ScrollTriggers.
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: svg,
          start: 'top top',
          // Functional `end` so ScrollTrigger.refresh() recomputes on resize/
          // orientation change (matches HeroDesktop pattern; spec note about
          // mobile Safari address bar resize).
          end: () => `+=${window.innerHeight * (MOBILE_COLLAPSE_VH / 100)}`,
          // scrub: 0.7 — snappier than desktop's 1.0; scaled by MOBILE_TIME_SCALE
          // so the constant remains the source of truth for "snappier on mobile".
          scrub: 1 * MOBILE_TIME_SCALE,
          pin: false,
          invalidateOnRefresh: true,
        },
      });

      tl.to(letters.P,  { x: COLLAPSE.P,  ease: 'power2.inOut' }, 0)
        .to(letters.S1, { x: COLLAPSE.S1, ease: 'power2.inOut' }, 0)
        .to(letters.L,  { x: COLLAPSE.L,  ease: 'power2.inOut' }, 0)
        .to(letters.M,  { x: COLLAPSE.M,  ease: 'power2.inOut' }, 0)
        .to(letters.S2, { x: COLLAPSE.S2, ease: 'power2.inOut' }, 0);
    });

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <div
      data-testid="hero-mobile"
      data-intro-active={introActive ? 'true' : 'false'}
      className="relative w-full min-h-[100svh]"
      style={{ backgroundColor: 'var(--app-bg)' }}
    >
      <HeroMaskClipDef />
      <div className="relative w-full flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8">
        <PsalmsWordmarkSvg ref={svgRef} className="w-[88vw] max-w-md" />
        <div
          ref={quoteRef}
          data-testid="hero-mobile-quote"
          data-visible={quoteVisible ? 'true' : 'false'}
          className={cn(
            'text-center px-6 transition-opacity duration-1000 max-w-md',
            quoteVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          <p className="quote-text italic text-[15px] leading-relaxed">
            "He leads me beside still waters.
          </p>
          <p className="quote-text italic text-[15px] leading-relaxed mt-2">
            He restores my soul."
          </p>
          <p className="quote-attr text-xs opacity-60 mt-4">
            Psalm 23:2-3
          </p>
        </div>
        <div
          data-testid="hero-mobile-video-mask"
          className="w-[88vw] max-w-md aspect-[5/3] overflow-hidden"
          style={{ clipPath: 'url(#hero-mask-clip)' }}
        >
          <video
            data-testid="hero-mobile-video"
            aria-hidden="true"
            src="/hero_main_video.mp4"
            poster="/tropical_jungle.png"
            autoPlay={!prefersReducedMotion}
            muted
            playsInline
            loop
            preload="auto"
            className="w-full h-full object-cover"
          />
        </div>
        <div
          ref={bridgeRef}
          data-testid="hero-mobile-bridge"
          data-visible={bridgeVisible ? 'true' : 'false'}
          className="mt-16 mb-24 text-center px-6 flex flex-col gap-8 max-w-md"
        >
          <p
            className={cn(
              'bridge-line-center text-[15px] leading-relaxed transition-opacity duration-700',
              bridgeVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            {BRIDGE_COPY.invitation}
          </p>
          <p
            className={cn(
              'bridge-thesis text-[15px] leading-relaxed transition-opacity duration-700 delay-200',
              bridgeVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            {BRIDGE_COPY.thesis}
          </p>
          <p
            className={cn(
              'bridge-line-center text-[15px] leading-relaxed transition-opacity duration-700 delay-500',
              bridgeVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            {BRIDGE_COPY.assurance}
          </p>
        </div>
      </div>
    </div>
  );
}
