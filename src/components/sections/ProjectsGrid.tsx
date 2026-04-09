import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import gsap from 'gsap';
import { Flip, ScrollTrigger } from 'gsap/all';
import { projects } from '@/data/projects';
import { FilterTabs } from '@/components/ui-custom/FilterTabs';
import type { FilterCategory, Project } from '@/types';

gsap.registerPlugin(Flip, ScrollTrigger);

interface ProjectsGridProps {
  onProjectClick: (project: Project) => void;
}

export function ProjectsGrid({ onProjectClick }: ProjectsGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const sectionRef = useRef<HTMLElement>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);

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

  // Scroll-linked come-in for the strip items, matching the Hero quote:
  // each item fades up from blur + y offset as the section scrolls into view.
  useEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid) return;

    const items = grid.querySelectorAll<HTMLElement>('[data-flip-id]');
    if (items.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.set(items, { opacity: 0, y: 40, filter: 'blur(10px)' });

      gsap.to(items, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        ease: 'power2.out',
        duration: 1,
        stagger: 0.08,
        scrollTrigger: {
          trigger: section,
          start: 'top 95%',
          end: 'top 35%',
          scrub: 3,
          invalidateOnRefresh: true,
        },
      });
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

  const handleFilterChange = (next: FilterCategory) => {
    if (gridRef.current) {
      flipStateRef.current = Flip.getState(
        gridRef.current.querySelectorAll('[data-flip-id]')
      );
    }
    setActiveFilter(next);
  };

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

      {/* Editorial horizontal strip — used for all filters */}
      <div
        ref={gridRef}
        className="flex w-full items-end gap-1 md:gap-1.5 px-0 overflow-x-auto md:overflow-visible md:flex-wrap"
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
          return (
            <div
              key={project.id}
              data-flip-id={project.id}
              onClick={() => onProjectClick(project)}
              className={`group relative flex-shrink-0 md:flex-[1_1_calc((100%_-_3rem)/9)] md:min-w-0 w-44 ${h} cursor-pointer overflow-hidden`}
              style={{ borderRadius: '2px' }}
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
