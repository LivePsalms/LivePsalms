# Mobile Lamplight Manual Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile, the Today's Lamp tab shows a brief intro + "Show Me Today's Lamp" button instead of auto-generating; generation only fires on tap. Desktop is unchanged.

**Architecture:** A new `autoGenerate` flag (default `true`) threads from the mobile view through `LamplightTabPanel` → `TodaysLampCard` → `useTodaysLamp`. The hook still does the cheap cached read on entry (so an already-generated lamp shows immediately for both platforms); on a cache **miss** it generates when `autoGenerate` is `true` or an explicit `start()` was requested, otherwise it enters a new `idle` phase. `TodaysLampCard` renders a new `TodaysLampIntro` component while `idle`.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react (jsdom), Tailwind utility classes with CSS custom-property tokens.

---

## File Structure

- `src/notepad/lamplight/lamplight-copy.ts` — add `todaysLampIntro(firstName)` helper (modify).
- `src/notepad/lamplight/lamplight-copy.test.ts` — add tests for the helper (modify).
- `src/notepad/hooks/useTodaysLamp.ts` — add `autoGenerate` arg, `idle` phase, `start()` (modify).
- `src/notepad/hooks/useTodaysLamp.test.tsx` — add tests for idle/start (modify).
- `src/notepad/components/lamplight/TodaysLampIntro.tsx` — new intro component (create).
- `src/notepad/components/lamplight/TodaysLampIntro.test.tsx` — new component test (create).
- `src/notepad/components/lamplight/TodaysLampCard.tsx` — accept `autoGenerate`, render idle → intro (modify).
- `src/notepad/components/lamplight/LamplightTabPanel.tsx` — add `autoGenerate` prop, thread to card (modify).
- `src/components/sections/notepad/mobile/LamplightMobileView.tsx` — pass `autoGenerate={false}` (modify).
- `src/components/sections/notepad/mobile/LamplightMobileView.test.tsx` — assert the flag is passed (modify).

---

## Task 1: Intro copy helper

**Files:**
- Modify: `src/notepad/lamplight/lamplight-copy.ts`
- Test: `src/notepad/lamplight/lamplight-copy.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/notepad/lamplight/lamplight-copy.test.ts` — extend the import and append a new `describe`:

```ts
import {
  loadingState,
  emptyStateInsufficientNotes,
  generationFailedToast,
  todaysLampIntro,
} from './lamplight-copy';
```

```ts
describe('todaysLampIntro', () => {
  it('returns personalized form when firstName is present', () => {
    expect(todaysLampIntro('Sarah')).toBe(
      "Sarah, Today's Lamp draws quietly from your recent notes — a piece of Scripture and a short reflection for where you are right now.",
    );
  });

  it('returns unpersonalized form when firstName is null', () => {
    expect(todaysLampIntro(null)).toBe(
      "Today's Lamp draws quietly from your recent notes — a piece of Scripture and a short reflection for where you are right now.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/lamplight/lamplight-copy.test.ts`
Expected: FAIL — `todaysLampIntro is not a function` / import has no exported member.

- [ ] **Step 3: Write minimal implementation**

Append to `src/notepad/lamplight/lamplight-copy.ts`:

```ts
export function todaysLampIntro(firstName: string | null): string {
  return firstName
    ? `${firstName}, Today's Lamp draws quietly from your recent notes — a piece of Scripture and a short reflection for where you are right now.`
    : `Today's Lamp draws quietly from your recent notes — a piece of Scripture and a short reflection for where you are right now.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/lamplight/lamplight-copy.test.ts`
