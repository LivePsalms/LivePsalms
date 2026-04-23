// src/components/sections/MoodBoard.tsx
import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useIsMobile } from '@/hooks/use-mobile';
import { categoryLabel, projects } from '@/data/projects';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import type { Project } from '@/types';

gsap.registerPlugin(ScrollTrigger);

/* ── Restoration 1 image map ── */
const R1 = {
  courtyardDoor: '/restoration1/hf_20260414_052152_0d84e8c5-405e-47c9-b2ac-b305071e3e75.png',
  bathPlants: '/restoration1/hf_20260414_052541_e8b75163-1b4a-41bb-9f5f-e62a0375dae5.png',
  vineDoor: '/restoration1/hf_20260414_052603_e157e053-f024-4596-a970-bc9c9830c26e.png',
  outdoorShower: '/restoration1/hf_20260414_052818_7e66aa90-20e0-4b89-8dae-59f80afa185d.png',
  stoneBedDark: '/restoration1/hf_20260414_053954_8eab2b6e-f7e1-4e13-90c8-a009ce499a47.png',
  stoneBedLight: '/restoration1/hf_20260414_054107_eb2996b7-a1e6-49f1-83b0-3a90f75c8209.png',
  warmSauna: '/restoration1/hf_20260414_054747_00ef631e-9f18-422a-9b64-f86347597ecc.png',
  darkSauna: '/restoration1/hf_20260414_055233_18d4b5eb-9558-471f-be7a-7c60d629c9cd.png',
  stillPool: '/restoration1/hf_20260414_060143_ac59f873-8396-49cc-b71a-31fc3624e0a1.png',
  spaTable: '/restoration1/hf_20260414_060351_457e393c-6660-4656-ac10-a8687f955863.png',
  archCouch: '/restoration1/hf_20260414_060514_629506c3-0888-4ddc-a3fc-b64fee0bc241.png',
  ivyNook: '/restoration1/hf_20260414_060559_8f073d25-fae7-412b-9d3d-b27100c2c7d0.png',
};

interface MoodBoardProps {
  project: Project;
  onInMoodBoard?: (inMoodBoard: boolean) => void;
}

