# Mobile PurposeGrid Parallax Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile horizontal-strip + hover-overlay treatment of the `PurposeGrid` section with a vertical parallax-scroll list of alternating-side text/image tiles, leaving desktop behavior unchanged.

**Architecture:** Mirror the existing `Hero` / `HeroDesktop` / `HeroMobile` split. The current monolithic `PurposeGrid.tsx` is broken into a thin top-level `PurposeGrid` (filter state + section chrome) that branches on `useIsMobile()` and mounts either an extracted `DesktopMosaic` (current desktop behavior) or a new `MobileParallaxList`. Each `MobileProjectTile` owns its own Framer Motion `useScroll` / `useTransform` for a scroll-scrubbed clip-path image reveal and a blurred text fade.

**Tech Stack:** React 18, TypeScript, Tailwind, Framer Motion (per-tile motion), GSAP + ScrollTrigger (existing section-level reveals, kept), Vitest + Testing Library (tests).

**Spec:** [`docs/superpowers/specs/2026-05-29-mobile-purpose-grid-parallax-design.md`](../specs/2026-05-29-mobile-purpose-grid-parallax-design.md)

---

## File Structure

**Created:**
- `src/components/sections/DesktopMosaic.tsx` — extracted desktop subtree (grid container, strip→grid Flip morph, filter-reflow Flip, `ProjectCard`, dots observer, `PurposeGridDots` mount).
- `src/components/sections/MobileParallaxList.tsx` — new mobile list. Maps `filteredProjects` to `MobileProjectTile` with alternating order.
- `src/components/sections/MobileProjectTile.tsx` — new mobile tile. Owns its `useScroll`/`useTransform` reveal. Renders eyebrow + devotion title + scripture next to the image.
- `src/components/sections/MobileProjectTile.test.tsx` — content, fallback, click, reduced-motion tests.
- `src/components/sections/MobileParallaxList.test.tsx` — tile-per-project, alternation tests.

**Modified:**
- `src/components/sections/PurposeGrid.tsx` — collapses to a thin section wrapper that holds filter state + watermark + filter tabs and branches on `useIsMobile()`. The strip→grid Flip code, `ProjectCard`, dots observer, and `PurposeGridDots` import move into `DesktopMosaic.tsx`.

**Left in place (no edit):**
- `src/components/sections/PurposeGridDots.tsx` — still imported, now only by `DesktopMosaic`. Net effect: it stops rendering (desktop never showed it; mobile no longer does). File kept for revert safety; follow-up can delete.
- `src/data/projects.ts`, `src/data/devotions.ts`, `src/types/index.ts` — consumed unchanged.
- `src/hooks/use-mobile.ts` — `useIsMobile()` and `MOBILE_BREAKPOINT` consumed unchanged.

---

## Task 1: Extract DesktopMosaic from PurposeGrid (refactor, no behavior change)

**Goal:** Move all desktop-specific rendering and effects into a new `DesktopMosaic` component while keeping `PurposeGrid`'s public behavior identical. This is a pure refactor — no visual or behavioral change yet, on either desktop or mobile.

**Files:**
- Create: `src/components/sections/DesktopMosaic.tsx`
- Modify: `src/components/sections/PurposeGrid.tsx`

- [ ] **Step 1: Run the existing test suite to capture a green baseline**

Run: `npm run test -- --run src/components/sections/PurposeGridDots.test.tsx`
Expected: PASS (3 tests).

Also run `npm run test -- --run` to confirm the full suite is green before touching anything.

- [ ] **Step 2: Create DesktopMosaic.tsx with the extracted desktop subtree**

Create `src/components/sections/DesktopMosaic.tsx` containing:
- The `overlayLabelById` constant (moved out of `PurposeGrid.tsx`).
- The `computeSpans` function (moved out).
- The `ProjectCard` component (moved out, unchanged).
- A new `DesktopMosaic` component that accepts the props it needs and renders the grid container, dots observer, `PurposeGridDots`, the strip→grid Flip morph, and the filter-reflow Flip.

