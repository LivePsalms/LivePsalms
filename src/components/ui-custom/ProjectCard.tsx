import { useState, useRef, useEffect } from 'react';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  index: number;
}

export function ProjectCard({ project, onClick, index }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'residential':
        return 'Résidentiel';
      case 'retail':
        return 'Retail';
      case 'hospitality':
        return 'Hospitality';
      default:
        return category;
    }
  };

  return (
    <div
      ref={cardRef}
      className={`project-card relative overflow-hidden cursor-pointer group transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={project.thumbnail}
          alt={project.name}
          className={`w-full h-full object-cover transition-transform duration-700 ${
            isHovered ? 'scale-105' : 'scale-100'
          }`}
          loading="lazy"
        />

        {/* Hover Overlay */}
        <div
          className={`absolute inset-0 ${project.overlayColor} transition-opacity duration-500 flex items-end p-6 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="text-white">
            <h3 className="text-2xl md:text-3xl font-bold mb-1">
              {project.name}
            </h3>
            <p className="text-sm opacity-80">
              {getCategoryLabel(project.category)}
            </p>
          </div>
        </div>
      </div>

      {/* Project Info Below */}
      <div className="flex items-center justify-between py-3 px-1">
        <h3 className="text-sm font-semibold text-mersi-dark">
          {project.name}
        </h3>
        <span className="text-xs text-mersi-dark/60">
          {getCategoryLabel(project.category)}
        </span>
      </div>
    </div>
  );
}