Expected: PASS (all `describe` blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/lamplight/lamplight-copy.ts src/notepad/lamplight/lamplight-copy.test.ts
git commit -m "feat(lamplight): add todaysLampIntro copy helper"
```

---

## Task 2: `useTodaysLamp` — `autoGenerate`, `idle` phase, `start()`

**Files:**
- Modify: `src/notepad/hooks/useTodaysLamp.ts`
- Test: `src/notepad/hooks/useTodaysLamp.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append these tests inside the `describe('useTodaysLamp', ...)` block in `src/notepad/hooks/useTodaysLamp.test.tsx`:

```ts
  it('cached artifact renders regardless of autoGenerate=false', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    const generateSpy = vi.spyOn(adapter, 'generateDailyDevotion');
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', autoGenerate: false, loadingStepIntervalMs: 10 }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('cache miss with autoGenerate=false enters idle without generating', async () => {
    const adapter = new FakeLamplightAdapter();
    const generateSpy = vi.spyOn(adapter, 'generateDailyDevotion');
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', autoGenerate: false, loadingStepIntervalMs: 10 }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('idle'));
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('start() from idle generates exactly once and reaches ready', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: true, artifact: devotion, cached: false });
    const generateSpy = vi.spyOn(adapter, 'generateDailyDevotion');
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', autoGenerate: false, loadingStepIntervalMs: 10 }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('idle'));
    act(() => { result.current.start(); });
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    expect(generateSpy).toHaveBeenCalledTimes(1);
  });

  it('start() error then retry recovers to ready', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: false, reason: 'network' });
    adapter.__queueGenerateResult({ ok: true, artifact: devotion, cached: false });
    const { result } = renderHook(() =>
      useTodaysLamp({ adapter, userId: 'user-1', localDate: '2026-05-27', autoGenerate: false, loadingStepIntervalMs: 10 }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe('idle'));
    act(() => { result.current.start(); });
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    act(() => { result.current.retry(); });
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/notepad/hooks/useTodaysLamp.test.tsx`
Expected: FAIL — `autoGenerate` not accepted / `result.current.start is not a function` / phase never becomes `'idle'`.

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/notepad/hooks/useTodaysLamp.ts` with:

```ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { LamplightAdapter } from '../storage/lamplight-adapter';
import type { DailyDevotion } from '../storage/lamplight-artifacts';

export type TodaysLampState =
  | { phase: 'idle' }
  | { phase: 'loading'; loadingStep: 0 | 1 | 2 }
  | { phase: 'ready'; artifact: DailyDevotion }
  | { phase: 'error'; reason: 'no_notes' | 'validators_failed' | 'network' };

export interface UseTodaysLampArgs {
  adapter: LamplightAdapter;
  userId: string;
  localDate: string;
  /** When false, a cache miss enters `idle` instead of generating until start() is called. Default true. */
  autoGenerate?: boolean;
  loadingStepIntervalMs?: number;
}

export interface UseTodaysLampResult {
  state: TodaysLampState;
  start: () => void;
  retry: () => void;
}

export function useTodaysLamp(args: UseTodaysLampArgs): UseTodaysLampResult {
  const { adapter, userId, localDate, autoGenerate = true, loadingStepIntervalMs = 2500 } = args;
  const [state, setState] = useState<TodaysLampState>({ phase: 'loading', loadingStep: 0 });
  const [generation, setGeneration] = useState(0);
  const cancelledRef = useRef(false);
  const startRequestedRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    const myGen = generation;
    let step: 0 | 1 | 2 = 0;

    const interval = setInterval(() => {
      if (cancelledRef.current) return;
      step = (Math.min(step + 1, 2) as 0 | 1 | 2);
      setState(prev => prev.phase === 'loading' ? { phase: 'loading', loadingStep: step } : prev);
    }, loadingStepIntervalMs);

    (async () => {
      // Reset to loading before each fetch-or-generate run. Done inside the
      // async IIFE so the effect body itself does no synchronous setState.
      setState(prev => prev.phase === 'loading' && prev.loadingStep === 0
        ? prev
        : { phase: 'loading', loadingStep: 0 });
      try {
        const existing = await adapter.getDailyDevotion(userId, localDate);
        if (cancelledRef.current || myGen !== generation) return;
        if (existing) {
          clearInterval(interval);
          setState({ phase: 'ready', artifact: existing });
          return;
        }
        // Cache miss: only generate when auto-generation is on or the user has
        // explicitly asked to start. Otherwise wait in idle for a start() tap.
        const shouldGenerate = autoGenerate || startRequestedRef.current;
        if (!shouldGenerate) {
          clearInterval(interval);
          setState({ phase: 'idle' });
          return;
        }
        const result = await adapter.generateDailyDevotion(userId, localDate);
        if (cancelledRef.current || myGen !== generation) return;
        clearInterval(interval);
        if (result.ok) {
          setState({ phase: 'ready', artifact: result.artifact });
        } else {
          setState({ phase: 'error', reason: result.reason });
        }
      } catch {
        if (cancelledRef.current || myGen !== generation) return;
        clearInterval(interval);
        setState({ phase: 'error', reason: 'network' });
      }
    })();

    return () => { clearInterval(interval); };
  }, [adapter, userId, localDate, autoGenerate, loadingStepIntervalMs, generation]);

  const start = useCallback(() => {
    startRequestedRef.current = true;
    setGeneration(g => g + 1);
  }, []);

  const retry = useCallback(() => {
    startRequestedRef.current = true;
    setGeneration(g => g + 1);
  }, []);

  return { state, start, retry };
}
```

Notes for the implementer:
- `idle` is added to the **front** of the union; existing consumers narrow on `phase` so order is irrelevant, but keeping it first reads as "before anything happens."
- `retry()` now also sets `startRequestedRef` — harmless on desktop (`autoGenerate` already true) and required on mobile so a retry after a tapped-then-failed generation re-generates rather than dropping back to `idle`.
- The dep array gains `autoGenerate`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/notepad/hooks/useTodaysLamp.test.tsx`
Expected: PASS — all existing tests (cached, generate, loadingStep, error, unmount, no-regenerate, retry) plus the 4 new ones are green.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/hooks/useTodaysLamp.ts src/notepad/hooks/useTodaysLamp.test.tsx
git commit -m "feat(lamplight): add autoGenerate flag, idle phase, and start() to useTodaysLamp"
```

---

## Task 3: `TodaysLampIntro` component

**Files:**
- Create: `src/notepad/components/lamplight/TodaysLampIntro.tsx`
- Test: `src/notepad/components/lamplight/TodaysLampIntro.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/components/lamplight/TodaysLampIntro.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TodaysLampIntro } from './TodaysLampIntro';