```tsx
import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import gsap from 'gsap';
import { Flip, ScrollTrigger } from 'gsap/all';
import { motion, AnimatePresence } from 'framer-motion';
import { PurposeGridDots } from './PurposeGridDots';
import { categoryLabel } from '@/data/projects';
import { MOBILE_BREAKPOINT } from '@/hooks/use-mobile';
import type { Project } from '@/types';

gsap.registerPlugin(Flip, ScrollTrigger);

const overlayLabelById: Record<string, string> = {
  peace: 'Restoration of Peace',
  hope: 'Restoration of Hope',
  strength: 'Restoration of Strength',
  wholeness: 'Restoration of Wholeness',
  purpose: 'Restoration of Purpose',
  connection: 'Restoration of Connection',
  identity: 'Restoration of Identity',
  joy: 'Restoration of Joy',
  forgiveness: 'Serenity of Forgiveness',
  surrender: 'Serenity of Surrender',
  trust: 'Serenity of Trust',
};

function computeSpans(n: number): number[] {
  const rows: number[] = [];
  let remaining = n;
  let rowIdx = 0;
  while (remaining > 0) {
    const expected = rowIdx % 2 === 0 ? 3 : 4;
    const take = Math.min(expected, remaining);
    rows.push(take);
    remaining -= take;
    rowIdx += 1;
  }
  if (rows.length >= 2 && rows[rows.length - 1] === 1 && rows[rows.length - 2] === 3) {
    rows[rows.length - 2] = 4;
    rows.pop();
  }
  const spans: number[] = [];
  for (const count of rows) {
    const span = count === 3 ? 4 : 3;
    for (let k = 0; k < count; k++) spans.push(span);
  }
  return spans;
}

function ProjectCard({
  project,
  span,
  heightClass,
  onProjectClick,
  hoverEnabled,
}: {
  project: Project;
  span: number;
  heightClass: string;
  onProjectClick: (project: Project) => void;
  hoverEnabled: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!hoverEnabled && isHovered) setIsHovered(false);
  }, [hoverEnabled, isHovered]);

  return (
    <div
      data-flip-id={project.id}
      data-span={span}
      onClick={() => onProjectClick(project)}
      onMouseEnter={() => hoverEnabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`pg-img group relative flex-shrink-0 md:min-w-0 w-44 md:w-auto ${heightClass} snap-center md:snap-align-none cursor-pointer overflow-hidden`}
      style={{ borderRadius: '2px' }}
    >
      <img
        src={project.thumbnail}
        alt={project.name}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <motion.div
        className="pg-hover-overlay absolute top-0 left-0 w-1/2 h-full backdrop-blur-sm"
        style={{ backgroundColor: project.overlayColor }}
        initial={{ x: '-100%' }}
        animate={{ x: isHovered ? 0 : '-100%' }}
        transition={{ duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] }}
      />
      <motion.div
        className="pg-hover-overlay absolute top-0 right-0 w-1/2 h-full backdrop-blur-sm"
        style={{ backgroundColor: project.overlayColor }}
        initial={{ x: '100%' }}
        animate={{ x: isHovered ? 0 : '100%' }}
        transition={{ duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] }}
      />
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="pg-hover-overlay absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <img
              src="/logo-icon.png"
              alt=""
              className="w-6 md:w-8 opacity-25 invert mb-3"
            />
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
              {overlayLabelById[project.id] ?? categoryLabel[project.category]}
            </span>
            <motion.span
              className="absolute bottom-8 right-4 text-lg italic text-white/80"
              style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 300 }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              Start here
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface DesktopMosaicProps {
  sectionRef: React.RefObject<HTMLElement>;
  filteredProjects: Project[];
  flipStateRef: React.MutableRefObject<Flip.FlipState | null>;
  onProjectClick: (project: Project) => void;
}

export function DesktopMosaic({
  sectionRef,
  filteredProjects,
  flipStateRef,
  onProjectClick,
}: DesktopMosaicProps) {
  const [gridReady, setGridReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const morphTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const spans = useMemo(
    () => computeSpans(filteredProjects.length),
    [filteredProjects.length]
  );

  // Scroll-linked come-in for the whole image strip (kept from PurposeGrid).
  useEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        grid,
        { opacity: 0, y: 40, filter: 'blur(10px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          ease: 'power2.out',
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 95%',
            end: 'top 10%',
            scrub: 3,
            invalidateOnRefresh: true,
          },
        }
      );
    }, section);
    return () => ctx.revert();
  }, [sectionRef]);

  // Mobile-only IntersectionObserver to track the centered tile.
  useEffect(() => {
    const root = gridRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.innerWidth >= MOBILE_BREAKPOINT) return;
    const tiles = Array.from(root.querySelectorAll<HTMLElement>('[data-flip-id]'));
    if (tiles.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const id = (entry.target as HTMLElement).getAttribute('data-flip-id');
            if (id) setActiveId(id);
          }
        }
      },
      {
        root: null,
        rootMargin: '-40% 0px -40% 0px',
        threshold: [0, 0.5, 1],
      }
    );
    for (const tile of tiles) observer.observe(tile);
    return () => observer.disconnect();
  }, [filteredProjects]);

  // Strip → grid auto-playing morph.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      grid.dataset.layout = 'grid';
      setGridReady(true);
      return;
    }
    const items = Array.from(
      grid.querySelectorAll<HTMLElement>('[data-flip-id]')
    );
    if (items.length === 0) return;
    for (const el of items) {
      el.style.position = '';
      el.style.top = '';
      el.style.left = '';
      el.style.width = '';
      el.style.height = '';
      el.style.transform = '';
    }
    grid.style.minHeight = '';
    const ctx = gsap.context(() => {
      grid.dataset.layout = 'strip';
      void grid.offsetHeight;
      const state = Flip.getState(items);
      grid.dataset.layout = 'grid';
      void grid.offsetHeight;
      let hoverDelayId: ReturnType<typeof gsap.delayedCall> | null = null;
      const tl = Flip.from(state, {
        duration: 1.2,
        ease: 'power2.inOut',
        paused: true,
      });
      morphTimelineRef.current = tl;
      const firstItem = items[0];
      ScrollTrigger.create({
        trigger: firstItem,
        start: 'bottom bottom',
        invalidateOnRefresh: true,
        onEnter: () => {
          tl.play();
          hoverDelayId = gsap.delayedCall(1.3, () => setGridReady(true));
        },
        onLeaveBack: () => {
          if (hoverDelayId) { hoverDelayId.kill(); hoverDelayId = null; }
          setGridReady(false);
          tl.reverse();
        },
      });
    }, section);
    return () => {
      ctx.revert();
      grid.style.minHeight = '';
      for (const el of items) {
        el.style.position = '';
        el.style.top = '';
        el.style.left = '';
        el.style.width = '';
        el.style.height = '';
        el.style.transform = '';
      }
      morphTimelineRef.current = null;
    };
  }, [filteredProjects, sectionRef]);

  // Filter reflow (grid → grid).
  useLayoutEffect(() => {
    if (!flipStateRef.current || !gridRef.current) return;
    const tl = Flip.from(flipStateRef.current, {
      duration: 0.6,
      ease: 'power2.inOut',
      absolute: true,
      stagger: 0.02,
      onEnter: (elements) =>
        gsap.fromTo(elements, { opacity: 0 }, { opacity: 1, duration: 0.4 }),
      onLeave: (elements) =>
        gsap.to(elements, { opacity: 0, duration: 0.3 }),
    });
    flipStateRef.current = null;
    return () => {
      tl.kill();
    };
  }, [filteredProjects, flipStateRef]);

  return (
    <>
      <div
        ref={gridRef}
        data-layout="strip"
        className="relative flex w-full items-end gap-1 px-0 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none"
        style={{ background: 'var(--app-bg)' }}
      >
        {filteredProjects.map((project, index) => {
          const heightCycle = [
            'h-64 md:h-[22rem]',
            'h-72 md:h-[24rem]',
            'h-60 md:h-[20rem]',
            'h-[17rem] md:h-[23rem]',
            'h-72 md:h-[25rem]',
            'h-64 md:h-[21rem]',
            'h-[17rem] md:h-[22.5rem]',
            'h-72 md:h-[24rem]',
          ];
          const h = heightCycle[index % heightCycle.length];
          const span = spans[index] ?? 3;
          return (
            <ProjectCard
              key={project.id}
              project={project}
              span={span}
              heightClass={h}
              onProjectClick={onProjectClick}
              hoverEnabled={gridReady}
            />
          );
        })}
      </div>
      <PurposeGridDots projects={filteredProjects} activeId={activeId} />
    </>
  );
}
```