export function MoodBoard({ project, onInMoodBoard }: MoodBoardProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const onInMoodBoardRef = useRef(onInMoodBoard);
  onInMoodBoardRef.current = onInMoodBoard;
  const isPeace = project.id === 'restoration1';
  const isHope = project.id === 'restoration3';

  useLayoutEffect(() => {
    if (isMobile || !sectionRef.current || !trackRef.current) return;

    const track = trackRef.current;

    const ctx = gsap.context(() => {
      // Main horizontal scroll tween — store reference for containerAnimation
      const mainTween = gsap.to(track, {
        x: () => -(track.scrollWidth - window.innerWidth),
        ease: 'none',
        scrollTrigger: {
          id: 'moodboard-pin',
          trigger: sectionRef.current,
          start: 'top top',
          end: () => `+=${track.scrollWidth - window.innerWidth}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progressBarRef.current) {
              progressBarRef.current.style.width = `${self.progress * 100}%`;
            }
            if (progressTrackRef.current) {
              progressTrackRef.current.style.opacity =
                self.progress > 0 && self.progress < 1 ? '1' : '0';
            }
            onInMoodBoardRef.current?.(self.progress > 0 && self.progress < 1);
          },
          onLeave: () => onInMoodBoardRef.current?.(false),
          onLeaveBack: () => onInMoodBoardRef.current?.(false),
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

      // Reveal animations
      gsap.utils.toArray<HTMLElement>('.mb-elem').forEach((el) => {
        const isText = el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'P' ||
                       el.classList.contains('text-xs') || el.classList.contains('text-sm') ||
                       el.classList.contains('text-white') || el.classList.contains('mb-text');
        const hasImage = el.querySelector('img');

        if (isText && !hasImage) {
          el.style.overflow = 'hidden';
          const inner = document.createElement('div');
          inner.style.willChange = 'transform';
          while (el.firstChild) inner.appendChild(el.firstChild);
          el.appendChild(inner);

          const isHeadline = el.tagName === 'H2' || el.tagName === 'H3';
          const dur = isHeadline ? 1.4 : 1.1;

          gsap.fromTo(
            inner,
            { yPercent: 110 },
            {
              yPercent: 0,
              duration: dur,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: el,
                containerAnimation: mainTween,
                start: 'left 90%',
                end: 'left 50%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        } else {
          const isCaption = el.classList.contains('text-xs') || el.classList.contains('text-sm');
          const xOffset = isCaption ? 40 : 60;
          const dur = isCaption ? 0.9 : 1.1;

          gsap.fromTo(
            el,
            { opacity: 0, x: xOffset },
            {
              opacity: parseFloat(el.style.opacity) || 1,
              x: 0,
              duration: dur,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: el,
                containerAnimation: mainTween,
                start: 'left 90%',
                end: 'left 50%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }
      });

      // Stagger reveal for list items
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
              trigger: item.closest('.mb-elem') || item,
              containerAnimation: mainTween,
              start: 'left 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });

      // Scale effect on large images
      gsap.utils.toArray<HTMLElement>('.mb-elem img').forEach((img) => {
        const parent = img.closest<HTMLElement>('.mb-elem');
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
              containerAnimation: mainTween,
              start: 'left 80%',
              end: 'left 20%',
              scrub: true,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [isMobile]);

  const bgColor = project.overlayColor;

  if (isMobile) {
    if (isPeace) return <PeaceMobile />;
    if (isHope) return <HopeMobile project={project} />;
    return <MoodBoardMobile project={project} />;
  }

  return (
    <div ref={sectionRef} className="relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div
        ref={trackRef}
        className="flex h-screen will-change-transform"
      >
        {isPeace ? <PeaceZones project={project} /> : isHope ? <HopeZones project={project} /> : <DefaultZones project={project} />}
      </div>

      {/* Progress bar */}
      <div
        ref={progressTrackRef}
        className="fixed bottom-0 left-0 right-0 h-[2px] z-50 transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(255,255,255,0.15)',
          opacity: 0,
        }}
      >
        <div
          ref={progressBarRef}
          className="h-full bg-white/60"
          style={{ width: '0%' }}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DEFAULT ZONES — existing generic moodboard
   ════════════════════════════════════════════════════════════════ */

function DefaultZones({ project }: { project: Project }) {
  return (
    <>
      {/* Zone 1: Hero */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw' }}>
        <div
          className="mb-elem absolute top-[15%] left-[8%] w-[45vw] h-[70vh] overflow-hidden"
          data-speed="0.3"
        >
          <PhotoDevelopImage
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full"
            threshold={0.05}
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
      <div className="relative flex-shrink-0 h-screen" style={{ width: '180vw', backgroundColor: `color-mix(in srgb, ${project.overlayColor} 85%, var(--plaster))` }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] bg-white p-4 shadow-lg"
          data-speed="0.8"
        >
          <PhotoDevelopImage
            src={project.images[1] || project.thumbnail}
            alt={`${project.name} detail`}
            className="w-[280px] h-[360px]"
            threshold={0.05}
          />
          <p className="text-xs mt-3 tracking-wide text-black/60">
            {project.location || 'Location'} — {project.year || '2025'}
          </p>
        </div>

        {project.area && (
          <div
            className="mb-elem absolute top-[50%] left-[35%] text-[18vw] font-bold text-white/10 leading-none"
            data-speed="0.2"
          >
            {project.area}m²
          </div>
        )}

        <div
          className="mb-elem absolute bottom-[15%] right-[20%] w-[35vw] h-[50vh] overflow-hidden"
          data-speed="0.4"
        >
          <PhotoDevelopImage
            src={project.images[2] || project.thumbnail}
            alt={`${project.name} view`}
            className="w-full h-full"
            threshold={0.05}
          />
        </div>

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
      <div className="relative flex-shrink-0 h-screen" style={{ width: '220vw', backgroundColor: `color-mix(in srgb, ${project.overlayColor} 70%, black 10%)` }}>
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
          <PhotoDevelopImage
            src={project.images[3] || project.images[1] || project.thumbnail}
            alt={`${project.name} craft`}
            className="w-full h-full"
            threshold={0.05}
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

        <div
          className="mb-elem absolute top-[15%] right-[25%] bg-white/95 p-3 shadow-xl"
          data-speed="0.7"
        >
          <PhotoDevelopImage
            src={project.images[4] || project.images[0]}
            alt="Detail study"
            className="w-[200px] h-[250px]"
            threshold={0.05}
          />
          <p className="text-[10px] mt-2 tracking-wider text-black/50 uppercase">Detail Study</p>
        </div>
      </div>

      {/* Zone 4: Year */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${project.overlayColor} 90%, black 5%)` }}>
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
          <PhotoDevelopImage
            src={project.images[5] || project.thumbnail}
            alt={`${project.name} featured`}
            className="w-full h-full"
            threshold={0.05}
          />
        </div>

        <p
          className="mb-elem absolute bottom-[20%] left-[20%] text-white text-xs tracking-widest uppercase"
          data-speed="0.75"
        >
          {categoryLabel[project.category]}
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
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   PEACE ZONES — Restoration of Peace devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function PeaceZones({ project }: { project: Project }) {
  const ov = '#8B8378';

  // Find the next project in the same category, wrapping around
  const sameCategoryProjects = projects.filter(p => p.category === project.category);
  const currentIndex = sameCategoryProjects.findIndex(p => p.id === project.id);
  const nextProject = sameCategoryProjects[(currentIndex + 1) % sameCategoryProjects.length];
  return (
    <>
      {/* ── Zone 1: Peace Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image1.png" alt="Courtyard doorway" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(5rem, 14vw, 16rem)' }}
          data-speed="0.5"
        >
          Peace
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s take a moment and let God restore the peace in and around you.
        </div>
      </div>

      {/* ── Zone 2: The Reflection ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--plaster))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          When was the last time you truly felt at rest?
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          Not just asleep, but at rest&mdash;deep in your bones, quiet in your thoughts, unhurried in your spirit? For most of us, that kind of stillness feels like a distant memory. We carry tension in our shoulders before our feet even hit the floor in the morning.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image2.png" alt="Serene bath with lush plants" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          We live in a world that rewards constant motion. Productivity is praised. Busyness is a badge. And somewhere along the way, rest became something we felt guilty about instead of something we were created for.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image3.png" alt="Restoration detail" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          David, the writer of Psalm 23, was no stranger to chaos. He had been hunted by a king, betrayed by friends, and burdened by war. Yet in the middle of all that turmoil, he wrote what may be the most peaceful passage in all of Scripture. He didn&rsquo;t write about rest from a place of leisure&mdash;he wrote about it from a place of lived experience with God&rsquo;s faithfulness.
        </div>

        {/* Gallery row — full-height images with percentage gaps to prevent overlap */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image4.png" alt="Outdoor shower with plants" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image5.png" alt="Shelf with mirror and bottles" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image6.png" alt="Arch doorway with stone basin" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          Notice the language: &ldquo;He makes me lie down.&rdquo; God doesn&rsquo;t suggest rest. He doesn&rsquo;t pencil it into our calendar if we have time. He makes us lie down. Like a shepherd who knows that an exhausted sheep will wander into danger, God sometimes brings us to a full stop because He knows what we need more than we do.
        </div>
      </div>

      {/* ── Zone 4: Still Waters + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--plaster))` }}>
        {/* Image 1 — full-height, matching Zone 3 size */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image7.png" alt="Still waters" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        {/* Text column between images */}
        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          And then He leads us beside &ldquo;quiet waters.&rdquo; Not raging rivers. Not crashing waves. Quiet waters. The Hebrew word for &ldquo;refreshes&rdquo; here is the word <em>shub</em>&mdash;which literally means &ldquo;to return&rdquo; or &ldquo;to restore.&rdquo; God&rsquo;s rest isn&rsquo;t just about stopping. It&rsquo;s about returning. Returning to the person you were before the anxiety took hold. Before the grief rewired your thinking. Before the burnout hollowed you out. God&rsquo;s restoration brings you back to wholeness.
        </div>

        {/* Image 2 — full-height, matching Zone 3 size */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image8.png" alt="Restoration detail" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          God&rsquo;s restoration begins not with doing more, but with allowing ourselves to be led into stillness.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          Peace is not the absence of problems; it is the presence of a Shepherd who knows exactly where to take us when we are depleted. Restoration of the soul starts when we stop striving and start trusting the One who never grows weary of caring for us.
        </div>

        {/* Image 3 — end of zone, full-height matching Zone 3 size */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image9.png" alt="Restoration space" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        {/* Text 1 */}
        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Maybe you&rsquo;re reading this in the middle of a packed schedule, on your phone between meetings, or late at night when the house is finally quiet. Wherever you are, consider this an invitation from your Shepherd. He is not asking you to earn rest&mdash;He is leading you to it.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[28%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;Lord, lead me beside still waters. Refresh my soul.&rdquo;
        </div>

        {/* Image 1 */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image10.png" alt="Application space" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        {/* Image 2 */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image11.png" alt="Peaceful retreat" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        {/* Text 2 */}
        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          Today, set aside just ten minutes. No phone. No agenda. No noise. Sit somewhere quiet and say it out loud. And then let Him. Don&rsquo;t rush it. Don&rsquo;t fill the silence with a to-do list. Just be led.
        </div>

        {/* Image 3 — after text 2 */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image12.png" alt="Restoration moment" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Lord, I confess that I have been running on empty. I have searched for rest in places that cannot give it. Today, I come to You, the Shepherd of my soul. Lead me to the green pastures and the quiet waters that only You can provide. Refresh what is weary in me. Restore what has been lost. Bring me back to wholeness, peace, and strength. I trust Your leading. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[8%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Psalm 23 &mdash; Restoration of Peace
        </p>

        {/* Final image — 4:3 ratio, wider to show full image */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image13.png" alt="Window nook with orchids" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <div className="relative flex-shrink-0 h-screen flex items-center justify-center" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 95%, black 10%)` }}>
        <div className="flex flex-col items-center text-center max-w-lg px-8">
          <h3
            className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[1.15] mb-6"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
          >
            Continue Restoring Your Peace
          </h3>
          <p className="text-sm text-white/50 tracking-wide leading-relaxed mb-10">
            Sign up for our newsletter to receive devotions that restores you
          </p>
          <div className="flex w-full max-w-md">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 bg-white/10 border border-white/20 text-white text-sm tracking-wide px-5 py-4 placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
            />
            <button className="px-6 py-4 bg-white text-mersi-dark text-sm tracking-wide hover:bg-white/90 transition-colors whitespace-nowrap">
              Subscribe
            </button>
          </div>
        </div>
      </div>

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          {/* Left Content */}
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>

          {/* Right Image */}
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   PEACE MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function PeaceMobile() {
  const bg = '#8B8378';
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--plaster))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Peace Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s take a moment and let God restore the peace in and around you.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(4rem, 18vw, 10rem)' }}
        >
          Peace
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={R1.courtyardDoor} alt="Courtyard doorway" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          When was the last time you truly felt at rest?
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          Not just asleep, but at rest&mdash;deep in your bones, quiet in your thoughts, unhurried in your spirit? For most of us, that kind of stillness feels like a distant memory. We carry tension in our shoulders before our feet even hit the floor in the morning.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          We live in a world that rewards constant motion. Productivity is praised. Busyness is a badge. And somewhere along the way, rest became something we felt guilty about instead of something we were created for.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          David, the writer of Psalm 23, was no stranger to chaos. He had been hunted by a king, betrayed by friends, and burdened by war. Yet in the middle of all that turmoil, he wrote what may be the most peaceful passage in all of Scripture.
        </p>
        <PhotoDevelopImage src={R1.outdoorShower} alt="Outdoor shower" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Notice the language: &ldquo;He makes me lie down.&rdquo; God doesn&rsquo;t suggest rest. He makes us lie down. Like a shepherd who knows that an exhausted sheep will wander into danger, God sometimes brings us to a full stop because He knows what we need more than we do.
        </p>
        <PhotoDevelopImage src={R1.stoneBedDark} alt="Stone bed" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          And then He leads us beside &ldquo;quiet waters.&rdquo; Not raging rivers. Not crashing waves. Quiet waters. The Hebrew word for &ldquo;refreshes&rdquo; here is the word <em>shub</em>&mdash;which literally means &ldquo;to return&rdquo; or &ldquo;to restore.&rdquo; God&rsquo;s restoration brings you back to wholeness.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={R1.bathPlants} alt="Bath with plants" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={R1.warmSauna} alt="Warm sauna" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          God&rsquo;s restoration begins not with doing more, but with allowing ourselves to be led into stillness.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Peace is not the absence of problems; it is the presence of a Shepherd who knows exactly where to take us when we are depleted.
        </p>
        <PhotoDevelopImage src={R1.stillPool} alt="Tranquil pool" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Maybe you&rsquo;re reading this in the middle of a packed schedule, on your phone between meetings, or late at night when the house is finally quiet. Wherever you are, consider this an invitation from your Shepherd. He is not asking you to earn rest&mdash;He is leading you to it.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;Lord, lead me beside still waters. Refresh my soul.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Today, set aside just ten minutes. No phone. No agenda. No noise. And then let Him. Don&rsquo;t rush it. Just be led.
        </p>
        <PhotoDevelopImage src={R1.archCouch} alt="Resting couch" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Lord, I confess that I have been running on empty. I have searched for rest in places that cannot give it. Today, I come to You, the Shepherd of my soul. Lead me to the green pastures and the quiet waters that only You can provide. Refresh what is weary in me. Restore what has been lost. Bring me back to wholeness, peace, and strength. I trust Your leading. Amen.
        </p>
        <PhotoDevelopImage src={R1.ivyNook} alt="Peaceful nook" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={R1.stoneBedLight} alt="Serene stone bed" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   HOPE ZONES — Restoration of Hope devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function HopeZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  const sameCategoryProjects = projects.filter(p => p.category === project.category);
  const currentIndex = sameCategoryProjects.findIndex(p => p.id === project.id);
  const nextProject = sameCategoryProjects[(currentIndex + 1) % sameCategoryProjects.length];

  return (
    <>
      {/* ── Zone 1: Hope Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image1.png" alt="Hope doorway" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(5rem, 14vw, 16rem)' }}
          data-speed="0.5"
        >
          Hope
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore a future you cannot see yet, and the God who holds it.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--plaster))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          Hope is a fragile thing.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          It can survive extraordinary hardship, but it can also be slowly suffocated by the weight of unanswered prayers, closed doors, and the quiet fear that maybe things will never get better. Perhaps you&rsquo;re in a season where hope feels more like a word on a greeting card than something real&mdash;a concept that sounds beautiful in theory but feels impossible in your actual life.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image2.png" alt="Hope landscape" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          You&rsquo;ve prayed. You&rsquo;ve waited. You&rsquo;ve tried to be faithful. And yet the breakthrough hasn&rsquo;t come. The healing hasn&rsquo;t happened. The relationship hasn&rsquo;t been reconciled. And in the silence, a dangerous whisper creeps in: &ldquo;What if this is all there is?&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image3.png" alt="Hope detail" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Jeremiah 29:11 is one of the most beloved verses in Scripture, but its full power is lost if we don&rsquo;t understand when God spoke it. This was not a promise delivered in a season of triumph. It was a letter&mdash;written by the prophet Jeremiah&mdash;to a people in exile. The Israelites had been ripped from their homeland and carried off to Babylon.
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image4.png" alt="Scripture scene" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image5.png" alt="Exile landscape" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image6.png" alt="Promise fulfilled" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          False prophets were telling them the exile would be brief, that God would rescue them any day now. But God&rsquo;s actual message through Jeremiah was far more challenging: settle in. Build houses. Plant gardens. The exile would last seventy years. And it is into that crushing news that God speaks this promise of hope.
        </div>
      </div>

      {/* ── Zone 4: God's Promise + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--plaster))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image7.png" alt="God's plans" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          He doesn&rsquo;t deny the difficulty. He doesn&rsquo;t promise a quick fix. He says, in essence: &ldquo;I know this is not what you wanted to hear. But I have not abandoned you. I have plans for you&mdash;and those plans end in flourishing, not destruction.&rdquo; The hope God offers is not tied to a timeline we control. It is anchored in a future He has already secured. And then comes the invitation: &ldquo;You will seek me and find me when you seek me with all your heart. I will be found by you,&rdquo; declares the Lord. Restoration doesn&rsquo;t begin with a change in circumstances. It begins with a turning of the heart.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image8.png" alt="Hope restored" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          God&rsquo;s plans for us do not expire in seasons of waiting.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          Hope is not wishful thinking&mdash;it is the confident assurance that God&rsquo;s intentions toward us are good, even when our circumstances suggest otherwise. Restoration of hope does not require an escape from the hard season. It requires a redirecting of our gaze toward the One who holds the future we cannot yet see.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image11.png" alt="Future hope" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          If you are in a season of waiting and your hope is wearing thin, do something countercultural today: plant something. Not because the exile is over, but because you believe God when He says it won&rsquo;t last forever. This could be literal&mdash;plant a seed, tend a garden. Or it could be metaphorical&mdash;invest in a friendship, start that project you&rsquo;ve been putting off, sign up for the class.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;Planting in exile is an act of defiant hope.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image10.png" alt="Planting in exile" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image13.png" alt="Defiant hope" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          It declares that you trust God&rsquo;s future more than your present feelings. And as you plant, seek Him. Not casually. With all your heart. Because He has promised: when you search for Him wholeheartedly, you will find Him. And finding Him is the beginning of every restoration.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image12.png" alt="Restoration moment" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Father, I confess that my hope has grown thin. I&rsquo;ve been waiting, and the waiting has worn me down. But today I choose to believe Your word over my weariness. You said You have plans for me&mdash;plans for a hope and a future. I can&rsquo;t see that future yet, but I trust the One who holds it. Restore my hope, Lord. Give me the courage to plant in exile, to build in the waiting, and to seek You with everything I have. I believe that You will be found. Bring me back, Lord. Bring me home. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Jeremiah 29:11 &mdash; Restoration of Hope
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image14.png" alt="Hope fulfilled" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <div className="relative flex-shrink-0 h-screen flex items-center justify-center" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 95%, black 10%)` }}>
        <div className="flex flex-col items-center text-center max-w-lg px-8">
          <h3
            className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[1.15] mb-6"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
          >
            Continue Restoring Your Hope
          </h3>
          <p className="text-sm text-white/50 tracking-wide leading-relaxed mb-10">
            Sign up for our newsletter to receive devotions that restores you
          </p>
          <div className="flex w-full max-w-md">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 bg-white/10 border border-white/20 text-white text-sm tracking-wide px-5 py-4 placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
            />
            <button className="px-6 py-4 bg-white text-mersi-dark text-sm tracking-wide hover:bg-white/90 transition-colors whitespace-nowrap">
              Subscribe
            </button>
          </div>
        </div>
      </div>

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   HOPE MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function HopeMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--plaster))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Hope Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore a future you cannot see yet, and the God who holds it.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(4rem, 18vw, 10rem)' }}
        >
          Hope
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src="/restoration3/image1.png" alt="Hope doorway" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          Hope is a fragile thing.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          It can survive extraordinary hardship, but it can also be slowly suffocated by the weight of unanswered prayers, closed doors, and the quiet fear that maybe things will never get better. Perhaps you&rsquo;re in a season where hope feels more like a word on a greeting card than something real&mdash;a concept that sounds beautiful in theory but feels impossible in your actual life.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          You&rsquo;ve prayed. You&rsquo;ve waited. You&rsquo;ve tried to be faithful. And yet the breakthrough hasn&rsquo;t come. The healing hasn&rsquo;t happened. The relationship hasn&rsquo;t been reconciled. And in the silence, a dangerous whisper creeps in: &ldquo;What if this is all there is?&rdquo;
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Jeremiah 29:11 is one of the most beloved verses in Scripture, but its full power is lost if we don&rsquo;t understand when God spoke it. This was not a promise delivered in a season of triumph. It was a letter&mdash;written by the prophet Jeremiah&mdash;to a people in exile.
        </p>
        <PhotoDevelopImage src="/restoration3/image4.png" alt="Scripture scene" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          False prophets were telling them the exile would be brief. But God&rsquo;s actual message was far more challenging: settle in. Build houses. Plant gardens. The exile would last seventy years. And it is into that crushing news that God speaks this promise of hope. He doesn&rsquo;t deny the difficulty. He doesn&rsquo;t promise a quick fix. He says: &ldquo;I have not abandoned you. I have plans for you&mdash;and those plans end in flourishing, not destruction.&rdquo;
        </p>
        <PhotoDevelopImage src="/restoration3/image5.png" alt="Exile landscape" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          And then comes the invitation: &ldquo;You will seek me and find me when you seek me with all your heart. I will be found by you,&rdquo; declares the Lord. Restoration doesn&rsquo;t begin with a change in circumstances. It begins with a turning of the heart&mdash;toward the God who has been there all along, even in exile.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src="/restoration3/image2.png" alt="Hope landscape" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src="/restoration3/image7.png" alt="God's plans" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          God&rsquo;s plans for us do not expire in seasons of waiting.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Hope is not wishful thinking&mdash;it is the confident assurance that God&rsquo;s intentions toward us are good, even when our circumstances suggest otherwise. Restoration of hope does not require an escape from the hard season. It requires a redirecting of our gaze toward the One who holds the future we cannot yet see.
        </p>
        <PhotoDevelopImage src="/restoration3/image8.png" alt="Hope restored" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          If you are in a season of waiting and your hope is wearing thin, do something countercultural today: plant something. Not because the exile is over, but because you believe God when He says it won&rsquo;t last forever. This could be literal&mdash;plant a seed, tend a garden. Or it could be metaphorical&mdash;invest in a friendship, start that project you&rsquo;ve been putting off, sign up for the class.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;Planting in exile is an act of defiant hope.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          It declares that you trust God&rsquo;s future more than your present feelings. And as you plant, seek Him. Not casually. With all your heart. Because He has promised: when you search for Him wholeheartedly, you will find Him. And finding Him is the beginning of every restoration.
        </p>
        <PhotoDevelopImage src="/restoration3/image10.png" alt="Planting in exile" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Father, I confess that my hope has grown thin. I&rsquo;ve been waiting, and the waiting has worn me down. But today I choose to believe Your word over my weariness. You said You have plans for me&mdash;plans for a hope and a future. I can&rsquo;t see that future yet, but I trust the One who holds it. Restore my hope, Lord. Give me the courage to plant in exile, to build in the waiting, and to seek You with everything I have. I believe that You will be found. Bring me back, Lord. Bring me home. Amen.
        </p>
        <PhotoDevelopImage src="/restoration3/image13.png" alt="Hope fulfilled" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src="/restoration3/image14.png" alt="Restoration complete" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DEFAULT MOBILE — existing generic fallback
   ════════════════════════════════════════════════════════════════ */

function MoodBoardMobile({ project }: { project: Project }) {
  const label = categoryLabel[project.category];

  return (
    <div style={{ backgroundColor: project.overlayColor }}>
      {/* Zone 1: Hero */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <PhotoDevelopImage
          src={project.thumbnail}
          alt={project.name}
          className="w-full h-[60vh] mb-8"
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
          <PhotoDevelopImage
            src={project.images[1] || project.thumbnail}
            alt={`${project.name} detail`}
            className="w-[240px] h-[300px]"
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
        <PhotoDevelopImage
          src={project.images[3] || project.images[1] || project.thumbnail}
          alt={`${project.name} craft`}
          className="w-full h-[40vh] mb-8"
        />
        <p className="text-white/80 text-sm leading-relaxed">
          {project.description || 'Every detail matters. From material selection to spatial flow, we consider how spaces evolve with their inhabitants.'}
        </p>
      </section>

      {/* Zone 4: Year */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <div className="text-[20vw] font-bold text-white/15 mb-8">{project.year || '2025'}</div>
        <PhotoDevelopImage
          src={project.images[5] || project.thumbnail}
          alt={`${project.name} featured`}
          className="w-full h-[50vh] mb-4"
        />
        <p className="text-white text-xs tracking-widest uppercase">{label}</p>
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
