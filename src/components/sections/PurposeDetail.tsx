import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Project } from '@/types';
import { MoodBoard } from '@/components/sections/MoodBoard';
import { LineMaskReveal } from '@/components/ui-custom/LineMaskReveal';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import { ImageReveal } from '@/components/ui-custom/ImageReveal';

interface PurposeDetailProps {
  project: Project;
  exiting?: boolean;
  onExitComplete?: () => void;
}


export function PurposeDetail({ project, exiting, onExitComplete }: PurposeDetailProps) {
  const isRestoration1 = project.id === 'restoration1';
  const [isVisible, setIsVisible] = useState(false);
  const [textReady, setTextReady] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);

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
    setTextReady(false);
    const timer = setTimeout(() => setTextReady(true), 1400);
    return () => clearTimeout(timer);
  }, [project]);

  // Exit animation: text slides down + fades, image fades, then notify parent
  useEffect(() => {
    if (!exiting) return;

    const content = heroContentRef.current;
    const image = heroImageRef.current;

    if (content) {
      content.style.transition = 'opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1), filter 0.6s cubic-bezier(0.22,1,0.36,1)';
      content.style.opacity = '0';
      content.style.transform = 'translateY(40px)';
      content.style.filter = 'blur(8px)';
    }

    if (image) {
      image.style.transition = 'opacity 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s';
      image.style.opacity = '0';
    }

    const timer = setTimeout(() => {
      onExitComplete?.();
    }, 650);

    return () => clearTimeout(timer);
  }, [exiting, onExitComplete]);

  return (
    <section
      ref={sectionRef}
      className="min-h-screen"
      style={{ backgroundColor: project.overlayColor }}
    >

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen overflow-hidden">
        {/* Left Content */}
        <div ref={heroContentRef} className="relative flex flex-col justify-start px-6 lg:px-16 pt-24 lg:pt-28 pb-32 lg:pb-20 order-2 lg:order-1">
          {isRestoration1 ? (
            <>
              {/* Label */}
              <LineMaskReveal
                className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10"
                duration={1400}
                stagger={120}
                threshold={0.1}
                enabled={textReady}
              >
                <span>Restoration of Peace</span>
              </LineMaskReveal>

              {/* Title */}
              <div
                className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12 overflow-hidden"
              >
                <h1
                  style={{
                    fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)',
                    lineHeight: 0.95,
                    transform: textReady ? 'translateY(0)' : 'translateY(110%)',
                    transition: 'transform 1.6s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  Beside Still Waters
                </h1>
              </div>

              {/* Scripture quote */}
              <div className="mb-20">
                <LineMaskReveal
                  className="font-['Cormorant_Garamond'] italic text-2xl md:text-3xl text-white/60 leading-snug"
                  duration={1500}
                  stagger={100}
                  threshold={0.1}
                  enabled={textReady}
                >
                  <p>&ldquo;He makes me lie down in green pastures,</p>
                  <p>he leads me beside quiet waters,</p>
                  <p>he refreshes my soul.&rdquo;</p>
                </LineMaskReveal>
                <p
                  className="mt-3 not-italic text-xs tracking-[0.25em] uppercase text-white/40"
                  style={{
                    opacity: textReady ? 1 : 0,
                    transition: 'opacity 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.6s',
                  }}
                >
                  Psalm 23:2&ndash;3
                </p>
              </div>

              {/* Down arrow + Journey */}
              <div
                className="absolute bottom-[30%] right-8 lg:right-12 flex items-center gap-3 text-white/50"
                style={{
                  opacity: textReady ? 1 : 0,
                  transition: 'opacity 1.4s cubic-bezier(0.22, 1, 0.36, 1) 1s',
                }}
              >
                <svg
                  className="w-4 h-4 journey-arrow"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M8 1v12M3 9l5 5 5-5" />
                </svg>
                <span className="text-xs tracking-[0.2em] uppercase">Journey</span>
              </div>
            </>
          ) : (
            <>
              {/* Location & Year */}
              {(project.location || project.year) && (
                <LineMaskReveal
                  className="flex items-center gap-8 mb-8 text-sm text-mersi-dark/70"
                  duration={1400}
                  stagger={120}
                  threshold={0.1}
                  enabled={textReady}
                >
                  <span>
                    {[project.location, project.year].filter(Boolean).join(' — ')}
                  </span>
                </LineMaskReveal>
              )}

              {/* Description */}
              {project.description && (
                <LineMaskReveal
                  className="text-lg md:text-xl text-mersi-dark/80 max-w-md mb-12 leading-relaxed"
                  duration={1500}
                  stagger={130}
                  threshold={0.1}
                  enabled={textReady}
                >
                  <p>{project.description}</p>
                </LineMaskReveal>
              )}

              {/* Project Title */}
              <LineMaskReveal
                className="text-6xl md:text-7xl lg:text-8xl font-bold text-mersi-dark tracking-tight"
                duration={1600}
                stagger={140}
                threshold={0.1}
                enabled={textReady}
              >
                <h1>{project.name}</h1>
              </LineMaskReveal>
            </>
          )}
        </div>

        {/* Right Image — meditative radial reveal */}
        <div ref={heroImageRef} className="relative h-[50vh] lg:h-screen order-1 lg:order-2 overflow-hidden">
          <ImageReveal
            src={project.thumbnail}
            alt={project.name}
            avgColor={project.overlayColor}
            className="w-full h-full"
            revealed={isVisible}
            duration={2600}
          />
        </div>
      </div>

      {/* Services Section */}
      {project.services && project.services.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 lg:px-16 py-20">
          {/* Left - Sticky Image */}
          <div className="relative h-[60vh] lg:h-[80vh] lg:sticky lg:top-20">
            <PhotoDevelopImage
              src={project.images[1] || project.thumbnail}
              alt={`${project.name} interior`}
              className="w-full h-full"
            />
          </div>

          {/* Right - Services List */}
          <div className="flex flex-col justify-center py-10">
            <LineMaskReveal
              className="text-2xl md:text-3xl font-semibold text-mersi-dark mb-12"
              duration={1000}
              stagger={90}
            >
              <h2>{project.description}</h2>
            </LineMaskReveal>

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
              <LineMaskReveal
                className="mt-16 text-7xl md:text-8xl lg:text-9xl font-bold text-mersi-dark tracking-tighter"
                duration={1100}
                stagger={100}
              >
                <span>
                  {project.area}
                  <span className="text-3xl md:text-4xl align-top ml-2">m²</span>
                </span>
              </LineMaskReveal>
            )}
          </div>
        </div>
      )}

      {/* Image Gallery */}
      {project.images.length > 2 && (
        <div className="px-6 lg:px-16 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {project.images.slice(2).map((image, index) => (
              <PhotoDevelopImage
                key={index}
                src={image}
                alt={`${project.name} view ${index + 3}`}
                className="aspect-[4/3]"
                imgClassName="hover:scale-105 transition-transform duration-700"
                threshold={0.2}
              />
            ))}
          </div>
        </div>
      )}

      <MoodBoard project={project} />
    </section>
  );
}
