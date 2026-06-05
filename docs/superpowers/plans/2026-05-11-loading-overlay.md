# PSALMS Loading Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a universal loading overlay that plays during SPA navigation and on hard reload of any non-home route, while preserving the existing home intro on `/`.

**Architecture:** A pure state machine (`loading-state.ts`) drives a React hook (`useLoadingOverlay`) that owns the overlay's active flag. `App.tsx` computes initial decisions, mounts the overlay component, and triggers it on `useLocation` changes. The overlay component (`HeroLoadingOverlay.tsx`) renders a full-viewport fixed div with dark canvas + centered A glyph + heartbeat-looping glow.

**Tech Stack:** React, TypeScript, GSAP (already in use), Vitest with fake timers.

**Reference:** Design spec at `docs/superpowers/specs/2026-05-11-loading-overlay-design.md`.

---

## File Structure

**New files:**
- `src/hooks/loading-state.ts` — pure state-machine factory
- `src/hooks/loading-state.test.ts` — Vitest tests with fake timers
- `src/hooks/useLoadingOverlay.ts` — React hook wrapping `createLoadingState`
- `src/components/sections/HeroLoadingOverlay.tsx` — visual component

**Modified files:**
- `src/App.tsx` — wire up overlay + initial decisions
- `src/components/sections/Hero.tsx` — no logic change needed; just receive the gate'd `introActive` from App

---

## Task 1: Pure loading-state machine + tests

**Files:**
- Create: `src/hooks/loading-state.ts`
- Create: `src/hooks/loading-state.test.ts`

A small state machine for the loading overlay. Owns `active` flag, schedules deactivation after `minMs`, allows re-triggering to extend the timer. Inject `setTimeoutFn`/`clearTimeoutFn` for testability with vitest fake timers.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/loading-state.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLoadingState } from './loading-state';

