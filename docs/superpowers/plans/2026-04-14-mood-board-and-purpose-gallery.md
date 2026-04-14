# Mood Board & Purpose Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the project detail page with a horizontally-scrolling editorial mood board, add a full-screen `/purpose` gallery route, and make the Return button context-aware.

**Architecture:** The mood board is a new `MoodBoard` component rendered after the existing gallery in `ProjectDetail`. It uses GSAP ScrollTrigger to pin itself and convert vertical scroll into horizontal translation. A new `PurposeGallery` component serves the `/purpose` route with full-viewport project images. The Return button tracks scroll position via ScrollTrigger to switch between "go home" and "scroll to top" behavior.

**Tech Stack:** React 19, TypeScript, GSAP 3 (ScrollTrigger already installed), Framer Motion, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-13-mood-board-detail-page-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/components/sections/MoodBoard.tsx` | Horizontal editorial strip with GSAP ScrollTrigger pin, parallax, reveals, progress bar |
| Create | `src/components/sections/MoodBoardMobile.tsx` | Vertical stack fallback for < 768px |
| Create | `src/components/sections/PurposeGallery.tsx` | Full-screen vertical gallery at `/purpose` |
| Modify | `src/components/sections/ProjectDetail.tsx` | Render MoodBoard after gallery, lift scroll state for Return button |
| Modify | `src/App.tsx` | Add `/purpose` route, wire PurposeGallery |
| Modify | `src/data/projects.ts` | Change PURPOSE navItem href from `#purpose` to `/purpose` |

---

## Task 1: Purpose Gallery Page

Create the `/purpose` route with full-viewport project images.

**Files:**
- Create: `src/components/sections/PurposeGallery.tsx`
- Modify: `src/App.tsx:97-119`
- Modify: `src/data/projects.ts:104-105`

- [ ] **Step 1: Create PurposeGallery component**

```tsx
// src/components/sections/PurposeGallery.tsx
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
      // Parallax: each image moves slightly slower than scroll
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

      // Fade in text overlays
      gsap.utils.toArray<HTMLElement>('.purpose-overlay').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el.closest('.purpose-slide'),
              start: 'top 60%',
              toggleActions: 'play none none reverse',
            },
          }
        );
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
          <div className="purpose-overlay absolute bottom-0 left-0 right-0 p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-2">
              {project.name}
            </h2>
            <p className="text-sm text-white/60 tracking-widest uppercase">
              {categoryLabel[project.category]}
            </p>
          </div>
          {/* Gradient overlay for text readability */}
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add /purpose route to App.tsx**

In `src/App.tsx`, add the import at the top with the other imports:

```tsx
import { PurposeGallery } from '@/components/sections/PurposeGallery';
```

Then add the new route between the `/` route and the `/purpose/:projectId` route inside the `<Routes>` block. The order matters — `/purpose/:projectId` must come after `/purpose` so the exact match wins:

```tsx
<Routes>
  <Route
    path="/"
    element={
      <main>
        <WaterRipple
          rippleColor="rgba(40, 35, 30, 0.12)"
          rippleDuration={1800}
          maxRipples={6}
        >
          <Hero showNav={showNav} />
        </WaterRipple>
        <ProjectsGrid projects={projects} onProjectClick={handleProjectClick} />
      </main>
    }
  />
  <Route
    path="/purpose"
    element={
      <PurposeGallery projects={projects} onProjectClick={handleProjectClick} />
    }
  />
  <Route
    path="/purpose/:projectId"
    element={
      <ProjectDetailRoute projects={projects} onBack={handleBackToProjects} />
    }
  />
