// src/components/sections/PurposeStack.tsx
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import type { Project } from '@/types';
import { devotions } from '@/data/devotions';
import { computePillData, type PillData } from './purpose-stack-data';
import { PurposeStackPill, type PurposeStackPillHandle } from './PurposeStackPill';
import { HeroMaskClipDef } from '@/components/ui-custom/HeroMaskClipDef';
import { useRouteTransitionContext } from '@/transitions/RouteTransitionContext';

gsap.registerPlugin(ScrollTrigger);

interface Props {
  projects: Project[];
}

const CYCLES = 10; // K — number of cycles spanned by the pinned scroll range

export function PurposeStack({ projects }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slotARef = useRef<HTMLDivElement>(null);
  const slotBRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<PurposeStackPillHandle>(null);

  // Tracks the last applied integer step (so slot data swaps fire once per boundary)
  const lastStepRef = useRef<number | null>(null);
  // Tracks the currently visible devotion (drives pill morph + click handler)
  const visibleIdxRef = useRef<number>(0);

  const pillDataPerPanel = useMemo<PillData[]>(
    () => projects.map((p) => computePillData(p, devotions[p.id])),
    [projects],
  );

  const routeTransition = useRouteTransitionContext();

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const wrapper = wrapperRef.current;
    const slotA = slotARef.current;
    const slotB = slotBRef.current;
    if (!stage || !wrapper || !slotA || !slotB) return;

    const N = pillDataPerPanel.length;
    if (N === 0) return;

    const ctx = gsap.context(() => {
      // Initial slot state
      setSlotImages(slotA, pillDataPerPanel[0]);
      setSlotImages(slotB, pillDataPerPanel[1 % N]);
      const aHalves = getHalves(slotA);
      const bHalves = getHalves(slotB);
      gsap.set([aHalves.l, aHalves.r], { yPercent: 0 });
      if (bHalves.l) gsap.set(bHalves.l, { yPercent: 100 });
      if (bHalves.r) gsap.set(bHalves.r, { yPercent: -100 });

      lastStepRef.current = 0;
      visibleIdxRef.current = 0;

      ScrollTrigger.create({
        trigger: wrapper,
        start: 'top top',
        end: () => `+=${CYCLES * N * window.innerHeight}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        snap: {
          snapTo: 1 / (CYCLES * N),
          duration: reducedMotion ? 0 : 0.7,
          ease: 'power2.inOut',
          delay: 0.15,
          inertia: false,
          directional: false,
        },
        onUpdate: (self) => {
          const globalStep = self.progress * CYCLES * N;
          const intStep = Math.floor(globalStep);
          let frac = globalStep - intStep;
          if (frac < 0) frac += 1; // safety for negative floor edge cases

          const aIdx = ((intStep % N) + N) % N;
          const bIdx = (aIdx + 1) % N;

          if (intStep !== lastStepRef.current) {
            lastStepRef.current = intStep;
            setSlotImages(slotA, pillDataPerPanel[aIdx]);
            setSlotImages(slotB, pillDataPerPanel[bIdx]);
          }

          if (reducedMotion) {
            // Snap-cut: halves either fully met or fully off-screen, no interpolation
            const met = frac >= 0.5;
            if (bHalves.l) gsap.set(bHalves.l, { yPercent: met ? 0 : 100 });
            if (bHalves.r) gsap.set(bHalves.r, { yPercent: met ? 0 : -100 });
          } else {
            const t = 1 - frac;
            if (bHalves.l) gsap.set(bHalves.l, { yPercent: 100 * t });
            if (bHalves.r) gsap.set(bHalves.r, { yPercent: -100 * t });
          }

          // Active devotion (for pill + click handler): same half-meet rule as before
          const visibleIdx = frac < 0.5 ? aIdx : bIdx;
          if (visibleIdx !== visibleIdxRef.current) {
            visibleIdxRef.current = visibleIdx;
            const data = pillDataPerPanel[visibleIdx];
            if (reducedMotion) pillRef.current?.setStatic(data);
            else pillRef.current?.morphTo(data);
          }
        },
      });
    }, wrapper);

    return () => ctx.revert();
  }, [pillDataPerPanel, reducedMotion]);

  // Scroll to top on mount (parity with prior behavior).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handlePillActivate = () => {
    if (!routeTransition) return;
    const i = visibleIdxRef.current;
    const project = projects[i];
    const data = pillDataPerPanel[i];
    if (!project) return;
    // Both mobile and desktop fire the same SplitTransition curtain the home
    // grid uses, for a reveal that's consistent with every other entry into a
    // purpose detail.
    routeTransition.beginCurtainNavigation(`/purpose/${project.id}`, data.pillColor);
  };

  if (pillDataPerPanel.length === 0) return null;

  return (
    <div ref={wrapperRef} className="ps-wrap relative w-full bg-[var(--app-bg)]">
      <HeroMaskClipDef />
      <div ref={stageRef} className="ps-stage relative w-full h-screen overflow-hidden">
        <Slot ref={slotARef} z={1} />
        <Slot ref={slotBRef} z={2} />
        <PurposeStackPill
          ref={pillRef}
          initial={pillDataPerPanel[0]}
          onActivate={handlePillActivate}
        />
      </div>
    </div>
  );
}

// --- helpers ---

function getHalves(slot: HTMLDivElement) {
  return {
    l: slot.querySelector<HTMLDivElement>('[data-ps-half="l"]'),
    r: slot.querySelector<HTMLDivElement>('[data-ps-half="r"]'),
  };
}

function setSlotImages(slot: HTMLDivElement, data: PillData) {
  const l = slot.querySelector<HTMLDivElement>('[data-ps-half="l"]');
  const r = slot.querySelector<HTMLDivElement>('[data-ps-half="r"]');
  if (l) l.style.backgroundImage = `url(${data.leftImage})`;
  if (r) r.style.backgroundImage = `url(${data.rightImage})`;
}

const Slot = forwardRef<HTMLDivElement, { z: number }>(function Slot({ z }, ref) {
  return (
    <div
      ref={ref}
      className="absolute inset-0 grid grid-cols-2 overflow-hidden"
      style={{ zIndex: z }}
    >
      <div
        data-ps-half="l"
        className="relative overflow-hidden will-change-transform"
        style={{ backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div
        data-ps-half="r"
        className="relative overflow-hidden will-change-transform"
        style={{ backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15 pointer-events-none" />
    </div>
  );
});
