import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';
import { BRIDGE_COPY, bridgeCascadeKeyframes } from './hero-bridge-content';
import { applyKeyframes, projectFinalFrame } from './motion-keyframes';
import { wordmarkAuraSizes, WORDMARK_COLLAPSE } from './hero-choreography/wordmark-geometry';
import { collapseKeyframes, COLLAPSE_COLOR_DEEP_UMBER } from './hero-choreography/collapse-keyframes';
import { maskExpandKeyframes, VIDEO_PLAY_AT } from './hero-choreography/mask-expand-keyframes';
import { quoteFadeKeyframes } from './hero-choreography/quote-fade-keyframes';
import { HeroIntroSequence } from './hero-choreography/hero-intro-sequence';
import { HeroMaskClipDef } from '@/components/ui-custom/HeroMaskClipDef';
import { setNavCollapseProgress } from '@/lib/nav-collapse-progress';

gsap.registerPlugin(ScrollTrigger);

export interface HeroProps {
  introActive?: boolean;
  onIntroComplete?: () => void;
  onHandoff?: () => void;
}

export function HeroDesktop({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const darkCanvasRef = useRef<HTMLDivElement>(null);
  const glowAuraRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);
  const quoteLine1Ref = useRef<HTMLParagraphElement>(null);
  const quoteLine2Ref = useRef<HTMLParagraphElement>(null);
  const quoteAttrRef = useRef<HTMLParagraphElement>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);
  const bridgeInviteRef = useRef<HTMLParagraphElement>(null);
  const bridgeThesisRef = useRef<HTMLParagraphElement>(null);
  const bridgeAssureRef = useRef<HTMLParagraphElement>(null);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Mask scroll-expand refs — silhouette clip-path owns image + video together.
  const maskScrollRef = useRef<HTMLDivElement>(null);
  const maskClipRef = useRef<HTMLDivElement>(null);
  const maskImgRef = useRef<HTMLImageElement>(null);
  const maskVideoRef = useRef<HTMLVideoElement>(null);

  // Scroll-collapse refs (see docs/superpowers/specs/2026-05-12-hero-scroll-collapse-design.md).
  // The wordmark itself lives on `svgRef` above — the same SVG instance the
  // intro effect animates. The collapse effect tweens the parent SVG and its
  // letter <g> children alongside the halo/ring overlay layers.
  const collapseScrollRef = useRef<HTMLDivElement>(null);
  const collapseRingRef = useRef<HTMLDivElement>(null);

  // Intro state-machine controller (created once) and its kill handle.
  const introRef = useRef<HeroIntroSequence | null>(null);
  const killIntroRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = quoteRef.current;
    const l1 = quoteLine1Ref.current;
    const l2 = quoteLine2Ref.current;
    const attr = quoteAttrRef.current;
    if (!container || !l1 || !l2 || !attr) return;

    const targets = { l1, l2, attr };
    const kfs = quoteFadeKeyframes();

    if (prefersReducedMotion) {
      const final = projectFinalFrame(kfs);
      gsap.set(l1, final.l1);
      gsap.set(l2, final.l2);
      gsap.set(attr, final.attr);
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: container, start: 'top 95%', end: 'top 10%', scrub: 3, invalidateOnRefresh: true },
      });
      applyKeyframes(tl, kfs, targets);
    }, container);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  /* ── Bridge cascade: pinned three-beat sequence. Text 1 enters from the
        left, hands off to text 2 on the right, hands off to text 3 at center.
        Same scroll-scrub pattern as the wordmark-collapse: CSS sticky owns
        the visual pin; GSAP owns the timeline scrub.
        Mirrored on mobile by HeroMobile.tsx — keep the two timelines in sync
        (kiss-handoff fractions, eases, blur/opacity/translate values). The
        mobile port differs only in `scrub` (× MOBILE_TIME_SCALE) and text 2's
        enter `x` (30 vs 120, proportional to viewport). ── */
  useEffect(() => {
    const scrollEl = bridgeRef.current;
    const t1 = bridgeInviteRef.current;
    const t2 = bridgeThesisRef.current;
    const t3 = bridgeAssureRef.current;
    if (!scrollEl || !t1 || !t2 || !t3) return;

    if (prefersReducedMotion) {
      // Reduced motion: all three beats settle to visible at their static
      // positions. The reduced-motion JSX path renders them in normal flow
      // (no pin, no overlap), so we just clear any transform/blur state.
      gsap.set([t1, t2, t3], { opacity: 1, y: 0, filter: 'blur(0px)' });
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: scrollEl, start: 'top 80%', end: 'bottom bottom', scrub: 2, invalidateOnRefresh: true },
      });
      applyKeyframes(tl, bridgeCascadeKeyframes({ enterX2: 120 }), { t1, t2, t3 });
    }, scrollEl);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  /* ── Mask-expand scroll animation ── */
  useEffect(() => {
    if (prefersReducedMotion) return;

    const scrollEl = maskScrollRef.current;
    const clipEl = maskClipRef.current;
    const imgEl = maskImgRef.current;
    const videoEl = maskVideoRef.current;
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
      const kfs = videoEl
        ? maskExpandKeyframes()
        : maskExpandKeyframes().filter((k) => k.target !== 'video');
      applyKeyframes(tl, kfs, { clip: clipEl, img: imgEl, video: videoEl });
    }, scrollEl);

    // Playback start: kick the video off slightly before its visual crossfade.
    let playbackTrigger: ScrollTrigger | undefined;
    if (videoEl) {
      playbackTrigger = ScrollTrigger.create({
        trigger: scrollEl,
        start: 'top top',
        end: '60% top',
        onUpdate: (self) => {
          if (self.progress >= VIDEO_PLAY_AT && videoEl.paused) {
            videoEl.play().catch(() => {});
          }
        },
      });
    }

    return () => {
      ctx.revert();
      playbackTrigger?.kill();
    };
  }, [prefersReducedMotion]);

  /* ── Reduced-motion fallback for the mask-expand:
       no scroll animation; silhouette rendered statically at full size with video playing. ── */
  useEffect(() => {
    if (!prefersReducedMotion) return;
    const clipEl = maskClipRef.current;
    const imgEl = maskImgRef.current;
    const videoEl = maskVideoRef.current;
    if (!clipEl || !imgEl) return;

    const final = projectFinalFrame(maskExpandKeyframes());
    gsap.set(clipEl, final.clip);
    gsap.set(imgEl, final.img);
    if (videoEl) {
      gsap.set(videoEl, final.video);
      videoEl.play().catch(() => {});
    }
  }, [prefersReducedMotion]);

  /* ── Responsive sizing for glow-aura and pulse-ring ── */
  useEffect(() => {
    const svgEl = svgRef.current;
    const heroEl = heroRef.current;
    if (!svgEl || !heroEl) return;

    const update = () => {
      const wordmarkWidth = svgEl.getBoundingClientRect().width;
      if (wordmarkWidth === 0) return;
      const sizes = wordmarkAuraSizes(wordmarkWidth);
      heroEl.style.setProperty('--aura-size', `${sizes.aura}px`);
      heroEl.style.setProperty('--ring-size', `${sizes.ringInitial}px`);
      heroEl.style.setProperty('--ring-final-size', `${sizes.ringFinal}px`);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(svgEl);
    return () => ro.disconnect();
  }, []);

  /* ── Intro timeline ── */
  // The GSAP build runs inside a HeroIntroSequence state-machine controller.
  // The controller is created once; `play` is injected with the same
  // useLayoutEffect-timing semantics (it's invoked from `start()` inside the
  // layout effect below) so the `tl.set(...)` initial-state calls run
  // synchronously after DOM commit but BEFORE first paint — otherwise the
  // browser briefly paints the fully-composed wordmark before GSAP collapses
  // the letters, causing a visible flash.
  if (introRef.current === null) {
    introRef.current = new HeroIntroSequence({
      play: ({ onHandoff: fireHandoff, onComplete }) => {
        const svgEl = svgRef.current!;
        const darkEl = darkCanvasRef.current!;
        const glowEl = glowAuraRef.current!;
        const ringEl = pulseRingRef.current!;
        const heroEl = heroRef.current!;
        const letterA  = svgEl.querySelector<SVGGElement>('#letter-A')!;
        const letterP  = svgEl.querySelector<SVGGElement>('#letter-P')!;
        const letterS1 = svgEl.querySelector<SVGGElement>('#letter-S1')!;
        const letterL  = svgEl.querySelector<SVGGElement>('#letter-L')!;
        const letterM  = svgEl.querySelector<SVGGElement>('#letter-M')!;
        const letterS2 = svgEl.querySelector<SVGGElement>('#letter-S2')!;

        const tl = gsap.timeline({ paused: true, onComplete });

        tl.set(letterA,  { opacity: 0, scale: 0.92, transformOrigin: '50% 50%' }, 0);
        tl.set(letterP,  { x: WORDMARK_COLLAPSE.P,  opacity: 0, filter: 'blur(6px)' }, 0);
        tl.set(letterS1, { x: WORDMARK_COLLAPSE.S1, opacity: 0, filter: 'blur(6px)' }, 0);
        tl.set(letterL,  { x: WORDMARK_COLLAPSE.L,  opacity: 0, filter: 'blur(6px)' }, 0);
        tl.set(letterM,  { x: WORDMARK_COLLAPSE.M,  opacity: 0, filter: 'blur(6px)' }, 0);
        tl.set(letterS2, { x: WORDMARK_COLLAPSE.S2, opacity: 0, filter: 'blur(6px)' }, 0);
        tl.set(glowEl, { opacity: 0 }, 0);
        tl.set(ringEl, { width: 'var(--ring-size, 260px)', height: 'var(--ring-size, 260px)', opacity: 0 }, 0);
        tl.set(darkEl, { opacity: 1 }, 0);

        tl.to(letterA, { opacity: 1, scale: 1, duration: 1.4, ease: 'power2.out', overwrite: 'auto' }, 0.3);
        tl.to(glowEl,  { opacity: 0.18, duration: 1.4, ease: 'power1.out', overwrite: 'auto' }, 0.4);

        const lub = 2.10;
        tl.to(letterA, { scale: 1.022, duration: 0.18, ease: 'power2.out', overwrite: 'auto' }, lub);
        tl.to(letterA, { scale: 1.0,   duration: 0.32, ease: 'power3.out', overwrite: 'auto' }, lub + 0.18);
        tl.to(glowEl,  { opacity: 0.42, scale: 1.08, duration: 0.18, ease: 'power2.out', overwrite: 'auto' }, lub);
        tl.to(glowEl,  { opacity: 0.18, scale: 1.0,  duration: 0.32, ease: 'power2.out', overwrite: 'auto' }, lub + 0.18);

        const dub = 2.85;
        tl.to(letterA, { scale: 1.042, duration: 0.22, ease: 'power2.out', overwrite: 'auto' }, dub);
        tl.to(letterA, { scale: 1.0,   duration: 0.50, ease: 'power3.out', overwrite: 'auto' }, dub + 0.22);
        tl.to(glowEl,  { opacity: 0.78, scale: 1.18, duration: 0.22, ease: 'power2.out', overwrite: 'auto' }, dub);
        tl.to(glowEl,  { opacity: 0,    scale: 1.0,  duration: 1.30, ease: 'power2.in',  overwrite: 'auto' }, dub + 0.22);

        const ring = dub + 0.12;
        const ringFinalCss = getComputedStyle(heroEl).getPropertyValue('--ring-final-size').trim() || '2800px';
        tl.to(ringEl, { opacity: 0.92, duration: 0.24, ease: 'power2.out', overwrite: 'auto' }, ring);
        tl.to(ringEl, { width: ringFinalCss, height: ringFinalCss, duration: 1.8, ease: 'power2.out', overwrite: 'auto' }, ring);
        tl.to(ringEl, { opacity: 0, duration: 1.5, ease: 'power2.in', overwrite: 'auto' }, ring + 0.35);

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

        const handoff = 6.40;
        tl.to(darkEl, { opacity: 0, duration: 1.2, ease: 'power2.inOut' }, handoff);
        tl.to(svgEl,  { color: COLLAPSE_COLOR_DEEP_UMBER, duration: 1.2, ease: 'power2.inOut' }, handoff);
        tl.to(svgEl,  { opacity: 0.45, duration: 1.2, ease: 'power2.inOut' }, handoff);
        tl.call(fireHandoff, [], handoff);

        tl.play(0);
        killIntroRef.current = () => tl.kill();
      },
      onHandoff,
      onIntroComplete,
    });
  }
  const introStatus = useSyncExternalStore(
    introRef.current.subscribe,
    () => introRef.current!.getSnapshot().status,
  );
  const showNav = !introActive || introStatus === 'revealed';

  useLayoutEffect(() => {
    if (!introActive) return;
    introRef.current!.start();
    return () => {
      // Tear down the gsap timeline, then reset the controller to idle so a
      // Strict Mode remount (mount → cleanup → mount) rebuilds and replays it.
      killIntroRef.current?.();
      introRef.current!.reset();
    };
    // Play-once intent: the controller closes over the latest callbacks via its
    // constructor, so introActive is the only meaningful dep.

  }, [introActive]);

  /* ── Scroll-collapse: bloom + three-wave collapse + A pulse + climax + rest ── */
  useLayoutEffect(() => {
    if (introActive) return;
    if (prefersReducedMotion) return;

    const scrollEl = collapseScrollRef.current;
    const svgEl    = svgRef.current;
    const ringEl   = collapseRingRef.current;
    if (!scrollEl || !svgEl || !ringEl) return;

    const letterA  = svgEl.querySelector<SVGGElement>('#letter-A');
    const letterP  = svgEl.querySelector<SVGGElement>('#letter-P');
    const letterS1 = svgEl.querySelector<SVGGElement>('#letter-S1');
    const letterL  = svgEl.querySelector<SVGGElement>('#letter-L');
    const letterM  = svgEl.querySelector<SVGGElement>('#letter-M');
    const letterS2 = svgEl.querySelector<SVGGElement>('#letter-S2');
    if (!letterA || !letterP || !letterS1 || !letterL || !letterM || !letterS2) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { force3D: true },
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top top',
          // 60% of the 380vh outer = 228vh of scrub. The remaining 152vh of
          // the outer is the natural sticky-release exit.
          end: '60% top',
          // scrub: 2 lerps the timeline ~2s behind the scroll position.
          scrub: 2,
          invalidateOnRefresh: true,
          // Publishes the wordmark-collapse progress to the singleton so the
          // Header's nav-collapse subscriber can drive the per-item fade in
          // lockstep with the letter waves.
          onUpdate: (self) => setNavCollapseProgress(self.progress),
        },
      });
      applyKeyframes(tl, collapseKeyframes(), {
        svg: svgEl,
        letterA, letterP, letterS1, letterL, letterM, letterS2,
        ring: ringEl,
      });
    }, scrollEl);

    return () => ctx.revert();
  }, [introActive, prefersReducedMotion]);

  /* ── Reduced-motion fallback: fade-only entrance on IntersectionObserver ── */
  useEffect(() => {
    if (introActive) return;
    if (!prefersReducedMotion) return;

    const scrollEl = collapseScrollRef.current;
    const svgEl    = svgRef.current;
    if (!scrollEl || !svgEl) return;

    const letterA  = svgEl.querySelector<SVGGElement>('#letter-A');
    const letterP  = svgEl.querySelector<SVGGElement>('#letter-P');
    const letterS1 = svgEl.querySelector<SVGGElement>('#letter-S1');
    const letterL  = svgEl.querySelector<SVGGElement>('#letter-L');
    const letterM  = svgEl.querySelector<SVGGElement>('#letter-M');
    const letterS2 = svgEl.querySelector<SVGGElement>('#letter-S2');
    if (!letterA || !letterP || !letterS1 || !letterL || !letterM || !letterS2) return;

    // Establish starting state (the SVG wrapper is at opacity 0.12 from inline style;
    // each letter inherits — but the A needs to bump to full opacity on intersection,
    // and siblings need to fade to 0. Seed the wrapper to opacity 1.0 with each
    // letter's individual opacity at 0.12 so the inheritance math works out).
    gsap.set(svgEl, { opacity: 1.0 });
    gsap.set([letterA, letterP, letterS1, letterL, letterM, letterS2], { opacity: 0.12 });

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        // Run the fade once, then disconnect.
        gsap.to([letterP, letterS1, letterL, letterM, letterS2], {
          opacity: 0,
          duration: 0.8,
          ease: 'power1.out',
        });
        gsap.to(letterA, {
          opacity: 1.0,
          duration: 0.8,
          ease: 'power2.out',
        });

        observer.disconnect();
      },
      { threshold: 0.3 },
    );

    observer.observe(scrollEl);
    return () => observer.disconnect();
  }, [introActive, prefersReducedMotion]);

  return (
    <section
      ref={heroRef}
      data-testid="hero-desktop"
      className="relative overflow-visible"
    >
      {/* Hero region — first viewport + scroll-collapse pin combined.
          Outer is 380vh; inner is `sticky top-0 h-screen`. With this geometry,
          CSS sticky stays glued for (380vh − 100vh) = 280vh of scroll, and
          the scrub range covers the first 228vh (60% of the outer). The
          extra height vs the original 250vh gives each collapse wave ~84vh
          of scroll to read at a deliberate pace — a fast flick still settles
          smoothly thanks to the bumped scrub lerp. */}
      <div
        ref={collapseScrollRef}
        data-reduced-motion={prefersReducedMotion ? 'true' : undefined}
        className="relative"
        style={{
          height: prefersReducedMotion ? '100vh' : '380vh',
          overscrollBehaviorY: 'contain',
        }}
      >
        <div
          className="top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden"
          style={{ position: prefersReducedMotion ? 'static' : 'sticky' }}
        >
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

          {/* Glow aura — sits behind the A glyph, blooms on intro heartbeats */}
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

          {/* Pulse ring — emanates from A on the intro's second heartbeat */}
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

          {/* PSALMS wordmark — the single instance, animated by both the intro
              and the scroll-collapse effect. */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden px-4"
            style={{ zIndex: 4 }}
          >
            <PsalmsWordmarkSvg
              ref={svgRef}
              className="w-[95vw] md:w-[80vw] max-w-4xl"
              style={{
                opacity: introActive ? 1 : 0.45,
                color: introActive ? '#f6f4f0' : 'var(--deep-umber)',
              }}
            />
          </div>

          {/* Expanding warm-sand ring — sits in front of the wordmark during climax.
              Width/height are GSAP-tweened (not scale), so the 1px stroke stays a
              true hairline at every diameter through the climax. */}
          <div
            ref={collapseRingRef}
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              width: '24px',
              height: '24px',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: '1px solid rgba(188, 179, 163, 0.85)',
              opacity: 0,
              willChange: 'opacity, width, height',
              zIndex: 5,
            }}
          />
        </div>
      </div>

      {/* Bridge — pinned three-beat manifesto. Cream stage with text 1 on the
          left, text 2 on the right, text 3 at center; kiss-handoff timing across
          a 300vh pinned scroll range. Mirrors the wordmark-collapse structure:
          outer 300vh + sticky-inner h-screen. Reduced-motion users get a static
          flex column (no pin, all three beats visible at once). */}
      {prefersReducedMotion ? (
        <section
          ref={bridgeRef}
          aria-label="Site introduction"
          className="relative flex flex-col items-center justify-center px-6 py-24 text-center"
          style={{ minHeight: '100vh', backgroundColor: 'var(--paper-cream)' }}
        >
          <div className="flex flex-col items-center">
            <p ref={bridgeInviteRef} className="bridge-line-center">
              {BRIDGE_COPY.invitation}
            </p>
            <p ref={bridgeThesisRef} className="bridge-thesis mt-8 md:mt-12">
              {BRIDGE_COPY.thesis}
            </p>
            <p ref={bridgeAssureRef} className="bridge-line-center mt-8 md:mt-12">
              {BRIDGE_COPY.assurance}
            </p>
          </div>
        </section>
      ) : (
        <div ref={bridgeRef} className="relative" style={{ height: '300vh' }}>
          <section
            aria-label="Site introduction"
            className="overflow-hidden"
            style={{
              position: 'sticky',
              top: 0,
              height: '100vh',
              backgroundColor: 'var(--paper-cream)',
            }}
          >
            <p ref={bridgeInviteRef} className="bridge-beat bridge-beat-left bridge-line-side">
              {BRIDGE_COPY.invitation}
            </p>
            <p ref={bridgeThesisRef} className="bridge-beat bridge-beat-right bridge-thesis">
              {BRIDGE_COPY.thesis}
            </p>
            <p ref={bridgeAssureRef} className="bridge-beat bridge-beat-center bridge-line-center">
              {BRIDGE_COPY.assurance}
            </p>
          </section>
        </div>
      )}

      {/* Hidden SVG defs for the mask clip-path */}
      <HeroMaskClipDef />

      {/* Scroll-animated masked image */}
      <div
        ref={maskScrollRef}
        className="relative"
        style={{
          height: prefersReducedMotion ? '100vh' : '250vh',
          marginTop: '-10vh',
        }}
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
              src="/tropical_jungle.webp"
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
