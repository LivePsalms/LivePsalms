import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import gsap from 'gsap';
import { Flip, ScrollTrigger } from 'gsap/all';
import { projects } from '@/data/projects';
import { FilterTabs } from '@/components/ui-custom/FilterTabs';
import type { FilterCategory, Project } from '@/types';

gsap.registerPlugin(Flip, ScrollTrigger);

// Display label for a project category, matching the editorial reference.
function categoryLabel(category: Project['category']): string {
  switch (category) {
    case 'residential':
      return 'Résidentiel';
    case 'retail':
      return 'Retail';
    case 'hospitality':
      return 'Hospitality';
  }
}

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
  }, [activeFilter]);

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

  // Strip → grid pinned scroll-scrubbed morph.
  //
  // The section pins when its top reaches the viewport top. The user's
  // scroll delta over the pin range (`end: +=100%`) scrubs a paused Flip
  // timeline that tweens items from their horizontal-strip positions into
  // the 3/4/3/4 editorial grid. Reversible: scrolling back up through the
  // pin range scrubs the timeline back to strip state.
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
      // positions TO current (grid) positions. Paused, scrubbed by scroll.
      //
      // NOTE: we intentionally DO NOT use absolute: true. Flip's absolute
      // mode takes items out of flow via position: absolute, which (a)
      // collapses the display: grid container to 0 height and (b) doesn't
      // release cleanly when the timeline is scrubbed via onUpdate
      // (the absolute -> relative transition only runs on natural play).
      // Without absolute, Flip uses transforms (translate + scale) which
      // scrub correctly in both directions.
      const tl = Flip.from(state, {
        duration: 1,
        ease: 'none',
        paused: true,
      });
      morphTimelineRef.current = tl;

      // NOTE: attaching a Flip timeline directly via `animation: tl` crashes
      // ScrollTrigger.refresh() with "animation.revert(...).invalidate is not
      // a function" because Flip's internal timeline isn't compatible with
      // ScrollTrigger's revert lifecycle. Scrub manually via onUpdate instead.
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: '+=100%',
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          tl.progress(self.progress);
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
        className="relative flex w-full items-end gap-1 px-0 overflow-x-auto md:overflow-visible"
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
            <div
              key={project.id}
              data-flip-id={project.id}
              data-span={span}
              onClick={() => onProjectClick(project)}
              className="group flex-shrink-0 md:min-w-0 w-44 md:w-auto cursor-pointer"
            >
              <div
                className={`pg-img relative overflow-hidden ${h}`}
                style={{ borderRadius: '2px' }}
              >
                <img
                  src={project.thumbnail}
                  alt={project.name}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>
              <div
                className="mt-2 md:mt-3 flex items-baseline justify-between gap-2"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                <span
                  className="text-[10px] md:text-xs font-semibold tracking-[0.08em] truncate"
                  style={{ color: 'var(--deep-umber)' }}
                >
                  {project.name}
                </span>
                <span
                  className="text-[9px] md:text-[10px] tracking-[0.15em] uppercase shrink-0"
                  style={{ color: 'var(--warm-sand)' }}
                >
                  {categoryLabel(project.category)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
