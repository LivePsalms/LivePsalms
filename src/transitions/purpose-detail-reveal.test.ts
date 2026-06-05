import { describe, it, expect } from 'vitest';
import { PurposeDetailReveal } from './purpose-detail-reveal';
import type { DetailRevealDeps, ExitStyles } from './purpose-detail-reveal';

interface DepsRecord {
  exitStyles: Array<{ target: 'content' | 'image'; styles: ExitStyles }>;
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

describe('PurposeDetailReveal — reset()', () => {
  it('from entering: cancels the pending text-ready timer and reschedules a new one', () => {
    const { deps, rec } = makeDeps();
    const r = new PurposeDetailReveal(deps);
    r.start();
    r.reset();
    expect(rec.timersCleared).toContain(1);
    expect(rec.timersScheduled).toHaveLength(2);
    expect(rec.timersScheduled[1].ms).toBe(1400);
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
    runTimer(2);
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
