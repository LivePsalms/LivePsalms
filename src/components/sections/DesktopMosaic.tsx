import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import gsap from 'gsap';
import { Flip, ScrollTrigger } from 'gsap/all';
import { motion, AnimatePresence } from 'framer-motion';
import { categoryLabel } from '@/data/projects';
import type { Project } from '@/types';

gsap.registerPlugin(Flip, ScrollTrigger);

// Per-image overlay overrides keyed by project id. Falls back to the
// shared category label when no override exists.
const overlayLabelById: Record<string, string> = {
  peace: 'Restoration of Peace',
  hope: 'Restoration of Hope',
  strength: 'Restoration of Strength',
  wholeness: 'Restoration of Wholeness',
  purpose: 'Restoration of Purpose',
  connection: 'Restoration of Connection',
  identity: 'Restoration of Identity',
  joy: 'Restoration of Joy',
  forgiveness: 'Serenity of Forgiveness',
  surrender: 'Serenity of Surrender',
  trust: 'Serenity of Trust',
};

// Row pattern: strict 3/4/3/4…; the final row truncates to whatever items
// remain. Returns each item's grid-column span count against a 12-col grid.
// When a planned final row is a lone item AND the previous row holds exactly
// three items, the lone item is folded into the previous row so it ends as a
// clean row of four (span-3 each) — avoiding the awkward orphan on its own row.
function computeSpans(n: number): number[] {
  const rows: number[] = [];
  let remaining = n;
  let rowIdx = 0;
  while (remaining > 0) {
    const expected = rowIdx % 2 === 0 ? 3 : 4;
    const take = Math.min(expected, remaining);
    rows.push(take);
    remaining -= take;
    rowIdx += 1;
  }

  // Fold an orphan last item into the previous row when that row has 3 items.
  // Result: 3 → 4 items in the previous row (still 12-col safe).
  if (rows.length >= 2 && rows[rows.length - 1] === 1 && rows[rows.length - 2] === 3) {
    rows[rows.length - 2] = 4;
    rows.pop();
  }

  const spans: number[] = [];
  for (const count of rows) {
    // 12-col grid: 3 items per row → span 4; 4 items per row → span 3.
    // Partial short rows (1 or 2 items) keep the span-3 cell so lone items
    // match the row-of-4 aspect and sit at the left instead of stretching.
    const span = count === 3 ? 4 : 3;
    for (let k = 0; k < count; k++) spans.push(span);
  }
  return spans;
}

function ProjectCard({
  project,
  span,
  heightClass,
  onProjectClick,
  hoverEnabled,
}: {
  project: Project;
  span: number;
  heightClass: string;
  onProjectClick: (project: Project) => void;
  hoverEnabled: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Force-clear hover state if the grid leaves its ready layout mid-hover
  // (e.g. user scrolls back up and the morph reverses while cursor is over).
  useEffect(() => {
    if (!hoverEnabled && isHovered) setIsHovered(false);
  }, [hoverEnabled, isHovered]);

  return (
    <div
      data-flip-id={project.id}
      data-span={span}
      onClick={() => onProjectClick(project)}
      onMouseEnter={() => hoverEnabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`pg-img group relative flex-shrink-0 md:min-w-0 w-44 md:w-auto ${heightClass} snap-center md:snap-align-none cursor-pointer overflow-hidden`}
      style={{ borderRadius: '2px' }}
    >
      <img
        src={project.thumbnail}
        alt={project.name}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Split overlay — left half slides in from left */}
      <motion.div
        className="pg-hover-overlay absolute top-0 left-0 w-1/2 h-full backdrop-blur-sm"
        style={{ backgroundColor: project.overlayColor }}
        initial={{ x: '-100%' }}
        animate={{ x: isHovered ? 0 : '-100%' }}
        transition={{ duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] }}
      />

      {/* Split overlay — right half slides in from right */}
      <motion.div
        className="pg-hover-overlay absolute top-0 right-0 w-1/2 h-full backdrop-blur-sm"
        style={{ backgroundColor: project.overlayColor }}
        initial={{ x: '100%' }}
        animate={{ x: isHovered ? 0 : '100%' }}
        transition={{ duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] }}
      />

      {/* Content — fades in after panels meet */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="pg-hover-overlay absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            {/* Logo watermark */}
            <img
              src="/logo-icon.png"
              alt=""
              className="w-6 md:w-8 opacity-25 invert mb-3"
            />
            {/* Category label */}
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
              {overlayLabelById[project.id] ?? categoryLabel[project.category]}
            </span>
            {/* Start-here CTA — anchored bottom-right of the overlay,
                italic serif voice + subtle vertical bounce to draw the eye. */}
            <motion.span
              className="absolute bottom-8 right-4 text-lg italic text-white/80"
              style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 300 }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              Start here
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface DesktopMosaicProps {
  sectionRef: React.RefObject<HTMLElement>;
  filteredProjects: Project[];
  flipStateRef: React.MutableRefObject<Flip.FlipState | null>;
  onProjectClick: (project: Project) => void;
}

