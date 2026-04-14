import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import type { Project } from '@/types';

gsap.registerPlugin(ScrollTrigger);

interface PurposeGalleryProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
}

export function PurposeGallery({ projects, onProjectClick }: PurposeGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.purpose-img').forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -10 },
          {
            yPercent: 10,
            ease: 'none',
            scrollTrigger: {
              trigger: img.closest('.purpose-slide'),
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
      });

      gsap.utils.toArray<HTMLElement>('.purpose-overlay').forEach((el, i) => {
        const slide = el.closest('.purpose-slide') as HTMLElement | null;
        const rect = slide?.getBoundingClientRect();
        const alreadyVisible = rect ? rect.top < window.innerHeight * 0.6 : false;

        if (i === 0 || alreadyVisible) {
          // First slide (or any slide already in view on load): show immediately
          gsap.set(el, { opacity: 1, y: 0 });
        } else {
          gsap.fromTo(
            el,
            { opacity: 0, y: 30 },
            {
              opacity: 1,
              y: 0,
              duration: 1,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: slide,
                start: 'top 60%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, [projects]);

  const categoryLabel: Record<Project['category'], string> = {
    residential: 'Restoration',
    retail: 'Renewal',
    hospitality: 'Serenity',
  };

  return (
    <div ref={containerRef} className="pt-20">
      {projects.map((project) => (
        <div
          key={project.id}
          className="purpose-slide relative h-screen overflow-hidden cursor-pointer"
          style={{ backgroundColor: project.overlayColor }}
          onClick={() => onProjectClick(project)}
        >
          <img
            src={project.thumbnail}
            alt={project.name}
            className="purpose-img absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          <div className="purpose-overlay absolute bottom-0 left-0 right-0 p-8 md:p-12 text-center z-10">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-2">
              {project.name}
            </h2>
            <p className="text-sm text-white/60 tracking-widest uppercase">
              {categoryLabel[project.category]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
