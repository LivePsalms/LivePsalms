# Deepen the Purpose Detail Reveal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three coordinated `useState`/`useEffect` blocks in `PurposeDetail` (entry visibility, text-ready timer, imperative DOM-mutating exit animation) with a single deep `PurposeDetailReveal` class that owns the entry + exit lifecycle behind a small interface.

**Architecture:** A plain TypeScript class extending the existing `Observable<T>` primitive, mirroring `RouteTransition`. Five-state status machine (`idle → entering → revealed → exiting → exited`). All side effects (`applyExitStyles`, `setTimer`, `clearTimer`, `onExitComplete`) are injected as `DetailRevealDeps` so the class is testable in node with no DOM and no React. A thin `useDetailReveal` hook wires the production deps to `ref.current.style` mutations and `window.setTimeout`. The timeline (text-ready delay, exit duration, exit content/image style payloads, easing string) is exported from the module as a `DETAIL_REVEAL_TIMELINE` constant — single source of truth, JSX imports the easing string.

**Tech Stack:** TypeScript 5.9, React 19, Vitest (already configured at `vitest.config.ts`).

**Domain language:** see [docs/CONTEXT.md](../../CONTEXT.md) §`PurposeDetailReveal`. The name `PurposeDetailReveal`, the five status values, the deps interface, and the timeline constant come from there — use them exactly.

**Composition with `RouteTransition`:** the back-from-detail handshake currently spans two modules informally. After this plan, both halves are named: `RouteTransition.beginExit()` flips the `exiting` prop, `PurposeDetailReveal.requestExit()` plays the fade and fires `onExitComplete = RouteTransition.completeExit`. No change to `RouteTransition`.

---

## File Structure

### New files
- `src/transitions/purpose-detail-reveal.ts` — the deep module: state machine + deps interface + `DETAIL_REVEAL_TIMELINE`
- `src/transitions/purpose-detail-reveal.test.ts` — node-only tests with fake deps
- `src/transitions/useDetailReveal.tsx` — production React hook wiring real DOM + timers

### Modified files
- `src/components/sections/PurposeDetail.tsx` — drop the three `useState`/`useEffect` blocks; consume the hook; import the easing constant for inline transitions
- `docs/CONTEXT.md` — already updated in design phase (§`PurposeDetailReveal`)

### No changes
- `src/transitions/route-transition.ts` — the partner half is untouched; the comment at lines 9-11 referencing `PurposeDetail` continues to apply (now to a named module)
- `src/App.tsx` — `PurposeDetailRoute` still receives `exiting` and `onExitComplete` from `useRouteTransition` and passes them through

---

## Task 1: Create the module skeleton with initial-state test

**Files:**
- Create: `src/transitions/purpose-detail-reveal.ts`
- Create: `src/transitions/purpose-detail-reveal.test.ts`

- [ ] **Step 1: Write the failing initial-state test**

Create `src/transitions/purpose-detail-reveal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PurposeDetailReveal } from './purpose-detail-reveal';
import type { DetailRevealDeps } from './purpose-detail-reveal';

interface DepsRecord {
  exitStyles: Array<{ target: 'content' | 'image'; styles: Record<string, string> }>;
  timersScheduled: Array<{ ms: number; cb: () => void }>;
  timersCleared: number[];
  onExitComplete: number;
}

function makeDeps(): { deps: DetailRevealDeps; rec: DepsRecord; runTimer: (handle: number) => void } {
  let nextHandle = 1;
  const rec: DepsRecord = {
    exitStyles: [],
    timersScheduled: [],
    timersCleared: [],
    onExitComplete: 0,
  };
  const handleToCb = new Map<number, () => void>();
  const deps: DetailRevealDeps = {
    applyExitStyles: (target, styles) => {
      rec.exitStyles.push({ target, styles });
    },
    setTimer: (cb, ms) => {
      const handle = nextHandle++;
      handleToCb.set(handle, cb);
      rec.timersScheduled.push({ ms, cb });
      return handle;
    },
    clearTimer: (handle) => {
      rec.timersCleared.push(handle);
      // Intentionally NOT deleting from handleToCb — tests simulate the case
      // where a real `setTimeout` fires moments after `clearTimeout` was
      // called (rare but possible). The class's own `=== null` guard is what
      // must catch this.
    },
    onExitComplete: () => {
      rec.onExitComplete++;
    },
  };
  const runTimer = (handle: number) => {
    const cb = handleToCb.get(handle);
    if (cb) cb();
  };
  return { deps, rec, runTimer };
}

describe('PurposeDetailReveal — initial state', () => {
  it('starts idle with isVisible=false and textReady=false', () => {
    const { deps } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    expect(r.getSnapshot()).toEqual({
      status: 'idle',
      isVisible: false,
      textReady: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: FAIL with `Cannot find module './purpose-detail-reveal'` (or similar import error).

- [ ] **Step 3: Create the module skeleton**

Create `src/transitions/purpose-detail-reveal.ts`:

```ts
import { Observable } from '@/notepad/collection/observable';

