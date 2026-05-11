import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';

gsap.registerPlugin(ScrollTrigger);

interface HeroProps {
  introActive?: boolean;
  onIntroComplete?: () => void;
}

export function Hero({ introActive = false, onIntroComplete }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [showNav, setShowNav] = useState<boolean>(!introActive);
  const svgRef = useRef<SVGSVGElement>(null);
  const darkCanvasRef = useRef<HTMLDivElement>(null);
  const glowAuraRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  // setShowNav and onIntroComplete are used by the intro timeline in Task 7;
  // referenced here so TypeScript's noUnusedLocals does not flag them.
  void setShowNav;
  void onIntroComplete;
  const quoteRef = useRef<HTMLDivElement>(null);
  const quoteLine1Ref = useRef<HTMLParagraphElement>(null);
  const quoteLine2Ref = useRef<HTMLParagraphElement>(null);
  const quoteAttrRef = useRef<HTMLParagraphElement>(null);

  // Mask scroll-expand refs
  const maskScrollRef = useRef<HTMLDivElement>(null);
  const maskClipRef = useRef<HTMLDivElement>(null);
  const maskImgRef = useRef<HTMLImageElement>(null);
  const maskVideoRef = useRef<HTMLVideoElement>(null);

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
