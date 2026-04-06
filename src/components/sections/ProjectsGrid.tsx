import { useState, useMemo } from 'react';
import { projects } from '@/data/projects';
import { FilterTabs } from '@/components/ui-custom/FilterTabs';
import { ProjectCard } from '@/components/ui-custom/ProjectCard';
import type { FilterCategory, Project } from '@/types';

interface ProjectsGridProps {
  onProjectClick: (project: Project) => void;
}

export function ProjectsGrid({ onProjectClick }: ProjectsGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('residential');

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return projects;
    return projects.filter((project) => project.category === activeFilter);
  }, [activeFilter]);

  // Split projects into rows for masonry-like layout
  const topRow = filteredProjects.slice(0, 3);
  const bottomRow = filteredProjects.slice(3, 7);

  return (
    <section
      id="projects"
      className="py-16 md:py-24 px-4 md:px-8 lg:px-16"
    >
      {/* Organic section title */}
      <div className="text-center mb-12 md:mb-16">
        <h2 
          className="text-xs md:text-sm tracking-[0.3em] uppercase"
          style={{ color: 'var(--warm-sand)', fontFamily: 'Outfit, sans-serif' }}
        >
          Selected Works
        </h2>
      </div>

      {/* Filter Tabs */}
      <FilterTabs activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {/* Projects Grid - Organic free-flow layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 mb-5 md:mb-8">
        {topRow.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => onProjectClick(project)}
            index={index}
          />
        ))}
      </div>

      {/* Projects Grid - Bottom Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-8">
        {bottomRow.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => onProjectClick(project)}
            index={index + 3}
          />
        ))}
      </div>
    </section>
  );
}