afterEach(cleanup);

describe('TodaysLampIntro', () => {
  it('renders the intro copy and start button', () => {
    render(<TodaysLampIntro firstName={null} onStart={() => {}} />);
    expect(screen.getByText(/Today's Lamp draws quietly from your recent notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show Me Today's Lamp/i })).toBeInTheDocument();
  });

  it('personalizes the intro with firstName', () => {
    render(<TodaysLampIntro firstName="Natalie" onStart={() => {}} />);
    expect(screen.getByText(/Natalie, Today's Lamp draws quietly/i)).toBeInTheDocument();
  });

  it('calls onStart when the button is tapped', () => {
    const onStart = vi.fn();
    render(<TodaysLampIntro firstName={null} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /Show Me Today's Lamp/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampIntro.test.tsx`
Expected: FAIL — cannot find module `./TodaysLampIntro`.

- [ ] **Step 3: Write minimal implementation**

Create `src/notepad/components/lamplight/TodaysLampIntro.tsx`:

```tsx
import { todaysLampIntro } from '../../lamplight/lamplight-copy';

export interface TodaysLampIntroProps {
  firstName: string | null;
  onStart: () => void;
}

export function TodaysLampIntro({ firstName, onStart }: TodaysLampIntroProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-3xl mb-3" aria-hidden>🕯</div>
      <h3
        className="text-base mb-2"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        Today's Lamp
      </h3>
      <p
        className="text-xs mb-5 max-w-[320px] leading-relaxed"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        {todaysLampIntro(firstName)}
      </p>
      <button
        type="button"
        onClick={onStart}
        className="px-5 py-2.5 rounded-full text-sm cursor-pointer"
        style={{
          background: 'var(--deep-umber)',
          color: 'var(--alabaster)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        Show Me Today's Lamp
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampIntro.test.tsx`
Expected: PASS (3 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/TodaysLampIntro.tsx src/notepad/components/lamplight/TodaysLampIntro.test.tsx
git commit -m "feat(lamplight): add TodaysLampIntro manual-start component"
```

---

## Task 4: `TodaysLampCard` — thread `autoGenerate`, render idle → intro

**Files:**
- Modify: `src/notepad/components/lamplight/TodaysLampCard.tsx`
- Test: `src/notepad/components/lamplight/TodaysLampCard.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/notepad/components/lamplight/TodaysLampCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodaysLampCard } from './TodaysLampCard';
import { FakeLamplightAdapter } from '../../storage/fake-lamplight-adapter';
import type { DailyDevotion } from '../../storage/lamplight-artifacts';

afterEach(cleanup);

const devotion: DailyDevotion = {
  opening: 'op',
  scripture: { ref: 'Psalm 23:4', text: 'though I walk' },
  reflection: 'r',
  prompt: 'p',
  note_citations: [{ note_id: 'n1', reason: 'rest' }],
};

function renderCard(adapter: FakeLamplightAdapter, autoGenerate: boolean) {
  return render(
    <MemoryRouter>
      <TodaysLampCard
        adapter={adapter}
        userId="user-1"
        localDate="2026-05-27"
        voicePreference="contemplative"
        traditionHint="ecumenical"
        firstName="Natalie"
        autoGenerate={autoGenerate}
      />
    </MemoryRouter>,
  );
}

describe('TodaysLampCard (manual start)', () => {
  it('shows the intro instead of generating when autoGenerate=false and nothing is cached', async () => {
    const adapter = new FakeLamplightAdapter();
    const generateSpy = vi.spyOn(adapter, 'generateDailyDevotion');
    renderCard(adapter, false);
    expect(await screen.findByRole('button', { name: /Show Me Today's Lamp/i })).toBeInTheDocument();
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('tapping the button generates once and renders the devotion', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: true, artifact: devotion, cached: false });
    const generateSpy = vi.spyOn(adapter, 'generateDailyDevotion');
    renderCard(adapter, false);
    fireEvent.click(await screen.findByRole('button', { name: /Show Me Today's Lamp/i }));
    await waitFor(() => expect(screen.getByText(/though I walk/i)).toBeInTheDocument());
    expect(generateSpy).toHaveBeenCalledTimes(1);
  });
});
```

Notes:
- `voicePreference`/`traditionHint` values above must be valid members of `LamplightVoice` / `LamplightTradition`. Open `src/notepad/storage/lamplight-adapter.ts` and substitute real union members if `'contemplative'` / `'ecumenical'` are not valid (they are display-only here and do not affect the assertions).
- `MemoryRouter` is required because the ready-state `Devotion` renders a react-router `<Link>`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampCard.test.tsx`
Expected: FAIL — `TodaysLampCard` does not accept `autoGenerate` (TS error) and/or the intro button never appears.

- [ ] **Step 3: Write the implementation**

Edit `src/notepad/components/lamplight/TodaysLampCard.tsx`. Add the import:

```tsx
import { TodaysLampIntro } from './TodaysLampIntro';
```

Change the props interface to add `autoGenerate`:

```tsx
export interface TodaysLampCardProps {
  adapter: LamplightAdapter;
  userId: string;
  localDate: string;
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
  firstName: string | null;
  autoGenerate?: boolean;
}
```

Update the component signature and hook call, and render the idle branch:

```tsx
export function TodaysLampCard({
  adapter, userId, localDate, voicePreference, traditionHint, firstName, autoGenerate = true,
}: TodaysLampCardProps) {
  const { state, start, retry } = useTodaysLamp({ adapter, userId, localDate, autoGenerate });

  if (state.phase === 'idle')    return <TodaysLampIntro firstName={firstName} onStart={start} />;
  if (state.phase === 'loading') return <TodaysLampLoading step={state.loadingStep} firstName={firstName} />;
  if (state.phase === 'error')   return <TodaysLampError reason={state.reason} firstName={firstName} onRetry={retry} />;

  return (
    <Devotion
      artifact={state.artifact}
      localDate={localDate}
      voicePreference={voicePreference}
      traditionHint={traditionHint}
    />
  );
}
```

(The `Devotion` function and `formatLocalDate` export below are unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/components/lamplight/TodaysLampCard.test.tsx`
Expected: PASS (2 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/TodaysLampCard.tsx src/notepad/components/lamplight/TodaysLampCard.test.tsx
git commit -m "feat(lamplight): render manual-start intro in TodaysLampCard idle phase"
```

---

## Task 5: Wire `autoGenerate` through the panel and mobile view

**Files:**
- Modify: `src/notepad/components/lamplight/LamplightTabPanel.tsx`
- Modify: `src/components/sections/notepad/mobile/LamplightMobileView.tsx`
- Test: `src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`

- [ ] **Step 1: Write the failing test**

The existing `LamplightMobileView.test.tsx` already mocks `LamplightTabPanel` with a stub. Convert that stub into a prop-capturing spy (via `vi.hoisted`, because `vi.mock` is hoisted above module-level `const`s) and assert the mobile view passes `autoGenerate={false}`. This is the exact contract of this task and matches the file's existing mock style.

Replace the current `LamplightTabPanel` mock block (lines 5-7) with:

```tsx
const { tabPanelSpy } = vi.hoisted(() => ({ tabPanelSpy: vi.fn() }));
vi.mock('../../../../notepad/components/lamplight/LamplightTabPanel', () => ({
  LamplightTabPanel: (props: { autoGenerate?: boolean }) => {
    tabPanelSpy(props);
    return <div data-testid="todays-lamp" />;
  },
}));
```

Then append this test inside the existing `describe('<LamplightMobileView />', ...)` block:

```tsx
  it("passes autoGenerate=false to the Today's Lamp panel (no auto-generate on mobile)", () => {
    tabPanelSpy.mockClear();
    render(<LamplightMobileView {...props} />);
    expect(tabPanelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ autoGenerate: false }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`
Expected: FAIL — `tabPanelSpy` is called with `{ autoGenerate: undefined }` (no `autoGenerate` key) because the mobile view does not yet pass the flag.

- [ ] **Step 3: Implement the wiring**

In `src/notepad/components/lamplight/LamplightTabPanel.tsx`, add the prop and thread it to the card.

Change the props interface:

```tsx
export interface LamplightTabPanelProps {
  lamplightAdapter: LamplightAdapter;
  autoGenerate?: boolean;
}
```

Change the signature:

```tsx
export function LamplightTabPanel({ lamplightAdapter, autoGenerate = true }: LamplightTabPanelProps) {
```

Pass it to `TodaysLampCard` (the final `return`), adding the one prop:

```tsx
  return (
    <TodaysLampCard
      adapter={lamplightAdapter}
      userId={user.id}
      localDate={localDate}
      voicePreference={settingsState.settings.voicePreference}
      traditionHint={settingsState.settings.traditionHint}
      firstName={firstName}
      autoGenerate={autoGenerate}
    />
  );
```

In `src/components/sections/notepad/mobile/LamplightMobileView.tsx`, pass `autoGenerate={false}` (line 44):

```tsx
        {segment === 'today' && (
          <LamplightTabPanel lamplightAdapter={lamplightAdapter} autoGenerate={false} />
        )}
```

Leave `src/components/sections/Notepad.tsx:220` unchanged — desktop keeps the default `true`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/sections/notepad/mobile/LamplightMobileView.test.tsx`
Expected: PASS — `tabPanelSpy` called with `{ autoGenerate: false }`; the two pre-existing segment tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/lamplight/LamplightTabPanel.tsx src/components/sections/notepad/mobile/LamplightMobileView.tsx src/components/sections/notepad/mobile/LamplightMobileView.test.tsx
git commit -m "feat(lamplight): mobile Today's Lamp requires manual start (autoGenerate=false)"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + full test suite**

Run: `npx tsc -b --noEmit && npx vitest run`
Expected: typecheck clean; all suites pass, including the unchanged desktop path and the new mobile behavior.

- [ ] **Step 2: Lint the touched files**

Run: `npx eslint src/notepad/hooks/useTodaysLamp.ts src/notepad/components/lamplight/TodaysLampCard.tsx src/notepad/components/lamplight/TodaysLampIntro.tsx src/notepad/components/lamplight/LamplightTabPanel.tsx src/components/sections/notepad/mobile/LamplightMobileView.tsx src/notepad/lamplight/lamplight-copy.ts`
Expected: no errors.

- [ ] **Step 3: Manual smoke (optional, recommended)**

Run the app (`npm run dev`), open a mobile viewport, sign in, open the Notepad → Today's Lamp tab. Confirm: with nothing generated today you see the intro + "Show Me Today's Lamp" button and no network call to generate until you tap; after tapping it loads then shows the devotion; switching to Connection Cards and back shows the devotion directly (now cached). Confirm desktop still auto-generates.

---

## Notes / Decisions Captured

- Mobile-only is expressed purely via the `autoGenerate` prop from the mobile view tree — no viewport detection.
- "Remember within session" is provided for free by server-side caching of a generated devotion; no new client persistence.
- The brief `loading` flash during the cheap cached read (before `idle`) is acceptable per the spec.
- If generation errors, nothing is cached, so a later tab re-entry returns to the intro — accepted behavior.