- [ ] **Step 3: Trim PurposeGrid.tsx to consume DesktopMosaic**

Replace `src/components/sections/PurposeGrid.tsx` with a version that no longer holds the grid logic. It keeps section ref, filter state, the section/watermark/filters reveals, and mounts `DesktopMosaic`.

```tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Flip, ScrollTrigger } from 'gsap/all';
import { FilterTabs } from '@/components/ui-custom/FilterTabs';
import { DesktopMosaic } from './DesktopMosaic';
import type { FilterCategory, Project } from '@/types';

gsap.registerPlugin(Flip, ScrollTrigger);

interface PurposeGridProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
}

export function PurposeGrid({ projects, onProjectClick }: PurposeGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const sectionRef = useRef<HTMLElement>(null);
  const watermarkRef = useRef<HTMLSpanElement>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);

  // Smooth fade-in for the entire section.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        section,
        { opacity: 0 },
        {
          opacity: 1,
          ease: 'power2.out',
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 90%',
            end: 'top 30%',
            scrub: 5,
            invalidateOnRefresh: true,
          },
        }
      );
    }, section);
    return () => ctx.revert();
  }, []);

  // Scroll-linked reveal for the filter tabs.
  useEffect(() => {
    const section = sectionRef.current;
    const filters = filterWrapRef.current;
    if (!section || !filters) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        filters,
        { opacity: 0, y: 40, filter: 'blur(8px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          ease: 'power2.out',
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 85%',
            end: 'top 20%',
            scrub: 5,
            invalidateOnRefresh: true,
          },
        }
      );
    }, section);
    return () => ctx.revert();
  }, []);

  // Scroll-linked reveal for the "Devotions" watermark.
  useEffect(() => {
    const section = sectionRef.current;
    const watermark = watermarkRef.current;
    if (!section || !watermark) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        watermark,
        { opacity: 0, y: 20, filter: 'blur(8px)' },
        {
          opacity: 0.32,
          y: 0,
          filter: 'blur(0px)',
          ease: 'power2.out',
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 85%',
            end: 'top 20%',
            scrub: 5,
            invalidateOnRefresh: true,
          },
        }
      );
    }, section);
    return () => ctx.revert();
  }, []);

  // Reset to "all" when scrolling past the section's bottom edge.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        onLeaveBack: () => setActiveFilter('all'),
      });
    }, section);
    return () => ctx.revert();
  }, []);

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return projects;
    return projects.filter((project) => project.category === activeFilter);
  }, [activeFilter, projects]);

  const handleFilterChange = (next: FilterCategory) => {
    setActiveFilter(next);
  };

  return (
    <section
      ref={sectionRef}
      id="projects"
      className="pt-44 md:pt-64 pb-16 md:pb-24 px-0"
      style={{ background: 'var(--app-bg)', position: 'relative' }}
    >
      <span
        ref={watermarkRef}
        aria-hidden="true"
        className="pg-devotions-watermark"
      >
        Devotions
      </span>
      <div ref={filterWrapRef} className="px-4 md:px-8 mb-4 md:mb-6">
        <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} />
      </div>
      <DesktopMosaic
        sectionRef={sectionRef}
        filteredProjects={filteredProjects}
        flipStateRef={flipStateRef}
        onProjectClick={onProjectClick}
      />
    </section>
  );
}
```

Note: this version intentionally drops the `morphTimelineRef.current.progress(1)` from `handleFilterChange` because that ref now lives inside `DesktopMosaic`. The Flip.from filter-reflow inside `DesktopMosaic` will capture state on the next render — the same lifecycle, just resident inside the desktop component. Pre-capture of `flipStateRef` for the filter reflow happens inside `DesktopMosaic` via a new pre-render effect, OR we move filter state into `DesktopMosaic` entirely.

To keep this refactor strictly behavior-preserving, instead introduce a `useLayoutEffect` inside `DesktopMosaic` that captures `flipStateRef` BEFORE the next `filteredProjects` change. Update Step 2's `DesktopMosaic` to add this hook before the existing filter-reflow effect:

```tsx
// Inside DesktopMosaic, immediately before the filter-reflow effect:
const prevFilteredRef = useRef<Project[]>(filteredProjects);
useLayoutEffect(() => {
  if (prevFilteredRef.current !== filteredProjects && gridRef.current) {
    flipStateRef.current = Flip.getState(
      prevFilteredRef.current.length > 0
        ? gridRef.current.querySelectorAll('[data-flip-id]')
        : []
    );
  }
  prevFilteredRef.current = filteredProjects;
}, [filteredProjects, flipStateRef]);
```

