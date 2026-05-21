import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';
import { extractDominantColor } from '@/utils/extractDominantColor';
import { usePillExpandNavigation } from '@/transitions/usePillExpandNavigation';

gsap.registerPlugin(ScrollTrigger);

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

function useNextProjectColor(nextProject: Project): string {
  const [color, setColor] = useState<string>(nextProject.overlayColor);

  useEffect(() => {
    let cancelled = false;
    extractDominantColor(nextProject.thumbnail).then((c) => {
      if (!cancelled) setColor(c);
    });
    return () => {
      cancelled = true;
    };
  }, [nextProject.thumbnail, nextProject.overlayColor]);

  return color;
}

interface NextDevotionHandoffProps {
  // currentProject is reserved for future use (e.g. analytics, ABT).
  currentProject: Project;
  nextProject: Project;
  nextDevotion: Devotion;
  variant?: 'desktop' | 'mobile';
}

/**
 * Final zone of each devotion's moodboard. Renders a 50/50 split-image
 * composition behind a hero-mask-clipped pill containing the next devotion's
 * meta. On click (Task 7), the pill expands to fullscreen and navigates to
 * the next devotion page.
 */
export function NextDevotionHandoff({
  currentProject,
  nextProject,
  nextDevotion,
  variant = 'desktop',
}: NextDevotionHandoffProps) {
  void currentProject; // reserved for future analytics

  const reducedMotion = useReducedMotion();
  const pillColor = useNextProjectColor(nextProject);
  const rootRef = useRef<HTMLDivElement>(null);
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const pillFillRef = useRef<HTMLDivElement>(null);
  const pillContentRef = useRef<HTMLDivElement>(null);
  useEntranceAnimation({
    rootRef,
    leftImgRef,
    rightImgRef,
    pillFillRef,
    pillContentRef,
    reducedMotion,
  });
  useIdleLoop({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion });
  const { startFromPill } = usePillExpandNavigation();
  const startExpand = () => {
    const pill = pillRef.current;
    if (!pill) return;
    startFromPill({
      pillEl: pill,
      pillColor,
      targetUrl: `/purpose/${nextProject.id}`,
      reducedMotion,
    });
  };

  const layoutProps: LayoutProps = {
    nextProject,
    nextDevotion,
    rootRef,
    leftImgRef,
    rightImgRef,
    pillRef,
    pillFillRef,
    pillContentRef,
    onActivate: startExpand,
    pillColor,
  };

  return variant === 'mobile' ? (
    <MobileLayout {...layoutProps} />
  ) : (
    <DesktopLayout {...layoutProps} />
  );
}

interface LayoutProps {
  nextProject: Project;
  nextDevotion: Devotion;
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillRef: React.RefObject<HTMLDivElement | null>;
  pillFillRef: React.RefObject<HTMLDivElement | null>;
  pillContentRef: React.RefObject<HTMLDivElement | null>;
  onActivate: () => void;
  pillColor: string;
}

