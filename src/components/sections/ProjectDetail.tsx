import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/types';
import { ArrowLeft } from 'lucide-react';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
}

export function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [project]);

  return (
    <section
      ref={sectionRef}
      className="min-h-screen"
      style={{ backgroundColor: project.overlayColor }}
    >
      {/* Back Button */}
      <button
        onClick={onBack}
        className={`fixed top-24 left-6 lg:left-10 z-50 flex items-center gap-2 text-sm font-medium text-mersi-dark hover:opacity-60 transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
        }`}
      >
        <ArrowLeft className="w-4 h-4" />
        Return
      </button>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        {/* Left Content */}
        <div className="flex flex-col justify-center px-6 lg:px-16 py-32 lg:py-20 order-2 lg:order-1">
          {/* Location & Year */}
          <div
            className={`flex items-center gap-8 mb-8 transition-all duration-700 delay-100 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
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
              className={`text-lg md:text-xl text-mersi-dark/80 max-w-md mb-12 leading-relaxed transition-all duration-700 delay-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              {project.description}
            </p>
          )}

          {/* Project Title */}
          <h1
            className={`text-6xl md:text-7xl lg:text-8xl font-bold text-mersi-dark tracking-tight transition-all duration-700 delay-400 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {project.name}
          </h1>
        </div>

        {/* Right Image */}
        <div className="relative h-[50vh] lg:h-screen order-1 lg:order-2">
          <img
            src={project.thumbnail}
            alt={project.name}
            className={`w-full h-full object-cover transition-all duration-1000 ${
              isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
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
    </section>
  );
}
