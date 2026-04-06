# Seamless Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Psalms app from a stacked, boxed-section layout into a seamless, borderless free-flow composition with a unified background, asymmetric editorial mosaic for projects, and animated filter transitions.

**Architecture:** A single page-level plaster background with one new `OrganicBackdrop` component providing subtle radial washes. Existing sections (Hero, PinnedImageSection, GalleryStrip, ProjectsGrid) lose their per-section backgrounds and rigid borders. ProjectsGrid is rebuilt as a 12-column CSS Grid mosaic with GSAP Flip filter animations.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, GSAP (with new Flip plugin import — already in package).

**Project note:** No test framework is set up. Verification is manual: run `npm run dev` and visually inspect each section after every task. Each task includes a "Verify" step with what to check.

**Spec:** [docs/superpowers/specs/2026-04-05-seamless-layout-design.md](../specs/2026-04-05-seamless-layout-design.md)

---

## Task 1: Create OrganicBackdrop component

**Files:**
- Create: `src/components/ui-custom/OrganicBackdrop.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/ui-custom/OrganicBackdrop.tsx
export function OrganicBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Wash 1: top of page, white mist (replaces Hero's old mist glow) */}
      <div
        style={{
          position: 'absolute',
          top: '85vh',
          left: '-10%',
          right: '-10%',
          height: '420px',
          background:
            'radial-gradient(ellipse 100% 50% at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 25%, rgba(255,253,250,0.45) 50%, rgba(248,244,239,0.12) 75%, transparent 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '90vh',
          left: '-20%',
          right: '-20%',
          height: '320px',
          background:
            'radial-gradient(ellipse 120% 35% at 50% 50%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.45) 40%, rgba(252,249,245,0.12) 70%, transparent 100%)',
        }}
      />

      {/* Wash 2: middle of page, warm sand glow */}
      <div
        style={{
          position: 'absolute',
          top: '180vh',
          left: '40%',
          width: '60vw',
          height: '60vw',
          maxWidth: '900px',
          maxHeight: '900px',
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(circle, rgba(188,179,163,0.10) 0%, rgba(188,179,163,0.05) 40%, transparent 70%)',
          borderRadius: '50%',
        }}
      />

      {/* Wash 3: lower page, warm white drift */}
      <div
        style={{
          position: 'absolute',
          top: '280vh',
          left: '-15%',
          width: '70vw',
          height: '50vw',
          maxWidth: '1100px',
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,255,255,0.18) 0%, rgba(245,240,232,0.08) 50%, transparent 80%)',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run build`
Expected: builds successfully with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui-custom/OrganicBackdrop.tsx
git commit -m "feat: add OrganicBackdrop component with radial washes"
```

---

## Task 2: Unify the page background

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/sections/Hero.tsx` (remove background)
- Modify: `src/components/sections/PinnedImageSection.tsx` (remove background)
- Modify: `src/components/sections/GalleryStrip.tsx` (remove background)
- Modify: `src/components/sections/ProjectsGrid.tsx` (remove background)

- [ ] **Step 1: Update App.tsx to mount OrganicBackdrop and use plaster background**

Replace the WaterRipple element block in `src/App.tsx` (lines 46–67) with:

```tsx
<WaterRipple
  rippleColor="rgba(40, 35, 30, 0.12)"
  rippleDuration={1800}
  maxRipples={6}
  className="relative min-h-screen"
  style={{ background: 'var(--plaster)' }}
>
  <OrganicBackdrop />
  <div className="relative" style={{ zIndex: 1 }}>
    <Header showNav={showNav} />

    {selectedProject ? (
      <ProjectDetail
        project={selectedProject}
        onBack={handleBackToProjects}
      />
    ) : (
      <main>
        <Hero />
        <PinnedImageSection />
        <GalleryStrip />
        <ProjectsGrid onProjectClick={handleProjectClick} />
      </main>
    )}
  </div>
</WaterRipple>
```

Add this import near the other imports at the top of `src/App.tsx`:

```tsx
import { OrganicBackdrop } from '@/components/ui-custom/OrganicBackdrop';
```

Note: if `WaterRipple` doesn't accept a `style` prop, fall back to wrapping it in a parent div with the plaster background, or update WaterRipple to forward style. Verify in the next step.

- [ ] **Step 2: Verify WaterRipple accepts style prop**

Run: `cat src/components/ui-custom/WaterRipple.tsx | head -40`
Look at the props interface. If it does NOT accept `style`, update App.tsx to wrap it instead:

