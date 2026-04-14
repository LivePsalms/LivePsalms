# Split-Overlay Page Transition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a center-origin split-overlay page transition when clicking a project card, expanding two colored panels from the card's center to cover the viewport, then reversing to reveal the project detail page.

**Architecture:** New `SplitTransition` component driven by a state machine (`idle → expanding → holding → revealing → idle`) managed in App.tsx. Framer Motion animates two fixed-position panels. The clicked card's bounding rect seeds the animation origin.

**Tech Stack:** React, Framer Motion (already in project), TypeScript

---

### Task 1: Create the SplitTransition component

**Files:**
- Create: `src/components/ui-custom/SplitTransition.tsx`

- [ ] **Step 1: Create the component file with types and shell**

Create `src/components/ui-custom/SplitTransition.tsx`:

```tsx
import { motion } from 'framer-motion';
import { useEffect } from 'react';

export type TransitionState = 'idle' | 'expanding' | 'holding' | 'revealing';

export interface TransitionOrigin {
  centerX: number;
  centerY: number;
  height: number;
  overlayColor: string;
}

interface SplitTransitionProps {
  state: TransitionState;
  origin: TransitionOrigin | null;
  onExpandComplete: () => void;
  onRevealComplete: () => void;
}

const EASE = [0.43, 0.13, 0.23, 0.96] as const;
const EXPAND_DURATION = 0.7;   // 700ms
const REVEAL_DURATION = 0.6;   // 600ms
const HOLD_DELAY = 50;         // ms pause between phases

export function SplitTransition({
  state,
  origin,
  onExpandComplete,
  onRevealComplete,
}: SplitTransitionProps) {
  // Auto-advance from holding → revealing after a brief pause
  useEffect(() => {
    if (state !== 'holding') return;
    const timer = setTimeout(onExpandComplete, HOLD_DELAY);
    return () => clearTimeout(timer);
  }, [state, onExpandComplete]);

  if (state === 'idle' || !origin) return null;

  const isExpanding = state === 'expanding' || state === 'holding';
  const isRevealing = state === 'revealing';

  // Expanding: panels grow from card center to viewport edges
  // Revealing: panels collapse from viewport edges back to center
  const leftPanel = {
    initial: {
      left: origin.centerX,
      width: 0,
      top: origin.centerY - origin.height / 2,
      height: origin.height,
    },
    expanded: {
      left: 0,
      width: '50vw',
      top: 0,
      height: '100vh',
    },
    revealed: {
      left: '50vw',
      width: 0,
      top: 0,
      height: '100vh',
    },
  };

  const rightPanel = {
    initial: {
      left: origin.centerX,
      width: 0,
      top: origin.centerY - origin.height / 2,
      height: origin.height,
    },
    expanded: {
      left: '50vw',
      width: '50vw',
      top: 0,
      height: '100vh',
    },
    revealed: {
      left: '50vw',
      width: 0,
      top: 0,
      height: '100vh',
    },
  };

  const getTarget = (panel: typeof leftPanel) => {
    if (isExpanding) return panel.expanded;
    if (isRevealing) return panel.revealed;
    return panel.initial;
  };

  const getInitial = (panel: typeof leftPanel) => {
    if (isExpanding) return panel.initial;
    return panel.expanded;
  };

  const duration = isExpanding ? EXPAND_DURATION : REVEAL_DURATION;

  // Only fire completion callback on the left panel (avoids double-fire)
  const handleAnimationComplete = () => {
    if (isExpanding) {
      // Will transition to 'holding', then useEffect advances to 'revealing'
    }
    if (isRevealing) {
      onRevealComplete();
    }
  };

  return (
    <>
      {/* Left panel */}
      <motion.div
        key={`left-${state}`}
        aria-hidden="true"
        initial={getInitial(leftPanel)}
        animate={getTarget(leftPanel)}
        transition={{ duration, ease: EASE }}
        onAnimationComplete={handleAnimationComplete}
        style={{
          position: 'fixed',
          backgroundColor: origin.overlayColor,
          zIndex: 40,
          pointerEvents: 'none',
        }}
      />
      {/* Right panel */}
      <motion.div
        key={`right-${state}`}
        aria-hidden="true"
        initial={getInitial(rightPanel)}
        animate={getTarget(rightPanel)}
        transition={{ duration, ease: EASE }}
        style={{
          position: 'fixed',
          backgroundColor: origin.overlayColor,
          zIndex: 40,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit src/components/ui-custom/SplitTransition.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui-custom/SplitTransition.tsx
git commit -m "feat: add SplitTransition overlay component"
```

---

### Task 2: Update ProjectCard and ProjectsGrid to pass DOMRect on click

**Files:**
- Modify: `src/components/sections/ProjectsGrid.tsx`

- [ ] **Step 1: Update the ProjectCard onClick to pass bounding rect**