export type DetailRevealStatus = 'idle' | 'entering' | 'revealed' | 'exiting' | 'exited';

export interface DetailRevealState {
  status: DetailRevealStatus;
  isVisible: boolean;
  textReady: boolean;
}

export interface ExitStyles {
  transition: string;
  opacity: string;
  transform?: string;
  filter?: string;
}

export interface DetailRevealDeps {
  applyExitStyles: (target: 'content' | 'image', styles: ExitStyles) => void;
  setTimer: (cb: () => void, ms: number) => number;
  clearTimer: (handle: number) => void;
  onExitComplete: () => void;
}

export const DETAIL_REVEAL_TIMELINE = {
  textReadyAt: 1400,
  exitCompleteAt: 650,
  easing: 'cubic-bezier(0.22,1,0.36,1)',
  contentExit: {
    transition:
      'opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1), filter 0.6s cubic-bezier(0.22,1,0.36,1)',
    opacity: '0',
    transform: 'translateY(40px)',
    filter: 'blur(8px)',
  },
  imageExit: {
    transition: 'opacity 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s',
    opacity: '0',
  },
} as const;

/**
 * Owns the entry + exit reveal lifecycle for the purpose detail page.
 * State machine: idle → entering → revealed → exiting → exited.
 *
 * Pure of React, DOM, and timers — all side effects flow through `deps`. See
 * `useDetailReveal` for the production wiring; tests pass fake deps.
 *
 * Composes with `RouteTransition`: `requestExit()` is invoked when the
 * partner module flips its `exiting` prop, and `onExitComplete` is wired
 * back to `RouteTransition.completeExit`.
 */
export class PurposeDetailReveal extends Observable<DetailRevealState> {
  private readonly deps: DetailRevealDeps;