function DesktopLayout({
  nextProject,
  nextDevotion,
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  onActivate,
  pillColor,
}: LayoutProps) {
  return (
    <section
      ref={rootRef}
      onClick={onActivate}
      className="next-handoff relative flex-shrink-0 h-screen overflow-hidden cursor-pointer"
      style={{ width: '100vw', backgroundColor: pillColor }}
    >
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          <img
            ref={leftImgRef}
            src={nextProject.thumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="relative overflow-hidden">
          <img
            ref={rightImgRef}
            src={nextDevotion.firstMoodboardImage}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />

      <Pill
        pillRef={pillRef}
        pillFillRef={pillFillRef}
        pillContentRef={pillContentRef}
        nextProject={nextProject}
        nextDevotion={nextDevotion}
        variant="desktop"
        onActivate={onActivate}
        pillColor={pillColor}
      />
    </section>
  );
}

function MobileLayout({
  nextProject,
  nextDevotion,
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  onActivate,
  pillColor,
}: LayoutProps) {
  return (
    <section
      ref={rootRef}
      onClick={onActivate}
      className="next-handoff relative w-full h-screen overflow-hidden cursor-pointer"
      style={{ backgroundColor: pillColor }}
    >
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          <img
            ref={leftImgRef}
            src={nextProject.thumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="relative overflow-hidden">
          <img
            ref={rightImgRef}
            src={nextDevotion.firstMoodboardImage}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />

      <Pill
        pillRef={pillRef}
        pillFillRef={pillFillRef}
        pillContentRef={pillContentRef}
        nextProject={nextProject}
        nextDevotion={nextDevotion}
        variant="mobile"
        onActivate={onActivate}
        pillColor={pillColor}
      />
    </section>
  );
}

interface PillProps {
  nextProject: Project;
  nextDevotion: Devotion;
  variant: 'desktop' | 'mobile';
  pillRef?: React.RefObject<HTMLDivElement | null>;
  pillFillRef?: React.RefObject<HTMLDivElement | null>;
  pillContentRef?: React.RefObject<HTMLDivElement | null>;
  onActivate?: () => void;
  pillColor: string;
}

function Pill({
  nextProject: _nextProject,
  nextDevotion,
  variant,
  pillRef,
  pillFillRef,
  pillContentRef,
  onActivate,
  pillColor,
}: PillProps) {
  void _nextProject;
  const isMobile = variant === 'mobile';

  // Outer pill — owns sizing, clipPath, centering, click affordance.
  // No background or shadow of its own; the inner fill carries those so the
  // pill is invisible until the entrance fills it from the center outward.
  const pillStyle: React.CSSProperties = {
    clipPath: 'url(#hero-mask-clip)',
    width: isMobile ? '92%' : 'min(62vw, 920px)',
    aspectRatio: '11 / 3.2',
    transform: 'translate(-50%, -50%)',
  };

  // Inner fill — colored layer that GSAP scaleX's from 0 to 1.
  const fillStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundColor: pillColor,
    boxShadow: '0 25px 50px -20px rgba(0,0,0,0.55)',
    transform: 'scaleX(0)',
    transformOrigin: '50% 50%',
  };

  // Inner content — three-column grid; fades in late.
  const contentStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    padding: isMobile ? '0 14%' : '0 10%',
    fontFamily: '"Cormorant Garamond", Georgia, serif',
    color: '#fff',
    opacity: 0,
  };

  return (
    <div
      ref={pillRef}
      className="next-handoff-pill absolute left-1/2 top-1/2 cursor-pointer"
      style={pillStyle}
      role={onActivate ? 'link' : undefined}
      aria-label={onActivate ? `Next devotion: ${nextDevotion.title}` : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
    >
      <div ref={pillFillRef} className="next-handoff-pill-fill" style={fillStyle} />
      <div ref={pillContentRef} className="next-handoff-pill-content" style={contentStyle}>
        {/* Left column: label + title */}
        <div className="flex flex-col gap-1 text-left">
          <span
            className="next-handoff-label"
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Next Devotion
          </span>
          <span
            className="next-handoff-title"
            style={{
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: isMobile ? '12px' : '28px',
              lineHeight: 1,
              color: 'rgba(255,255,255,0.95)',
            }}
          >
            {nextDevotion.title}
          </span>
        </div>

        {/* Center column: logo watermark — nudged down to visually center
            in the pill's main body (the clipPath has a notch at the top). */}
        <img
          src="/logo-icon.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={`next-handoff-logo opacity-25 invert pointer-events-none ${isMobile ? 'w-5' : 'w-10'}`}
          style={{ transform: isMobile ? 'translateY(12px)' : 'translateY(22px)' }}
        />

        {/* Right column: category + scripture */}
        <div className="flex flex-col gap-1 text-right">
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {nextDevotion.label.replace(/^(The )?(Restoration of |Serenity of )/, '')}
          </span>
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            {nextDevotion.scriptureRef} <span aria-hidden="true">↗</span>
          </span>
        </div>
      </div>
    </div>
  );
}

interface EntranceArgs {
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillFillRef: React.RefObject<HTMLDivElement | null>;
  pillContentRef: React.RefObject<HTMLDivElement | null>;
}

function useEntranceAnimation({
  rootRef,
  leftImgRef,
  rightImgRef,
  pillFillRef,
  pillContentRef,
  reducedMotion,
}: EntranceArgs & { reducedMotion: boolean }) {
  useEffect(() => {
    const root = rootRef.current;
    const left = leftImgRef.current;
    const right = rightImgRef.current;
    const fill = pillFillRef.current;
    const content = pillContentRef.current;
    if (!root || !left || !right || !fill || !content) return;

    if (reducedMotion) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });
      tl.set([left, right], { yPercent: 0 });
      tl.set(fill, { scaleX: 1, transformOrigin: '50% 50%' });
      tl.set(content, { opacity: 1 });
      tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
      return () => {
        tl.kill();
      };
    }

    // The moodboard's main horizontal scroll tween lives at id 'moodboard-pin'.
    // It's created in MoodBoard's useEffect, which fires AFTER this component's
    // child useEffects. Defer to the next frame so the parent has registered it.
    let ctx: gsap.Context | null = null;
    const rafId = requestAnimationFrame(() => {
      const mainTrigger = ScrollTrigger.getById('moodboard-pin');
      const containerAnimation = mainTrigger?.animation;
      if (!containerAnimation) {
        // No horizontal-scroll container available — happens on mobile (no
        // horizontal pin) and during the race-condition window where MoodBoard
        // hasn't registered its trigger yet. Snap to the visible resting
        // state so nothing is stuck off-screen or invisible.
        gsap.set([left, right], { yPercent: 0 });
        gsap.set(fill, { scaleX: 1, transformOrigin: '50% 50%' });
        gsap.set(content, { opacity: 1 });
        return;
      }

      ctx = gsap.context(() => {
        // Seed off-screen start state via GSAP so it owns the transform matrix
        // outright — avoids composition with the idle Ken Burns tween.
        gsap.set(left, { yPercent: -100 });
        gsap.set(right, { yPercent: 100 });
        gsap.set(fill, { scaleX: 0, transformOrigin: '50% 50%' });
        gsap.set(content, { opacity: 0 });

        // Slide-in entrance — fires when the zone is ~70% visible.
        const actOne = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            containerAnimation,
            start: 'left 30%',
            end: 'left -10%',
            toggleActions: 'play none none reverse',
          },
        });

        actOne
          .fromTo(
            left,
            { yPercent: -100 },
            { yPercent: 0, duration: 1.0, ease: 'power3.out' },
            0,
          )
          .fromTo(
            right,
            { yPercent: 100 },
            { yPercent: 0, duration: 1.0, ease: 'power3.out' },
            0,
          )
          .fromTo(
            fill,
            { scaleX: 0, transformOrigin: '50% 50%' },
            { scaleX: 1, transformOrigin: '50% 50%', duration: 1.0, ease: 'power3.out' },
            0,
          )
          .to(content, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.6);
      }, root);
    });

    return () => {
      cancelAnimationFrame(rafId);
      ctx?.revert();
    };
  }, [
    rootRef,
    leftImgRef,
    rightImgRef,
    pillFillRef,
    pillContentRef,
    reducedMotion,
  ]);
}

function useIdleLoop({
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  reducedMotion,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillRef: React.RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}) {
  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const left = leftImgRef.current;
    const right = rightImgRef.current;
    const pill = pillRef.current;
    if (!root || !left || !right || !pill) return;

    const ctx = gsap.context(() => {
      // Pill stays static after entrance — no breathing loop. Ken Burns
      // drift on the two background images carries the residual sense of
      // motion. (`pill` is intentionally unused here.)
      void pill;

      // Ken Burns drift — each image breathes and drifts outward slowly.
      gsap.to(left, {
        scale: 1.05,
        x: -10,
        duration: 12,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
      gsap.to(right, {
        scale: 1.05,
        x: 10,
        duration: 12,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    }, root);

    return () => ctx.revert();
  }, [rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion]);
}

