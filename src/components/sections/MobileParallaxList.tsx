import { MobileProjectTile } from './MobileProjectTile';
import type { Project } from '@/types';

export interface MobileParallaxListProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
}

export function MobileParallaxList({
  projects,
  onProjectClick,
}: MobileParallaxListProps) {
  return (
    <div className="flex flex-col w-full gap-10">
      {projects.map((project, index) => (
        <MobileProjectTile
          key={project.id}
          project={project}
          index={index}
          onProjectClick={onProjectClick}
        />
      ))}
    </div>
  );
}