export function DesktopMosaic({
  sectionRef,
  filteredProjects,
  flipStateRef,
  onProjectClick,
}: DesktopMosaicProps) {
  const [gridReady, setGridReady] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const morphTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const spans = useMemo(
    () => computeSpans(filteredProjects.length),
    [filteredProjects.length]
  );

  // Scroll-linked come-in for the whole image strip, matching the Hero
  // quote's feel (opacity + y + blur, scrub 3). Applied to the grid
  // container so its transform sits OUTSIDE Flip's per-item transforms
  // and the two don't fight during the pinned strip→grid morph. Runs
  // as a useEffect so it fires AFTER the pin's useLayoutEffect has
  // captured Flip state on a clean (untransformed) DOM.
  useEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        grid,
        { opacity: 0, y: 40, filter: 'blur(10px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          ease: 'power2.out',
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 95%',
            end: 'top 10%',
            scrub: 3,
            invalidateOnRefresh: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, [sectionRef]);

  // Strip → grid auto-playing morph.
  //
  // When the section scrolls into view the Flip animation plays through
  // automatically with a smooth ease (not tied to scroll position).
  // Scrolling back up reverses the animation.
  //
  // Rebuilt whenever filteredProjects changes so each filter's items are
  // measured fresh. Declared BEFORE the filter-reflow effect below so that
  // the container ends this effect in grid layout — the state the filter
  // reflow expects.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      // Skip morph and pin: land directly in the editorial grid.
      grid.dataset.layout = 'grid';
      setGridReady(true);
      return;
    }

    // Defensive reset: clear any leftover inline positioning from a prior
    // Strict-Mode effect run (Flip's absolute: true leaves items position:
    // absolute which skews measurements on the next run).
    const items = Array.from(
      grid.querySelectorAll<HTMLElement>('[data-flip-id]')
    );
    if (items.length === 0) return;
    for (const el of items) {
      el.style.position = '';
      el.style.top = '';
      el.style.left = '';
      el.style.width = '';
      el.style.height = '';
      el.style.transform = '';
    }
    grid.style.minHeight = '';

    const ctx = gsap.context(() => {
      // Capture horizontal-strip positions as the timeline's starting frame.
      grid.dataset.layout = 'strip';
      // Force a synchronous reflow so strip rules apply before measurement.
      void grid.offsetHeight;
      const state = Flip.getState(items);

      // Switch to the final editorial grid layout. Items stay in flow so
      // the container's natural height is the grid height throughout —
      // no min-height hack needed.
      grid.dataset.layout = 'grid';
      void grid.offsetHeight;

      // Flip.from returns a timeline that tweens FROM captured (strip)
      // positions TO current (grid) positions. Paused initially, played
      // automatically when the section enters the viewport.
      //
      // NOTE: we intentionally DO NOT use absolute: true. Flip's absolute
      // mode takes items out of flow via position: absolute, which collapses
      // the display: grid container to 0 height. Without absolute, Flip
      // uses transforms (translate + scale) which animate cleanly.
      let hoverDelayId: ReturnType<typeof gsap.delayedCall> | null = null;

      const tl = Flip.from(state, {
        duration: 1.2,
        ease: 'power2.inOut',
        paused: true,
      });
      morphTimelineRef.current = tl;

      // Trigger when 80% of the first row of strip items is visible.
      // Use the first item as trigger — its bottom + 80% of its height.
      //
      // Hover activation is delayed by the morph duration to guarantee
      // the visual transition finishes first (GSAP's onComplete can
      // fire early in React Strict-Mode dev builds where the Flip
      // timeline ends up with near-zero effective duration).
      const firstItem = items[0];
      ScrollTrigger.create({
        trigger: firstItem,
        start: 'bottom bottom',
        invalidateOnRefresh: true,
        onEnter: () => {
          tl.play();
          hoverDelayId = gsap.delayedCall(1.3, () => setGridReady(true));
        },
        onLeaveBack: () => {
          if (hoverDelayId) { hoverDelayId.kill(); hoverDelayId = null; }
          setGridReady(false);
          tl.reverse();
        },
      });
    }, section);

    return () => {
      ctx.revert();
      grid.style.minHeight = '';
      // Strip any inline positioning Flip left behind so the next effect
      // run can measure a clean strip/grid layout.
      for (const el of items) {
        el.style.position = '';
        el.style.top = '';
        el.style.left = '';
        el.style.width = '';
        el.style.height = '';
        el.style.transform = '';
      }
      morphTimelineRef.current = null;
    };
  }, [filteredProjects, sectionRef]);

  // Pre-capture Flip state BEFORE the filteredProjects list changes so the
  // filter-reflow effect below has a stable "from" snapshot to tween from.
  // Mirrors the original PurposeGrid.handleFilterChange behavior, which
  // captured state synchronously at click time. This effect runs BEFORE the
  // filter-reflow useLayoutEffect (declaration order = run order in React),
  // so when the reflow effect reads flipStateRef.current it sees the
  // snapshot from the PREVIOUS render — exactly the original semantics.
  //
  // Note: the original handleFilterChange also called
  // morphTimelineRef.current?.progress(1) before capture. We omit that
  // here because morphTimelineRef lives inside DesktopMosaic and the
  // filter-reflow Flip naturally captures whatever transform state the
  // in-flight morph has applied. The behavior on rapid mid-morph filter
  // switches is documented as acceptable in the refactor plan.
  const prevFilteredRef = useRef<Project[]>(filteredProjects);
  useLayoutEffect(() => {
    if (prevFilteredRef.current !== filteredProjects && gridRef.current) {
      flipStateRef.current = Flip.getState(
        prevFilteredRef.current.length > 0
          ? gridRef.current.querySelectorAll('[data-flip-id]')
          : []
      );
    }
    prevFilteredRef.current = filteredProjects;
  }, [filteredProjects, flipStateRef]);

  // Filter reflow (grid → grid). Tweens items between the previous grid
  // layout and the new one when the user picks a different category.
  useLayoutEffect(() => {
    if (!flipStateRef.current || !gridRef.current) return;
    const tl = Flip.from(flipStateRef.current, {
      duration: 0.6,
      ease: 'power2.inOut',
      absolute: true,
      stagger: 0.02,
      onEnter: (elements) =>
        gsap.fromTo(elements, { opacity: 0 }, { opacity: 1, duration: 0.4 }),
      onLeave: (elements) =>
        gsap.to(elements, { opacity: 0, duration: 0.3 }),
    });
    flipStateRef.current = null;
    return () => {
      tl.kill();
    };
  }, [filteredProjects, flipStateRef]);

  return (
    // Editorial container — data-layout drives strip vs grid mode on md+.
    // Mobile always uses the horizontal scrolling strip.
    <div
      ref={gridRef}
      data-layout="strip"
      className="relative flex w-full items-end gap-1 px-0 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none"
      style={{ background: 'var(--app-bg)' }}
    >
      {filteredProjects.map((project, index) => {
        // Slightly varied strip heights so the top edge breathes like the
        // reference. Only apply in strip mode — grid mode uses CSS
        // aspect-ratio rules keyed off data-span (see index.css).
        const heightCycle = [
          'h-64 md:h-[22rem]',
          'h-72 md:h-[24rem]',
          'h-60 md:h-[20rem]',
          'h-[17rem] md:h-[23rem]',
          'h-72 md:h-[25rem]',
          'h-64 md:h-[21rem]',
          'h-[17rem] md:h-[22.5rem]',
          'h-72 md:h-[24rem]',
        ];
        const h = heightCycle[index % heightCycle.length];
        const span = spans[index] ?? 3;
        return (
          <ProjectCard
            key={project.id}
            project={project}
            span={span}
            heightClass={h}
            onProjectClick={onProjectClick}
            hoverEnabled={gridReady}
          />
        );
      })}
    </div>
  );
}
