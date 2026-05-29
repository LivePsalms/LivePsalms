import { useState, useMemo, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Flip, ScrollTrigger } from 'gsap/all';
import { FilterTabs } from '@/components/ui-custom/FilterTabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { DesktopMosaic } from './DesktopMosaic';
import { MobileParallaxList } from './MobileParallaxList';
import type { FilterCategory, Project } from '@/types';

// PurposeGrid no longer touches Flip directly, but DesktopMosaic does and
// PurposeGrid still uses ScrollTrigger for its section/watermark/filter
// reveals plus the leave-back reset. Registering here is a no-op when
// DesktopMosaic re-registers — gsap.registerPlugin is idempotent — but it
// keeps the plugin registration colocated with the file that consumes it.
gsap.registerPlugin(Flip, ScrollTrigger);

interface PurposeGridProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
}

export function PurposeGrid({ projects, onProjectClick }: PurposeGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);
  const watermarkRef = useRef<HTMLSpanElement>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);

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

  const handleFilterChange = (next: FilterCategory) => {
    // Pre-capture of flipStateRef now lives inside DesktopMosaic as a
    // useLayoutEffect keyed on filteredProjects — see DesktopMosaic.tsx.
    setActiveFilter(next);
  };

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

      {isMobile ? (
        <MobileParallaxList
          projects={filteredProjects}
          onProjectClick={onProjectClick}
        />
      ) : (
        <DesktopMosaic
          sectionRef={sectionRef}
          filteredProjects={filteredProjects}
          flipStateRef={flipStateRef}
          onProjectClick={onProjectClick}
        />
      )}
    </section>
  );
}
