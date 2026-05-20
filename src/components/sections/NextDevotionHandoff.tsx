import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';

gsap.registerPlugin(ScrollTrigger);

interface NextDevotionHandoffProps {
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
  currentProject: _currentProject,
  nextProject,
  nextDevotion,
  variant = 'desktop',
}: NextDevotionHandoffProps) {
  // currentProject is reserved for future use (e.g. analytics, ABT).
  // Underscore prefix silences the unused-arg lint.

  if (variant === 'mobile') {
    return <MobileLayout nextProject={nextProject} nextDevotion={nextDevotion} />;
  }
  return <DesktopLayout nextProject={nextProject} nextDevotion={nextDevotion} />;
}

interface LayoutProps {
  nextProject: Project;
  nextDevotion: Devotion;
}

function DesktopLayout({ nextProject, nextDevotion }: LayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef });

  return (
    <section
      ref={rootRef}
      className="next-handoff relative flex-shrink-0 h-screen overflow-hidden"
      style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}
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
            style={{ clipPath: 'inset(0 100% 0 0)' }}
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
            style={{ clipPath: 'inset(0 0 0 100%)' }}
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
        nextProject={nextProject}
        nextDevotion={nextDevotion}
        variant="desktop"
      />
    </section>
  );
}

function MobileLayout({ nextProject, nextDevotion }: LayoutProps) {
  return (
    <section
      className="next-handoff relative w-full overflow-hidden"
      style={{ minHeight: '100vh', backgroundColor: nextProject.overlayColor }}
    >
      {/* Two vertical columns */}
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          <img
            src={nextProject.thumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="next-handoff-img-left absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="relative overflow-hidden">
          <img
            src={nextDevotion.firstMoodboardImage}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="next-handoff-img-right absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />

      <Pill nextProject={nextProject} nextDevotion={nextDevotion} variant="mobile" />
    </section>
  );
}

interface PillProps extends LayoutProps {
  variant: 'desktop' | 'mobile';
  pillRef?: React.RefObject<HTMLDivElement | null>;
}

function Pill({ nextProject, nextDevotion, variant, pillRef }: PillProps) {
  const isMobile = variant === 'mobile';
  const pillStyle: React.CSSProperties = {
    backgroundColor: nextProject.overlayColor,
    clipPath: 'url(#hero-mask-clip)',
    width: isMobile ? '92%' : 'min(62vw, 920px)',
    aspectRatio: '11 / 3.2',
    boxShadow: '0 25px 50px -20px rgba(0,0,0,0.55)',
    opacity: 0,
    transform: 'translate(-50%, calc(-50% + 40px)) scale(0.96)',
  };

  return (
    <div
      ref={pillRef}
      className="next-handoff-pill absolute left-1/2 top-1/2 cursor-pointer"
      style={pillStyle}
    >
      <div
        className="absolute inset-0 grid items-center text-white"
        style={{
          gridTemplateColumns: '1fr auto 1fr',
          padding: isMobile ? '0 14%' : '0 10%',
          fontFamily: '"Cormorant Garamond", Georgia, serif',
        }}
      >
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

        {/* Center column: monogram */}
        <div
          className="next-handoff-monogram"
          style={{
            fontFamily: 'ui-sans-serif, system-ui',
            fontSize: isMobile ? '11px' : '22px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          {nextDevotion.monogram}
        </div>

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
  pillRef: React.RefObject<HTMLDivElement | null>;
}

function useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef }: EntranceArgs) {
  useEffect(() => {
    const root = rootRef.current;
    const left = leftImgRef.current;
    const right = rightImgRef.current;
    const pill = pillRef.current;
    if (!root || !left || !right || !pill) return;

    // The moodboard's main horizontal scroll tween lives at id 'moodboard-pin'.
    // It's created in MoodBoard's useEffect, which fires AFTER this component's
    // child useEffects. Defer to the next frame so the parent has registered it.
    let ctx: gsap.Context | null = null;
    const rafId = requestAnimationFrame(() => {
      const mainTrigger = ScrollTrigger.getById('moodboard-pin');
      const containerAnimation = mainTrigger?.animation;
      if (!containerAnimation) return; // graceful no-op; entrance just won't play

      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            containerAnimation,
            start: 'left 90%',
            end: 'left 30%',
            toggleActions: 'play none none reverse',
          },
        });

        tl.to(left, { clipPath: 'inset(0 0 0 0)', duration: 0.8, ease: 'power3.out' }, 0)
          .fromTo(left, { y: 24 }, { y: 0, duration: 0.8, ease: 'power3.out' }, 0)
          .to(right, { clipPath: 'inset(0 0 0 0)', duration: 0.8, ease: 'power3.out' }, 0)
          .fromTo(right, { y: 24 }, { y: 0, duration: 0.8, ease: 'power3.out' }, 0)
          .to(
            pill,
            {
              opacity: 1,
              transform: 'translate(-50%, -50%) scale(1)',
              duration: 0.6,
              ease: 'power3.out',
            },
            0.5,
          );
      }, root);
    });

    return () => {
      cancelAnimationFrame(rafId);
      ctx?.revert();
    };
  }, [rootRef, leftImgRef, rightImgRef, pillRef]);
}
