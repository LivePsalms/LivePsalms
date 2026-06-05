import { describe, it, expect } from 'vitest';
import { scrollToPurposeGrid } from './two-path-interlude-actions';
import type { ScrollToPurposeGridDeps } from './two-path-interlude-actions';

interface DepsRecord {
  findCalls: string[];
  scrollIntoViewCalls: Array<{ behavior?: ScrollBehavior; block?: ScrollLogicalPosition }>;
}

function makeDeps(targetExists: boolean): { deps: ScrollToPurposeGridDeps; rec: DepsRecord } {
  const rec: DepsRecord = { findCalls: [], scrollIntoViewCalls: [] };
  const fakeElement = {
    scrollIntoView: (opts: ScrollIntoViewOptions) => {
      rec.scrollIntoViewCalls.push({ behavior: opts.behavior, block: opts.block });
    },
  } as unknown as HTMLElement;
  const deps: ScrollToPurposeGridDeps = {
    findElementById: (id: string) => {
      rec.findCalls.push(id);
      return targetExists ? fakeElement : null;
    },
  };
  return { deps, rec };
}

describe('scrollToPurposeGrid', () => {
  it('looks up the #projects element', () => {
    const { deps, rec } = makeDeps(true);
    scrollToPurposeGrid(deps);
    expect(rec.findCalls).toEqual(['projects']);
  });

  it('scrolls smoothly to the top of the element when it exists', () => {
    const { deps, rec } = makeDeps(true);
    scrollToPurposeGrid(deps);
    expect(rec.scrollIntoViewCalls).toEqual([{ behavior: 'smooth', block: 'start' }]);
  });

  it('is a no-op when the target element is missing (no throw)', () => {
    const { deps, rec } = makeDeps(false);
    expect(() => scrollToPurposeGrid(deps)).not.toThrow();
    expect(rec.findCalls).toEqual(['projects']);
    expect(rec.scrollIntoViewCalls).toEqual([]);
  });
});
