# Deepen the Migration Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `MigrationDialog`'s inline 7-kind `Phase` state machine, async `handleImport` orchestration, 1400ms `setTimeout` pause, retry handler, and toast firing with a single deep `MigrationWorkflow` class that owns the entire lifecycle behind a small interface.

**Architecture:** A plain TypeScript class extending `Observable<T>`, mirroring `RouteTransition` and `PurposeDetailReveal`. Seven-state status machine (`idle → loading → folders → notes → cleanup → done`, plus `error` from any step). All side effects (`migrate`, `clearSource`, `toastSuccess`, `toastError`, `setTimer`, `clearTimer`, `onMigrationComplete`, `onClose`) are injected as `MigrationWorkflowDeps` so the class is testable in node with no toast, no DOM, and no real timers. A thin `useMigrationWorkflow` hook wires production deps to `localAdapter.clearAll`, `sonner`, and `window.setTimeout`.

**Tech Stack:** TypeScript 5.9, React 19, Vitest, existing `migrateAdapter` and `StorageAdapter`.

**Domain language:** see [docs/CONTEXT.md](../../CONTEXT.md) §`MigrationWorkflow`. The name `MigrationWorkflow`, the seven status values, the deps interface, and the `MIGRATION_TIMELINE` constant come from there — use them exactly. The new module is the *named caller* that §`AdapterMigration` refers to as "the caller's concern."

**Composition with `AdapterMigration`:** the pure module is unchanged. `MigrationWorkflow.start()` calls `deps.migrate(source, target, { onEvent: ... })` and translates each `MigrationEvent` into a status update. The result `{ folders, notes }` flows into the `done` payload so the toast pluralization logic moves with the rest of the lifecycle.

---

## File Structure

### New files
- `src/notepad/storage/migration-workflow.ts` — the deep module: state machine + deps interface + `MIGRATION_TIMELINE`
- `src/notepad/storage/migration-workflow.test.ts` — node-only tests with fake migrate + fake timers
- `src/notepad/storage/useMigrationWorkflow.tsx` — production React hook wiring real `localAdapter.clearAll`, `sonner` toasts, and `window.setTimeout`

### Modified files
- `src/notepad/components/MigrationDialog.tsx` — drop the `Phase` union, the `useState`, the async `handleImport`, the 1400ms `setTimeout`, the retry handler, and the toast imports; consume the hook; render JSX off `state.status`
- `docs/CONTEXT.md` — already updated in design phase (§`MigrationWorkflow`)

### No changes
- `src/notepad/storage/migration.ts` — pure module is untouched; `MigrationEvent` and `MigrationResult` are imported by the workflow
- `src/notepad/storage/local-storage.ts` — `localAdapter.clearAll()` (sync, returns `void`) is wrapped by the production hook's `clearSource` dep
- `src/components/sections/Notepad.tsx` — `<MigrationDialog>` props (`open`, `onClose`, `targetAdapter`, `onMigrationComplete`) are unchanged

---

## Task 1: Create the module skeleton with initial-state test

**Files:**
- Create: `src/notepad/storage/migration-workflow.ts`
- Create: `src/notepad/storage/migration-workflow.test.ts`

- [ ] **Step 1: Write the failing initial-state test**

