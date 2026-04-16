import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Project } from '@/types';
import { MoodBoard } from '@/components/sections/MoodBoard';

interface PurposeDetailProps {
  project: Project;
}

export function PurposeDetail({ project }: PurposeDetailProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Reset scroll before paint so the page always starts at the top
  useLayoutEffect(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = '';
    });
  }, [project]);

  useEffect(() => {
    setIsVisible(true);
  }, [project]);

  return (
    <section
      ref={sectionRef}
      className="min-h-screen"
      style={{ backgroundColor: project.overlayColor }}
    >

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen overflow-hidden">
        {/* Left Content */}
        <div className="flex flex-col justify-center px-6 lg:px-16 py-32 lg:py-20 order-2 lg:order-1">
          {/* Location & Year */}
          <div
            className="flex items-center gap-8 mb-8"
            style={{
              opacity: isVisible ? 1 : 0,
              transition: 'opacity 1.6s cubic-bezier(0.22,1,0.36,1) 2.5s',
            }}
          >
            {project.location && (
              <span className="text-sm text-mersi-dark/70">{project.location}</span>
            )}
            {project.year && (
              <span className="text-sm text-mersi-dark/70">{project.year}</span>
            )}
          </div>

          {/* Description */}
          {project.description && (
            <p
              className="text-lg md:text-xl text-mersi-dark/80 max-w-md mb-12 leading-relaxed"
              style={{
                opacity: isVisible ? 1 : 0,
                transition: 'opacity 1.8s cubic-bezier(0.22,1,0.36,1) 2.2s',
              }}
            >
              {project.description}
            </p>
          )}

          {/* Project Title */}
          <h1
            className="text-6xl md:text-7xl lg:text-8xl font-bold text-mersi-dark tracking-tight"
            style={{
              opacity: isVisible ? 1 : 0,
              transition: 'opacity 2s cubic-bezier(0.22,1,0.36,1) 1.9s',
            }}
          >
            {project.name}
          </h1>
        </div>

        {/* Right Image — rises up from below with a slow, smooth ease. */}
        <div className="relative h-[50vh] lg:h-screen order-1 lg:order-2 overflow-hidden">
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
              transition:
                'opacity 1.6s cubic-bezier(0.22,1,0.36,1) 0.3s, transform 1.6s cubic-bezier(0.22,1,0.36,1) 0.3s',
            }}
          />
        </div>
      </div>

      {/* Services Section */}
      {project.services && project.services.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 lg:px-16 py-20">
          {/* Left - Sticky Image */}
          <div className="relative h-[60vh] lg:h-[80vh] lg:sticky lg:top-20">
            <img
              src={project.images[1] || project.thumbnail}
              alt={`${project.name} interior`}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Right - Services List */}
          <div className="flex flex-col justify-center py-10">
            <h2 className="text-2xl md:text-3xl font-semibold text-mersi-dark mb-12">
              {project.description}
            </h2>

            <div className="space-y-0">
              {project.services.map((service, index) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between py-4 border-t border-mersi-dark/20 group cursor-pointer hover:bg-mersi-dark/5 transition-colors duration-300 px-2 -mx-2"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-2 h-2 rounded-full bg-mersi-dark/30 group-hover:bg-mersi-dark transition-colors duration-300" />
                    <span className="text-base md:text-lg text-mersi-dark">
                      {service.name}
                    </span>
                  </div>
                  <span className="text-sm text-mersi-dark/50">
                    {service.number}
                  </span>
                </div>
              ))}
            </div>

            {/* Area Display */}
            {project.area && (
              <div className="mt-16">
                <span className="text-7xl md:text-8xl lg:text-9xl font-bold text-mersi-dark tracking-tighter">
                  {project.area}
                  <span className="text-3xl md:text-4xl align-top ml-2">m²</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Gallery */}
      {project.images.length > 2 && (
        <div className="px-6 lg:px-16 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {project.images.slice(2).map((image, index) => (
              <div
                key={index}
                className="aspect-[4/3] overflow-hidden"
              >
                <img
                  src={image}
                  alt={`${project.name} view ${index + 3}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <MoodBoard project={project} />
    </section>
  );
}