describe('createLoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial active matches initialActive=false', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: false, onChange });
    expect(state.active).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    state.cleanup();
  });

  it('initial active matches initialActive=true and schedules deactivate', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: true, onChange });
    expect(state.active).toBe(true);
    vi.advanceTimersByTime(1499);
    expect(state.active).toBe(true);
    vi.advanceTimersByTime(1);
    expect(state.active).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
    state.cleanup();
  });

  it('trigger() sets active=true and schedules deactivate', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: false, onChange });
    state.trigger();
    expect(state.active).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
    vi.advanceTimersByTime(1500);
    expect(state.active).toBe(false);
    state.cleanup();
  });

  it('re-trigger before deactivate extends the timer', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: false, onChange });
    state.trigger();
    vi.advanceTimersByTime(1000);
    expect(state.active).toBe(true);
    state.trigger(); // extend
    vi.advanceTimersByTime(1000);
    expect(state.active).toBe(true); // still active because trigger reset the timer
    vi.advanceTimersByTime(500);
    expect(state.active).toBe(false);
    state.cleanup();
  });

  it('cleanup() cancels the pending deactivate timer', () => {
    const onChange = vi.fn();
    const state = createLoadingState({ minMs: 1500, initialActive: true, onChange });
    state.cleanup();
    onChange.mockClear();
    vi.advanceTimersByTime(2000);
    // After cleanup, deactivate timer should not fire
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses injected setTimeout/clearTimeout when provided', () => {
    const onChange = vi.fn();
    const setTimeoutSpy = vi.fn().mockReturnValue(42 as unknown as number);
    const clearTimeoutSpy = vi.fn();
    const state = createLoadingState({
      minMs: 1500,
      initialActive: true,
      onChange,
      setTimeoutFn: setTimeoutSpy,
      clearTimeoutFn: clearTimeoutSpy,
    });
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1500);
    state.cleanup();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(42);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/hooks/loading-state.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the module**

Create `src/hooks/loading-state.ts`:

```typescript
type TimerId = ReturnType<typeof setTimeout>;
type SetTimeoutFn = (handler: () => void, ms: number) => TimerId;
type ClearTimeoutFn = (id: TimerId) => void;

export interface LoadingStateMachine {
  /** Current active state. Read-only — mutate via trigger() or cleanup(). */
  readonly active: boolean;
  /** Set active=true and schedule auto-deactivate after minMs. Resets timer if already active. */
  trigger: () => void;
  /** Cancel any pending deactivate timer. Does not change active. */
  cleanup: () => void;
}

export interface CreateLoadingStateOptions {
  minMs: number;
  initialActive: boolean;
  onChange: (active: boolean) => void;
  setTimeoutFn?: SetTimeoutFn;
  clearTimeoutFn?: ClearTimeoutFn;
}

export function createLoadingState(opts: CreateLoadingStateOptions): LoadingStateMachine {
  const setTimeoutImpl = opts.setTimeoutFn ?? (setTimeout as unknown as SetTimeoutFn);
  const clearTimeoutImpl = opts.clearTimeoutFn ?? (clearTimeout as unknown as ClearTimeoutFn);

  let active = opts.initialActive;
  let timer: TimerId | null = null;

  const scheduleDeactivate = () => {
    if (timer !== null) clearTimeoutImpl(timer);
    timer = setTimeoutImpl(() => {
      active = false;
      timer = null;
      opts.onChange(false);
    }, opts.minMs);
  };

  if (opts.initialActive) {
    scheduleDeactivate();
  }

  return {
    get active() {
      return active;
    },
    trigger: () => {
      const wasInactive = !active;
      active = true;
      if (wasInactive) opts.onChange(true);
      scheduleDeactivate();
    },
    cleanup: () => {
      if (timer !== null) {
        clearTimeoutImpl(timer);
        timer = null;
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/hooks/loading-state.test.ts`

Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/loading-state.ts src/hooks/loading-state.test.ts
git commit -m "$(cat <<'EOF'
feat(loading-overlay): pure loading-state machine + tests

A small state machine for the loading overlay's active flag. Owns
the deactivate timer with re-trigger extension. Fully testable with
vitest fake timers via injectable setTimeout/clearTimeout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: useLoadingOverlay hook

**Files:**
- Create: `src/hooks/useLoadingOverlay.ts`

A thin React hook that wraps `createLoadingState`. Owns `active` as React state and exposes `{ active, trigger }`.

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useLoadingOverlay.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { createLoadingState, type LoadingStateMachine } from './loading-state';

interface UseLoadingOverlayOptions {
  minMs: number;
  initialActive: boolean;
}

export interface LoadingOverlay {
  active: boolean;
  trigger: () => void;
}

export function useLoadingOverlay({
  minMs,
  initialActive,
}: UseLoadingOverlayOptions): LoadingOverlay {
  const [active, setActive] = useState<boolean>(initialActive);
  const machineRef = useRef<LoadingStateMachine | null>(null);

  // Create the state machine on first render. Strict-mode-safe via the ref guard.
  if (machineRef.current === null) {
    machineRef.current = createLoadingState({
      minMs,
      initialActive,
      onChange: setActive,
    });
  }

  useEffect(() => {
    return () => {
      machineRef.current?.cleanup();
      machineRef.current = null;
    };
  }, []);

  return {
    active,
    trigger: () => machineRef.current?.trigger(),
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Run full test suite (no new tests, just verify nothing broke)**

Run: `npm run test`

Expected: PASS, same test count as before this task (one new module added but no React component tests possible in node env; manual verification later).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLoadingOverlay.ts
git commit -m "$(cat <<'EOF'
feat(loading-overlay): useLoadingOverlay React hook

Thin wrapper around createLoadingState that mirrors the active flag
into React state. Caller gets { active, trigger }.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: HeroLoadingOverlay component

**Files:**
- Create: `src/components/sections/HeroLoadingOverlay.tsx`

A full-viewport fixed overlay with dark canvas + centered A glyph + heartbeat loop. When `active` flips to false, GSAP crossfades the entire overlay's opacity from 1 to 0 over 1.2s, then the component unmounts via parent state.

- [ ] **Step 1: Create the component file**

Create `src/components/sections/HeroLoadingOverlay.tsx`:

```typescript
import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

interface HeroLoadingOverlayProps {
  active: boolean;
  onCrossfadeComplete?: () => void;
}

/**
 * Universal loading overlay. Plays the heartbeat-A loop while `active`,
 * crossfades out when `active` flips to false, then calls onCrossfadeComplete
 * (so the parent can unmount the component if desired).
 *
 * Visuals match the home hero intro: same dark canvas radial gradient,
 * same glow aura, same heartbeat keyframes.
 */
export function HeroLoadingOverlay({ active, onCrossfadeComplete }: HeroLoadingOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<SVGGElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);

  // Heartbeat loop while active
  useLayoutEffect(() => {
    if (!active) return;
    const glyph = glyphRef.current;
    const aura = auraRef.current;
    if (!glyph || !aura) return;

    gsap.set(glyph, { scale: 1, transformOrigin: '50% 50%' });
    gsap.set(aura, { opacity: 0.18, scale: 1 });

    const tl = gsap.timeline({ repeat: -1, paused: true });

    // Lub
    tl.to(glyph, { scale: 1.022, duration: 0.18, ease: 'power2.out' }, 0);
    tl.to(glyph, { scale: 1.0,   duration: 0.32, ease: 'power3.out' }, 0.18);
    tl.to(aura,  { opacity: 0.42, scale: 1.08, duration: 0.18, ease: 'power2.out' }, 0);
    tl.to(aura,  { opacity: 0.18, scale: 1.0,  duration: 0.32, ease: 'power2.out' }, 0.18);

    // Dub at 0.75s
    const dub = 0.75;
    tl.to(glyph, { scale: 1.042, duration: 0.22, ease: 'power2.out' }, dub);
    tl.to(glyph, { scale: 1.0,   duration: 0.50, ease: 'power3.out' }, dub + 0.22);
    tl.to(aura,  { opacity: 0.78, scale: 1.18, duration: 0.22, ease: 'power2.out' }, dub);
    tl.to(aura,  { opacity: 0.18, scale: 1.0,  duration: 0.50, ease: 'power2.out' }, dub + 0.22);

    // Rest gap so the cycle is ~1.95s total
    tl.set({}, {}, 1.95);

    tl.play(0);
    return () => {
      tl.kill();
    };
  }, [active]);

  // Crossfade-out when active flips to false
  useEffect(() => {
    if (active) return;
    const root = rootRef.current;
    if (!root) return;

    const tween = gsap.to(root, {
      opacity: 0,
      duration: 1.2,
      ease: 'power2.inOut',
      onComplete: () => {
        onCrossfadeComplete?.();
      },
    });

    return () => {
      tween.kill();
    };
  }, [active, onCrossfadeComplete]);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-busy={active}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        opacity: 1,
        pointerEvents: active ? 'auto' : 'none',
        background:
          'radial-gradient(ellipse 90% 70% at 50% 50%, #0e0c10 0%, #08070a 60%, #050507 100%), #0a0a0c',
      }}
    >
      <span className="sr-only">Loading</span>

      {/* Glow aura — sits behind the A */}
      <div
        ref={auraRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 'min(220px, 30vw)',
          height: 'min(220px, 30vw)',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle at center, rgba(246, 244, 240, 0.32) 0%, rgba(246, 244, 240, 0.12) 22%, rgba(246, 244, 240, 0.04) 45%, rgba(246, 244, 240, 0) 72%)',
          borderRadius: '50%',
          opacity: 0,
          mixBlendMode: 'screen',
          filter: 'blur(14px)',
          willChange: 'opacity, transform',
          pointerEvents: 'none',
        }}
      />

      {/* A glyph SVG */}
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 'min(120px, 12vw)',
          height: 'auto',
          transform: 'translate(-50%, -50%)',
          color: '#f6f4f0',
          pointerEvents: 'none',
        }}
        viewBox="0 0 251 282"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g ref={glyphRef} fill="currentColor">
          <path d="M 124.625 0 L 250.734375 281.515625 L 216.578125 281.515625 L 170.03125 178.296875 C 170.03125 191.308594 167.96875 204.007812 163.84375 216.390625 C 159.71875 228.777344 153.648438 239.851562 145.640625 249.609375 C 137.628906 259.371094 127.742188 267.132812 115.984375 272.890625 C 104.222656 278.640625 90.710938 281.515625 75.453125 281.515625 C 58.929688 281.515625 44.789062 277.953125 33.03125 270.828125 C 21.269531 263.695312 12.507812 253.933594 6.75 241.546875 C 1 229.152344 -1 215.074219 0.75 199.3125 C 2 187.804688 4.9375 176.605469 9.5625 165.71875 C 14.195312 154.835938 19.640625 144.261719 25.890625 134 C 32.148438 123.742188 38.410156 113.980469 44.671875 104.71875 C 52.421875 93.210938 59.363281 82.199219 65.5 71.6875 C 71.632812 61.179688 76.828125 50.105469 81.078125 38.46875 C 85.328125 26.835938 88.332031 14.011719 90.09375 0 Z M 161.40625 159.15625 L 94.59375 10.125 C 91.84375 25.648438 87.398438 40.351562 81.265625 54.234375 C 75.128906 68.121094 68.0625 82.074219 60.0625 96.09375 C 54.550781 106.105469 48.789062 116.804688 42.78125 128.1875 C 36.78125 139.574219 31.898438 151.210938 28.140625 163.09375 C 24.390625 174.980469 23.140625 186.929688 24.390625 198.9375 C 25.648438 211.199219 29.59375 222.023438 36.21875 231.40625 C 42.851562 240.792969 51.675781 247.617188 62.6875 251.875 C 73.695312 256.125 86.457031 256.996094 100.96875 254.484375 C 110.226562 252.984375 119.300781 248.859375 128.1875 242.109375 C 137.070312 235.351562 144.703125 227.214844 151.078125 217.703125 C 157.460938 208.195312 161.78125 198.308594 164.03125 188.046875 C 166.28125 177.789062 165.40625 168.15625 161.40625 159.15625 Z M 161.40625 159.15625 " />
        </g>
      </svg>
    </div>
  );
}
```

**Note on the A glyph viewBox:** This is the same A path from `PsalmsWordmarkSvg.tsx`, but with the y-axis flipped (the original used negative-y; here we use positive-y so the glyph reads top-down inside its own viewBox). The viewBox is sized to the glyph's bounding box (~251 × 282 in the source units).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Verify tests still pass**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/HeroLoadingOverlay.tsx
git commit -m "$(cat <<'EOF'
feat(loading-overlay): HeroLoadingOverlay component

Full-viewport fixed overlay with dark canvas + centered A glyph +
heartbeat-looping glow aura. Crossfades opacity to 0 over 1.2s when
active flips to false, then calls onCrossfadeComplete so the parent
can unmount it.

Visuals match the home hero intro (same gradient, same heartbeat
keyframes, same crossfade easing).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: App.tsx wiring

**Files:**
- Modify: `src/App.tsx`

Compute initial decisions, gate `introActive` on `homeIntroPlays`, set up `useLoadingOverlay`, trigger on location changes, render the overlay.

- [ ] **Step 1: Update App.tsx imports**

In `src/App.tsx`, find the existing react import line and add `useEffect` and `useMemo` if not already present:

```typescript
import { useCallback, useEffect, useMemo, useState } from 'react';
```

Add the new component and hook imports near the other component imports:

```typescript
import { HeroLoadingOverlay } from '@/components/sections/HeroLoadingOverlay';
import { useLoadingOverlay } from '@/hooks/useLoadingOverlay';
```

- [ ] **Step 2: Replace the initial-state computation**

Replace the existing `useState<boolean>(() => { ... })` block for `introActive` and the `headerVisible` block.

Find this block:

```typescript
  const [introActive, setIntroActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const decision = decideHeroIntro({
      storage: window.sessionStorage,
      prefersReducedMotion,
    });
    if (decision.persistFlag) {
      persistIntroPlayed(window.sessionStorage);
    }
    return decision.playIntro;
  });
  // Header is hidden during the cinematic intro and fades in at the handoff
  // beat (t=6.4s) via its existing showNav prop. On a session-skip path
  // (introActive=false at mount) it starts visible.
  const [headerVisible, setHeaderVisible] = useState<boolean>(() => !introActive);
```

Replace with:

```typescript
  // Single-shot computation of all the intro-related decisions at first mount.
  // useMemo with [] deps keeps it stable across re-renders and avoids
  // re-reading window state on every render.
  const initialDecision = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        homeIntroPlays: false,
        prefersReducedMotion: false,
      };
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const decision = decideHeroIntro({
      storage: window.sessionStorage,
      prefersReducedMotion,
    });
    if (decision.persistFlag) {
      persistIntroPlayed(window.sessionStorage);
    }
    const isInitiallyOnHome = window.location.pathname === '/';
    return {
      homeIntroPlays: isInitiallyOnHome && decision.playIntro,
      prefersReducedMotion,
    };
  }, []);

  const [introActive, setIntroActive] = useState<boolean>(initialDecision.homeIntroPlays);
  // Header is hidden during the home intro and fades in at the handoff beat
  // via showNav. On any path where the home intro doesn't play (session-skip
  // OR initial route is not /), the header starts visible — the loading
  // overlay sits above it during navigation.
  const [headerVisible, setHeaderVisible] = useState<boolean>(() => !initialDecision.homeIntroPlays);

  // Loading overlay: active on initial mount unless the home intro is going
  // to play (the home intro IS the brand moment on /). Also skipped if the
  // user prefers reduced motion.
  const overlay = useLoadingOverlay({
    minMs: 1500,
    initialActive: !initialDecision.homeIntroPlays && !initialDecision.prefersReducedMotion,
  });

  // Trigger the overlay on every SPA location change after the initial mount.
  const previousPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialDecision.prefersReducedMotion) return;
    if (previousPathnameRef.current === null) {
      // First effect call — initial mount. Initial state already handled by useLoadingOverlay.
      previousPathnameRef.current = location.pathname;
      return;
    }
    if (previousPathnameRef.current !== location.pathname) {
      overlay.trigger();
      previousPathnameRef.current = location.pathname;
    }
  }, [location.pathname, initialDecision.prefersReducedMotion, overlay]);
```

Also add the `useRef` import if not already present, alongside other React imports:

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 3: Render the overlay at the App root**

Find the existing JSX root (after `<AuthProvider><>`...). Add `<HeroLoadingOverlay>` as the LAST child of the outer div so it sits above everything in DOM order (z-index 100 keeps it on top regardless).

Find:

```typescript
        </div>
      </>
    </AuthProvider>
  );
}
```

Just BEFORE the closing `</div>` of the main background div, render the overlay. Look for the pattern around line 130 where the main `<div className="relative min-h-screen" ...>` closes:

```typescript
        </div>
        <HeroLoadingOverlay active={overlay.active} />
      </>
    </AuthProvider>
```

The exact placement: the `<HeroLoadingOverlay>` should be a sibling AFTER the `<div className="relative min-h-screen" ...>` (which is currently the only child of the `<>`) but inside the fragment. Make it the second child of the fragment.

Read the file first to find the exact correct location.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Run the test suite**

Run: `npm run test`

Expected: PASS. Test count = 461 (was 455 before this task — Task 1 added 6 tests).

- [ ] **Step 6: Build smoke-test**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat(loading-overlay): wire up HeroLoadingOverlay in App

Compute initial decisions once at mount: gate result, reduced-motion,
and whether the initial route is /. Home intro only plays when the
initial route IS / (avoids double-animation when user lands elsewhere
and navigates home). Loading overlay starts active on any other path
and triggers on every SPA location change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Manual verification

**Files:**
- No code changes.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify each lifecycle scenario**

In a browser at http://localhost:5173:

| Scenario | Steps | Expected |
|---|---|---|
| Fresh session, lands on `/` | Clear sessionStorage, hard refresh `/` | Full home intro plays. No overlay. |
| Fresh session, lands on `/notepad` | Clear sessionStorage, navigate to `http://localhost:5173/notepad` directly | Overlay plays for ~1.5s, then Notepad shows. |
| SPA nav `/notepad → /` | After overlay finishes on Notepad, click "Home" or browser back | Overlay plays for ~1.5s, then home page shows. No home intro afterward (gate'd out by initial-route check). |
| SPA nav `/ → /purpose` | From home, click any project tile | Overlay plays, then `/purpose/:id` shows. |
| Reload `/notepad` | Hard refresh on Notepad route | Overlay plays for ~1.5s. |
| Reload `/` with session flag | Session flag set (from prior visit), hard refresh `/` | Overlay plays for ~1.5s (no home intro). |
| Reduced motion | Enable `prefers-reduced-motion: reduce` in DevTools rendering panel | No overlay anywhere; routes transition instantly. |

- [ ] **Step 3: Visual polish check**

- Overlay's A glyph is centered and looks like a brand mark, not lost in space.
- Heartbeat is visible but subtle.
- Crossfade-out is smooth, no flash of unstyled content.
- No console errors during navigation.

- [ ] **Step 4: Done — no commit needed unless trims required**

If any visual adjustment is needed (glyph too small, heartbeat too aggressive), tune the relevant values in `HeroLoadingOverlay.tsx` and commit.

---

## Verification summary

After all tasks:

1. **Unit tests:** 6 new tests in `loading-state.test.ts`. `npm run test` shows 461 total passing.
2. **TypeScript:** clean.
3. **Build:** succeeds.
4. **Manual scenarios:** all 7 lifecycle cases (Task 5 Step 2) behave as documented.