Create `src/notepad/storage/migration-workflow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MigrationWorkflow } from './migration-workflow';
import type { MigrationWorkflowDeps } from './migration-workflow';
import type { MigrationEvent, MigrationResult } from './migration';
import type { StorageAdapter } from './adapter';

interface DepsRecord {
  migrateCalls: Array<{ source: StorageAdapter; target: StorageAdapter }>;
  clearSourceCalls: number;
  toastSuccess: string[];
  toastError: string[];
  timersScheduled: Array<{ ms: number; cb: () => void }>;
  timersCleared: number[];
  onMigrationComplete: number;
  onClose: number;
}

interface FakeMigrate {
  fn: MigrationWorkflowDeps['migrate'];
  emit: (event: MigrationEvent) => void;
  resolve: (result: MigrationResult) => void;
  reject: (err: Error) => void;
  reset: () => void;
}

function makeFakeMigrate(): FakeMigrate {
  let onEvent: ((e: MigrationEvent) => void) | null = null;
  let pendingResolve: ((r: MigrationResult) => void) | null = null;
  let pendingReject: ((e: Error) => void) | null = null;
  const fn: MigrationWorkflowDeps['migrate'] = async (_source, _target, opts) => {
    onEvent = opts?.onEvent ?? null;
    return new Promise<MigrationResult>((res, rej) => {
      pendingResolve = res;
      pendingReject = rej;
    });
  };
  return {
    fn,
    emit: (event) => onEvent?.(event),
    resolve: (result) => pendingResolve?.(result),
    reject: (err) => pendingReject?.(err),
    reset: () => {
      onEvent = null;
      pendingResolve = null;
      pendingReject = null;
    },
  };
}

const fakeAdapter = (): StorageAdapter => ({} as StorageAdapter);

function makeDeps(): {
  deps: MigrationWorkflowDeps;
  rec: DepsRecord;
  migrate: FakeMigrate;
  runTimer: (handle: number) => void;
} {
  let nextHandle = 1;
  const handleToCb = new Map<number, () => void>();
  const rec: DepsRecord = {
    migrateCalls: [],
    clearSourceCalls: 0,
    toastSuccess: [],
    toastError: [],
    timersScheduled: [],
    timersCleared: [],
    onMigrationComplete: 0,
    onClose: 0,
  };
  const migrate = makeFakeMigrate();
  const deps: MigrationWorkflowDeps = {
    source: fakeAdapter(),
    target: fakeAdapter(),
    migrate: async (source, target, opts) => {
      rec.migrateCalls.push({ source, target });
      return migrate.fn(source, target, opts);
    },
    clearSource: () => {
      rec.clearSourceCalls++;
    },
    toastSuccess: (msg) => {
      rec.toastSuccess.push(msg);
    },
    toastError: (msg) => {
      rec.toastError.push(msg);
    },
    setTimer: (cb, ms) => {
      const handle = nextHandle++;
      handleToCb.set(handle, cb);
      rec.timersScheduled.push({ ms, cb });
      return handle;
    },
    clearTimer: (handle) => {
      rec.timersCleared.push(handle);
      // Intentionally NOT deleting from handleToCb — see purpose-detail-reveal.test.ts
      // for the rationale: tests must be able to simulate a stale timer firing
      // post-clearTimeout to exercise the class's `=== null` guard.
    },
    onMigrationComplete: () => {
      rec.onMigrationComplete++;
    },
    onClose: () => {
      rec.onClose++;
    },
  };
  const runTimer = (handle: number) => {
    const cb = handleToCb.get(handle);
    if (cb) cb();
  };
  return { deps, rec, migrate, runTimer };
}

describe('MigrationWorkflow — initial state', () => {
  it('starts idle', () => {
    const { deps } = makeDeps();
    const w = new MigrationWorkflow(deps);
    expect(w.getSnapshot()).toEqual({ status: 'idle' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: FAIL — `Cannot find module './migration-workflow'`.

- [ ] **Step 3: Create the module skeleton**

Create `src/notepad/storage/migration-workflow.ts`:

```ts
import { Observable } from '@/notepad/collection/observable';
import type { migrateAdapter, MigrationEvent } from './migration';
import type { StorageAdapter } from './adapter';

export type MigrationStatus =
  | 'idle'
  | 'loading'
  | 'folders'
  | 'notes'
  | 'cleanup'
  | 'done'
  | 'error';

export type MigrationWorkflowState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'folders'; current: number; total: number }
  | { status: 'notes'; current: number; total: number }
  | { status: 'cleanup' }
  | { status: 'done'; folders: number; notes: number }
  | { status: 'error'; message: string };

export interface MigrationWorkflowDeps {
  source: StorageAdapter;
  target: StorageAdapter;
  migrate: typeof migrateAdapter;
  clearSource: () => void;
  toastSuccess: (message: string) => void;
  toastError: (message: string) => void;
  setTimer: (cb: () => void, ms: number) => number;
  clearTimer: (handle: number) => void;
  onMigrationComplete: () => void;
  onClose: () => void;
}