</Routes>
```

- [ ] **Step 3: Update PURPOSE nav link**

In `src/data/projects.ts`, change the PURPOSE navItem from an anchor to a route:

```ts
// Change this:
{ label: 'PURPOSE', href: '#purpose' },
// To this:
{ label: 'PURPOSE', href: '/purpose' },
```

- [ ] **Step 4: Update Header to use React Router for internal links**

The Header currently renders nav items as `<a href="...">` tags. The `/purpose` link needs to use React Router navigation. In `src/components/layout/Header.tsx`, add the import:

```tsx
import { useNavigate } from 'react-router-dom';
```

Inside the `Header` component, add:

```tsx
const navigate = useNavigate();
```

Update the desktop nav item rendering to handle route links. Replace the `navItems.map` block inside the desktop `<nav>`:

```tsx
{navItems.map((item, index) => (
  <WaterText
    key={item.label}
    href={item.href}
    as="a"
    onClick={(e: React.MouseEvent) => {
      if (item.href.startsWith('/')) {
        e.preventDefault();
        navigate(item.href);
      }
    }}
    className="text-[10px] lg:text-[11px] font-medium tracking-widest transition-opacity duration-300"
    style={{
      color: textColor,
      opacity: showNav ? 1 : 0,
      transform: showNav
        ? 'translateY(0)'
        : 'translateY(20px)',
      transition: `all 2.5s cubic-bezier(0.16, 1, 0.3, 1)`,
      transitionDelay: `${800 + index * 150}ms`,
    }}
  >
    {item.label}
  </WaterText>
))}
```

Do the same for the mobile nav items — add onClick handler to the `navItems.map` in the mobile menu overlay:

```tsx
{navItems.map((item) => (
  <a
    key={item.label}
    href={item.href}
    onClick={(e) => {
      if (item.href.startsWith('/')) {
        e.preventDefault();
        navigate(item.href);
      }
      setIsMobileMenuOpen(false);
    }}
    className="text-lg font-medium tracking-widest hover:opacity-60 transition-opacity duration-300"
    style={{ color: textColor }}
  >
    {item.label}
  </a>
))}
```

- [ ] **Step 5: Verify the purpose gallery works**

Run: `npm run dev`

Test manually:
1. Click "PURPOSE" in the header nav → should navigate to `/purpose`
2. Full-screen project images should stack vertically, one per viewport
3. Scrolling shows parallax on images and fade-in on text overlays
4. Clicking any project image → should trigger SplitTransition → navigate to `/purpose/:projectId`
5. Back button on detail page should return home

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/PurposeGallery.tsx src/App.tsx src/data/projects.ts src/components/layout/Header.tsx
git commit -m "feat: add /purpose gallery page with full-viewport project images"
```

---

## Task 2: MoodBoard Component — Horizontal Scroll Shell

Create the core horizontal scrolling container with GSAP ScrollTrigger pinning.

**Files:**
- Create: `src/components/sections/MoodBoard.tsx`

- [ ] **Step 1: Create MoodBoard with ScrollTrigger horizontal pin**

```tsx
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
    }, sectionRef);

    return () => ctx.revert();
  }, [isMobile, onInMoodBoard]);

  // Blend overlayColor with plaster for background
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

// Inline mobile fallback — simple vertical stack
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
```

- [ ] **Step 2: Verify the component compiles**

Run: `npm run dev`

Check the browser console for any TypeScript or runtime errors. The component isn't rendered yet — just ensuring it compiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/MoodBoard.tsx
git commit -m "feat: add MoodBoard component with GSAP horizontal scroll"
```

---

## Task 3: Wire MoodBoard into ProjectDetail

Mount the MoodBoard component after the existing gallery and add contextual Return button behavior.

**Files:**
- Modify: `src/components/sections/ProjectDetail.tsx`

- [ ] **Step 1: Add MoodBoard import and scroll state**

At the top of `src/components/sections/ProjectDetail.tsx`, add the import:

```tsx
import { MoodBoard } from '@/components/sections/MoodBoard';
```

- [ ] **Step 2: Add contextual Return button state**

Inside the `ProjectDetail` component, add state to track whether the user is in the mood board zone. Add these after the existing `useState` calls:

```tsx
const [inMoodBoard, setInMoodBoard] = useState(false);

const handleReturn = () => {
  if (inMoodBoard) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    onBack();
  }
};
```

- [ ] **Step 3: Update the Return button onClick**

Change the back button's `onClick` from `onBack` to `handleReturn`:

```tsx
<button
  onClick={handleReturn}
  className={`fixed top-24 left-6 lg:left-10 z-50 flex items-center gap-2 text-sm font-medium text-mersi-dark hover:opacity-60 transition-all duration-500 ${
    isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
  }`}
>
  <ArrowLeft className="w-4 h-4" />
  Return
</button>
```

- [ ] **Step 4: Render MoodBoard after the image gallery**

Add the MoodBoard component after the image gallery `</div>` (after the closing of the gallery section, before the closing `</section>` tag). Place it right before `</section>`:

```tsx
      {/* Mood Board - Horizontal Editorial Strip */}
      <MoodBoard project={project} onInMoodBoard={setInMoodBoard} />
    </section>
```

The full end of the component should look like:

```tsx
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

      {/* Mood Board - Horizontal Editorial Strip */}
      <MoodBoard project={project} onInMoodBoard={setInMoodBoard} />
    </section>
```

- [ ] **Step 5: Verify the full flow works**

Run: `npm run dev`

Test manually:
1. Navigate to any project detail page (`/purpose/:projectId`)
2. Existing hero, services, and gallery sections should render unchanged
3. Scroll past the gallery → the mood board section should pin and start scrolling horizontally
4. Scroll progress bar appears at bottom while in mood board zone
5. While in mood board, clicking Return scrolls to top of detail page
6. At top of detail page, clicking Return navigates home
7. On mobile (< 768px), mood board renders as vertical sections

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/ProjectDetail.tsx
git commit -m "feat: wire MoodBoard into ProjectDetail with contextual Return"
```