  constructor(deps: DetailRevealDeps) {
    super({ status: 'idle', isVisible: false, textReady: false });
    this.deps = deps;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/transitions/purpose-detail-reveal.ts src/transitions/purpose-detail-reveal.test.ts docs/CONTEXT.md
git commit -m "feat(transitions): scaffold PurposeDetailReveal with initial state"
```

---

## Task 2: `start()` transitions idle → entering and schedules text-ready timer

**Files:**
- Modify: `src/transitions/purpose-detail-reveal.ts`
- Modify: `src/transitions/purpose-detail-reveal.test.ts`

- [ ] **Step 1: Add failing tests for `start()`**

Append to `src/transitions/purpose-detail-reveal.test.ts`:

```ts
describe('PurposeDetailReveal — start()', () => {
  it('moves idle → entering; isVisible=true, textReady=false', () => {
    const { deps } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    expect(r.getSnapshot()).toEqual({
      status: 'entering',
      isVisible: true,
      textReady: false,
    });
  });

  it('schedules the text-ready timer at TIMELINE.textReadyAt', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    expect(rec.timersScheduled).toHaveLength(1);
    expect(rec.timersScheduled[0].ms).toBe(1400);
  });

  it('flips status → revealed and textReady → true when the timer fires', () => {
    const { deps, runTimer } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    runTimer(1);
    expect(r.getSnapshot()).toEqual({
      status: 'revealed',
      isVisible: true,
      textReady: true,
    });
  });

  it('is a no-op when not idle', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.start();
    expect(rec.timersScheduled).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: FAIL — `r.start is not a function`.

- [ ] **Step 3: Implement `start()`**

In `src/transitions/purpose-detail-reveal.ts`, add the field and method to the class body (after the constructor):

```ts
  private textReadyHandle: number | null = null;

  /** Begin the entry reveal. No-op if not idle. */
  start = (): void => {
    if (this.getSnapshot().status !== 'idle') return;
    this.setStatus('entering', { isVisible: true, textReady: false });
    this.textReadyHandle = this.deps.setTimer(() => {
      this.textReadyHandle = null;
      this.setStatus('revealed', { isVisible: true, textReady: true });
    }, DETAIL_REVEAL_TIMELINE.textReadyAt);
  };

  private setStatus(
    status: DetailRevealStatus,
    flags: { isVisible: boolean; textReady: boolean },
  ): void {
    this.update(() => ({ status, ...flags }));
  }

  private update(updater: (prev: DetailRevealState) => DetailRevealState): void {
    // setState is protected on Observable; this thin wrapper matches the
    // RouteTransition pattern.
    (this as unknown as { setState: (u: typeof updater) => void }).setState(updater);
  }
```

(The `update` indirection mirrors `route-transition.ts:121-123`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/transitions/purpose-detail-reveal.ts src/transitions/purpose-detail-reveal.test.ts
git commit -m "feat(transitions): start() transitions to entering and schedules textReady timer"
```

---

## Task 3: `reset()` cancels pending text-ready timer and re-enters

**Files:**
- Modify: `src/transitions/purpose-detail-reveal.ts`
- Modify: `src/transitions/purpose-detail-reveal.test.ts`

- [ ] **Step 1: Add failing tests for `reset()`**

Append to `src/transitions/purpose-detail-reveal.test.ts`:

```ts
describe('PurposeDetailReveal — reset()', () => {
  it('from entering: cancels the pending text-ready timer and reschedules a new one', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    const firstHandle = rec.timersScheduled.length; // handle 1 returned by makeDeps
    r.reset();
    expect(rec.timersCleared).toContain(1);
    expect(rec.timersScheduled).toHaveLength(2);
    expect(rec.timersScheduled[1].ms).toBe(1400);
    void firstHandle;
  });

  it('from revealed: re-enters and starts a fresh text-ready timer', () => {
    const { deps, rec, runTimer } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    runTimer(1);
    expect(r.getSnapshot().status).toBe('revealed');
    r.reset();
    expect(r.getSnapshot()).toEqual({
      status: 'entering',
      isVisible: true,
      textReady: false,
    });
    expect(rec.timersScheduled).toHaveLength(2);
  });

  it('from idle: behaves like start()', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.reset();
    expect(r.getSnapshot().status).toBe('entering');
    expect(rec.timersScheduled).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: FAIL — `r.reset is not a function`.

- [ ] **Step 3: Implement `reset()`**

In `src/transitions/purpose-detail-reveal.ts`, add inside the class (after `start`):

```ts
  /** Restart the entry reveal (e.g. on project change). Cancels any pending text-ready timer. */
  reset = (): void => {
    this.cancelTextReadyTimer();
    this.setStatus('entering', { isVisible: true, textReady: false });
    this.textReadyHandle = this.deps.setTimer(() => {
      this.textReadyHandle = null;
      this.setStatus('revealed', { isVisible: true, textReady: true });
    }, DETAIL_REVEAL_TIMELINE.textReadyAt);
  };

  private cancelTextReadyTimer(): void {
    if (this.textReadyHandle !== null) {
      this.deps.clearTimer(this.textReadyHandle);
      this.textReadyHandle = null;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/transitions/purpose-detail-reveal.ts src/transitions/purpose-detail-reveal.test.ts
git commit -m "feat(transitions): reset() cancels and reschedules the textReady timer"
```

---

## Task 4: `requestExit()` applies exit styles and schedules `onExitComplete`

**Files:**
- Modify: `src/transitions/purpose-detail-reveal.ts`
- Modify: `src/transitions/purpose-detail-reveal.test.ts`

- [ ] **Step 1: Add failing tests for `requestExit()`**

Append to `src/transitions/purpose-detail-reveal.test.ts`:

```ts
describe('PurposeDetailReveal — requestExit()', () => {
  it('from revealed: status → exiting; applies content + image exit styles', () => {
    const { deps, rec, runTimer } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    runTimer(1);
    r.requestExit();
    expect(r.getSnapshot()).toEqual({
      status: 'exiting',
      isVisible: true,
      textReady: true,
    });
    expect(rec.exitStyles).toEqual([
      {
        target: 'content',
        styles: {
          transition:
            'opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1), filter 0.6s cubic-bezier(0.22,1,0.36,1)',
          opacity: '0',
          transform: 'translateY(40px)',
          filter: 'blur(8px)',
        },
      },
      {
        target: 'image',
        styles: {
          transition: 'opacity 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s',
          opacity: '0',
        },
      },
    ]);
  });

  it('from entering (text not ready yet): also moves to exiting and applies styles', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.requestExit();
    expect(r.getSnapshot().status).toBe('exiting');
    expect(rec.exitStyles).toHaveLength(2);
  });

  it('cancels the in-flight text-ready timer when interrupting entering', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.requestExit();
    expect(rec.timersCleared).toContain(1);
  });

  it('schedules the exit-complete timer at TIMELINE.exitCompleteAt', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.requestExit();
    const exitTimer = rec.timersScheduled[rec.timersScheduled.length - 1];
    expect(exitTimer.ms).toBe(650);
  });

  it('fires onExitComplete and moves to exited when the exit timer fires', () => {
    const { deps, rec, runTimer } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.requestExit();
    // After start + requestExit: text-ready timer (handle 1, cleared), exit-complete timer (handle 2)
    runTimer(2);
    expect(rec.onExitComplete).toBe(1);
    expect(r.getSnapshot()).toEqual({
      status: 'exited',
      isVisible: false,
      textReady: false,
    });
  });

  it('is a no-op from idle', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.requestExit();
    expect(r.getSnapshot().status).toBe('idle');
    expect(rec.exitStyles).toHaveLength(0);
    expect(rec.timersScheduled).toHaveLength(0);
  });

  it('is a no-op when already exiting (defends against double trigger)', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.requestExit();
    const stylesBefore = rec.exitStyles.length;
    r.requestExit();
    expect(rec.exitStyles).toHaveLength(stylesBefore);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: FAIL — `r.requestExit is not a function`.

- [ ] **Step 3: Implement `requestExit()`**

In `src/transitions/purpose-detail-reveal.ts`, add inside the class (after `reset`):

```ts
  private exitHandle: number | null = null;

  /**
   * Begin the exit fade. No-op from idle, exiting, or exited. Cancels the
   * in-flight text-ready timer if entering, applies exit styles to both
   * targets via deps, and schedules `onExitComplete`.
   */
  requestExit = (): void => {
    const { status } = this.getSnapshot();
    if (status !== 'entering' && status !== 'revealed') return;
    this.cancelTextReadyTimer();
    this.deps.applyExitStyles('content', DETAIL_REVEAL_TIMELINE.contentExit);
    this.deps.applyExitStyles('image', DETAIL_REVEAL_TIMELINE.imageExit);
    this.setStatus('exiting', { isVisible: true, textReady: true });
    this.exitHandle = this.deps.setTimer(() => {
      this.exitHandle = null;
      this.setStatus('exited', { isVisible: false, textReady: false });
      this.deps.onExitComplete();
    }, DETAIL_REVEAL_TIMELINE.exitCompleteAt);
  };
```

Note on the `entering` case: the spec preserves `textReady: true` when transitioning to `exiting` even from `entering`. Looking at the original `PurposeDetail.tsx`, the imperative exit effect runs regardless of `textReady` and always plays the same fade. The `textReady` flag in `exiting` is a derived view of "the text was committed" — once exit begins, the JSX no longer needs to gate further reveals. The test above asserts this; if the consumer ever surfaced separate fades for unfaded text vs faded text, this is the place to revisit.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: PASS (15 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/transitions/purpose-detail-reveal.ts src/transitions/purpose-detail-reveal.test.ts
git commit -m "feat(transitions): requestExit() applies exit styles and fires onExitComplete"
```

---

## Task 5: `dispose()` cancels any pending timer

**Files:**
- Modify: `src/transitions/purpose-detail-reveal.ts`
- Modify: `src/transitions/purpose-detail-reveal.test.ts`

- [ ] **Step 1: Add failing tests for `dispose()`**

Append to `src/transitions/purpose-detail-reveal.test.ts`:

```ts
describe('PurposeDetailReveal — dispose()', () => {
  it('cancels the pending text-ready timer when called from entering', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.dispose();
    expect(rec.timersCleared).toContain(1);
  });

  it('cancels the pending exit-complete timer when called from exiting', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.requestExit();
    rec.timersCleared.length = 0;
    r.dispose();
    expect(rec.timersCleared).toContain(2);
  });

  it('does not call onExitComplete after dispose, even if a stale exit timer would fire', () => {
    const { deps, rec, runTimer } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.requestExit();
    r.dispose();
    runTimer(2); // simulating a leaked timer firing post-dispose
    expect(rec.onExitComplete).toBe(0);
    expect(r.getSnapshot().status).toBe('exiting');
  });

  it('does not transition to revealed if a stale text-ready timer fires after dispose from entering', () => {
    const { deps, runTimer } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.dispose();
    runTimer(1);
    expect(r.getSnapshot().status).toBe('entering');
  });

  it('is safe to call from idle (no timers scheduled)', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.dispose();
    expect(rec.timersCleared).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: FAIL — `r.dispose is not a function`.

- [ ] **Step 3: Implement `dispose()`**

In `src/transitions/purpose-detail-reveal.ts`, add inside the class (after `requestExit`):

```ts
  /** Clear any pending timers; safe to call from any status. */
  dispose = (): void => {
    this.cancelTextReadyTimer();
    if (this.exitHandle !== null) {
      this.deps.clearTimer(this.exitHandle);
      this.exitHandle = null;
    }
  };
```

The "stale timer would fire" test passes because `dispose` nulls `exitHandle`, but the timer-firing branch of `requestExit` mutates state and calls `onExitComplete` unconditionally — so we also need a guard. Update the exit-timer callback inside `requestExit` to check the handle:

```ts
    this.exitHandle = this.deps.setTimer(() => {
      if (this.exitHandle === null) return; // disposed before firing
      this.exitHandle = null;
      this.setStatus('exited', { isVisible: false, textReady: false });
      this.deps.onExitComplete();
    }, DETAIL_REVEAL_TIMELINE.exitCompleteAt);
```

Apply the same `=== null` guard to the text-ready timer callback in both `start()` and `reset()`:

```ts
    this.textReadyHandle = this.deps.setTimer(() => {
      if (this.textReadyHandle === null) return;
      this.textReadyHandle = null;
      this.setStatus('revealed', { isVisible: true, textReady: true });
    }, DETAIL_REVEAL_TIMELINE.textReadyAt);
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test -- src/transitions/purpose-detail-reveal.test.ts`
Expected: PASS (20 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/transitions/purpose-detail-reveal.ts src/transitions/purpose-detail-reveal.test.ts
git commit -m "feat(transitions): dispose() cancels pending timers and guards stale firings"
```

---

## Task 6: Production hook `useDetailReveal`

**Files:**
- Create: `src/transitions/useDetailReveal.tsx`

- [ ] **Step 1: Create the hook**

Create `src/transitions/useDetailReveal.tsx`:

```tsx
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  PurposeDetailReveal,
  type DetailRevealDeps,
  type ExitStyles,
} from './purpose-detail-reveal';
import type { Project } from '@/types';

interface UseDetailRevealArgs {
  project: Project;
  exiting: boolean;
  onExitComplete?: () => void;
}

interface UseDetailRevealResult {
  isVisible: boolean;
  textReady: boolean;
  contentRef: React.RefObject<HTMLDivElement>;
  imageRef: React.RefObject<HTMLDivElement>;
}

/**
 * React glue for `PurposeDetailReveal`. Wires DOM-style mutators and
 * `window.setTimeout` into the class, drives the lifecycle on prop changes
 * (`start` on mount, `reset` on `project` change, `requestExit` when the
 * `exiting` prop flips true), and disposes on unmount.
 */
export function useDetailReveal({
  project,
  exiting,
  onExitComplete,
}: UseDetailRevealArgs): UseDetailRevealResult {
  const contentRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;

  const reveal = useMemo(() => {
    const applyToRef = (target: HTMLDivElement | null, styles: ExitStyles) => {
      if (!target) return;
      target.style.transition = styles.transition;
      target.style.opacity = styles.opacity;
      if (styles.transform !== undefined) target.style.transform = styles.transform;
      if (styles.filter !== undefined) target.style.filter = styles.filter;
    };
    const deps: DetailRevealDeps = {
      applyExitStyles: (target, styles) => {
        const el = target === 'content' ? contentRef.current : imageRef.current;
        applyToRef(el, styles);
      },
      setTimer: (cb, ms) => window.setTimeout(cb, ms),
      clearTimer: (handle) => window.clearTimeout(handle),
      onExitComplete: () => onExitCompleteRef.current?.(),
    };
    return new PurposeDetailReveal(deps);
  }, []);

  const state = useSyncExternalStore(reveal.subscribe, reveal.getSnapshot);

  // Project change → reset (also handles initial mount: idle → entering).
  useEffect(() => {
    reveal.reset();
  }, [project, reveal]);

  // exiting prop flips true → request exit. The class no-ops if we re-fire.
  useEffect(() => {
    if (exiting) reveal.requestExit();
  }, [exiting, reveal]);

  // Unmount → cancel any pending timers.
  useEffect(() => {
    return () => reveal.dispose();
  }, [reveal]);

  return {
    isVisible: state.isVisible,
    textReady: state.textReady,
    contentRef,
    imageRef,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no new errors. (Pre-existing project errors, if any, are out of scope.)

- [ ] **Step 3: Commit**

```bash
git add src/transitions/useDetailReveal.tsx
git commit -m "feat(transitions): useDetailReveal hook wires real DOM and timers to the class"
```

---

## Task 7: Wire `useDetailReveal` into `PurposeDetail` and remove the old state

**Files:**
- Modify: `src/components/sections/PurposeDetail.tsx`

- [ ] **Step 1: Replace state hooks and effects with the new hook**

In `src/components/sections/PurposeDetail.tsx`, replace the imports and the top of the component.

Replace:

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Project } from '@/types';
import { MoodBoard } from '@/components/sections/MoodBoard';
import { LineMaskReveal } from '@/components/ui-custom/LineMaskReveal';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import { ImageReveal } from '@/components/ui-custom/ImageReveal';
```

With:

```tsx
import { useLayoutEffect, useRef } from 'react';
import type { Project } from '@/types';
import { MoodBoard } from '@/components/sections/MoodBoard';
import { LineMaskReveal } from '@/components/ui-custom/LineMaskReveal';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import { ImageReveal } from '@/components/ui-custom/ImageReveal';
import { useDetailReveal } from '@/transitions/useDetailReveal';
import { DETAIL_REVEAL_TIMELINE } from '@/transitions/purpose-detail-reveal';
```

Replace the body of `PurposeDetail` from line ~15 down to and including the `useEffect(() => { if (!exiting) ... })` block (the imperative exit effect at lines 41-64 in the current file). Specifically:

Replace:

```tsx
export function PurposeDetail({ project, exiting, onExitComplete }: PurposeDetailProps) {
  const isRestoration1 = project.id === 'restoration1';
  const isRestoration3 = project.id === 'restoration3';
  const [isVisible, setIsVisible] = useState(false);
  const [textReady, setTextReady] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);

  // Reset scroll before paint so the page always starts at the top
  useLayoutEffect(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = '';
    });
  }, [project]);

  useEffect(() => {
    setIsVisible(true);
    setTextReady(false);
    const timer = setTimeout(() => setTextReady(true), 1400);
    return () => clearTimeout(timer);
  }, [project]);

  // Exit animation: text slides down + fades, image fades, then notify parent
  useEffect(() => {
    if (!exiting) return;

    const content = heroContentRef.current;
    const image = heroImageRef.current;

    if (content) {
      content.style.transition = 'opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1), filter 0.6s cubic-bezier(0.22,1,0.36,1)';
      content.style.opacity = '0';
      content.style.transform = 'translateY(40px)';
      content.style.filter = 'blur(8px)';
    }

    if (image) {
      image.style.transition = 'opacity 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s';
      image.style.opacity = '0';
    }

    const timer = setTimeout(() => {
      onExitComplete?.();
    }, 650);

    return () => clearTimeout(timer);
  }, [exiting, onExitComplete]);
```

With:

```tsx
export function PurposeDetail({ project, exiting, onExitComplete }: PurposeDetailProps) {
  const isRestoration1 = project.id === 'restoration1';
  const isRestoration3 = project.id === 'restoration3';
  const sectionRef = useRef<HTMLDivElement>(null);

  const { isVisible, textReady, contentRef: heroContentRef, imageRef: heroImageRef } =
    useDetailReveal({ project, exiting: !!exiting, onExitComplete });

  // Reset scroll before paint so the page always starts at the top.
  // Stays here (not in the controller) because layout-effect timing is the point.
  useLayoutEffect(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = '';
    });
  }, [project]);
```

- [ ] **Step 2: Replace inline easing strings with the timeline constant**

Inline transition strings using the same easing currently appear at three places in the JSX. Replace each:

At the title `<h1 style={{ ... transition: 'transform 1.6s cubic-bezier(0.22, 1, 0.36, 1)' }}>`, change to:

```tsx
                  transition: `transform 1.6s ${DETAIL_REVEAL_TIMELINE.easing}`,
```

At the small text under the scripture quote (`transition: 'opacity 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.6s'`), change to:

```tsx
                    transition: `opacity 1.2s ${DETAIL_REVEAL_TIMELINE.easing} 0.6s`,
```

At the down-arrow / "Journey" container (`transition: 'opacity 1.4s cubic-bezier(0.22, 1, 0.36, 1) 1s'`), change to:

```tsx
                  transition: `opacity 1.4s ${DETAIL_REVEAL_TIMELINE.easing} 1s`,
```

These three occurrences are in the Restoration1/3 branch — the standard branch uses `<LineMaskReveal>` only, no inline easing.

- [ ] **Step 3: Type-check + run all tests**

Run: `npx tsc -b && npm test`
Expected: no type errors, all existing tests still pass plus the 20 new `purpose-detail-reveal` tests.

- [ ] **Step 4: Smoke-test in the browser**

Run: `npm run dev` and exercise:
1. Navigate `/purpose` → click a project → entry reveal plays (image fade-in, text reveal at ~1.4s, scripture and "Journey" fade in after).
2. Browser back from `/purpose/:id` → text fades down with blur, image fades, then the `SplitTransition` overlay expands.
3. Inside `/purpose/:id`, navigate directly to a different project URL (or click a different gallery thumb if exposed): the entry reveal restarts cleanly.

Expected: behavior matches pre-deepening exactly — same durations, same easing, no regressions in handshake with `RouteTransition`.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/PurposeDetail.tsx
git commit -m "refactor(purpose-detail): consume useDetailReveal; drop inline state machine"
```

---

## Self-review checklist (run after Task 7)

- [ ] Five-state machine matches CONTEXT.md §`PurposeDetailReveal` exactly: `idle`, `entering`, `revealed`, `exiting`, `exited`.
- [ ] `RouteTransition` is unchanged.
- [ ] No `useState` for `isVisible` / `textReady` remains in `PurposeDetail.tsx`.
- [ ] No `setTimeout` / `clearTimeout` calls remain in `PurposeDetail.tsx` for the lifecycle (the `useLayoutEffect` scroll-reset is the only timer-adjacent code left, and it uses `requestAnimationFrame`, not `setTimeout`).
- [ ] No `cubic-bezier(0.22,1,0.36,1)` literal string survives in `PurposeDetail.tsx` — it lives only in `DETAIL_REVEAL_TIMELINE.easing` and the prebuilt `contentExit.transition` / `imageExit.transition` strings.
- [ ] `useDetailReveal` returns refs typed `RefObject<HTMLDivElement>` and the consumer attaches them to the same elements as before (`heroContentRef` → left content `<div>`, `heroImageRef` → right image `<div>`).
- [ ] All 20 new tests pass; no React, no jsdom, no real timers.
- [ ] CONTEXT.md §`PurposeDetailReveal` reflects the implemented module (already added in design phase — re-read to confirm).
