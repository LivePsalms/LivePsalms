# Split-Overlay Page Transition — Design Spec

## Overview

On click of a project card, trigger a full-screen page transition using two vertical overlay halves that expand outward from the card's horizontal center, cover the viewport, then reverse inward to reveal the project detail page underneath.

## Approach

Framer Motion — declarative animation with `motion.div` panels, coordinated via React state machine. Chosen over GSAP (imperative DOM wiring) and CSS keyframes (hard to dynamically position from click origin).

## State Machine

```
idle → expanding → holding → revealing → idle
```

### States

| State | Description |
|-------|-------------|
| `idle` | No transition active |
| `expanding` | Panels growing from card center to cover viewport |
| `holding` | Brief pause (~50ms) ensuring detail page is mounted |
| `revealing` | Panels collapsing back to center seam, unveiling detail page |

### Data

```ts
type TransitionState = 'idle' | 'expanding' | 'holding' | 'revealing';

interface TransitionOrigin {
  centerX: number;   // horizontal center of clicked card (viewport px)
  centerY: number;   // vertical center of clicked card (viewport px)
  height: number;    // card's height (for vertical scale origin)
  overlayColor: string; // project.overlayColor
}
```

### Flow

1. User clicks card → capture `getBoundingClientRect()` → store as `TransitionOrigin`
2. Set `selectedProject` and `transitionState = 'expanding'`
3. Two overlay panels render (fixed, full viewport), animate from card center outward
4. On expand complete → `transitionState = 'holding'` → brief pause (~50ms)
5. → `transitionState = 'revealing'` → panels reverse inward to center seam
6. On reveal complete → `transitionState = 'idle'`, clear `TransitionOrigin`

`ProjectDetail` mounts immediately at step 2 but is hidden behind the overlay panels.

## New Component: SplitTransition

**File:** `src/components/ui-custom/SplitTransition.tsx`

### Props

```ts
interface SplitTransitionProps {
  state: TransitionState;
  origin: TransitionOrigin | null;
  onExpandComplete: () => void;
  onRevealComplete: () => void;
}
```

### Panel Structure

Two `motion.div` panels, both `position: fixed`, `top: 0`, `height: 100vh`, colored with `origin.overlayColor`. No content on panels (no logo, no category label).

### Phase 1 — Expanding (600–800ms)

- Left panel: `left: centerX, width: 0` → `left: 0, width: 50vw`
- Right panel: `left: centerX, width: 0` → `left: 50vw, width: 50vw`
- Vertically: both panels start with `top: origin.centerY - origin.height/2, height: origin.height` and animate to `top: 0, height: 100vh`
- Easing: `[0.43, 0.13, 0.23, 0.96]` (matches existing hover overlay curve)

### Phase 2 — Revealing (500–700ms, after ~50ms hold)

- Left panel: `left: 0, width: 50vw` → `left: 50vw, width: 0` (slides to center)
- Right panel: `left: 50vw, width: 50vw` → `left: 50vw, width: 0` (slides to center)
- Both disappear at the center seam
- Easing: same curve

Uses Framer Motion `onAnimationComplete` to fire callbacks advancing the state machine.

## Integration Points

### App.tsx

Current conditional render stays the same. `SplitTransition` renders as a sibling at the same level:

```tsx
{selectedProject ? <ProjectDetail ... /> : <main>...</main>}
<SplitTransition
  state={transitionState}
  origin={transitionOrigin}
  onExpandComplete={handleExpandComplete}
  onRevealComplete={handleRevealComplete}
/>
```

### handleProjectClick (updated)

```ts
const handleProjectClick = (project: Project, rect: DOMRect) => {
  setTransitionOrigin({
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    height: rect.height,
    overlayColor: project.overlayColor,
  });
  setSelectedProject(project);
  setTransitionState('expanding');
  document.body.style.overflow = 'hidden';
};
```

### ProjectCard change

`onClick` handler uses `e.currentTarget.getBoundingClientRect()` to pass the card's rect alongside the project data. The `onProjectClick` callback signature changes to `(project: Project, rect: DOMRect) => void`.

### ProjectsGrid change

`onProjectClick` prop signature updates to include `DOMRect`.

## Mobile

Works identically on all screen sizes. The card's bounding rect is captured the same way on tap. Fixed overlay panels cover the viewport regardless of screen size. No breakpoint logic needed.

## z-index

Overlay panels: `z-40` — above main content and detail page, below the grain overlay (`z-[1000]`).

## Back Navigation

Back button from ProjectDetail does **not** play the split transition in reverse. Uses existing fade-out/state-clear behavior. The split transition is entry-only.

## Files Modified

| File | Change |
|------|--------|
| `src/components/ui-custom/SplitTransition.tsx` | **New** — transition overlay component |
| `src/App.tsx` | Add state machine, updated `handleProjectClick`, render `SplitTransition` |
| `src/components/sections/ProjectsGrid.tsx` | Update `onProjectClick` signature to pass `DOMRect`, update `ProjectCard` onClick |

## Accessibility

- Respects `prefers-reduced-motion`: skip animation, instant state swap (matches existing pattern in ProjectsGrid)
- `aria-hidden="true"` on overlay panels (decorative only)
