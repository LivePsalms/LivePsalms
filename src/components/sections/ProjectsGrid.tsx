import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import gsap from 'gsap';
import { Flip, ScrollTrigger } from 'gsap/all';
import { projects } from '@/data/projects';
import { FilterTabs } from '@/components/ui-custom/FilterTabs';
import type { FilterCategory, Project } from '@/types';

gsap.registerPlugin(Flip, ScrollTrigger);

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
    // 12-col grid: 1 item = full-bleed (12), 2 = 6 each, 3 = 4 each, 4 = 3 each
    const span = take === 1 ? 12 : take === 2 ? 6 : take === 3 ? 4 : 3;
    for (let k = 0; k < take; k++) spans.push(span);
    remaining -= take;
    rowIdx += 1;
  }
  return spans;
}

interface ProjectsGridProps {
  onProjectClick: (project: Project) => void;
}

export function ProjectsGrid({ onProjectClick }: ProjectsGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const sectionRef = useRef<HTMLElement>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);
  const morphTimelineRef = useRef<gsap.core.Timeline | null>(null);

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
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          ease: 'power2.out',
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 95%',
            end: 'top 35%',
            scrub: 3,
            invalidateOnRefresh: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  // Reset to the aggregated "all" view when the user scrolls up past the
  // section's top edge (section leaves the viewport moving downward).
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
  }, [activeFilter]);

  const spans = useMemo(
    () => computeSpans(filteredProjects.length),
    [filteredProjects.length]
  );

  const handleFilterChange = (next: FilterCategory) => {
    // If the strip→grid morph is mid-flight, snap it to the end so Flip
    // measures a stable grid layout for the filter reflow below.
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

  // Strip → grid scroll-scrubbed morph.
  //
  // Rebuilt whenever filteredProjects changes so each filter's item
  // positions are measured fresh. Declared BEFORE the filter-reflow effect
  // below so that the container ends this effect in its "grid" layout state,
  // which is the layout the filter-reflow effect expects to see.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      // Skip the morph: land directly in the editorial grid.
      grid.dataset.layout = 'grid';
      return;
    }

    const items = grid.querySelectorAll<HTMLElement>('[data-flip-id]');
    if (items.length === 0) return;

    // Capture strip layout positions as the timeline's starting frame.
    grid.dataset.layout = 'strip';
    // Force a synchronous reflow so the strip rules apply before measurement.
    void grid.offsetHeight;
    const state = Flip.getState(items);

    // Switch to the final editorial grid layout.
    grid.dataset.layout = 'grid';

    // Flip.from returns a timeline that tweens FROM the captured (strip)
    // positions TO the current (grid) positions. We pause it and let a
    // ScrollTrigger scrub its progress based on scroll position.
    const tl = Flip.from(state, {
      duration: 1,
      ease: 'none',
      absolute: true,
      paused: true,
    });
    morphTimelineRef.current = tl;

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 80%',
      end: 'top 30%',
      scrub: 1,
      animation: tl,
      invalidateOnRefresh: true,
    });

    return () => {
      st.kill();
      tl.kill();
      if (morphTimelineRef.current === tl) {
        morphTimelineRef.current = null;
      }
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
      className="pt-24 md:pt-40 pb-16 md:pb-24 px-0"
    >
      {/* Filter Tabs */}
      <div ref={filterWrapRef} className="px-4 md:px-8 mb-4 md:mb-6">
        <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} />
      </div>

      {/* Editorial container — data-layout drives strip vs grid mode on md+.
          Mobile always uses the horizontal scrolling strip. */}
      <div
        ref={gridRef}
        data-layout="strip"
        className="flex w-full items-end gap-1 md:gap-1.5 px-0 overflow-x-auto md:overflow-visible"
      >
        {filteredProjects.map((project, index) => {
          // Slightly varied heights so the top edge breathes like the reference
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
            <div
              key={project.id}
              data-flip-id={project.id}
              onClick={() => onProjectClick(project)}
              className={`group relative flex-shrink-0 md:min-w-0 w-44 ${h} cursor-pointer overflow-hidden`}
              style={{
                borderRadius: '2px',
                gridColumn: `span ${span} / span ${span}`,
              }}
            >
              <img
                src={project.thumbnail}
                alt={project.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
