import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';
import { extractDominantColor } from '@/utils/extractDominantColor';
import { usePillExpandNavigation } from '@/transitions/usePillExpandNavigation';
import { useRouteTransitionContext } from '@/transitions/RouteTransitionContext';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { decideHandoffEntrance } from './next-handoff-entrance-plan';
import { actOneKeyframes, actTwoKeyframes, shouldAutoNavigate } from './next-handoff-keyframes';
import { applyKeyframes } from './motion-keyframes';

gsap.registerPlugin(ScrollTrigger);

/**
 * Returns the title unchanged when no curated break is configured, or a
 * two-segment tuple [before, after] when a 1-indexed word boundary is given.
 *
 * Used by the mobile Pill branch to render `<>{a}<br/>{b}</>`. Desktop never
 * calls this — it always renders the title as a single span.
 *
 * Exported for unit-testing in NextDevotionHandoff.test.tsx.
 */
export function applyCuratedBreak(
  title: string,
  breakAfter: number | undefined,
): string | [string, string] {
  if (!breakAfter || breakAfter <= 0) return title;
  const words = title.split(' ');
  if (breakAfter >= words.length) return title;
  return [
    words.slice(0, breakAfter).join(' '),
    words.slice(breakAfter).join(' '),
  ];
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
  // When true (desktop only), the handoff renders as the final panel inside
  // the moodboard horizontal track. Skips its own pin + entrance/exit
  // choreography and auto-nav — user reaches it by horizontal scroll like
  // every other zone.
  inHorizontalTrack?: boolean;
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
  inHorizontalTrack = false,
}: NextDevotionHandoffProps) {
  void currentProject; // reserved for future analytics

  const reducedMotion = usePrefersReducedMotion();
  const pillColor = useNextProjectColor(nextProject);
  const rootRef = useRef<HTMLDivElement>(null);
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const pillFillRef = useRef<HTMLDivElement>(null);
  const pillContentRef = useRef<HTMLDivElement>(null);
  const navigatedRef = useRef(false);

  useEntranceAnimation({
    rootRef,
    leftImgRef,
    rightImgRef,
    pillRef,
    pillFillRef,
    pillContentRef,
    navigatedRef,
    nextProject,
    reducedMotion,
    variant,
    inHorizontalTrack,
  });
  useIdleLoop({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion });

  const { startFromPill } = usePillExpandNavigation();
  const routeTransition = useRouteTransitionContext();
  const startExpand = () => {
    if (navigatedRef.current) return;
    const targetUrl = `/purpose/${nextProject.id}`;
    // Mobile fires the same SplitTransition curtain the home grid uses; desktop
    // keeps the cinematic pill-expand morph.
    if (variant === 'mobile' && routeTransition) {
      navigatedRef.current = true;
      routeTransition.beginCurtainNavigation(targetUrl, pillColor);
      return;
    }
    const pill = pillRef.current;
    if (!pill) return;
    navigatedRef.current = true;
    startFromPill({ pillEl: pill, pillColor, targetUrl, reducedMotion });
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
    inHorizontalTrack,
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
  inHorizontalTrack: boolean;
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
  inHorizontalTrack,
}: LayoutProps) {
  // Inside the moodboard horizontal track, the section must behave like every
  // other zone: non-shrinking 100vw flex item. Standalone (legacy / non-custom
  // devotion) keeps the original w-full sizing.
  const sectionClassName = inHorizontalTrack
    ? 'next-handoff relative flex-shrink-0 h-screen overflow-hidden cursor-pointer'
    : 'next-handoff relative w-full h-screen overflow-hidden cursor-pointer';
  const sectionStyle: React.CSSProperties = inHorizontalTrack
    ? { width: '100vw', backgroundColor: pillColor }
    : { backgroundColor: pillColor };

  return (
    <section
      ref={rootRef}
      onClick={onActivate}
      className={sectionClassName}
      style={sectionStyle}
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
  inHorizontalTrack: _inHorizontalTrack,
}: LayoutProps) {
  void _inHorizontalTrack; // mobile has no horizontal track; flag is ignored
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

  const titleNode = (() => {
    if (!isMobile) return nextDevotion.title;
    const segments = applyCuratedBreak(nextDevotion.title, nextDevotion.mobileTitleBreak);
    if (typeof segments === 'string') return segments;
    return (
      <>
        <span>{segments[0]}</span>
        <br />
        <span>{segments[1]}</span>
      </>
    );
  })();

  const shrinkOnMobile = isMobile && nextDevotion.mobileTitleScale === 'shrink';

  // Outer pill — owns sizing, clipPath, centering, click affordance.
  // No background or shadow of its own; the inner fill carries those so the
  // pill is invisible until the entrance fills it from the center outward.
  const pillStyle: React.CSSProperties = {
    clipPath: 'url(#hero-mask-clip)',
    width: isMobile ? '92%' : 'min(62vw, 920px)',
    aspectRatio: isMobile ? '11 / 4' : '11 / 3.2',
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
    padding: isMobile ? '0 10%' : '0 10%',
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
              fontSize: isMobile ? '9px' : '10px',
              letterSpacing: isMobile ? '0.22em' : '0.25em',
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
              fontSize: isMobile ? (shrinkOnMobile ? '17px' : '21px') : '28px',
              lineHeight: isMobile ? 1.1 : 1,
              color: 'rgba(255,255,255,0.95)',
            }}
          >
            {titleNode}
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
          className={`next-handoff-logo opacity-25 invert pointer-events-none ${isMobile ? 'w-[19px]' : 'w-10'}`}
          style={{ transform: isMobile ? 'translateY(14px)' : 'translateY(22px)' }}
        />

        {/* Right column: category + scripture */}
        <div className="flex flex-col gap-1 text-right">
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '9px' : '10px',
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
              fontSize: isMobile ? '9px' : '10px',
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
  pillRef: React.RefObject<HTMLDivElement | null>;
  pillFillRef: React.RefObject<HTMLDivElement | null>;
  pillContentRef: React.RefObject<HTMLDivElement | null>;
  navigatedRef: React.RefObject<boolean>;
  nextProject: Project;
}