```tsx
<div className="relative min-h-screen" style={{ background: 'var(--plaster)' }}>
  <WaterRipple
    rippleColor="rgba(40, 35, 30, 0.12)"
    rippleDuration={1800}
    maxRipples={6}
    className="min-h-screen"
  >
    <OrganicBackdrop />
    <div className="relative" style={{ zIndex: 1 }}>
      {/* ...rest as above */}
    </div>
  </WaterRipple>
</div>
```

Choose whichever approach works without modifying WaterRipple.

- [ ] **Step 3: Remove background from Hero.tsx**

In `src/components/sections/Hero.tsx`, line 11, change:

```tsx
style={{ background: 'var(--plaster)' }}
```

to remove the style entirely from the section element. The opening tag becomes:

```tsx
<section
  ref={heroRef}
  className="relative min-h-screen flex flex-col items-center justify-center overflow-visible"
>
```

- [ ] **Step 4: Remove background from PinnedImageSection.tsx**

In `src/components/sections/PinnedImageSection.tsx`, line 66, change:

```tsx
<section
  ref={sectionRef}
  className="relative h-screen w-full overflow-hidden"
  style={{ background: "var(--plaster)" }}
>
```

to:

```tsx
<section
  ref={sectionRef}
  className="relative h-screen w-full overflow-hidden"
>
```

- [ ] **Step 5: Remove background from GalleryStrip.tsx**

In `src/components/sections/GalleryStrip.tsx`, lines 30–34, change:

```tsx
<div
  ref={scrollRef}
  className="relative w-full overflow-hidden py-12 md:py-16"
  style={{ background: 'var(--plaster)' }}
>
```

to:

```tsx
<div
  ref={scrollRef}
  className="relative w-full overflow-hidden py-12 md:py-16"
>
```

- [ ] **Step 6: Remove background from ProjectsGrid.tsx**

In `src/components/sections/ProjectsGrid.tsx`, lines 24–28, change:

```tsx
<section
  id="projects"
  className="py-16 md:py-24 px-4 md:px-8 lg:px-16"
  style={{ background: 'var(--plaster)' }}
>
```

to:

```tsx
<section
  id="projects"
  className="py-16 md:py-24 px-4 md:px-8 lg:px-16"
>
```

(Padding is intentionally left for now — Task 7 will change it to edge-to-edge.)

- [ ] **Step 7: Verify build and visual**

Run: `npm run build && npm run dev`
Open the dev URL. Expected:
- Page still loads with plaster background visible everywhere.
- No visible color seams or background color changes between sections.
- Subtle radial washes are barely perceptible in the background.
- Filter tabs still work, scroll still works.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/components/sections/Hero.tsx src/components/sections/PinnedImageSection.tsx src/components/sections/GalleryStrip.tsx src/components/sections/ProjectsGrid.tsx
git commit -m "refactor: unify plaster background at page root, mount OrganicBackdrop"
```

---

## Task 3: Strip Hero's mist glow (now provided by OrganicBackdrop)

**Files:**
- Modify: `src/components/sections/Hero.tsx`

- [ ] **Step 1: Delete the Mist Glow block**

In `src/components/sections/Hero.tsx`, delete lines 33–69 (the entire `{/* Mist Glow */}` block and its inner two divs). The result should be that the Hero component returns only:
1. The section wrapper
2. The background PSALMS logo div (lines 13–23)
3. The scroll indicator div (lines 26–31)

After deletion, the JSX inside `<section>` should be:

```tsx
{/* Background PSALMS Logo - Large Outline Style */}
<div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden px-4">
  <img
    src="/logo-hero.png"
    alt="PSALMS"
    className="w-[95vw] md:w-[80vw] max-w-4xl object-contain"
    style={{
      opacity: 0.12,
      filter: 'invert(1)',
    }}
  />
</div>

{/* Scroll Indicator */}
<div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2" style={{ zIndex: 2 }}>
  <div
    className="w-10 md:w-12 h-1 rounded-full"
    style={{ background: 'var(--warm-sand)', opacity: 0.4 }}
  ></div>
</div>
```

- [ ] **Step 2: Verify**

Run: `npm run dev`
Expected: Hero looks the same as before (the mist glow is now provided by `OrganicBackdrop` instead). The transition from Hero into PinnedImageSection still has a soft white wash at the bottom of the viewport.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "refactor: remove Hero mist glow (moved to OrganicBackdrop)"
```

---

## Task 4: Clean up PinnedImageSection and overlap with GalleryStrip