This preserves the original two-phase Flip capture (pre-change state → post-change layout) without requiring `PurposeGrid` to know about Flip internals.

- [ ] **Step 4: Run typecheck and the existing test suite**

Run: `npm run typecheck` (or `tsc --noEmit` if no script exists)
Expected: 0 errors.

Run: `npm run test -- --run`
Expected: same green baseline as Step 1 — no test regressions.

- [ ] **Step 5: Manually verify desktop in the browser**

Run: `npm run dev`
Open the home page on a desktop viewport (≥768px wide). Scroll into the Devotions section.

Verify (no changes from before):
- Filter tabs (All / Restoration / Serenity) reveal with blur+y+opacity.
- "Devotions" watermark fades in.
- Image strip morphs into the editorial grid as you scroll.
- Hovering a tile reveals the split-panel overlay with the category label and "Start here" CTA.
- Clicking a tile opens the devotion.
- Changing the filter reflows the grid with the Flip animation.

If any of these regress, the refactor is wrong — fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/DesktopMosaic.tsx src/components/sections/PurposeGrid.tsx
git commit -m "refactor(purpose-grid): extract DesktopMosaic from PurposeGrid

Pure refactor — no behavior change. Moves the strip→grid Flip morph,
filter-reflow Flip, ProjectCard, dots observer, and PurposeGridDots
mount into a new DesktopMosaic component. PurposeGrid keeps filter
state and section chrome. Prepares the file for a mobile branch."
```

---

## Task 2: Build MobileProjectTile (static, no motion)

**Goal:** Render one tile's content correctly — eyebrow + devotion title + scripture, with the devotion-missing fallback, and the click handler — before adding any scroll-driven motion.

**Files:**
- Create: `src/components/sections/MobileProjectTile.tsx`
- Create: `src/components/sections/MobileProjectTile.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/sections/MobileProjectTile.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MobileProjectTile } from './MobileProjectTile';
import type { Project } from '@/types';

afterEach(cleanup);

const peaceProject: Project = {
  id: 'peace',
  name: 'Restoration 01',
  category: 'residential',
  thumbnail: '/mid_section/restoration1.png',
  images: ['/mid_section/restoration1.png'],
  overlayColor: '#8B8378',
};

const orphanProject: Project = {
  id: 'mystery',
  name: 'Mystery',
  category: 'hospitality',
  thumbnail: '/mid_section/mystery.png',
  images: ['/mid_section/mystery.png'],
  overlayColor: '#B08A6A',
};