function useEntranceAnimation({
  rootRef,
  leftImgRef,
  rightImgRef,
  pillRef,
  pillFillRef,
  pillContentRef,
  navigatedRef,
  nextProject,
  reducedMotion,
  variant,
  inHorizontalTrack,
}: EntranceArgs & {
  reducedMotion: boolean;
  variant: 'desktop' | 'mobile';
  inHorizontalTrack: boolean;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const root = rootRef.current;
    const left = leftImgRef.current;
    const right = rightImgRef.current;
    const pill = pillRef.current;
    const fill = pillFillRef.current;
    const content = pillContentRef.current;
    if (!root || !left || !right || !pill || !fill || !content) return;

    const plan = decideHandoffEntrance({ reducedMotion, variant, inHorizontalTrack });

    // 'snap' collapses original branches A (in-track desktop) and C (mobile):
    // both present the pill in its resting state with no choreography. In-track
    // desktop is the final panel reached by horizontal scroll (pill click is the
    // only way forward); mobile renders without a horizontal pin. The idle Ken
    // Burns loop keeps the background images alive.
    if (plan === 'snap') {
      gsap.set([left, right], { yPercent: 0 });
      gsap.set(fill, { scaleX: 1, transformOrigin: '50% 50%' });
      gsap.set(content, { opacity: 1 });
      return;
    }

    if (plan === 'reducedFade') {
      // Snap to final state; fade the whole section once when it enters.
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

    // plan === 'fullMotion'
    const ctx = gsap.context(() => {
      // Seed off-screen state. GSAP owns the transform matrix outright so it
      // doesn't get composed with the idle Ken Burns tween's translate3d.
      gsap.set(left, { yPercent: -100 });
      gsap.set(right, { yPercent: 100 });
      gsap.set(fill, { scaleX: 0, transformOrigin: '50% 50%' });
      gsap.set(content, { opacity: 0 });

      // Pin the section while Act 2 scrubs. `+=120%` of viewport gives Act 2
      // enough scroll distance to read clearly without dragging.
      const pinTrigger = ScrollTrigger.create({
        id: 'next-handoff-pin',
        trigger: root,
        start: 'top top',
        end: '+=120%',
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
      });

      const targets = { left, right, fill, content };

      // ACT 1: scrubbed entrance, plays as the section scrolls toward the pin.
      // From 'top 70%' (section 30% visible) to 'top top' (pin engages).
      const actOne = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top 70%',
          end: 'top top',
          scrub: 1,
        },
      });
      applyKeyframes(actOne, actOneKeyframes(), targets);

      // ACT 2: scrubbed exit + re-enter + navigate, runs while pinned.
      const actTwo = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: '+=120%',
          scrub: 1,
          onUpdate: (self) => {
            if (shouldAutoNavigate(self.progress, navigatedRef.current)) {
              navigatedRef.current = true;
              navigate(`/purpose/${nextProject.id}`);
            }
          },
        },
      });
      applyKeyframes(actTwo, actTwoKeyframes(), targets);
      // Inert timeline padding (no named target) — kept verbatim for fidelity.
      actTwo.to({}, { duration: 0.2 }, 0.4);

      void pinTrigger;
    }, root);

    return () => {
      ctx.revert();
    };
  }, [
    rootRef,
    leftImgRef,
    rightImgRef,
    pillRef,
    pillFillRef,
    pillContentRef,
    navigatedRef,
    nextProject,
    reducedMotion,
    variant,
    inHorizontalTrack,
    navigate,
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