**Files:**
- Modify: `src/components/sections/PinnedImageSection.tsx`

- [ ] **Step 1: Delete the explicit decorative circle**

In `src/components/sections/PinnedImageSection.tsx`, delete lines 68–82 (the `{/* Organic decorative elements - soft circles */}` div). It is no longer needed because `OrganicBackdrop` provides the warm sand wash at this scroll position.

- [ ] **Step 2: Add negative margin to overlap GalleryStrip**

In `src/components/sections/PinnedImageSection.tsx`, change the section opening tag to include a negative margin-bottom:

```tsx
<section
  ref={sectionRef}
  className="relative h-screen w-full overflow-hidden"
  style={{ marginBottom: '-30vh' }}
>
```

- [ ] **Step 3: Verify**

Run: `npm run dev`
Expected:
- Pinned section still pins and animates the verse/frame correctly.
- After the pin releases, the GalleryStrip starts ~30vh higher than before — the bottom of the framed image's drop shadow visually overlaps with the top of the marquee.
- If the GSAP ScrollTrigger pin breaks (visible glitch in the pin behavior), revert the negative margin and instead apply `style={{ marginTop: '-30vh' }}` to the GalleryStrip wrapper in the next task. Document which approach worked in the commit message.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/PinnedImageSection.tsx
git commit -m "refactor: remove decorative circle, overlap PinnedImageSection with GalleryStrip"
```

---

## Task 5: Dissolve the GalleryStrip into the page

**Files:**
- Modify: `src/components/sections/GalleryStrip.tsx`

- [ ] **Step 1: Delete the gradient fade overlays**

In `src/components/sections/GalleryStrip.tsx`, delete lines 35–43 (both `<div>` elements with the linear-gradient backgrounds — the top fade and the bottom fade).

- [ ] **Step 2: Vary thumbnail heights and remove rounded corners**

In `src/components/sections/GalleryStrip.tsx`, replace the marquee item map (lines 51–64) with:

```tsx
{allImages.map((image, index) => {
  // Cycle through varied heights so the strip's top/bottom edges aren't perfect lines
  const heightCycle = [
    { w: 'w-56 md:w-72', h: 'h-40 md:h-48' },
    { w: 'w-60 md:w-80', h: 'h-44 md:h-56' },
    { w: 'w-52 md:w-64', h: 'h-36 md:h-44' },
    { w: 'w-64 md:w-80', h: 'h-48 md:h-60' },
    { w: 'w-56 md:w-72', h: 'h-40 md:h-52' },
  ];
  const { w, h } = heightCycle[index % heightCycle.length];
  return (
    <div
      key={index}
      className={`flex-shrink-0 ${w} ${h} overflow-hidden`}
      style={{ borderRadius: '2px' }}
    >
      <img
        src={image}
        alt={`Gallery image ${index + 1}`}
        className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
        loading="lazy"
      />
    </div>
  );
})}
```

Also change the flex container (line 46) to align items to center so the varied heights center nicely:

```tsx
<div
  className={`flex gap-6 items-center animate-marquee transition-opacity duration-700 ${
    isVisible ? 'opacity-100' : 'opacity-0'
  }`}
  style={{ width: 'fit-content' }}
>
```

- [ ] **Step 3: Verify**

Run: `npm run dev`
Expected:
- No visible fade-bands at top/bottom of the strip.
- Thumbnails have varying heights, creating a softly uneven top and bottom edge.
- Corners are nearly square (2px radius — almost imperceptible).
- The strip flows continuously into the surrounding plaster.
- Marquee animation still works.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/GalleryStrip.tsx
git commit -m "refactor: dissolve GalleryStrip with varied heights and no fade overlays"
```

---

## Task 6: Refactor ProjectCard for borderless mosaic use

**Files:**
- Modify: `src/components/ui-custom/ProjectCard.tsx`

- [ ] **Step 1: Add aspect ratio prop and remove card chrome**

Replace the entire contents of `src/components/ui-custom/ProjectCard.tsx` with:

```tsx
import { useState, useRef, useEffect } from 'react';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  index: number;
  aspectRatio?: string;
}

export function ProjectCard({ project, onClick, index, aspectRatio = '4/5' }: ProjectCardProps) {
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
      data-flip-id={project.id}
      className={`project-card relative cursor-pointer group transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${index * 80}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Image — fills the entire card, no border, no shadow, no rounded corners */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio }}
      >
        <img
          src={project.thumbnail}
          alt={project.name}
          className={`w-full h-full object-cover transition-transform duration-700 ${
            isHovered ? 'scale-[1.02]' : 'scale-100'
          }`}
          loading="lazy"
        />

        {/* Hover overlay — soft caption fade-in, no box */}
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

      {/* Plain text metadata below — no chrome */}
      <div className="flex items-center justify-between pt-3 px-1">
        <h3 className="text-xs md:text-sm tracking-wide uppercase text-mersi-dark">
          {project.name}
        </h3>
        <span className="text-[10px] md:text-xs tracking-wider uppercase text-mersi-dark/50">
          {getCategoryLabel(project.category)}
        </span>
      </div>
    </div>
  );
}
```

Key changes from the original:
- Added `aspectRatio?: string` prop with default `'4/5'` (preserves backwards compatibility).
- Removed `overflow-hidden` from outer wrapper (it was clipping; only the inner image container needs it).
- Removed `aspect-[4/5]` Tailwind class; aspect is now controlled by inline `style={{ aspectRatio }}`.
- Image scale on hover changed from `scale-105` to `scale-[1.02]` (more restrained, per spec).
- Added `data-flip-id={project.id}` for GSAP Flip tracking in Task 8.
- Metadata text restyled to small uppercase tracking-wide to match the rest of the system.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: builds successfully. ProjectsGrid still passes the existing props (no `aspectRatio` yet) and the default kicks in, so the page still renders.

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Expected: Project cards still render in the existing grid, but now have:
- No rounded corners (was none anyway, but confirm).
- Slightly more restrained hover scale.
- Smaller, uppercase metadata.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui-custom/ProjectCard.tsx
git commit -m "refactor: borderless ProjectCard with aspectRatio prop and Flip id"
```

---

## Task 7: Replace ProjectsGrid with editorial mosaic layout

**Files:**
- Modify: `src/components/sections/ProjectsGrid.tsx`

- [ ] **Step 1: Replace ProjectsGrid with mosaic layout**

Replace the entire contents of `src/components/sections/ProjectsGrid.tsx` with:

```tsx
import { useState, useMemo } from 'react';
import { projects } from '@/data/projects';
import { FilterTabs } from '@/components/ui-custom/FilterTabs';
import { ProjectCard } from '@/components/ui-custom/ProjectCard';
import type { FilterCategory, Project } from '@/types';

interface ProjectsGridProps {
  onProjectClick: (project: Project) => void;
}

// Editorial mosaic pattern. Each entry defines a card's column span (out of 12)
// and aspect ratio. Pattern loops via index modulo. Each row's spans always sum to 12.
const MOSAIC_PATTERN: Array<{ cols: number; ratio: string }> = [
  { cols: 7, ratio: '4/3' },
  { cols: 5, ratio: '3/4' },
  { cols: 5, ratio: '1/1' },
  { cols: 7, ratio: '16/9' },
  { cols: 6, ratio: '4/3' },
  { cols: 6, ratio: '3/4' },
  { cols: 8, ratio: '16/9' },
  { cols: 4, ratio: '1/1' },
];

// Tailwind requires literal class names, so we map cols → class.
const COL_SPAN_CLASS: Record<number, string> = {
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
};

export function ProjectsGrid({ onProjectClick }: ProjectsGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('residential');

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return projects;
    return projects.filter((project) => project.category === activeFilter);
  }, [activeFilter]);

  return (
    <section
      id="projects"
      className="py-16 md:py-24 px-0"
    >
      {/* Filter Tabs */}
      <div className="px-4 md:px-8 mb-10 md:mb-14">
        <FilterTabs activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      </div>

      {/* Editorial mosaic grid — fully edge-to-edge */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3">
        {/* "Selected Works" label as a grid cell, bottom-aligned, on first row */}
        <div className="md:col-span-3 flex items-end justify-start px-4 md:px-6 pb-2">
          <h2
            className="text-xs md:text-sm tracking-[0.3em] uppercase"
            style={{ color: 'var(--warm-sand)', fontFamily: 'Outfit, sans-serif' }}
          >
            Selected Works
          </h2>
        </div>

        {filteredProjects.map((project, index) => {
          const pattern = MOSAIC_PATTERN[index % MOSAIC_PATTERN.length];
          // First card shares row 1 with the label, so it gets cols (12 - 3 = 9) max.
          // To keep the pattern simple, override the first card to col-span-9.
          const colsClass =
            index === 0 ? 'md:col-span-9' : COL_SPAN_CLASS[pattern.cols];
          return (
            <div key={project.id} className={`col-span-1 ${colsClass}`}>
              <ProjectCard
                project={project}
                onClick={() => onProjectClick(project)}
                index={index}
                aspectRatio={pattern.ratio}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

Key changes:
- `px-4 md:px-8 lg:px-16` → `px-0` (full edge-to-edge).
- Removed the centered "Selected Works" header above the grid; it now lives as a grid cell on row 1.
- Removed the two separate `topRow`/`bottomRow` grids; one unified 12-column grid.
- `MOSAIC_PATTERN` controls span and aspect ratio per index.
- `COL_SPAN_CLASS` map exists because Tailwind only includes class names that appear literally in source — dynamic `md:col-span-${n}` won't work.
- First project card overrides to `col-span-9` because the "Selected Works" label takes `col-span-3` on the same row.
- Filter tabs container retains horizontal padding (only the mosaic itself goes edge-to-edge).
- Mobile: `grid-cols-1` collapses everything to a single full-width column. The label appears above the first card naturally.

- [ ] **Step 2: Verify Tailwind picks up the col-span classes**

Run: `npm run build`
Expected: builds successfully. If any `md:col-span-*` classes are missing in the output CSS (cards stack vertically on desktop instead of forming a mosaic), open `tailwind.config.js` and confirm the `content` glob includes `./src/**/*.{ts,tsx}`. The literal class strings in `COL_SPAN_CLASS` should be sufficient since they appear as plain strings in source.

- [ ] **Step 3: Verify visually on desktop**

Run: `npm run dev`
Expected:
- Projects flow as an asymmetric mosaic — first row has the "Selected Works" label (col 1–3) next to a wide first project (col 4–12).
- Subsequent rows alternate widths (5+7, 6+6, 8+4, etc.).
- Cards bleed to the viewport edges (no horizontal padding around the mosaic).
- Tiny `gap-3` between cards.
- Aspect ratios vary per card.

- [ ] **Step 4: Verify visually on mobile**

Resize browser to <768px. Expected:
- Single full-width column.
- Aspect ratios still vary.
- "Selected Works" label sits above the first card.
- No horizontal padding.

- [ ] **Step 5: Verify filter tabs still work**

Click each filter tab. Expected:
- Cards swap to the new filtered set instantly (no animation yet — that comes in Task 8).
- Layout reflows correctly with the new card count.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/ProjectsGrid.tsx
git commit -m "feat: editorial mosaic layout for ProjectsGrid"
```

