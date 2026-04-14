# Mood Board Detail Page & Purpose Gallery — Design Spec

**Date:** 2026-04-13
**Status:** Draft

---

## Overview

Extend the existing project detail page (`/purpose/:projectId`) with a horizontally-scrolling mood board section that activates after the user scrolls past the existing vertical content. Additionally, create a new `/purpose` gallery route that displays projects one per viewport in a full-screen vertical scroll.

## Scope

Three additions to the existing codebase:

1. **`MoodBoard` component** — horizontal editorial strip appended below the existing `ProjectDetail` content
2. **`/purpose` route** — full-screen vertical gallery page, one project image per viewport
3. **Contextual Return button** — state-aware navigation that adapts based on scroll position

The existing `ProjectDetail` component remains unchanged. The home page `ProjectsGrid` remains unchanged.

---

## 1. Mood Board Component

### Architecture

`MoodBoard` is a new component rendered as a sibling after the image gallery inside `ProjectDetail`. It receives the current `Project` data as props.

```
ProjectDetail (unchanged)
  ├── Hero section (vertical scroll)
  ├── Services section (vertical scroll)
  ├── Image gallery (vertical scroll)
  └── MoodBoard (NEW — horizontal scroll)
       ├── Pinned horizontal container (GSAP ScrollTrigger)
       │   ├── Zone 1: Hero image + project title + description
       │   ├── Zone 2: Framed image + area number + services list
       │   ├── Zone 3: Landscape image + body copy + detail photo
       │   ├── Zone 4: Year + portrait image + label
       │   └── Zone 5: CTA ("Let's Talk")
       └── Progress bar (fixed bottom, visible only in mood board)
```

### Scroll Mechanics

