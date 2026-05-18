import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import gsap from 'gsap';
import { Flip, ScrollTrigger } from 'gsap/all';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterTabs } from '@/components/ui-custom/FilterTabs';
import { categoryLabel } from '@/data/projects';
import type { FilterCategory, Project } from '@/types';

gsap.registerPlugin(Flip, ScrollTrigger);

// Per-image overlay overrides keyed by project id. Falls back to the
// shared category label when no override exists.
const overlayLabelById: Record<string, string> = {
  restoration1: 'Restoration of Peace',
  restoration3: 'Restoration of Hope',
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
// Special case: a lone last item spans the full row (full-bleed).
function computeSpans(n: number): number[] {
  const spans: number[] = [];
  let remaining = n;
  let rowIdx = 0;
  while (remaining > 0) {
    const expected = rowIdx % 2 === 0 ? 3 : 4;
    const take = Math.min(expected, remaining);
    // 12-col grid: 3 items per row → span 4; 4 items per row → span 3.
    // Partial short rows (1 or 2 items) keep the span-3 cell so lone items
    // match the row-of-4 aspect and sit at the left instead of stretching.
    const span = take === 3 ? 4 : 3;
    for (let k = 0; k < take; k++) spans.push(span);
    remaining -= take;
    rowIdx += 1;
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
      className={`pg-img group relative flex-shrink-0 md:min-w-0 w-44 md:w-auto ${heightClass} cursor-pointer overflow-hidden`}
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
            {/* Start-here CTA — anchored bottom-right of the overlay */}
            <span className="absolute bottom-4 right-4 text-[10px] uppercase tracking-[0.2em] text-white/60">
              Start here
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PurposeGridProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
}

export function PurposeGrid({ projects, onProjectClick }: PurposeGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [gridReady, setGridReady] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const watermarkRef = useRef<HTMLSpanElement>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);
  const morphTimelineRef = useRef<gsap.core.Timeline | null>(null);

  // Smooth fade-in for the entire section
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        section,
        { opacity: 0 },
        {
          opacity: 1,
          ease: 'power2.out',
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 90%',
            end: 'top 30%',
            scrub: 5,
            invalidateOnRefresh: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  // Scroll-linked reveal for the filter tabs only. The grid stays fully
  // visible at all times — animating its opacity/transform was interfering
  // with SVG clip-path references on the project cards.
  useEffect(() => {
    const section = sectionRef.current;
    const filters = filterWrapRef.current;
    if (!section || !filters) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        filters,
        { opacity: 0, y: 40, filter: 'blur(8px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          ease: 'power2.out',
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 85%',
            end: 'top 20%',
            scrub: 5,
            invalidateOnRefresh: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  // Scroll-linked reveal for the "Devotions" watermark. Mirrors the
  // filter-row reveal but lands at opacity 0.32 (its resting decorative
  // opacity), with a smaller y offset because it's a quieter element.
  useEffect(() => {
    const section = sectionRef.current;
    const watermark = watermarkRef.current;
    if (!section || !watermark) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        watermark,
        { opacity: 0, y: 20, filter: 'blur(8px)' },
        {
          opacity: 0.32,
          y: 0,
          filter: 'blur(0px)',
          ease: 'power2.out',
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 85%',
            end: 'top 20%',
            scrub: 5,
            invalidateOnRefresh: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

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
  }, []);

  // Reset to the aggregated "all" view when the user scrolls up past the
  // section's bottom edge (section leaves the viewport moving downward).
  // Fires before the pin range engages so it never collides with pinning.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        onLeaveBack: () => setActiveFilter('all'),
      });
    }, section);

    return () => ctx.revert();
  }, []);

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return projects;
    return projects.filter((project) => project.category === activeFilter);
  }, [activeFilter, projects]);

  const spans = useMemo(
    () => computeSpans(filteredProjects.length),
    [filteredProjects.length]
  );

  const handleFilterChange = (next: FilterCategory) => {
    // If the strip→grid morph is mid-flight, snap it to the end so Flip
    // captures a stable grid layout for the reflow below.
    if (morphTimelineRef.current) {
      morphTimelineRef.current.progress(1);
    }
    if (gridRef.current) {
      flipStateRef.current = Flip.getState(
        gridRef.current.querySelectorAll('[data-flip-id]')
      );
    }
    setActiveFilter(next);
  };

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
  }, [filteredProjects]);

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
  }, [filteredProjects]);

  return (
    <section
      ref={sectionRef}
      id="projects"
      className="pt-44 md:pt-64 pb-16 md:pb-24 px-0"
      style={{ background: 'var(--app-bg)', position: 'relative' }}
    >
      <span
        ref={watermarkRef}
        aria-hidden="true"
        className="pg-devotions-watermark"
      >
        Devotions
      </span>

      {/* Filter Tabs */}
      <div ref={filterWrapRef} className="px-4 md:px-8 mb-4 md:mb-6">
        <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} />
      </div>

      {/* Editorial container — data-layout drives strip vs grid mode on md+.
          Mobile always uses the horizontal scrolling strip. */}
      <div
        ref={gridRef}
        data-layout="strip"
        className="relative flex w-full items-end gap-1 px-0 overflow-x-auto md:overflow-visible"
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
    </section>
  );
}