export const MIGRATION_TIMELINE = {
  celebratoryPauseMs: 1400,
} as const;

export const MIGRATION_FALLBACK_ERROR =
  'Something went wrong importing your notes. Your local copy was left untouched.';

/**
 * Owns the multi-phase orchestration around `migrateAdapter`. Stateful
 * coordinator counterpart to the pure `AdapterMigration` module: §AdapterMigration
 * notes that source-side cleanup is "the caller's concern" — this class is
 * that caller, named.
 *
 * Pure of React, DOM, toast, and timers — all side effects flow through
 * `deps`. See `useMigrationWorkflow` for the production wiring.
 */
export class MigrationWorkflow extends Observable<MigrationWorkflowState> {
  private readonly deps: MigrationWorkflowDeps;

  constructor(deps: MigrationWorkflowDeps) {
    super({ status: 'idle' });
    this.deps = deps;
  }

  // Re-export so consumers don't need to import MigrationEvent separately.
  protected applyEvent(_event: MigrationEvent): void {
    void _event;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/storage/migration-workflow.ts src/notepad/storage/migration-workflow.test.ts docs/CONTEXT.md
git commit -m "feat(migration): scaffold MigrationWorkflow with initial state"
```

---

## Task 2: `start()` happy-path sequencing and side effects

**Files:**
- Modify: `src/notepad/storage/migration-workflow.ts`
- Modify: `src/notepad/storage/migration-workflow.test.ts`

This task implements the synchronous shape of `start()` end-to-end up to and including the `done` status. The celebratory timer is scheduled but its firing is covered in Task 3.

- [ ] **Step 1: Add failing happy-path tests**

Append to `src/notepad/storage/migration-workflow.test.ts`:

```ts
describe('MigrationWorkflow — start() happy path', () => {
  it('moves idle → loading immediately', async () => {
    const { deps } = makeDeps();
    const w = new MigrationWorkflow(deps);
    void w.start();
    expect(w.getSnapshot()).toEqual({ status: 'loading' });
  });

  it('translates folders and notes events into typed status updates', async () => {
    const { deps, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();

    migrate.emit({ kind: 'folders', current: 1, total: 3 });
    expect(w.getSnapshot()).toEqual({ status: 'folders', current: 1, total: 3 });

    migrate.emit({ kind: 'folders', current: 3, total: 3 });
    migrate.emit({ kind: 'notes', current: 2, total: 5 });
    expect(w.getSnapshot()).toEqual({ status: 'notes', current: 2, total: 5 });

    migrate.resolve({ folders: 3, notes: 5 });
    await startPromise;
  });

  it('moves through cleanup → done after migrate resolves', async () => {
    const { deps, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.resolve({ folders: 2, notes: 7 });
    await startPromise;
    expect(w.getSnapshot()).toEqual({ status: 'done', folders: 2, notes: 7 });
  });

  it('calls clearSource AFTER migrate resolves and BEFORE onMigrationComplete', async () => {
    const { deps, rec, migrate } = makeDeps();
    const order: string[] = [];
    deps.clearSource = () => {
      rec.clearSourceCalls++;
      order.push('clearSource');
    };
    deps.onMigrationComplete = () => {
      rec.onMigrationComplete++;
      order.push('onMigrationComplete');
    };
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.resolve({ folders: 0, notes: 1 });
    await startPromise;
    expect(order).toEqual(['clearSource', 'onMigrationComplete']);
  });

  it('fires toastSuccess with singular message when notes === 1', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.resolve({ folders: 0, notes: 1 });
    await startPromise;
    expect(rec.toastSuccess).toEqual(['1 note imported to your account.']);
  });

  it('fires toastSuccess with plural message when notes !== 1', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.resolve({ folders: 1, notes: 12 });
    await startPromise;
    expect(rec.toastSuccess).toEqual(['12 notes imported to your account.']);
  });

  it('passes source and target from deps into migrate', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.resolve({ folders: 0, notes: 0 });
    await startPromise;
    expect(rec.migrateCalls).toHaveLength(1);
    expect(rec.migrateCalls[0].source).toBe(deps.source);
    expect(rec.migrateCalls[0].target).toBe(deps.target);
  });

  it('is a no-op when called from a non-restart status (loading)', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const first = w.start();
    void w.start();
    expect(rec.migrateCalls).toHaveLength(1);
    migrate.resolve({ folders: 0, notes: 0 });
    await first;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: FAIL — `w.start is not a function`.

- [ ] **Step 3: Implement `start()` synchronous core**

Replace the body of `MigrationWorkflow` in `src/notepad/storage/migration-workflow.ts` with:

```ts
export class MigrationWorkflow extends Observable<MigrationWorkflowState> {
  private readonly deps: MigrationWorkflowDeps;
  private celebratoryHandle: number | null = null;

  constructor(deps: MigrationWorkflowDeps) {
    super({ status: 'idle' });
    this.deps = deps;
  }

  start = async (): Promise<void> => {
    const { status } = this.getSnapshot();
    if (status !== 'idle' && status !== 'error') return;

    this.update(() => ({ status: 'loading' }));
    try {
      const result = await this.deps.migrate(this.deps.source, this.deps.target, {
        onEvent: (event) => this.applyEvent(event),
      });
      this.update(() => ({ status: 'cleanup' }));
      this.deps.clearSource();
      this.deps.onMigrationComplete();
      this.update(() => ({ status: 'done', folders: result.folders, notes: result.notes }));
      this.deps.toastSuccess(this.successMessage(result.notes));
      this.scheduleCelebratoryClose();
    } catch (err) {
      // Error path — Task 4.
      throw err;
    }
  };

  private applyEvent(event: MigrationEvent): void {
    switch (event.kind) {
      case 'loading':
        // The class set `loading` itself before `migrate` was awaited; the
        // pure module also emits `loading` at start. Idempotent.
        return;
      case 'folders':
        this.update(() => ({ status: 'folders', current: event.current, total: event.total }));
        return;
      case 'notes':
        this.update(() => ({ status: 'notes', current: event.current, total: event.total }));
        return;
    }
  }

  private scheduleCelebratoryClose(): void {
    // Implemented in Task 3.
  }

  private successMessage(notes: number): string {
    return notes === 1
      ? '1 note imported to your account.'
      : `${notes} notes imported to your account.`;
  }

  private update(updater: (prev: MigrationWorkflowState) => MigrationWorkflowState): void {
    (this as unknown as { setState: (u: typeof updater) => void }).setState(updater);
  }
}
```

Remove the placeholder `applyEvent` method that referenced `_event`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: PASS (9 tests total — 1 from Task 1 + 8 new).

Note: the "no-op when called from a non-restart status" test passes because the second `start()` early-returns without calling `migrate`, so `rec.migrateCalls.length === 1`.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/storage/migration-workflow.ts src/notepad/storage/migration-workflow.test.ts
git commit -m "feat(migration): start() drives the happy-path sequence to done"
```

---

## Task 3: Celebratory pause + auto-close

**Files:**
- Modify: `src/notepad/storage/migration-workflow.ts`
- Modify: `src/notepad/storage/migration-workflow.test.ts`

- [ ] **Step 1: Add failing tests for the celebratory close**

Append to `src/notepad/storage/migration-workflow.test.ts`:

```ts
describe('MigrationWorkflow — celebratory pause + auto-close', () => {
  it('schedules the celebratory timer at MIGRATION_TIMELINE.celebratoryPauseMs after done', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.resolve({ folders: 0, notes: 1 });
    await startPromise;
    expect(rec.timersScheduled).toHaveLength(1);
    expect(rec.timersScheduled[0].ms).toBe(1400);
  });

  it('returns to idle and fires onClose when the celebratory timer fires', async () => {
    const { deps, rec, migrate, runTimer } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.resolve({ folders: 0, notes: 1 });
    await startPromise;
    runTimer(1);
    expect(w.getSnapshot()).toEqual({ status: 'idle' });
    expect(rec.onClose).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: FAIL — the celebratory timer is currently a no-op.

- [ ] **Step 3: Implement `scheduleCelebratoryClose`**

In `src/notepad/storage/migration-workflow.ts`, replace the placeholder:

```ts
  private scheduleCelebratoryClose(): void {
    this.celebratoryHandle = this.deps.setTimer(() => {
      if (this.celebratoryHandle === null) return;
      this.celebratoryHandle = null;
      this.update(() => ({ status: 'idle' }));
      this.deps.onClose();
    }, MIGRATION_TIMELINE.celebratoryPauseMs);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: PASS (11 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/storage/migration-workflow.ts src/notepad/storage/migration-workflow.test.ts
git commit -m "feat(migration): celebratory pause schedules onClose"
```

---

## Task 4: Error path + retry

**Files:**
- Modify: `src/notepad/storage/migration-workflow.ts`
- Modify: `src/notepad/storage/migration-workflow.test.ts`

- [ ] **Step 1: Add failing tests for the error and retry flows**

Append to `src/notepad/storage/migration-workflow.test.ts`:

```ts
describe('MigrationWorkflow — error path', () => {
  it('catches a thrown Error and moves to error with the error message', async () => {
    const { deps, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.reject(new Error('Network down'));
    await startPromise;
    expect(w.getSnapshot()).toEqual({ status: 'error', message: 'Network down' });
  });

  it('uses the fallback message when the thrown value is not an Error', async () => {
    const { deps } = makeDeps();
    deps.migrate = async () => {
      throw 'not-an-error';
    };
    const w = new MigrationWorkflow(deps);
    await w.start();
    const state = w.getSnapshot();
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.message).toBe(
        'Something went wrong importing your notes. Your local copy was left untouched.',
      );
    }
  });

  it('fires toastError with the same message used for the status', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.reject(new Error('Boom'));
    await startPromise;
    expect(rec.toastError).toEqual(['Boom']);
  });

  it('does NOT call clearSource or onMigrationComplete or schedule the celebratory timer on error', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.reject(new Error('Boom'));
    await startPromise;
    expect(rec.clearSourceCalls).toBe(0);
    expect(rec.onMigrationComplete).toBe(0);
    expect(rec.timersScheduled).toHaveLength(0);
  });

  it('start() from error status retries the full sequence', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const firstStart = w.start();
    migrate.reject(new Error('Boom'));
    await firstStart;
    expect(w.getSnapshot().status).toBe('error');

    migrate.reset();
    const retry = w.start();
    expect(w.getSnapshot()).toEqual({ status: 'loading' });
    migrate.resolve({ folders: 0, notes: 2 });
    await retry;
    expect(w.getSnapshot()).toEqual({ status: 'done', folders: 0, notes: 2 });
    expect(rec.migrateCalls).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: FAIL — the catch branch currently re-throws.

- [ ] **Step 3: Implement the error branch**

In `src/notepad/storage/migration-workflow.ts`, replace the `try/catch` body of `start`:

```ts
    try {
      const result = await this.deps.migrate(this.deps.source, this.deps.target, {
        onEvent: (event) => this.applyEvent(event),
      });
      this.update(() => ({ status: 'cleanup' }));
      this.deps.clearSource();
      this.deps.onMigrationComplete();
      this.update(() => ({ status: 'done', folders: result.folders, notes: result.notes }));
      this.deps.toastSuccess(this.successMessage(result.notes));
      this.scheduleCelebratoryClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : MIGRATION_FALLBACK_ERROR;
      this.update(() => ({ status: 'error', message }));
      this.deps.toastError(message);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: PASS (16 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/storage/migration-workflow.ts src/notepad/storage/migration-workflow.test.ts
git commit -m "feat(migration): error path swallows + toasts; start() retries from error"
```

---

## Task 5: `dismissError()` and `dispose()`

**Files:**
- Modify: `src/notepad/storage/migration-workflow.ts`
- Modify: `src/notepad/storage/migration-workflow.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/notepad/storage/migration-workflow.test.ts`:

```ts
describe('MigrationWorkflow — dismissError()', () => {
  it('returns to idle and fires onClose when called from error', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.reject(new Error('Boom'));
    await startPromise;
    w.dismissError();
    expect(w.getSnapshot()).toEqual({ status: 'idle' });
    expect(rec.onClose).toBe(1);
  });

  it('is a no-op from any non-error status', () => {
    const { deps, rec } = makeDeps();
    const w = new MigrationWorkflow(deps);
    w.dismissError();
    expect(rec.onClose).toBe(0);
    expect(w.getSnapshot()).toEqual({ status: 'idle' });
  });
});

describe('MigrationWorkflow — dispose()', () => {
  it('cancels a pending celebratory timer', async () => {
    const { deps, rec, migrate } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.resolve({ folders: 0, notes: 1 });
    await startPromise;
    w.dispose();
    expect(rec.timersCleared).toContain(1);
  });

  it('does not fire onClose if a stale celebratory timer fires after dispose', async () => {
    const { deps, rec, migrate, runTimer } = makeDeps();
    const w = new MigrationWorkflow(deps);
    const startPromise = w.start();
    migrate.resolve({ folders: 0, notes: 1 });
    await startPromise;
    w.dispose();
    runTimer(1);
    expect(rec.onClose).toBe(0);
  });

  it('is safe to call from idle (no timers scheduled)', () => {
    const { deps, rec } = makeDeps();
    const w = new MigrationWorkflow(deps);
    w.dispose();
    expect(rec.timersCleared).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: FAIL — `dismissError`/`dispose` are not defined.

- [ ] **Step 3: Implement `dismissError` and `dispose`**

In `src/notepad/storage/migration-workflow.ts`, add these methods to the class (after `start`):

```ts
  dismissError = (): void => {
    if (this.getSnapshot().status !== 'error') return;
    this.update(() => ({ status: 'idle' }));
    this.deps.onClose();
  };

  dispose = (): void => {
    if (this.celebratoryHandle !== null) {
      this.deps.clearTimer(this.celebratoryHandle);
      this.celebratoryHandle = null;
    }
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/notepad/storage/migration-workflow.test.ts`
Expected: PASS (21 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/storage/migration-workflow.ts src/notepad/storage/migration-workflow.test.ts
git commit -m "feat(migration): dismissError() and dispose() with stale-timer guard"
```

---

## Task 6: Production hook `useMigrationWorkflow`

**Files:**
- Create: `src/notepad/storage/useMigrationWorkflow.tsx`

- [ ] **Step 1: Create the hook**

Create `src/notepad/storage/useMigrationWorkflow.tsx`:

```tsx
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import {
  MigrationWorkflow,
  type MigrationWorkflowDeps,
  type MigrationWorkflowState,
} from './migration-workflow';
import { migrateAdapter } from './migration';
import { localAdapter } from './local-storage';
import type { StorageAdapter } from './adapter';

interface UseMigrationWorkflowArgs {
  target: StorageAdapter;
  onMigrationComplete: () => void;
  onClose: () => void;
}

interface UseMigrationWorkflowResult {
  state: MigrationWorkflowState;
  start: () => void;
  dismissError: () => void;
}

/**
 * React glue for `MigrationWorkflow`. Wires the production migrate function,
 * sonner toasts, `localAdapter.clearAll`, and `window.setTimeout` into the
 * class. Source is hardcoded to `localAdapter` (the only direction wired
 * today); `target`, `onMigrationComplete`, and `onClose` come from the dialog.
 */
export function useMigrationWorkflow({
  target,
  onMigrationComplete,
  onClose,
}: UseMigrationWorkflowArgs): UseMigrationWorkflowResult {
  const onCompleteRef = useRef(onMigrationComplete);
  const onCloseRef = useRef(onClose);
  onCompleteRef.current = onMigrationComplete;
  onCloseRef.current = onClose;

  const workflow = useMemo(() => {
    const deps: MigrationWorkflowDeps = {
      source: localAdapter,
      target,
      migrate: migrateAdapter,
      clearSource: () => localAdapter.clearAll(),
      toastSuccess: (msg) => toast.success(msg),
      toastError: (msg) => toast.error(msg),
      setTimer: (cb, ms) => window.setTimeout(cb, ms),
      clearTimer: (handle) => window.clearTimeout(handle),
      onMigrationComplete: () => onCompleteRef.current(),
      onClose: () => onCloseRef.current(),
    };
    return new MigrationWorkflow(deps);
  }, [target]);

  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot);

  useEffect(() => {
    return () => workflow.dispose();
  }, [workflow]);

  return {
    state,
    start: () => {
      void workflow.start();
    },
    dismissError: workflow.dismissError,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/notepad/storage/useMigrationWorkflow.tsx
git commit -m "feat(migration): useMigrationWorkflow hook wires real toast/timers/adapter"
```

---

## Task 7: Wire `useMigrationWorkflow` into `MigrationDialog`

**Files:**
- Modify: `src/notepad/components/MigrationDialog.tsx`

- [ ] **Step 1: Replace the inline state and handler**

Rewrite `src/notepad/components/MigrationDialog.tsx` end-to-end. The new file:

```tsx
import { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { localAdapter } from '../storage/local-storage';
import { useMigrationWorkflow } from '../storage/useMigrationWorkflow';
import type { MigrationWorkflowState } from '../storage/migration-workflow';
import type { StorageAdapter } from '../storage/adapter';

interface MigrationDialogProps {
  open: boolean;
  onClose: () => void;
  targetAdapter: StorageAdapter;
  onMigrationComplete: () => void;
}

const phaseMessage = (s: MigrationWorkflowState): string => {
  switch (s.status) {
    case 'idle':    return '';
    case 'loading': return 'Reading your local notes…';
    case 'folders': return s.total === 1
      ? 'Syncing your folder…'
      : `Syncing folder ${s.current} of ${s.total}…`;
    case 'notes':   return s.total === 1
      ? 'Importing your note…'
      : `Importing note ${s.current} of ${s.total}…`;
    case 'cleanup': return 'Almost done — tidying up…';
    case 'done':    return 'All set. Your notes are now in your account.';
    case 'error':   return s.message;
  }
};

const isInProgress = (s: MigrationWorkflowState): boolean =>
  s.status === 'loading' ||
  s.status === 'folders' ||
  s.status === 'notes' ||
  s.status === 'cleanup';

export function MigrationDialog({
  open,
  onClose,
  targetAdapter,
  onMigrationComplete,
}: MigrationDialogProps) {
  const { state, start, dismissError } = useMigrationWorkflow({
    target: targetAdapter,
    onMigrationComplete,
    onClose,
  });
  const [noteCount, setNoteCount] = useState(0);

  // Read the current local note count when the dialog opens. Source-side
  // ownership stays inside LocalStorageAdapter — the dialog no longer knows
  // the storage keys.
  useEffect(() => {
    if (!open) return;
    localAdapter.getNotes().then((notes) => setNoteCount(notes.length));
  }, [open]);

  const inProgress = isInProgress(state);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !inProgress) onClose();
      }}
    >
      <DialogContent
        className="max-w-sm p-8"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
        }}
      >
        {inProgress || state.status === 'done' ? (
          <div className="flex flex-col items-center gap-4 py-2">
            {state.status === 'done' ? (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ border: '1.5px solid var(--deep-umber)' }}
              >
                <Check className="w-5 h-5" style={{ color: 'var(--deep-umber)' }} strokeWidth={2} />
              </div>
            ) : (
              <Loader2
                className="w-11 h-11 animate-spin"
                style={{ color: 'var(--deep-umber)' }}
                strokeWidth={1.25}
              />
            )}

            <DialogTitle
              className="text-base font-medium text-center"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              {state.status === 'done' ? 'Done' : 'Importing your notes'}
            </DialogTitle>

            <DialogDescription
              className="text-center text-xs px-2"
              style={{
                color: 'var(--silica)',
                fontFamily: 'Outfit, sans-serif',
                minHeight: '2.4em',
                lineHeight: 1.5,
              }}
            >
              {phaseMessage(state)}
            </DialogDescription>

            {(state.status === 'folders' || state.status === 'notes') && (
              <div
                className="w-full h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--pale-stone)' }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{
                    background: 'var(--deep-umber)',
                    width: `${(state.current / Math.max(state.total, 1)) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        ) : state.status === 'error' ? (
          <>
            <DialogTitle
              className="text-lg font-medium text-center"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              Something went wrong
            </DialogTitle>
            <DialogDescription
              className="text-center text-sm mt-2"
              style={{
                color: 'var(--silica)',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {state.message}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <button
                onClick={dismissError}
                className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  border: '1px solid var(--pale-stone)',
                  color: 'var(--deep-umber)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Close
              </button>
              <button
                onClick={start}
                className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity"
                style={{
                  background: 'var(--deep-umber)',
                  color: 'var(--plaster)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Try again
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle
              className="text-lg font-medium text-center"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              Import Local Notes?
            </DialogTitle>
            <DialogDescription
              className="text-center text-sm mt-2"
              style={{
                color: 'var(--silica)',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              You have {noteCount} {noteCount === 1 ? 'note' : 'notes'} saved locally.
              Would you like to import them to your account?
            </DialogDescription>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  border: '1px solid var(--pale-stone)',
                  color: 'var(--deep-umber)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                No Thanks
              </button>
              <button
                onClick={start}
                className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity"
                style={{
                  background: 'var(--deep-umber)',
                  color: 'var(--plaster)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Import Notes
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

Key diffs from the original:
- `useState<Phase>` removed; `state` comes from the hook
- `handleImport` removed; intro and retry buttons both call `start`
- The error-screen "Close" button calls `dismissError` instead of resetting phase manually
- `localAdapter` import retained only for the `noteCount` fetch — the cleanup `localAdapter.clearAll()` moved to the hook's `clearSource` dep
- `migrateAdapter` import dropped — the workflow imports it
- `toast` import dropped — the workflow's hook imports it
- `phaseMessage` and `isInProgress` are pure helpers reading off `MigrationWorkflowState`

- [ ] **Step 2: Type-check + run all tests**

Run: `npx tsc -b && npm test`
Expected: no type errors, all existing tests pass plus the 21 new `migration-workflow` tests.

- [ ] **Step 3: Smoke-test in the browser**

Run: `npm run dev` and exercise:
1. Sign in with a fresh account that has local notes (or seed via `scripts/seed-demo-notes.js`). Migration dialog appears.
2. Click "Import Notes". Loader spins; phase messages flow `Reading… → Syncing folder… → Importing note… → Almost done… → Done`.
3. Done state shows the check icon for ~1.4 seconds, then the dialog closes itself.
4. Toast: "N notes imported to your account." (or "1 note" when N=1).
5. Re-trigger with a forced error (e.g. break network mid-migration): error screen shows. "Try again" retries; "Close" dismisses.
6. The dialog cannot be dismissed by clicking outside while `Importing your notes` is showing.

Expected: behavior matches pre-deepening exactly.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/components/MigrationDialog.tsx
git commit -m "refactor(migration-dialog): consume useMigrationWorkflow; drop inline state machine"
```

---

## Self-review checklist (run after Task 7)

- [ ] Seven-state machine matches CONTEXT.md §`MigrationWorkflow` exactly: `idle`, `loading`, `folders`, `notes`, `cleanup`, `done`, `error`.
- [ ] `migration.ts` and `local-storage.ts` are unchanged.
- [ ] No `useState<Phase>` remains in `MigrationDialog.tsx`.
- [ ] No `setTimeout` / `clearTimeout` in `MigrationDialog.tsx`.
- [ ] No `toast` import in `MigrationDialog.tsx` — toast firing lives in the workflow's deps wiring.
- [ ] No `migrateAdapter` import in `MigrationDialog.tsx` — the workflow imports it.
- [ ] `MIGRATION_FALLBACK_ERROR` is the single source of truth for the non-`Error` fallback message.
- [ ] All 21 new tests pass; no React, no jsdom, no real timers, no real toast.
- [ ] CONTEXT.md §`MigrationWorkflow` reflects the implemented module.
- [ ] In-progress click-outside guard still works (`open && !inProgress`); `inProgress` reads off `state.status`.