---

## Task 8: Animate filter changes with GSAP Flip

**Files:**
- Modify: `src/components/sections/ProjectsGrid.tsx`

- [ ] **Step 1: Add GSAP Flip imports**

At the top of `src/components/sections/ProjectsGrid.tsx`, add:

```tsx
import { useState, useMemo, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);
```

(Replace the existing `import { useState, useMemo } from 'react';` line with the expanded one above.)

- [ ] **Step 2: Replace ProjectsGrid with the Flip-animated version**

GSAP Flip needs to capture DOM state *before* the layout change, then animate from old to new positions after React re-renders. The pattern is:
1. Wrap `setActiveFilter` so we capture state via `Flip.getState()` first.
2. Use `useLayoutEffect` to play `Flip.from()` after re-render.

Replace the entire `ProjectsGrid` function body with:

```tsx
export function ProjectsGrid({ onProjectClick }: ProjectsGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('residential');
  const gridRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return projects;
    return projects.filter((project) => project.category === activeFilter);
  }, [activeFilter]);

  const handleFilterChange = (next: FilterCategory) => {
    if (gridRef.current) {
      flipStateRef.current = Flip.getState(
        gridRef.current.querySelectorAll('[data-flip-id]')
      );
    }
    setActiveFilter(next);
  };

  useLayoutEffect(() => {
    if (!flipStateRef.current || !gridRef.current) return;
    Flip.from(flipStateRef.current, {
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
  }, [filteredProjects]);

  return (
    <section
      id="projects"
      className="py-16 md:py-24 px-0"
    >
      <div className="px-4 md:px-8 mb-10 md:mb-14">
        <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} />
      </div>

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3">
        <div className="md:col-span-3 flex items-end justify-start px-4 md:px-6 pb-2">
          <h2
            className="text-xs md:text-sm tracking-[0.3em] uppercase"
            style={{ color: 'var(--warm-sand)', fontFamily: 'Outfit, sans-serif' }}
          >
            Selected Works
          </h2>
        </div>

        {filteredProjects.map((project, index) => {
          const pattern = MOSAIC_PATTERN[index % MOSAIC_PATTERN.length];
          const colsClass =
            index === 0 ? 'md:col-span-9' : COL_SPAN_CLASS[pattern.cols];
          return (
            <div key={project.id} className={`col-span-1 ${colsClass}`}>
              <ProjectCard
                project={project}
                onClick={() => onProjectClick(project)}
                index={index}
                aspectRatio={pattern.ratio}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

The pattern:
- `handleFilterChange` runs **before** React re-renders. It captures the current DOM state via `Flip.getState(...)` and stores it in a ref, then calls `setActiveFilter`.
- After React re-renders the new layout, `useLayoutEffect` runs `Flip.from()` with the captured state, which animates from old positions to new.
- `absolute: true` lets cards animate without being constrained by grid layout during the tween.
- `onEnter`/`onLeave` fade new cards in and removed cards out.

- [ ] **Step 3: Verify FilterTabs prop type still matches**

Run: `cat src/components/ui-custom/FilterTabs.tsx | head -20`
Confirm `onFilterChange` accepts `(filter: FilterCategory) => void`. If it does, no change needed. If it accepts a different signature, adapt `handleFilterChange` to match.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: builds with no TypeScript errors. If `gsap/Flip` import fails, run `ls node_modules/gsap` to confirm Flip is bundled — it should be (it's part of the gsap package since v3).

- [ ] **Step 5: Verify animation visually**

Run: `npm run dev`
Click between filter tabs. Expected:
- Cards smoothly translate from their old mosaic positions to their new ones over ~600ms.
- Cards being removed fade out; new cards fade in.
- No layout jumps or glitches.
- Animation feels coherent — like the layout is rearranging itself, not blinking.

If animation is jerky or cards overlap incorrectly, tune `duration` or remove `absolute: true`.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/ProjectsGrid.tsx
git commit -m "feat: animate ProjectsGrid filter changes with GSAP Flip"
```