describe('MobileProjectTile', () => {
  it('renders the category eyebrow as RESTORATION for residential projects', () => {
    render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
    );
    expect(screen.getByText('Restoration')).toBeInTheDocument();
  });

  it('renders the category eyebrow as SERENITY for hospitality projects', () => {
    render(
      <MobileProjectTile project={orphanProject} index={0} onProjectClick={vi.fn()} />
    );
    expect(screen.getByText('Serenity')).toBeInTheDocument();
  });

  it('renders the devotion title and scripture ref when a devotion exists', () => {
    render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
    );
    expect(screen.getByText('Beside Still Waters')).toBeInTheDocument();
    expect(screen.getByText('Psalm 23:2–3')).toBeInTheDocument();
  });

  it('falls back to overlay/category label and hides scripture when no devotion exists', () => {
    render(
      <MobileProjectTile project={orphanProject} index={0} onProjectClick={vi.fn()} />
    );
    // Fallback title is the category label "Serenity" — already rendered as eyebrow,
    // but the title slot should also render. Assert title slot has the fallback text.
    expect(screen.getByTestId('tile-title')).toHaveTextContent('Serenity');
    expect(screen.queryByTestId('tile-scripture')).toBeNull();
  });

  it('fires onProjectClick when the tile is tapped', () => {
    const handleClick = vi.fn();
    render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={handleClick} />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(peaceProject);
  });

  it('alternates column order: index 0 → text-image, index 1 → image-text', () => {
    const { rerender, getByTestId } = render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
    );
    expect(getByTestId('mobile-project-tile').getAttribute('data-tile-order')).toBe('text-image');
    rerender(
      <MobileProjectTile project={peaceProject} index={1} onProjectClick={vi.fn()} />
    );
    expect(getByTestId('mobile-project-tile').getAttribute('data-tile-order')).toBe('image-text');
  });

  it('exposes an aria-label that combines category, title, and scripture', () => {
    render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe(
      'Restoration — Beside Still Waters, Psalm 23:2–3'
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/components/sections/MobileProjectTile.test.tsx`
Expected: FAIL with "Cannot find module './MobileProjectTile'" or similar.

- [ ] **Step 3: Implement MobileProjectTile (static, no motion yet)**

Create `src/components/sections/MobileProjectTile.tsx`:

```tsx
import { categoryLabel } from '@/data/projects';
import { devotions } from '@/data/devotions';
import type { Project } from '@/types';

const overlayLabelById: Record<string, string> = {
  peace: 'Restoration of Peace',
  hope: 'Restoration of Hope',
  strength: 'Restoration of Strength',
  wholeness: 'Restoration of Wholeness',
  purpose: 'Restoration of Purpose',
  connection: 'Restoration of Connection',
  identity: 'Restoration of Identity',
  joy: 'Restoration of Joy',
  forgiveness: 'Serenity of Forgiveness',
  surrender: 'Serenity of Surrender',
  trust: 'Serenity of Trust',
};

export interface MobileProjectTileProps {
  project: Project;
  index: number;
  onProjectClick: (project: Project) => void;
}

export function MobileProjectTile({
  project,
  index,
  onProjectClick,
}: MobileProjectTileProps) {
  const devotion = devotions[project.id];
  const eyebrow = categoryLabel[project.category];
  const title = devotion?.title ?? overlayLabelById[project.id] ?? eyebrow;
  const scripture = devotion?.scriptureRef ?? null;
  const order: 'text-image' | 'image-text' = index % 2 === 0 ? 'text-image' : 'image-text';

  const ariaLabel = scripture
    ? `${eyebrow} — ${title}, ${scripture}`
    : `${eyebrow} — ${title}`;

  return (
    <button
      type="button"
      data-testid="mobile-project-tile"
      data-tile-order={order}
      onClick={() => onProjectClick(project)}
      aria-label={ariaLabel}
      className={`group flex w-full items-center gap-6 px-6 min-h-[70vh] text-left ${
        order === 'image-text' ? 'flex-row-reverse' : ''
      }`}
    >
      <div className="flex-1 flex flex-col gap-2">
        <span
          aria-hidden="true"
          className="text-[10px] tracking-[0.3em] uppercase text-white/60"
        >
          {eyebrow}
        </span>
        <span
          data-testid="tile-title"
          className="text-[26px] leading-[1.05] italic text-white"
          style={{ fontFamily: '"Cormorant Garamond", serif' }}
        >
          {title}
        </span>
        {scripture && (
          <span
            data-testid="tile-scripture"
            className="text-[10px] tracking-[0.12em] uppercase text-white/70"
          >
            {scripture}
          </span>
        )}
      </div>
      <div className="flex-[1.15] aspect-[3/4] overflow-hidden" style={{ borderRadius: '2px' }}>
        <img
          src={project.thumbnail}
          alt={project.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    </button>
  );
}
```

Note: the eyebrow text comes back from `categoryLabel`, which returns `Restoration` or `Serenity` (capitalized, not all-caps — Tailwind's `uppercase` does the visual transform but `screen.getByText('Restoration')` matches the underlying DOM text). The tests assert the canonical-case string.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- --run src/components/sections/MobileProjectTile.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/MobileProjectTile.tsx src/components/sections/MobileProjectTile.test.tsx
git commit -m "feat(purpose-grid): mobile project tile (static)

Static side-by-side text+image tile for the mobile parallax list.
Alternates column order by index. Renders eyebrow + devotion title +
scripture from the devotions registry, with a graceful fallback for
projects without a devotion entry. Whole tile is the click target."
```

---

## Task 3: Add scroll-driven reveal motion to MobileProjectTile

**Goal:** Add the Framer Motion clip-path image reveal + blurred text fade scrubbed against the tile's scroll progress, with a `prefers-reduced-motion` fallback.

**Files:**
- Modify: `src/components/sections/MobileProjectTile.tsx`
- Modify: `src/components/sections/MobileProjectTile.test.tsx`

- [ ] **Step 1: Extend the test file with reduced-motion + motion-presence tests**

Add the following to `src/components/sections/MobileProjectTile.test.tsx` (append inside the existing `describe` block):

```tsx
it('renders no clip-path or blur when prefers-reduced-motion is set', () => {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;

  try {
    render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
    );
    const imageWrap = screen.getByTestId('tile-image');
    const textCol = screen.getByTestId('tile-text');

    // Reduced-motion: no inline clip-path on the image wrap, no blur on text.
    expect(imageWrap.style.clipPath).toBe('');
    expect(textCol.style.filter).toBe('');
    expect(textCol.style.opacity === '' || textCol.style.opacity === '1').toBe(true);
  } finally {
    window.matchMedia = original;
  }
});

it('applies an initial clip-path/blur when reduced motion is not set', () => {
  // Default jsdom: matchMedia returns matches: false for everything unless mocked.
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;

  try {
    render(
      <MobileProjectTile project={peaceProject} index={0} onProjectClick={vi.fn()} />
    );
    const imageWrap = screen.getByTestId('tile-image');
    const textCol = screen.getByTestId('tile-text');

    // Animated path: the image wrap is a motion.div with style.clipPath set to
    // its initial value (fully clipped). Framer Motion sets these as inline styles.
    // Assert that the wrap has *some* clip-path inline style (i.e. motion is engaged).
    expect(imageWrap.style.clipPath).not.toBe('');
    // Text column has filter inline (the blur), even if 0 at this transform progress.
    expect(textCol.style.filter).not.toBe('');
  } finally {
    window.matchMedia = original;
  }
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm run test -- --run src/components/sections/MobileProjectTile.test.tsx`
Expected: the two new tests FAIL — `tile-image` and `tile-text` testids do not yet exist; inline style assertions fail because the static implementation has no inline `clipPath`/`filter`.

- [ ] **Step 3: Implement the scroll-driven reveal**

Replace `src/components/sections/MobileProjectTile.tsx` with:

```tsx
import { useRef, useMemo } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { categoryLabel } from '@/data/projects';
import { devotions } from '@/data/devotions';
import type { Project } from '@/types';

const overlayLabelById: Record<string, string> = {
  peace: 'Restoration of Peace',
  hope: 'Restoration of Hope',
  strength: 'Restoration of Strength',
  wholeness: 'Restoration of Wholeness',
  purpose: 'Restoration of Purpose',
  connection: 'Restoration of Connection',
  identity: 'Restoration of Identity',
  joy: 'Restoration of Joy',
  forgiveness: 'Serenity of Forgiveness',
  surrender: 'Serenity of Surrender',
  trust: 'Serenity of Trust',
};

function usePrefersReducedMotion(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
}

export interface MobileProjectTileProps {
  project: Project;
  index: number;
  onProjectClick: (project: Project) => void;
}

export function MobileProjectTile({
  project,
  index,
  onProjectClick,
}: MobileProjectTileProps) {
  const devotion = devotions[project.id];
  const eyebrow = categoryLabel[project.category];
  const title = devotion?.title ?? overlayLabelById[project.id] ?? eyebrow;
  const scripture = devotion?.scriptureRef ?? null;
  const order: 'text-image' | 'image-text' = index % 2 === 0 ? 'text-image' : 'image-text';
  const ariaLabel = scripture
    ? `${eyebrow} — ${title}, ${scripture}`
    : `${eyebrow} — ${title}`;

  const tileRef = useRef<HTMLButtonElement>(null);
  const reduced = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: tileRef,
    offset: ['start 85%', 'start 30%'],
  });

  const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

  // Image clip-path: clipped from the bottom at progress 0 (inset bottom = 100%)
  // unwinds to fully revealed at progress 0.6.
  const imageInsetBottom = useTransform(scrollYProgress, [0, 0.6], [100, 0], { ease });
  const imageClipPath = useTransform(
    imageInsetBottom,
    (v) => `inset(0 0 ${v}% 0)`
  );
  const imageOpacity = useTransform(scrollYProgress, [0, 0.6], [0, 1], { ease });

  // Text: lags the image by 0.1.
  const textOpacity = useTransform(scrollYProgress, [0.1, 0.7], [0, 1], { ease });
  const textY = useTransform(scrollYProgress, [0.1, 0.7], [20, 0], { ease });
  const textBlurPx = useTransform(scrollYProgress, [0.1, 0.7], [6, 0], { ease });
  const textFilter = useTransform(textBlurPx, (v) => `blur(${v}px)`);

  return (
    <button
      ref={tileRef}
      type="button"
      data-testid="mobile-project-tile"
      data-tile-order={order}
      onClick={() => onProjectClick(project)}
      aria-label={ariaLabel}
      className={`group flex w-full items-center gap-6 px-6 min-h-[70vh] text-left ${
        order === 'image-text' ? 'flex-row-reverse' : ''
      }`}
    >
      <motion.div
        data-testid="tile-text"
        className="flex-1 flex flex-col gap-2"
        style={
          reduced
            ? undefined
            : { opacity: textOpacity, y: textY, filter: textFilter }
        }
      >
        <span
          aria-hidden="true"
          className="text-[10px] tracking-[0.3em] uppercase text-white/60"
        >
          {eyebrow}
        </span>
        <span
          data-testid="tile-title"
          className="text-[26px] leading-[1.05] italic text-white"
          style={{ fontFamily: '"Cormorant Garamond", serif' }}
        >
          {title}
        </span>
        {scripture && (
          <span
            data-testid="tile-scripture"
            className="text-[10px] tracking-[0.12em] uppercase text-white/70"
          >
            {scripture}
          </span>
        )}
      </motion.div>
      <motion.div
        data-testid="tile-image"
        className="flex-[1.15] aspect-[3/4] overflow-hidden"
        style={
          reduced
            ? { borderRadius: '2px' }
            : { borderRadius: '2px', clipPath: imageClipPath, opacity: imageOpacity }
        }
      >
        <img
          src={project.thumbnail}
          alt={project.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </motion.div>
    </button>
  );
}
```

- [ ] **Step 4: Run all MobileProjectTile tests**

Run: `npm run test -- --run src/components/sections/MobileProjectTile.test.tsx`
Expected: PASS (9 tests).

If any test fails because the static-implementation tests now query `tile-text` / `tile-image` wrappers that wrap their content, fix the test queries (e.g. `getByTestId('tile-title')` still resolves because the title `span` lives inside `tile-text`). The asserted text + click + ARIA behaviors should still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/MobileProjectTile.tsx src/components/sections/MobileProjectTile.test.tsx
git commit -m "feat(purpose-grid): scroll-driven reveal for mobile tile

Adds Framer Motion useScroll/useTransform reveal — image unveils
top-to-bottom via clip-path inset, text fades in with blur and y
translate slightly behind. Respects prefers-reduced-motion."
```

---

## Task 4: Build MobileParallaxList

**Goal:** Render a `MobileProjectTile` for each project in the list, passing the index through so alternation works.

**Files:**
- Create: `src/components/sections/MobileParallaxList.tsx`
- Create: `src/components/sections/MobileParallaxList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/MobileParallaxList.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MobileParallaxList } from './MobileParallaxList';
import type { Project } from '@/types';

afterEach(cleanup);

const projects: Project[] = [
  {
    id: 'peace',
    name: 'Restoration 01',
    category: 'residential',
    thumbnail: '/mid_section/restoration1.png',
    images: ['/mid_section/restoration1.png'],
    overlayColor: '#8B8378',
  },
  {
    id: 'hope',
    name: 'Restoration 03',
    category: 'residential',
    thumbnail: '/mid_section/restoration3.jpg',
    images: ['/mid_section/restoration3.jpg'],
    overlayColor: '#7A7568',
  },
  {
    id: 'forgiveness',
    name: 'Serenity 02',
    category: 'hospitality',
    thumbnail: '/mid_section/serenity2.png',
    images: ['/mid_section/serenity2.png'],
    overlayColor: '#B08A6A',
  },
];

describe('MobileParallaxList', () => {
  it('renders one tile per project', () => {
    render(<MobileParallaxList projects={projects} onProjectClick={vi.fn()} />);
    expect(screen.getAllByTestId('mobile-project-tile')).toHaveLength(3);
  });

  it('alternates tile order by index — 0 text-image, 1 image-text, 2 text-image', () => {
    render(<MobileParallaxList projects={projects} onProjectClick={vi.fn()} />);
    const tiles = screen.getAllByTestId('mobile-project-tile');
    expect(tiles[0].getAttribute('data-tile-order')).toBe('text-image');
    expect(tiles[1].getAttribute('data-tile-order')).toBe('image-text');
    expect(tiles[2].getAttribute('data-tile-order')).toBe('text-image');
  });

  it('renders nothing in the list when projects is empty', () => {
    render(<MobileParallaxList projects={[]} onProjectClick={vi.fn()} />);
    expect(screen.queryAllByTestId('mobile-project-tile')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/components/sections/MobileParallaxList.test.tsx`
Expected: FAIL with "Cannot find module './MobileParallaxList'".

- [ ] **Step 3: Implement MobileParallaxList**

Create `src/components/sections/MobileParallaxList.tsx`:

```tsx
import { MobileProjectTile } from './MobileProjectTile';
import type { Project } from '@/types';

export interface MobileParallaxListProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
}

export function MobileParallaxList({
  projects,
  onProjectClick,
}: MobileParallaxListProps) {
  return (
    <div className="flex flex-col w-full">
      {projects.map((project, index) => (
        <MobileProjectTile
          key={project.id}
          project={project}
          index={index}
          onProjectClick={onProjectClick}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- --run src/components/sections/MobileParallaxList.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/MobileParallaxList.tsx src/components/sections/MobileParallaxList.test.tsx
git commit -m "feat(purpose-grid): MobileParallaxList renders tiles with alternation

Wraps MobileProjectTile rendering and passes the index through so the
alternating side-by-side layout falls out of the array order."
```

---

## Task 5: Branch PurposeGrid by useIsMobile

**Goal:** Mount `MobileParallaxList` on mobile and `DesktopMosaic` on desktop. `PurposeGridDots` stops rendering anywhere.

**Files:**
- Modify: `src/components/sections/PurposeGrid.tsx`
- Create or modify: `src/components/sections/PurposeGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/PurposeGrid.test.tsx` (the file does not exist today):

```tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import type { Project } from '@/types';

afterEach(cleanup);

const projects: Project[] = [
  {
    id: 'peace',
    name: 'Restoration 01',
    category: 'residential',
    thumbnail: '/mid_section/restoration1.png',
    images: ['/mid_section/restoration1.png'],
    overlayColor: '#8B8378',
  },
  {
    id: 'forgiveness',
    name: 'Serenity 02',
    category: 'hospitality',
    thumbnail: '/mid_section/serenity2.png',
    images: ['/mid_section/serenity2.png'],
    overlayColor: '#B08A6A',
  },
];

beforeEach(() => {
  // Default matchMedia stub — reduced motion off.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

vi.mock('@/hooks/use-mobile', async () => {
  return {
    MOBILE_BREAKPOINT: 768,
    useIsMobile: vi.fn(),
  };
});

import { useIsMobile } from '@/hooks/use-mobile';
import { PurposeGrid } from './PurposeGrid';

describe('PurposeGrid', () => {
  it('renders MobileParallaxList tiles on mobile', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(<PurposeGrid projects={projects} onProjectClick={vi.fn()} />);
    expect(screen.getAllByTestId('mobile-project-tile')).toHaveLength(2);
    expect(screen.queryByTestId('purpose-grid-dots')).toBeNull();
  });

  it('renders the desktop mosaic strip on desktop', () => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    render(<PurposeGrid projects={projects} onProjectClick={vi.fn()} />);
    // DesktopMosaic renders [data-flip-id] tiles for each project.
    expect(document.querySelectorAll('[data-flip-id]').length).toBe(2);
    expect(screen.queryAllByTestId('mobile-project-tile')).toHaveLength(0);
  });
});
```

`PurposeGridDots.tsx` already renders dots with `role="presentation"`; add a `data-testid="purpose-grid-dots"` on its wrapper to make the absence assertion reliable. If `PurposeGridDots` is no longer rendered from `DesktopMosaic` in Step 3 (the design says it isn't), this testid would never appear — that's the correct outcome. Keep the assertion as a guard against regressions that re-mount it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/components/sections/PurposeGrid.test.tsx`
Expected: FAIL — the current `PurposeGrid` doesn't branch by `useIsMobile` and still mounts `PurposeGridDots`.

- [ ] **Step 3: Stop rendering PurposeGridDots from DesktopMosaic**

Modify `src/components/sections/DesktopMosaic.tsx` to remove the `<PurposeGridDots projects={filteredProjects} activeId={activeId} />` line at the bottom of the return statement, and remove the corresponding import.

Before:
```tsx
import { PurposeGridDots } from './PurposeGridDots';
// ...
return (
  <>
    <div ref={gridRef} ...>
      {/* tiles */}
    </div>
    <PurposeGridDots projects={filteredProjects} activeId={activeId} />
  </>
);
```

After:
```tsx
// (no PurposeGridDots import)
// ...
return (
  <div ref={gridRef} ...>
    {/* tiles */}
  </div>
);
```

Also remove the `activeId` state and the dots-tracking `IntersectionObserver` effect from `DesktopMosaic` — they only existed to drive `PurposeGridDots`. Drop both.

- [ ] **Step 4: Branch PurposeGrid by useIsMobile**

Modify `src/components/sections/PurposeGrid.tsx`. Add the imports:

```tsx
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileParallaxList } from './MobileParallaxList';
```

Then change the final render to branch:

```tsx
const isMobile = useIsMobile();

return (
  <section
    ref={sectionRef}
    id="projects"
    className="pt-44 md:pt-64 pb-16 md:pb-24 px-0"
    style={{ background: 'var(--app-bg)', position: 'relative' }}
  >
    <span
      ref={watermarkRef}
      aria-hidden="true"
      className="pg-devotions-watermark"
    >
      Devotions
    </span>
    <div ref={filterWrapRef} className="px-4 md:px-8 mb-4 md:mb-6">
      <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} />
    </div>
    {isMobile ? (
      <MobileParallaxList
        projects={filteredProjects}
        onProjectClick={onProjectClick}
      />
    ) : (
      <DesktopMosaic
        sectionRef={sectionRef}
        filteredProjects={filteredProjects}
        flipStateRef={flipStateRef}
        onProjectClick={onProjectClick}
      />
    )}
  </section>
);
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npm run test -- --run src/components/sections/PurposeGrid.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full test suite**

Run: `npm run test -- --run`
Expected: all tests pass. The existing `PurposeGridDots.test.tsx` continues to pass because that file's unit tests don't depend on whether `PurposeGrid` mounts it.

If any test that previously asserted dots are visible on mobile fails — that's a real regression of the design: dots are deliberately removed on mobile. Update the assertion to match the new behavior (or delete the test if it's now meaningless).

- [ ] **Step 7: Commit**

```bash
git add src/components/sections/PurposeGrid.tsx src/components/sections/DesktopMosaic.tsx src/components/sections/PurposeGrid.test.tsx
git commit -m "feat(purpose-grid): branch PurposeGrid by useIsMobile

Mobile mounts the new MobileParallaxList; desktop keeps the editorial
mosaic. PurposeGridDots is no longer rendered on either branch — the
dots paired to the horizontal strip the mobile list replaces. File
left in place for revert safety; a follow-up can delete."
```

---

## Task 6: Browser verification + final pass

**Goal:** Catch the things only a real browser surfaces — scroll cadence at real viewport heights, image aspect-ratio crops on real photos, GSAP/Framer Motion interaction, and the `prefers-reduced-motion` end state.

**Files:**
- No code changes expected. Any fixes uncovered here are folded into earlier files.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open `http://localhost:5173` (or whichever port Vite reports).

- [ ] **Step 2: Test on a mobile viewport (DevTools, 390x844 / iPhone 12)**

Resize to a mobile viewport (or use the device toolbar). Scroll into the Devotions section.

Verify:
- "Devotions" watermark + filter tabs reveal as before.
- The first project tile shows: eyebrow ("Restoration"), italic title ("Beside Still Waters"), small-caps scripture ("Psalm 23:2–3"), and image to the right.
- As you scroll the tile into view, the image unveils top-to-bottom and the text fades + slides up + de-blurs slightly behind.
- The second tile renders image-left, text-right (alternation).
- Tapping any tile opens that devotion.
- Filter tabs (All / Restoration / Serenity) still filter the list. After a filter change, the visible tiles show their final state; tiles further down still play their reveal on scroll-in.
- No pagination dots beneath the list.
- Scroll feels smooth — at 70vh tile height the next tile starts entering before the current finishes its reveal.

- [ ] **Step 3: Test prefers-reduced-motion**

In DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion" → reduce.

Reload. Verify:
- All tiles render immediately at full opacity, no clip-path, no blur, no translate.
- Tap still opens the devotion.
- Layout is identical to the animated end state — no broken positioning.

- [ ] **Step 4: Test desktop (≥768px viewport)**

Resize to desktop. Verify:
- Strip → grid Flip morph still plays.
- Hover overlay panels still slide in with category label + "Start here" CTA.
- Filter reflow Flip still tweens between layouts.
- No `MobileProjectTile` elements present in the DOM.
- No pagination dots (correct — they were a mobile-only artifact and are gone from both branches).

- [ ] **Step 5: Quick Lighthouse check (optional)**

Run a mobile Lighthouse pass on the home page. Confirm no regressions in CLS or LCP introduced by the tile layout. The image is `loading="lazy"` and uses `aspect-[3/4]` so the slot is reserved before the image paints — CLS should be 0.

If the score regressed materially, the most likely cause is the tile's `min-h-[70vh]` creating an empty scroll region before the first image loads. Verify by network-throttling and observing the section while scrolling in.

- [ ] **Step 6: Run typecheck and the full test suite one more time**

```bash
npm run typecheck
npm run test -- --run
```

Both should be clean.

- [ ] **Step 7: Final commit if anything was changed during verification**

If Steps 2–5 surfaced no issues, no commit is needed — Task 5's commit is the final commit.

If a fix was needed (e.g. image aspect, eyebrow case, motion timing), commit it as:

```bash
git add <files>
git commit -m "fix(purpose-grid): <specific finding from browser verification>"
```

---

## Spec self-review

Comparing the plan against the spec:

- **Scope boundary** — Task 5 branches by `useIsMobile()`; desktop path untouched after Task 1's pure refactor. ✓
- **Layout (alternation, columns, padding, 70vh)** — Task 2 implements all of it; Task 4 tests alternation across the list. ✓
- **Content (eyebrow + title + scripture, fallback, no CTA)** — Task 2 tests all three lines + fallback. ✓
- **Motion (clip-path image reveal + blurred text fade, no leave animation)** — Task 3 implements with the exact ranges from the spec. ✓
- **prefers-reduced-motion** — Task 3 implements + tests. Task 6 verifies in the browser. ✓
- **Interaction (whole tile tappable, no hover)** — Task 2 implements as a single `<button>`. ✓
- **Section chrome (watermark + filter tabs kept, dots removed)** — Task 5 Step 3 removes dots; Task 1 keeps watermark + filter tabs reveals. ✓
- **Architecture (PurposeGrid → FilterTabs + DesktopMosaic | MobileParallaxList → MobileProjectTile)** — Tasks 1, 2, 3, 4, 5 build this exactly. ✓
- **Files touched list** — matches the File Structure section above. ✓
- **Tests** — all spec'd tests appear as steps. ✓
- **Accessibility (aria-label, eyebrow aria-hidden)** — Task 2 implements + tests aria-label; eyebrow uses `aria-hidden="true"`. ✓

No gaps. Plan is consistent with the spec.

---

Plan complete and saved to [`docs/superpowers/plans/2026-05-29-mobile-purpose-grid-parallax.md`](2026-05-29-mobile-purpose-grid-parallax.md).
