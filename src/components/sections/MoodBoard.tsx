// src/components/sections/MoodBoard.tsx
import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import type { Project } from '@/types';

gsap.registerPlugin(ScrollTrigger);

interface MoodBoardProps {
  project: Project;
  onInMoodBoard?: (inMoodBoard: boolean) => void;
}

export function MoodBoard({ project, onInMoodBoard }: MoodBoardProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useLayoutEffect(() => {
    if (isMobile || !sectionRef.current || !trackRef.current) return;

    const track = trackRef.current;

    const ctx = gsap.context(() => {
      const totalWidth = track.scrollWidth;
      const viewportWidth = window.innerWidth;

      gsap.to(track, {
        x: -(totalWidth - viewportWidth),
        ease: 'none',
        scrollTrigger: {
          id: 'moodboard-pin',
          trigger: sectionRef.current,
          start: 'top top',
          end: () => `+=${totalWidth - viewportWidth}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            setProgress(self.progress);
            onInMoodBoard?.(self.progress > 0 && self.progress < 1);
          },
          onLeave: () => onInMoodBoard?.(false),
          onLeaveBack: () => onInMoodBoard?.(false),
        },
      });

      // Parallax: offset each element by its data-speed factor
      gsap.utils.toArray<HTMLElement>('.mb-elem').forEach((el) => {
        const speed = parseFloat(el.dataset.speed || '0.5');
        gsap.to(el, {
          x: () => -(speed - 0.5) * (track.scrollWidth - window.innerWidth) * 0.3,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: () => `+=${track.scrollWidth - window.innerWidth}`,
            scrub: 1,
          },
        });
      });

      // Reveal: fade + translate as elements enter viewport
      gsap.utils.toArray<HTMLElement>('.mb-elem').forEach((el) => {
        const isHeadline = el.tagName === 'H2' || el.tagName === 'H3';
        const isCaption = el.classList.contains('text-xs') || el.classList.contains('text-sm');
        const xOffset = isHeadline ? 100 : isCaption ? 40 : 60;
        const duration = isHeadline ? 1.4 : isCaption ? 0.9 : 1.1;

        gsap.fromTo(
          el,
          { opacity: 0, x: xOffset },
          {
            opacity: parseFloat(el.style.opacity) || 1,
            x: 0,
            duration,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'left 90%',
              end: 'left 50%',
              toggleActions: 'play none none reverse',
              horizontal: true,
            },
          }
        );
      });

      // Stagger reveal for service list items
      gsap.utils.toArray<HTMLElement>('.mb-list-item').forEach((item, i) => {
        gsap.fromTo(
          item,
          { opacity: 0, x: 40 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            delay: i * 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: item.closest('.mb-elem'),
              start: 'left 85%',
              toggleActions: 'play none none reverse',
              horizontal: true,
            },
          }
        );
      });

      // Scale effect on large images as they pass through center
      gsap.utils.toArray<HTMLElement>('.mb-elem img').forEach((img) => {
        const parent = img.closest('.mb-elem');
        if (!parent) return;
        const isLarge = parent.classList.contains('w-[45vw]') ||
                        parent.classList.contains('w-[35vw]') ||
                        parent.classList.contains('w-[50vw]') ||
                        parent.classList.contains('w-[40vw]');
        if (!isLarge) return;

        gsap.fromTo(
          img,
          { scale: 1.05 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: parent,
              start: 'left 80%',
              end: 'left 20%',
              scrub: true,
              horizontal: true,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [isMobile, onInMoodBoard]);

  const bgColor = project.overlayColor;

  if (isMobile) {
    return <MoodBoardMobile project={project} />;
  }

  return (
    <div ref={sectionRef} className="relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div
        ref={trackRef}
        className="flex h-screen will-change-transform"
      >
        {/* Zone 1: Hero */}
        <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw' }}>
          <div
            className="mb-elem absolute top-[15%] left-[8%] w-[45vw] h-[70vh] overflow-hidden"
            data-speed="0.3"
          >
            <img
              src={project.thumbnail}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          </div>

          <h2
            className="mb-elem absolute bottom-[20%] right-[15%] text-[12vw] font-bold leading-[0.85] tracking-tighter text-white/90"
            data-speed="0.5"
          >
            {project.name.toUpperCase()}
          </h2>

          <div
            className="mb-elem absolute top-[25%] right-[25%] text-sm tracking-wide max-w-[200px] leading-relaxed text-white/60"
            data-speed="0.7"
          >
            <p>{project.description || 'A space where architecture meets editorial design.'}</p>
          </div>
        </div>

        {/* Zone 2: Data */}
        <div className="relative flex-shrink-0 h-screen" style={{ width: '180vw' }}>
          {/* Polaroid image */}
          <div
            className="mb-elem absolute top-[10%] left-[5%] bg-white p-4 shadow-lg"
            data-speed="0.8"
          >
            <img
              src={project.images[1] || project.thumbnail}
              alt={`${project.name} detail`}
              className="w-[280px] h-[360px] object-cover"
            />
            <p className="text-xs mt-3 tracking-wide text-black/60">
              {project.location || 'Location'} — {project.year || '2025'}
            </p>
          </div>

          {/* Giant area number */}
          {project.area && (
            <div
              className="mb-elem absolute top-[50%] left-[35%] text-[18vw] font-bold text-white/10 leading-none"
              data-speed="0.2"
            >
              {project.area}m²
            </div>
          )}

          {/* Large image */}
          <div
            className="mb-elem absolute bottom-[15%] right-[20%] w-[35vw] h-[50vh] overflow-hidden"
            data-speed="0.4"
          >
            <img
              src={project.images[2] || project.thumbnail}
              alt={`${project.name} view`}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Services list */}
          {project.services && project.services.length > 0 && (
            <div
              className="mb-elem absolute top-[35%] right-[8%] max-w-[180px]"
              data-speed="0.9"
            >
              <div className="space-y-3 text-xs tracking-wide">
                {project.services.map((service, i) => (
                  <div key={service.id} className="mb-list-item flex items-start gap-3">
                    <span className="text-white/40">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-white/70">{service.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Zone 3: Craft */}
        <div className="relative flex-shrink-0 h-screen" style={{ width: '220vw' }}>
          <h3
            className="mb-elem absolute top-[20%] left-[10%] text-[10vw] font-bold text-white leading-none tracking-tight"
            data-speed="0.6"
          >
            CRAFT
          </h3>

          <div
            className="mb-elem absolute top-[55%] left-[25%] w-[50vw] h-[35vh] overflow-hidden"
            data-speed="0.3"
          >
            <img
              src={project.images[3] || project.images[1] || project.thumbnail}
              alt={`${project.name} craft`}
              className="w-full h-full object-cover"
            />
          </div>

          <div
            className="mb-elem absolute bottom-[25%] right-[15%] text-white/80 text-sm max-w-[250px] leading-relaxed tracking-wide"
            data-speed="0.8"
          >
            <p>
              {project.description || 'Every detail matters. From material selection to spatial flow, we consider how spaces evolve with their inhabitants.'}
            </p>
          </div>

          {/* Small matted detail photo */}
          <div
            className="mb-elem absolute top-[15%] right-[25%] bg-white/95 p-3 shadow-xl"
            data-speed="0.7"
          >
            <img
              src={project.images[4] || project.images[0]}
              alt="Detail study"
              className="w-[200px] h-[250px] object-cover"
            />
            <p className="text-[10px] mt-2 tracking-wider text-black/50 uppercase">Detail Study</p>
          </div>
        </div>

        {/* Zone 4: Year */}
        <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw' }}>
          <div
            className="mb-elem absolute top-[30%] left-[15%] text-[14vw] font-bold text-white/15 leading-none"
            data-speed="0.25"
          >
            {project.year || '2025'}
          </div>

          <div
            className="mb-elem absolute top-[20%] right-[20%] w-[40vw] h-[60vh] overflow-hidden shadow-2xl"
            data-speed="0.5"
          >
            <img
              src={project.images[5] || project.thumbnail}
              alt={`${project.name} featured`}
              className="w-full h-full object-cover"
            />
          </div>

          <p
            className="mb-elem absolute bottom-[20%] left-[20%] text-white text-xs tracking-widest uppercase"
            data-speed="0.75"
          >
            {project.category === 'residential' ? 'Restoration' : project.category === 'retail' ? 'Renewal' : 'Serenity'}
          </p>
        </div>

        {/* Zone 5: CTA */}
        <div className="relative flex-shrink-0 h-screen flex items-center justify-center" style={{ width: '100vw', backgroundColor: 'rgba(0,0,0,0.15)' }}>
          <div className="text-center">
            <h3 className="text-[8vw] font-bold text-white mb-8 tracking-tight">
              Let's Talk
            </h3>
            <p className="text-white/70 text-sm tracking-wide mb-12 max-w-md mx-auto">
              Ready to create something extraordinary? Reach out and let's start a conversation about your next project.
            </p>
            <button className="px-8 py-4 bg-white text-mersi-dark text-sm tracking-wide hover:bg-white/90 transition-colors">
              Get in Touch
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="fixed bottom-0 left-0 right-0 h-[2px] z-50 transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(255,255,255,0.15)',
          opacity: progress > 0 && progress < 1 ? 1 : 0,
        }}
      >
        <div
          className="h-full bg-white/60 transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

// Mobile fallback — simple vertical stack
function MoodBoardMobile({ project }: { project: Project }) {
  const categoryLabel =
    project.category === 'residential' ? 'Restoration'
    : project.category === 'retail' ? 'Renewal'
    : 'Serenity';

  return (
    <div style={{ backgroundColor: project.overlayColor }}>
      {/* Zone 1: Hero */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <img
          src={project.thumbnail}
          alt={project.name}
          className="w-full h-[60vh] object-cover mb-8"
        />
        <h2 className="text-[15vw] font-bold text-white/90 leading-none mb-4">
          {project.name.toUpperCase()}
        </h2>
        <p className="text-sm text-white/60 leading-relaxed max-w-sm">
          {project.description || 'A space where architecture meets editorial design.'}
        </p>
      </section>

      {/* Zone 2: Data */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <div className="bg-white p-4 shadow-lg w-fit mb-8">
          <img
            src={project.images[1] || project.thumbnail}
            alt={`${project.name} detail`}
            className="w-[240px] h-[300px] object-cover"
          />
          <p className="text-xs mt-3 text-black/60">
            {project.location || 'Location'} — {project.year || '2025'}
          </p>
        </div>
        {project.area && (
          <div className="text-[20vw] font-bold text-white/10 mb-8">{project.area}m²</div>
        )}
        {project.services && (
          <div className="space-y-3 text-sm">
            {project.services.map((service, i) => (
              <div key={service.id} className="flex gap-3">
                <span className="text-white/40">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-white/70">{service.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Zone 3: Craft */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <h3 className="text-[15vw] font-bold text-white leading-none mb-8">CRAFT</h3>
        <img
          src={project.images[3] || project.images[1] || project.thumbnail}
          alt={`${project.name} craft`}
          className="w-full h-[40vh] object-cover mb-8"
        />
        <p className="text-white/80 text-sm leading-relaxed">
          {project.description || 'Every detail matters. From material selection to spatial flow, we consider how spaces evolve with their inhabitants.'}
        </p>
      </section>

      {/* Zone 4: Year */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <div className="text-[20vw] font-bold text-white/15 mb-8">{project.year || '2025'}</div>
        <img
          src={project.images[5] || project.thumbnail}
          alt={`${project.name} featured`}
          className="w-full h-[50vh] object-cover mb-4"
        />
        <p className="text-white text-xs tracking-widest uppercase">{categoryLabel}</p>
      </section>

      {/* Zone 5: CTA */}
      <section className="min-h-screen p-6 flex flex-col justify-center items-center text-center">
        <h3 className="text-[12vw] font-bold text-white mb-6">Let's Talk</h3>
        <p className="text-white/70 text-sm mb-8 max-w-sm">
          Ready to create something extraordinary? Reach out and let's start a conversation about your next project.
        </p>
        <button className="px-8 py-4 bg-white text-mersi-dark text-sm">Get in Touch</button>
      </section>
    </div>
  );
}
