// src/components/sections/PurposeStack.tsx
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import type { Project } from '@/types';
import { devotions } from '@/data/devotions';
import { computePillData, type PillData } from './purpose-stack-data';
import { PurposeStackPill, type PurposeStackPillHandle } from './PurposeStackPill';
import { HeroMaskClipDef } from '@/components/ui-custom/HeroMaskClipDef';
import { usePillExpandNavigation } from '@/transitions/usePillExpandNavigation';

gsap.registerPlugin(ScrollTrigger);

interface Props {
  projects: Project[];
}

export function PurposeStack({ projects }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<PurposeStackPillHandle>(null);
  const currentIndexRef = useRef<number>(0);

  const pillDataPerPanel = useMemo<PillData[]>(
    () => projects.map((p) => computePillData(p, devotions[p.id])),
    [projects],
  );

  const { startFromPill } = usePillExpandNavigation();

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Master pinned timeline. Skips work when reducedMotion or narrow viewport.
  useLayoutEffect(() => {
    if (reducedMotion) return;
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return;

    const stage = stageRef.current;
    const wrapper = wrapperRef.current;
    if (!stage || !wrapper) return;

    const panels = Array.from(stage.querySelectorAll<HTMLDivElement>('[data-ps-panel]'));
    if (panels.length === 0) return;

    const ctx = gsap.context(() => {
      // Initial state for panels 2..N.
      panels.forEach((panel, i) => {
        if (i === 0) return;
        const l = panel.querySelector<HTMLDivElement>('[data-ps-half="l"]');
        const r = panel.querySelector<HTMLDivElement>('[data-ps-half="r"]');
        if (l) gsap.set(l, { yPercent: 100 });
        if (r) gsap.set(r, { yPercent: -100 });
      });

      // Total timeline duration = N-1 (each panel transition is duration 1).
      // Panel i becomes "current" when progress crosses (i - 0.5) / (N-1).
      const totalDuration = panels.length - 1;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapper,
          start: 'top top',
          end: () => `+=${totalDuration * window.innerHeight}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            // Determine which devotion is currently focal based on scrubbed
            // progress. The active index advances at the half-meet point of
            // each transition (progress = (i - 0.5) / totalDuration).
            const progress = self.progress;
            let idx = 0;
            for (let i = 1; i < panels.length; i++) {
              if (progress >= (i - 0.5) / totalDuration) idx = i;
              else break;
            }
            if (idx !== currentIndexRef.current) {
              currentIndexRef.current = idx;
              pillRef.current?.morphTo(pillDataPerPanel[idx]);
            }
          },
        },
      });

      panels.forEach((panel, i) => {
        if (i === 0) return;
        const l = panel.querySelector<HTMLDivElement>('[data-ps-half="l"]');
        const r = panel.querySelector<HTMLDivElement>('[data-ps-half="r"]');
        if (l) tl.to(l, { yPercent: 0, ease: 'none' }, i - 1);
        if (r) tl.to(r, { yPercent: 0, ease: 'none' }, i - 1);
      });
    }, wrapper);

    return () => ctx.revert();
  }, [pillDataPerPanel, reducedMotion]);

  // Scroll to top on mount (parity with current PurposeGallery).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handlePillActivate = () => {
    const i = currentIndexRef.current;
    const project = projects[i];
    const data = pillDataPerPanel[i];
    const pillRoot = pillRef.current?.getRoot();
    if (!project || !pillRoot) return;
    startFromPill({
      pillEl: pillRoot,
      pillColor: data.pillColor,
      targetUrl: `/purpose/${project.id}`,
      reducedMotion,
    });
  };

  if (pillDataPerPanel.length === 0) return null;

  const useFallback =
    reducedMotion ||
    (typeof window !== 'undefined' && window.innerWidth <= 768);

  if (useFallback) {
    return (
      <FallbackStack
        projects={projects}
        pillDataPerPanel={pillDataPerPanel}
        onPillActivate={(i) => {
          const project = projects[i];
          const data = pillDataPerPanel[i];
          if (!project) return;
          // No shared pill in fallback; pass the activated panel's pill root.
          // `.ps-pill` is the actual pill element (absolute-positioned with the
          // pill geometry); the `[data-ps-fallback-pill]` wrapper has 0 height.
          const root = document.querySelector<HTMLDivElement>(
            `[data-ps-fallback-panel="${i}"] .ps-pill`,
          );
          if (!root) return;
          startFromPill({
            pillEl: root,
            pillColor: data.pillColor,
            targetUrl: `/purpose/${project.id}`,
            reducedMotion,
          });
        }}
      />
    );
  }

  return (
    <div ref={wrapperRef} className="ps-wrap relative w-full bg-[var(--app-bg)] pt-20">
      <HeroMaskClipDef />
      <div ref={stageRef} className="ps-stage relative w-full h-screen overflow-hidden">
        {projects.map((project, i) => {
          const data = pillDataPerPanel[i];
          return (
            <div
              key={project.id}
              data-ps-panel
              className="absolute inset-0 grid grid-cols-2 overflow-hidden"
              style={{ zIndex: i + 1 }}
            >
              <div
                data-ps-half="l"
                className="relative overflow-hidden will-change-transform"
                style={{
                  backgroundImage: `url(${data.leftImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div
                data-ps-half="r"
                className="relative overflow-hidden will-change-transform"
                style={{
                  backgroundImage: `url(${data.rightImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15 pointer-events-none" />
            </div>
          );
        })}

        <PurposeStackPill
          ref={pillRef}
          initial={pillDataPerPanel[0]}
          onActivate={handlePillActivate}
        />
      </div>
    </div>
  );
}

function FallbackStack({
  projects,
  pillDataPerPanel,
  onPillActivate,
}: {
  projects: Project[];
  pillDataPerPanel: PillData[];
  onPillActivate: (index: number) => void;
}) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion) return;

    const ctx = gsap.context(() => {
      const panels = gsap.utils.toArray<HTMLDivElement>('[data-ps-fallback-panel]');
      panels.forEach((panel) => {
        const l = panel.querySelector<HTMLDivElement>('[data-ps-half="l"]');
        const r = panel.querySelector<HTMLDivElement>('[data-ps-half="r"]');
        if (l) gsap.set(l, { yPercent: 100 });
        if (r) gsap.set(r, { yPercent: -100 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: panel,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        });
        if (l) tl.to(l, { yPercent: 0, duration: 1.0, ease: 'power3.out' }, 0);
        if (r) tl.to(r, { yPercent: 0, duration: 1.0, ease: 'power3.out' }, 0);
      });
    });

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div className="ps-wrap relative w-full bg-[var(--app-bg)] pt-20">
      <HeroMaskClipDef />
      {projects.map((project, i) => {
        const data = pillDataPerPanel[i];
        return (
          <section
            key={project.id}
            data-ps-fallback-panel={i}
            className="relative w-full h-screen overflow-hidden grid grid-cols-2"
            style={{ backgroundColor: data.pillColor }}
          >
            <div
              data-ps-half="l"
              className="relative overflow-hidden will-change-transform"
              style={{
                backgroundImage: `url(${data.leftImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div
              data-ps-half="r"
              className="relative overflow-hidden will-change-transform"
              style={{
                backgroundImage: `url(${data.rightImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15 pointer-events-none" />
            <div data-ps-fallback-pill>
              <PurposeStackPill
                initial={data}
                onActivate={() => onPillActivate(i)}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
