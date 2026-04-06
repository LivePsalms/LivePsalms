import { useState, useMemo } from 'react';
import { projects } from '@/data/projects';
import { FilterTabs } from '@/components/ui-custom/FilterTabs';
import { ProjectCard } from '@/components/ui-custom/ProjectCard';
import type { FilterCategory, Project } from '@/types';

interface ProjectsGridProps {
  onProjectClick: (project: Project) => void;
}

// Editorial mosaic pattern. Each entry defines a card's column span (out of 12)
// and aspect ratio. Pattern loops via index modulo. Each row's spans always sum to 12.
const MOSAIC_PATTERN: Array<{ cols: number; ratio: string }> = [
  { cols: 9, ratio: '4/3' },   // 0 — paired with the "Selected Works" label (3+9=12)
  { cols: 5, ratio: '3/4' },   // 1
  { cols: 7, ratio: '1/1' },   // 2 — pair (1,2) = 5+7 = 12
  { cols: 6, ratio: '16/9' },  // 3
  { cols: 6, ratio: '4/3' },   // 4 — pair (3,4) = 6+6 = 12
  { cols: 8, ratio: '3/4' },   // 5
  { cols: 4, ratio: '16/9' },  // 6 — pair (5,6) = 8+4 = 12
  { cols: 12, ratio: '16/9' }, // 7 — solo full-bleed row (sums to 12 alone)
];

// Tailwind requires literal class names, so we map cols → class.
const COL_SPAN_CLASS: Record<number, string> = {
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  12: 'md:col-span-12',
};

export function ProjectsGrid({ onProjectClick }: ProjectsGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('residential');

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return projects;
    return projects.filter((project) => project.category === activeFilter);
  }, [activeFilter]);

  return (
    <section
      id="projects"
      className="py-16 md:py-24 px-0"
    >
      {/* Filter Tabs */}
      <div className="px-4 md:px-8 mb-10 md:mb-14">
        <FilterTabs activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      </div>

      {/* Editorial mosaic grid — fully edge-to-edge */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3">
        {/* "Selected Works" label as a grid cell, bottom-aligned, on first row */}
        <div className="md:col-span-3 flex items-end justify-start px-4 md:px-6 pb-2">
          <h2
            className="text-xs md:text-sm tracking-[0.3em] uppercase"
            style={{ color: 'var(--warm-sand)', fontFamily: 'Outfit, sans-serif' }}
          >
            Selected Works
          </h2>
        </div>

        {filteredProjects.map((project, index) => {
          const pattern = MOSAIC_PATTERN[index % MOSAIC_PATTERN.length];
          const colsClass = COL_SPAN_CLASS[pattern.cols];
          return (
            <div key={project.id} className={`col-span-1 ${colsClass}`}>
              <ProjectCard
                project={project}
                onClick={() => onProjectClick(project)}
                index={index}
                aspectRatio={pattern.ratio}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