---

## Task 9: Final visual pass and cleanup

**Files:**
- (Inspection only — possibly minor tweaks)

- [ ] **Step 1: Full-page visual inspection on desktop**

Run: `npm run dev`
Scroll from top to bottom. Check each transition:
- Hero → PinnedImageSection: no visible color seam, mist wash visible at viewport ~95vh.
- PinnedImageSection → GalleryStrip: framed image's drop shadow bleeds into the start of the marquee.
- GalleryStrip → ProjectsGrid: marquee dissolves into plaster, no fade band, no hard edge.
- ProjectsGrid: edge-to-edge mosaic, varied widths and heights, "Selected Works" label integrated into row 1, filter animations smooth.

- [ ] **Step 2: Mobile inspection**

Resize to <768px or use device emulator. Check:
- Hero still fills viewport.
- PinnedImageSection still pins (this is the most likely thing to break — GSAP pin on mobile can be touchy with negative margins).
- GalleryStrip marquee still scrolls.
- ProjectsGrid collapses to single full-width column.
- No horizontal scroll.

If horizontal scroll appears anywhere, the culprit is most likely the negative-margin overlap on PinnedImageSection or one of the OrganicBackdrop washes. Add `overflow-x: hidden` to the page-level wrapper if needed.

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: no new errors introduced by this work. Fix any new lint errors before committing.

- [ ] **Step 4: Commit any cleanup**

```bash
git add -A
git commit -m "chore: final cleanup and lint pass for seamless layout"
```

---

## Summary of files changed

| File | Change |
|---|---|
| [src/components/ui-custom/OrganicBackdrop.tsx](src/components/ui-custom/OrganicBackdrop.tsx) | **NEW** — radial wash component |
| [src/App.tsx](src/App.tsx) | Mount OrganicBackdrop, plaster background at root |
| [src/components/sections/Hero.tsx](src/components/sections/Hero.tsx) | Remove background, delete mist glow block |
| [src/components/sections/PinnedImageSection.tsx](src/components/sections/PinnedImageSection.tsx) | Remove background, delete decorative circle, add -30vh margin |
| [src/components/sections/GalleryStrip.tsx](src/components/sections/GalleryStrip.tsx) | Remove background, delete fade overlays, varied heights, 2px radius |
| [src/components/sections/ProjectsGrid.tsx](src/components/sections/ProjectsGrid.tsx) | Edge-to-edge 12-col mosaic, MOSAIC_PATTERN, GSAP Flip filter animation |
| [src/components/ui-custom/ProjectCard.tsx](src/components/ui-custom/ProjectCard.tsx) | aspectRatio prop, borderless, restrained hover, data-flip-id |