In `src/components/sections/ProjectsGrid.tsx`, change the `ProjectCard` component's `onProjectClick` prop type and `onClick` handler.

Replace the `onProjectClick` prop in the `ProjectCard` function signature (line 47):

```tsx
  onProjectClick: (project: Project) => void;
```

with:

```tsx
  onProjectClick: (project: Project, rect: DOMRect) => void;
```

Replace the `onClick` on the outer div (line 55):

```tsx
      onClick={() => onProjectClick(project)}
```

with:

```tsx
      onClick={(e) => onProjectClick(project, e.currentTarget.getBoundingClientRect())}
```

- [ ] **Step 2: Update the ProjectsGridProps interface**

Replace the `ProjectsGridProps` interface (line 113-115):

```tsx
interface ProjectsGridProps {
  onProjectClick: (project: Project) => void;
}
```

with:

```tsx
interface ProjectsGridProps {
  onProjectClick: (project: Project, rect: DOMRect) => void;
}
```

- [ ] **Step 3: Verify the file compiles (expect App.tsx type error — that's fine, fixed in Task 3)**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`
Expected: Type error in App.tsx only (handleProjectClick signature mismatch)

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/ProjectsGrid.tsx
git commit -m "feat: pass DOMRect from ProjectCard click to parent"
```

---

### Task 3: Wire the state machine into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports and state**

At the top of `src/App.tsx`, add the import (after the existing imports, before `import './App.css'`):

```tsx
import { SplitTransition } from '@/components/ui-custom/SplitTransition';
import type { TransitionState, TransitionOrigin } from '@/components/ui-custom/SplitTransition';
```

Inside the `App` function, after the existing `useState` declarations (after line 16), add:

```tsx
  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const [transitionOrigin, setTransitionOrigin] = useState<TransitionOrigin | null>(null);
```

- [ ] **Step 2: Update handleProjectClick**

Replace the existing `handleProjectClick` (lines 25-28):

```tsx
  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    document.body.style.overflow = 'hidden';
  };
```

with:

```tsx
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

- [ ] **Step 3: Add transition callbacks**

After the updated `handleProjectClick`, add:

```tsx
  const handleExpandComplete = () => {
    setTransitionState('revealing');
  };

  const handleRevealComplete = () => {
    setTransitionState('idle');
    setTransitionOrigin(null);
  };
```

- [ ] **Step 4: Render the SplitTransition component**

In the JSX return, add `<SplitTransition>` just before the grain overlay div (before line 88 `{/* Global film-grain overlay */}`):

```tsx
      {/* Split-overlay page transition */}
      <SplitTransition
        state={transitionState}
        origin={transitionOrigin}
        onExpandComplete={handleExpandComplete}
        onRevealComplete={handleRevealComplete}
      />
```

- [ ] **Step 5: Verify everything compiles cleanly**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire split-transition state machine into App"
```

---

### Task 4: Add reduced-motion support

**Files:**
- Modify: `src/components/ui-custom/SplitTransition.tsx`

- [ ] **Step 1: Add reduced-motion detection**

In `SplitTransition.tsx`, add a reduced-motion check at the top of the component function body (before the `useEffect`):

```tsx
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

Then update the early return to also skip when reduced motion is preferred:

Replace:

```tsx
  if (state === 'idle' || !origin) return null;
```

with:

```tsx
  // Skip animation entirely for reduced-motion — the state machine still
  // advances via the callbacks so the detail page appears immediately.
  useEffect(() => {
    if (!prefersReduced) return;
    if (state === 'expanding') onExpandComplete();
    if (state === 'revealing') onRevealComplete();
  }, [state, prefersReduced, onExpandComplete, onRevealComplete]);

  if (state === 'idle' || !origin || prefersReduced) return null;
```

Note: the two `useEffect` hooks must always be called (React rules of hooks), so the reduced-motion check is inside the effect, not guarding it.

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui-custom/SplitTransition.tsx
git commit -m "feat: add prefers-reduced-motion support to split transition"
```

---

### Task 5: Manual QA

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/newmac/Downloads/Psalms_app && npm run dev`

- [ ] **Step 2: Test desktop**

1. Scroll to the projects grid section
2. Click any project card
3. Verify: two colored panels expand from the card's center to cover the viewport (~700ms)
4. Verify: panels then collapse back toward the center seam, revealing the detail page (~600ms)
5. Verify: no logo or category text appears on the panels during transition
6. Verify: back button returns to projects grid normally (no reverse transition)

- [ ] **Step 3: Test mobile viewport**

1. Use browser DevTools to set viewport to 375×812 (iPhone)
2. Tap a project card in the horizontal strip
3. Verify the same split transition plays correctly

- [ ] **Step 4: Test reduced motion**

1. In DevTools, enable "Prefers reduced motion" emulation
2. Click a card
3. Verify the detail page appears immediately with no animation

- [ ] **Step 5: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "fix: polish split transition after QA"
```
