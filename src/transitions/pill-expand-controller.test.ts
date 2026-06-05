import { describe, it, expect, beforeEach } from 'vitest';
import { PillExpandController } from './pill-expand-controller';
import type { PillExpandDeps, ExpandTiming, RectLike } from './pill-expand-controller';

interface CreateCoverCall { rect: RectLike; pillColor: string; }
interface TimelineCall { timing: ExpandTiming; targetUrl: string; }

interface DepsRecord {
  coversCreated: CreateCoverCall[];
  coversRemoved: number;
  timelines: TimelineCall[];
  bodyOverflow: string[];
  existingCover: boolean;
}

function makeDeps(overrides: Partial<{ existingCover: boolean }> = {}): {
  deps: PillExpandDeps; rec: DepsRecord;
} {
  const rec: DepsRecord = {
    coversCreated: [],
    coversRemoved: 0,
    timelines: [],
    bodyOverflow: [],
    existingCover: overrides.existingCover ?? false,
  };
  const deps: PillExpandDeps = {
    createCover: (opts) => { rec.coversCreated.push(opts); },
    removeCover: () => { rec.coversRemoved += 1; },
    runExpandTimeline: (opts) => { rec.timelines.push(opts); },
    setBodyOverflow: (v) => { rec.bodyOverflow.push(v); },
    hasExistingCover: () => rec.existingCover,
  };
  return { deps, rec };
}

const RECT: RectLike = { top: 100, left: 200, width: 600, height: 175 };

describe('PillExpandController — initial state', () => {
  it('starts not-navigated', () => {
    const { deps } = makeDeps();
    const c = new PillExpandController(deps);
    expect(c.hasNavigated()).toBe(false);
  });
});

describe('PillExpandController — start (normal motion)', () => {
  let deps: PillExpandDeps;
  let rec: DepsRecord;
  let c: PillExpandController;

  beforeEach(() => {
    ({ deps, rec } = makeDeps());
    c = new PillExpandController(deps);
  });

  it('locks body overflow, creates cover with rect+color, runs timeline with targetUrl', () => {
    c.start({ pillRect: RECT, targetUrl: '/purpose/strength', pillColor: '#7d7565', reducedMotion: false });
    expect(rec.bodyOverflow).toEqual(['hidden']);
    expect(rec.coversCreated).toEqual([{ rect: RECT, pillColor: '#7d7565' }]);
    expect(rec.timelines).toHaveLength(1);
    expect(rec.timelines[0].targetUrl).toBe('/purpose/strength');
  });

  it('uses the cinematic timings (0.65s expand, 0.35s layer fade, 200ms hold, 400ms fade out)', () => {
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    expect(rec.timelines[0].timing).toEqual({
      expandSeconds: 0.65,
      layerFadeSeconds: 0.35,
      layerFadeStartSeconds: 0.15,
      postNavHoldMs: 200,
      coverFadeMs: 400,
    });
  });

  it('marks hasNavigated true after start', () => {
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    expect(c.hasNavigated()).toBe(true);
  });
});

describe('PillExpandController — start (reduced motion)', () => {
  it('collapses every duration to 0 / 50ms / 200ms', () => {
    const { deps, rec } = makeDeps();
    const c = new PillExpandController(deps);
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: true });
    expect(rec.timelines[0].timing).toEqual({
      expandSeconds: 0,
      layerFadeSeconds: 0,
      layerFadeStartSeconds: 0,
      postNavHoldMs: 50,
      coverFadeMs: 200,
    });
  });
});

describe('PillExpandController — idempotency', () => {
  it('second start is a no-op (no second cover, no second timeline)', () => {
    const { deps, rec } = makeDeps();
    const c = new PillExpandController(deps);
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    c.start({ pillRect: RECT, targetUrl: '/purpose/y', pillColor: '#fff', reducedMotion: false });
    expect(rec.coversCreated).toHaveLength(1);
    expect(rec.timelines).toHaveLength(1);
    expect(rec.timelines[0].targetUrl).toBe('/purpose/x');
  });

  it('refuses to start if hasExistingCover() returns true', () => {
    const { deps, rec } = makeDeps({ existingCover: true });
    const c = new PillExpandController(deps);
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    expect(rec.coversCreated).toHaveLength(0);
    expect(rec.timelines).toHaveLength(0);
  });
});

describe('PillExpandController — cleanup', () => {
  it('removes any cover and resets body overflow on cleanup', () => {
    const { deps, rec } = makeDeps();
    const c = new PillExpandController(deps);
    c.start({ pillRect: RECT, targetUrl: '/purpose/x', pillColor: '#000', reducedMotion: false });
    c.cleanup();
    expect(rec.coversRemoved).toBe(1);
    expect(rec.bodyOverflow).toEqual(['hidden', '']);
  });

  it('cleanup is safe to call when start was never called', () => {
    const { deps, rec } = makeDeps();
    const c = new PillExpandController(deps);
    c.cleanup();
    expect(rec.coversRemoved).toBe(1); // unconditionally tries; deps decide if there's anything
    expect(rec.bodyOverflow).toEqual(['']);
  });
});
