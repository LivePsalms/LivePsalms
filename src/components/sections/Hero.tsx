import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';

gsap.registerPlugin(ScrollTrigger);

// The CSS var `--deep-umber` (#3A3426) is used in inline styles via var(),
// but GSAP cannot tween a CSS variable cleanly. Keep this literal in sync
// with `src/index.css:29` if the palette ever changes.
const DEEP_UMBER_HEX = '#3A3426';

// SVG-userspace collapse offsets. Distance each letter travels from its
// settled position to the A's center, in viewBox units (positive = moves
// rightward toward A from the left side; negative = moves leftward toward
// A from the right side). Used by both the intro spread (reverse direction)
// and the scroll-collapse effect.
const COLLAPSE = {
  P:  653.3,
  S1: 339.8,
  L: -313.9,
  M: -690.5,
  S2: -1076.4,
} as const;

interface HeroProps {
  introActive?: boolean;
  onIntroComplete?: () => void;
  onHandoff?: () => void;
}

export function Hero({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [showNav, setShowNav] = useState<boolean>(!introActive);
  const svgRef = useRef<SVGSVGElement>(null);
  const darkCanvasRef = useRef<HTMLDivElement>(null);
  const glowAuraRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);
  const quoteLine1Ref = useRef<HTMLParagraphElement>(null);
  const quoteLine2Ref = useRef<HTMLParagraphElement>(null);
  const quoteAttrRef = useRef<HTMLParagraphElement>(null);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Mask scroll-expand refs
  const maskScrollRef = useRef<HTMLDivElement>(null);
  const maskClipRef = useRef<HTMLDivElement>(null);
  const maskImgRef = useRef<HTMLImageElement>(null);
  const maskVideoRef = useRef<HTMLVideoElement>(null);

  // Scroll-collapse refs (new — see docs/superpowers/specs/2026-05-12-hero-scroll-collapse-design.md)
  const collapseScrollRef = useRef<HTMLDivElement>(null);
  const collapsePinRef = useRef<HTMLDivElement>(null);
  const collapseSvgRef = useRef<SVGSVGElement>(null);
  const collapseHaloRef = useRef<HTMLDivElement>(null);
  const collapseRingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = quoteRef.current;
    const l1 = quoteLine1Ref.current;
    const l2 = quoteLine2Ref.current;
    const attr = quoteAttrRef.current;
    if (!container || !l1 || !l2 || !attr) return;

    const ctx = gsap.context(() => {
      gsap.set([l1, l2, attr], { opacity: 0, y: 40, filter: 'blur(10px)' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top 95%',
          end: 'top 10%',
          scrub: 3,
          invalidateOnRefresh: true,
        },
      });

      tl.to(
        l1,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 1 },
        0
      );
      tl.to(
        l2,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 1 },
        0.35
      );
      tl.to(
        attr,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 1 },
        0.7
      );
    }, container);

    return () => ctx.revert();
  }, []);

  /* ── Mask-expand scroll animation ── */
  useEffect(() => {
    const scrollEl = maskScrollRef.current;
    const clipEl = maskClipRef.current;
    const imgEl = maskImgRef.current;
    if (!scrollEl || !clipEl || !imgEl) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top top',
          end: '60% top',
          scrub: 1,
          pin: false,
          invalidateOnRefresh: true,
        },
      });

      // Expand the clipped mask container from centered/small → full viewport
      tl.fromTo(
        clipEl,
        { width: '75%', height: '45%' },
        { width: '100%', height: '100%', ease: 'none', duration: 1 },
        0
      );

      // Subtle image zoom-out as the mask expands
      tl.fromTo(
        imgEl,
        { scale: 1.15 },
        { scale: 1, ease: 'none', duration: 1 },
        0
      );

      // Crossfade image → video near the end of the scroll animation
      const videoEl = maskVideoRef.current;
      if (videoEl) {
        gsap.set(videoEl, { opacity: 0 });

        // Fade video in over 20% of the timeline, starting at 70%
        tl.to(
          videoEl,
          { opacity: 1, ease: 'power1.inOut', duration: 0.2 },
          0.7
        );

        // Start video playback slightly before the crossfade begins
        ScrollTrigger.create({
          trigger: scrollEl,
          start: 'top top',
          end: '60% top',
          onUpdate: (self) => {
            if (self.progress >= 0.65 && videoEl.paused) {
              videoEl.play().catch(() => {});
            }
          },
        });
      }
    }, scrollEl);

    return () => ctx.revert();
  }, []);

  /* ── Responsive sizing for glow-aura and pulse-ring ── */
  useEffect(() => {
    const svgEl = svgRef.current;
    const heroEl = heroRef.current;
    if (!svgEl || !heroEl) return;

    const update = () => {
      const wordmarkWidth = svgEl.getBoundingClientRect().width;
      if (wordmarkWidth === 0) return;
      // Ratios derived from the original 1100px wordmark:
      // aura 720px → 0.6545, ring initial 260px → 0.2364, ring final 2800px → 2.5455
      heroEl.style.setProperty('--aura-size', `${wordmarkWidth * 0.6545}px`);
      heroEl.style.setProperty('--ring-size', `${wordmarkWidth * 0.2364}px`);
      heroEl.style.setProperty('--ring-final-size', `${wordmarkWidth * 2.5455}px`);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(svgEl);
    return () => ro.disconnect();
  }, []);

  /* ── Intro timeline ── */
  // useLayoutEffect (not useEffect) so the `tl.set(...)` initial-state calls
  // run synchronously after DOM commit but BEFORE first paint. Otherwise the
  // browser briefly paints the fully-composed wordmark before GSAP collapses
  // the letters, causing a visible flash.
  useLayoutEffect(() => {
    if (!introActive) return;

    const svgEl = svgRef.current;
    const darkEl = darkCanvasRef.current;
    const glowEl = glowAuraRef.current;
    const ringEl = pulseRingRef.current;
    const heroEl = heroRef.current;
    if (!svgEl || !darkEl || !glowEl || !ringEl || !heroEl) return;

    // Resolve letter elements once via the SVG ref. Direct references avoid
    // global selector queries and let us drop gsap.context() (see note above).
    const letterA  = svgEl.querySelector<SVGGElement>('#letter-A');
    const letterP  = svgEl.querySelector<SVGGElement>('#letter-P');
    const letterS1 = svgEl.querySelector<SVGGElement>('#letter-S1');
    const letterL  = svgEl.querySelector<SVGGElement>('#letter-L');
    const letterM  = svgEl.querySelector<SVGGElement>('#letter-M');
    const letterS2 = svgEl.querySelector<SVGGElement>('#letter-S2');
    if (!letterA || !letterP || !letterS1 || !letterL || !letterM || !letterS2) return;

    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        onIntroComplete?.();
      },
    });

    // Initial states (t=0)
    tl.set(letterA,  { opacity: 0, scale: 0.92, transformOrigin: '50% 50%' }, 0);
    tl.set(letterP,  { x: COLLAPSE.P,  opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(letterS1, { x: COLLAPSE.S1, opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(letterL,  { x: COLLAPSE.L,  opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(letterM,  { x: COLLAPSE.M,  opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(letterS2, { x: COLLAPSE.S2, opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(glowEl, { opacity: 0 }, 0);
    tl.set(ringEl, { width: 'var(--ring-size, 260px)', height: 'var(--ring-size, 260px)', opacity: 0 }, 0);
    tl.set(darkEl, { opacity: 1 }, 0);

    // Act I.1 — A enters (0.3 → 1.7s)
    tl.to(letterA, { opacity: 1, scale: 1, duration: 1.4, ease: 'power2.out', overwrite: 'auto' }, 0.3);
    tl.to(glowEl,  { opacity: 0.18, duration: 1.4, ease: 'power1.out', overwrite: 'auto' }, 0.4);

    // Act I.3 — Lub (2.10s)
    const lub = 2.10;
    tl.to(letterA, { scale: 1.022, duration: 0.18, ease: 'power2.out', overwrite: 'auto' }, lub);
    tl.to(letterA, { scale: 1.0,   duration: 0.32, ease: 'power3.out', overwrite: 'auto' }, lub + 0.18);
    tl.to(glowEl,  { opacity: 0.42, scale: 1.08, duration: 0.18, ease: 'power2.out', overwrite: 'auto' }, lub);
    tl.to(glowEl,  { opacity: 0.18, scale: 1.0,  duration: 0.32, ease: 'power2.out', overwrite: 'auto' }, lub + 0.18);

    // Act I.5 — Dub (2.85s)
    const dub = 2.85;
    tl.to(letterA, { scale: 1.042, duration: 0.22, ease: 'power2.out', overwrite: 'auto' }, dub);
    tl.to(letterA, { scale: 1.0,   duration: 0.50, ease: 'power3.out', overwrite: 'auto' }, dub + 0.22);
    tl.to(glowEl,  { opacity: 0.78, scale: 1.18, duration: 0.22, ease: 'power2.out', overwrite: 'auto' }, dub);
    tl.to(glowEl,  { opacity: 0,    scale: 1.0,  duration: 1.30, ease: 'power2.in',  overwrite: 'auto' }, dub + 0.22);

    // Act I.6 — Ring expands (2.97s)
    const ring = dub + 0.12;
    const ringFinalCss = getComputedStyle(heroEl).getPropertyValue('--ring-final-size').trim() || '2800px';
    tl.to(ringEl, { opacity: 0.92, duration: 0.24, ease: 'power2.out', overwrite: 'auto' }, ring);
    tl.to(ringEl, { width: ringFinalCss, height: ringFinalCss, duration: 1.8, ease: 'power2.out', overwrite: 'auto' }, ring);
    tl.to(ringEl, { opacity: 0, duration: 1.5, ease: 'power2.in', overwrite: 'auto' }, ring + 0.35);

    // Act II — Letter spread (4.20s, three waves)
    const spread = (target: SVGGElement, t: number) => {
      tl.to(target, { x: 0,                duration: 1.8, ease: 'power3.out' }, t);
      tl.to(target, { opacity: 1,          duration: 1.4, ease: 'power1.out' }, t);
      tl.to(target, { filter: 'blur(0px)', duration: 1.6, ease: 'power2.out' }, t);
    };
    const spreadAt = 4.20;
    spread(letterS1, spreadAt);
    spread(letterL,  spreadAt);
    spread(letterP,  spreadAt + 0.45);
    spread(letterM,  spreadAt + 0.45);
    spread(letterS2, spreadAt + 0.90);

    // Handoff beat (6.40s → 7.60s) — cream→deep-umber, opacity→0.12, dark canvas fades.
    // tl.call fires once at the position; setShowNav(true) triggers the existing
    // masked-image and quote entrance via their existing prop gating, and
    // onHandoff?.() notifies App so the header can fade in via its showNav prop.
    const handoff = 6.40;
    tl.to(darkEl, { opacity: 0, duration: 1.2, ease: 'power2.inOut' }, handoff);
    tl.to(svgEl,  { color: DEEP_UMBER_HEX, duration: 1.2, ease: 'power2.inOut' }, handoff);
    tl.to(svgEl,  { opacity: 0.12, duration: 1.2, ease: 'power2.inOut' }, handoff);
    tl.call(() => {
      setShowNav(true);
      onHandoff?.();
    }, [], handoff);

    tl.play(0);

    return () => {
      tl.kill();
    };
  }, [introActive, onIntroComplete, onHandoff]);

  return (
    <section
      ref={heroRef}
      className="relative overflow-visible"
    >
      {/* First viewport: PSALMS logo */}
      <div className="relative h-screen flex flex-col items-center justify-center">
        {/* Dark canvas — covers the first viewport during intro, fades at handoff */}
        <div
          ref={darkCanvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 50% 50%, #0e0c10 0%, #08070a 60%, #050507 100%), #0a0a0c',
            opacity: introActive ? 1 : 0,
            zIndex: 2,
          }}
        />

        {/* Glow aura — sits behind the A glyph, blooms on heartbeats */}
        <div
          ref={glowAuraRef}
          className="absolute pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            width: 'var(--aura-size, 0px)',
            height: 'var(--aura-size, 0px)',
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle at center, rgba(246, 244, 240, 0.32) 0%, rgba(246, 244, 240, 0.12) 22%, rgba(246, 244, 240, 0.04) 45%, rgba(246, 244, 240, 0) 72%)',
            borderRadius: '50%',
            opacity: 0,
            mixBlendMode: 'screen',
            filter: 'blur(14px)',
            willChange: 'opacity, transform',
            zIndex: 3,
          }}
        />

        {/* Pulse ring — emanates from A on the second heartbeat */}
        <div
          ref={pulseRingRef}
          className="absolute pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            width: 'var(--ring-size, 0px)',
            height: 'var(--ring-size, 0px)',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1.25px solid rgba(246, 244, 240, 0.85)',
            boxShadow:
              '0 0 38px rgba(246, 244, 240, 0.42), 0 0 90px rgba(246, 244, 240, 0.18), inset 0 0 22px rgba(246, 244, 240, 0.12)',
            opacity: 0,
            mixBlendMode: 'screen',
            willChange: 'width, height, opacity',
            zIndex: 3,
          }}
        />

        {/* Background PSALMS Logo - Large Outline Style */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden px-4"
          style={{ zIndex: 4 }}
        >
          <PsalmsWordmarkSvg
            ref={svgRef}
            className="w-[95vw] md:w-[80vw] max-w-4xl"
            style={{
              opacity: introActive ? 1 : 0.12,
              color: introActive ? '#f6f4f0' : 'var(--deep-umber)',
            }}
          />
        </div>
      </div>

      {/* Scroll-collapse pin region — wordmark gathers back into A as user scrolls. */}
      <div
        ref={collapseScrollRef}
        data-reduced-motion={prefersReducedMotion ? 'true' : undefined}
        className="relative"
        style={{
          height: prefersReducedMotion ? '100vh' : '150vh',
          overscrollBehaviorY: 'contain',
        }}
      >
        <div
          ref={collapsePinRef}
          className="top-0 h-screen w-full flex items-center justify-center overflow-hidden"
          style={{ position: prefersReducedMotion ? 'static' : 'sticky' }}
        >
          {/* Persistent umber halo — sits behind the wordmark. */}
          <div
            ref={collapseHaloRef}
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              width: '520px',
              height: '520px',
              transform: 'translate(-50%, -50%) scale(0.3)',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(58, 52, 38, 0.18) 0%, rgba(58, 52, 38, 0.10) 28%, rgba(58, 52, 38, 0.04) 55%, rgba(58, 52, 38, 0) 80%)',
              filter: 'blur(18px)',
              opacity: 0,
              willChange: 'opacity, transform',
              zIndex: 0,
            }}
          />

          {/* Second wordmark instance — the one that animates the collapse. */}
          <PsalmsWordmarkSvg
            ref={collapseSvgRef}
            className="w-[95vw] md:w-[80vw] max-w-4xl relative"
            style={{
              opacity: 0.12,
              color: 'var(--deep-umber)',
              zIndex: 1,
            }}
          />

          {/* Expanding warm-sand ring — sits in front of the wordmark. */}
          <div
            ref={collapseRingRef}
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              width: '24px',
              height: '24px',
              transform: 'translate(-50%, -50%) scale(0.3)',
              borderRadius: '50%',
              border: '1.5px solid rgba(188, 179, 163, 0.85)',
              opacity: 0,
              willChange: 'opacity, transform',
              zIndex: 2,
            }}
          />
        </div>
      </div>

      {/* Hidden SVG defs for the mask clip-path */}
      <svg
        className="absolute -top-[999px] -left-[999px] w-0 h-0"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="hero-mask-clip" clipPathUnits="objectBoundingBox">
            <path d="M0.0998072 1H0.422076H0.749756C0.767072 1 0.774207 0.961783 0.77561 0.942675V0.807325C0.777053 0.743631 0.791844 0.731953 0.799059 0.734076H0.969813C0.996268 0.730255 1.00088 0.693206 0.999875 0.675159V0.0700637C0.999875 0.0254777 0.985045 0.00477707 0.977629 0H0.902473C0.854975 0 0.890448 0.138535 0.850165 0.138535H0.0204424C0.00408849 0.142357 0 0.180467 0 0.199045V0.410828C0 0.449045 0.0136283 0.46603 0.0204424 0.469745H0.0523086C0.0696245 0.471019 0.0735527 0.497877 0.0733523 0.511146V0.915605C0.0723903 0.983121 0.090588 1 0.0998072 1Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Scroll-animated masked image */}
      <div
        ref={maskScrollRef}
        className="relative"
        style={{ height: '250vh', marginTop: '-35vh' }}
      >
        <div
          className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center"
          style={{
            opacity: showNav ? 1 : 0,
            transform: showNav ? 'translateY(0)' : 'translateY(40px)',
            filter: showNav ? 'blur(0px)' : 'blur(12px)',
            transition: 'all 3.5s cubic-bezier(0.16, 1, 0.3, 1)',
            transitionDelay: '1900ms',
          }}
        >
          <div
            ref={maskClipRef}
            className="relative overflow-hidden"
            style={{
              clipPath: 'url(#hero-mask-clip)',
              width: '75%',
              height: '45%',
            }}
          >
            <img
              ref={maskImgRef}
              src="/tropical_jungle.png"
              alt=""
              className="w-full h-full object-cover"
              style={{ transform: 'scale(1.15)' }}
            />
            <video
              ref={maskVideoRef}
              src="/hero_main_video.mp4"
              muted
              playsInline
              loop
              preload="auto"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0 }}
            />
          </div>
        </div>
      </div>

      {/* Quote - sits beneath the masked image, over the white mist glow.
          Fades in smoothly via scroll-linked GSAP timeline. */}
      <div
        ref={quoteRef}
        className="relative flex flex-col items-center justify-center px-6 text-center"
        style={{ minHeight: '8vh', marginTop: '15vh' }}
      >
        <div className="max-w-4xl">
          <p ref={quoteLine1Ref} className="quote-text">
            "He leads me beside still waters.
          </p>
          <p ref={quoteLine2Ref} className="quote-text mt-2 md:mt-3">
            He restores my soul."
          </p>
          <p ref={quoteAttrRef} className="quote-attr mt-6 md:mt-8">
            Psalm 23:2-3
          </p>
        </div>
      </div>
    </section>
  );
}