- **Engine:** GSAP ScrollTrigger pin + horizontal tween
- **Behavior:** When the mood board container enters the viewport, ScrollTrigger pins it. Vertical scroll input maps to horizontal translation via a GSAP tween. When the horizontal strip ends, the pin releases.
- **Total width:** 5-6x viewport width
- **Scrolling feel:** Smooth/inertial (GSAP's built-in interpolation). No snapping.
- **Input mapping:** Mouse wheel, trackpad (vertical and horizontal), keyboard arrows all drive horizontal movement while pinned.

### Vertical-to-Horizontal Transition

- **Style:** Seamless hijack. No visual break, divider, or gate. The user scrolls past the gallery and the mood board content starts appearing from the right edge as scrolling silently becomes horizontal.
- **Implementation:** ScrollTrigger `pin: true` on the mood board wrapper. The `start` trigger fires when the wrapper's top hits the viewport top. The `end` is calculated from the total horizontal width minus one viewport width.

### Layout & Composition

**Composition rules:**
- Treat the horizontal strip as one continuous magazine spread, not stacked sections
- Elements placed at irregular Y-positions and varied sizes
- Mix scales dramatically: 8vw display headlines next to 12px captions
- Generous negative space — elements breathe
- Combine full-bleed images with smaller framed/matted images (white padding + caption)

**5 editorial zones across the strip:**

| Zone | Content | Data Source |
|------|---------|-------------|
| 1. Hero | Full-bleed image (45vw x 70vh), giant project name near bottom, small description floating near top | `project.thumbnail`, `project.name`, `project.description` |
| 2. Data | Polaroid-framed image (white border + caption), giant watermark area number, numbered services list | `project.images[1]`, `project.area`, `project.services`, `project.location`, `project.year` |
| 3. Craft | Wide landscape image (50vw x 35vh), thin body copy column, small matted detail study photo | `project.images[2]`, `project.description`, `project.images[3]` |
| 4. Year | Large transparent year number, dramatic portrait image (40vw x 60vh), collection label | `project.year`, `project.images[4]` or fallback to thumbnail, `project.category` |
| 5. CTA | Centered "Let's Talk" heading, subtitle, "Get in Touch" button | Static content (button is non-functional placeholder — will link to contact when that route exists) |

**Note:** Projects currently have limited images (mostly 1). The layout gracefully handles this by reusing the thumbnail and falling back where images are unavailable. When richer content is added later, it slots in naturally.

### Visual Style

- **Background:** Project's `overlayColor` blended with `var(--plaster)`. Subtle gradient shifts across zones — no hard section breaks.
- **Typography:** Uses existing project font stack. Display headlines in large serif/sans, captions in small tracking-wide text.
- **Text colors:** `mersi-dark` for primary text, reduced opacity variants for secondary. White text where background is dark enough.

### Motion & Reveals

**Element entrance animations** (triggered as elements enter viewport from right):

| Element Type | Transform | Duration | Ease |
|-------------|-----------|----------|------|
| Images | `x: 60px → 0, opacity: 0 → 1` | 1.0-1.3s | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Headlines | `x: 100px → 0, opacity: 0 → 1` | 1.2-1.5s | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Captions/Lists | `x: 40px → 0, opacity: 0 → 1`, stagger 0.1s | 0.8-1.0s | `cubic-bezier(0.22, 1, 0.36, 1)` |

**Parallax (3 depth layers):**

| Layer | Speed Factor | Elements |
|-------|-------------|----------|
| Background (slow) | 0.15-0.3 | Hero images, background color zones |
| Midground (medium) | 0.4-0.6 | Display headlines, main images, framed photos |
| Foreground (fast) | 0.7-0.9 | Small captions, index lists, labels |

**Additional effects:**
- Large images subtly scale (`1.05 → 1.0`) as they pass through viewport center
- Service list rows reveal one-by-one with stagger

### Progress Bar

- Fixed at bottom of viewport, 2px height
- Only visible while ScrollTrigger pin is active (mood board zone)
- Fills left-to-right based on ScrollTrigger progress (0 → 1)
- Color: white at reduced opacity or lightened `overlayColor`, depending on background contrast

### Mobile (< 768px)

- No horizontal scroll. No ScrollTrigger pin.
- Mood board content renders as stacked vertical sections below the gallery.
- Same editorial content, laid out top-to-bottom.
- Standard scroll-triggered fade-in animations (GSAP or Framer Motion).
- Progress bar hidden.

---

## 2. Purpose Gallery Page (`/purpose`)

### Route

- **Path:** `/purpose`
- **Access:** Header "PURPOSE" nav link. Exists alongside the current `/purpose/:projectId` route.
- **Home page behavior unchanged:** `ProjectsGrid` cards still navigate directly to `/purpose/:projectId`.

### Layout

- Each project occupies 100vh (one full viewport).
- Project image fills the viewport (`object-cover`).
- Background: project's `overlayColor`, visible around image edges and during scroll transitions.
- Project name and category label overlaid at bottom-center of each viewport.
- Smooth vertical scroll, no snapping.
- Images parallax or crossfade as the user scrolls between them.

### Interaction

- Click/tap any project image → triggers existing `SplitTransition` → navigates to `/purpose/:projectId`.
- Uses the same `handleProjectClick` flow already in `App.tsx`.

### Mobile

- Same layout — full-viewport stacked images work naturally on small screens.
- Tap to navigate to detail page.

---

## 3. Contextual Return Button

The existing fixed "Return" button in `ProjectDetail` becomes scroll-position-aware.

### State Machine

| State | Condition | Button Action |
|-------|-----------|---------------|
| **Detail top** | ScrollTrigger progress === 0 (not in mood board) | Navigate home (existing behavior) |
| **In mood board** | ScrollTrigger progress > 0 | Smooth scroll to top of detail page |
| **Back at top** | After scrolling to top from mood board | Navigate home (resets to default) |

### Implementation

- Track whether the user is in the mood board zone via ScrollTrigger's `onUpdate` callback.
- The button label stays "Return" in all states — the behavior changes, not the label.
- Smooth scroll to top uses `window.scrollTo({ top: 0, behavior: 'smooth' })`.

---

## Technical Notes

### Dependencies

- **No new dependencies.** GSAP + ScrollTrigger and Framer Motion are already installed.

### Files to Create

- `src/components/sections/MoodBoard.tsx` — horizontal mood board component
- `src/components/sections/PurposeGallery.tsx` — full-screen vertical gallery page

### Files to Modify

- `src/components/sections/ProjectDetail.tsx` — render `MoodBoard` after gallery, add scroll state for Return button
- `src/App.tsx` — add `/purpose` route, pass `handleProjectClick` to `PurposeGallery`

### GSAP ScrollTrigger Pattern

```
ScrollTrigger.create({
  trigger: moodBoardRef,
  start: "top top",
  end: () => `+=${totalHorizontalWidth - viewportWidth}`,
  pin: true,
  scrub: 1,  // smooth 1-second lag
  onUpdate: (self) => {
    // Update progress bar
    // Update Return button state
    // Trigger element reveals based on self.progress
  }
});
```

The horizontal translation is applied via a GSAP tween tied to the ScrollTrigger's scrub, not manual wheel event interception.
