import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  index: number;
  aspectRatio?: string;
}

export function ProjectCard({ project, onClick, aspectRatio = '4/5' }: ProjectCardProps) {
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'residential':
        return 'Restoration';
      case 'retail':
        return 'Renewal';
      case 'hospitality':
        return 'Serenity';
      default:
        return category;
    }
  };

  const getCategoryClipPath = (category: string) => {
    switch (category) {
      case 'residential':
        return 'url(#clip-pattern3)';
      case 'retail':
        return 'url(#clip-pattern5)';
      case 'hospitality':
        return 'url(#clip-pattern6)';
      default:
        return undefined;
    }
  };

  const clipPath = getCategoryClipPath(project.category);

  return (
    <div
      data-flip-id={project.id}
      className="project-card relative cursor-pointer group"
      onClick={onClick}
    >
      {/* Image clipped by a category-specific SVG mask */}
      <figure
        className="relative w-full m-0 overflow-hidden"
        style={{
          aspectRatio,
          clipPath,
          WebkitClipPath: clipPath,
        }}
      >
        <img
          src={project.thumbnail}
          alt={project.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </figure>

      {/* Plain text metadata below — no chrome */}
      <div className="flex items-center justify-between pt-3 px-1">
        <h3 className="text-xs md:text-sm tracking-wide uppercase text-mersi-dark">
          {project.name}
        </h3>
        <span className="text-[10px] md:text-xs tracking-wider uppercase text-mersi-dark/50">
          {getCategoryLabel(project.category)}
        </span>
      </div>
    </div>
  );
}