---

## Task 4: Parallax and Reveal Animations

Add the parallax depth layers and element entrance animations to the mood board.

**Files:**
- Modify: `src/components/sections/MoodBoard.tsx`

- [ ] **Step 1: Add parallax and reveal animations inside the existing useLayoutEffect**

Inside the `useLayoutEffect` in `MoodBoard`, after the ScrollTrigger setup for horizontal pinning, add parallax and reveal logic within the same `gsap.context()` callback. Add this code after the `gsap.to(track, ...)` block but still inside `ctx`:

```tsx
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
        containerAnimation: gsap.getById?.('moodboard-pin') || undefined,
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
```

- [ ] **Step 2: Add an ID to the main ScrollTrigger for containerAnimation reference**

Update the main `gsap.to(track, ...)` call to include an id so reveal animations can reference it. Change the scrollTrigger config:

```tsx
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
```

- [ ] **Step 3: Test the animations**

Run: `npm run dev`

Test manually:
1. Navigate to a project detail page
2. Scroll into the mood board section
3. Elements should fade + translate in from the right as they enter the viewport
4. Different elements should move at different speeds (parallax depth)
5. Service list items should stagger in one-by-one
6. Large images should subtly scale down as they pass through center

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/MoodBoard.tsx
git commit -m "feat: add parallax depth layers and reveal animations to MoodBoard"
```

---

## Task 5: Polish and Edge Cases

Handle edge cases, refine the visual style, and ensure clean integration.

**Files:**
- Modify: `src/components/sections/MoodBoard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Handle ScrollTrigger cleanup on route change**

In `src/App.tsx`, the detail page unmounts when navigating away. GSAP ScrollTrigger instances are cleaned up by the `gsap.context().revert()` in the MoodBoard component, but ensure body overflow is reset. In the `handlePhaseComplete` callback where `transitionPhase === 'revealing'`, the overflow is already being reset for non-detail pages. No change needed — just verify this works.

- [ ] **Step 2: Add background gradient transitions between zones**

In the MoodBoard component, update the zone wrapper divs to include subtle background color variations. Apply these inline styles to create depth without hard breaks. Update each zone's `style` prop:

Zone 1 (already has `bgColor`): no change needed — inherits from parent.

Zone 2: add a slight shift:
```tsx
style={{ width: '180vw', backgroundColor: `color-mix(in srgb, ${project.overlayColor} 85%, var(--plaster))` }}
```

Zone 3: shift further:
```tsx
style={{ width: '220vw', backgroundColor: `color-mix(in srgb, ${project.overlayColor} 70%, black 10%)` }}
```

Zone 4: warmer:
```tsx
style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${project.overlayColor} 90%, black 5%)` }}
```

Zone 5 already has its own `backgroundColor: 'rgba(0,0,0,0.15)'` overlay — leave as-is.

- [ ] **Step 3: Ensure detail page doesn't show footer**

Check `src/App.tsx` — the footer is already hidden on detail pages via `{!isDetailPage && <Footer />}`. The `/purpose` gallery page should also hide the footer. Update the `isDetailPage` check:

```tsx
const isDetailPage = location.pathname.startsWith('/purpose/');
const isPurposePage = location.pathname === '/purpose';
const hideFooter = isDetailPage || isPurposePage;
```

Then update the footer rendering:

```tsx
{!hideFooter && <Footer />}
```

Also update the spacer div:

```tsx
{!hideFooter && (
  <div className="h-[20vh] md:h-[25vh]" style={{ background: 'var(--plaster)' }} />
)}
```

- [ ] **Step 4: Final end-to-end test**

Run: `npm run dev`

Full test checklist:
1. Home page loads normally — grid, hero, transitions all work
2. Click "PURPOSE" in nav → `/purpose` gallery with full-viewport images
3. Click project in purpose gallery → SplitTransition → detail page
4. Detail page: hero, services, gallery all render as before
5. Scroll past gallery → mood board pins and scrolls horizontally
6. Parallax layers move at different speeds
7. Elements fade in from right as they enter viewport
8. Progress bar visible at bottom during mood board
9. Return button in mood board → scrolls to top
10. Return button at top → navigates home
11. Resize to mobile (< 768px) → mood board is vertical stack
12. Purpose gallery works on mobile with tap navigation
13. No console errors or GSAP warnings

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/MoodBoard.tsx src/App.tsx
git commit -m "feat: polish MoodBoard with gradient zones, fix footer visibility"
```
