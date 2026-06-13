import { describe, it, expect } from 'vitest';
import { buildNoteStats } from './note-stats';
import type { Reference } from './types';

const ref = (over: Partial<Reference> & { id: string; source: string; target: string }): Reference => ({
  id: over.id,
  source: over.source,
  target: over.target,
  type: over.type ?? 'explicit',
  weight: over.weight ?? 1,
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
});

describe('buildNoteStats', () => {
  it('returns zeros when there are no references', () => {
    expect(buildNoteStats('a', [])).toEqual({
      backlinkCount: 0,
      outgoingLinkCount: 0,
      verseCount: 0,
    });
  });

  it('counts inbound explicit references as backlinks', () => {
    const refs = [
      ref({ id: '1', source: 'b', target: 'a' }),
      ref({ id: '2', source: 'c', target: 'a' }),
    ];
    expect(buildNoteStats('a', refs).backlinkCount).toBe(2);
  });

  it('ignores non-explicit and other-target references when counting backlinks', () => {
    const refs = [
      ref({ id: '1', source: 'b', target: 'a', type: 'scripture-reference' }),
      ref({ id: '2', source: 'c', target: 'a', type: 'cross-reference' }),
      ref({ id: '3', source: 'd', target: 'z' }),
    ];
    expect(buildNoteStats('a', refs).backlinkCount).toBe(0);
  });

  it('counts outbound explicit references as outgoing links', () => {
    const refs = [
      ref({ id: '1', source: 'a', target: 'b' }),
      ref({ id: '2', source: 'a', target: 'c' }),
      ref({ id: '3', source: 'a', target: 'd', type: 'scripture-reference' }),
    ];
    expect(buildNoteStats('a', refs).outgoingLinkCount).toBe(2);
  });

  it('counts outbound scripture-reference rows as verses', () => {
    const refs = [
      ref({ id: '1', source: 'a', target: 's1', type: 'scripture-reference' }),
      ref({ id: '2', source: 'a', target: 's2', type: 'scripture-reference' }),
      ref({ id: '3', source: 'a', target: 'b' }),
      ref({ id: '4', source: 'a', target: 's3', type: 'cross-reference' }),
    ];
    expect(buildNoteStats('a', refs).verseCount).toBe(2);
  });

  it('excludes self-references from backlink and outgoing counts', () => {
    const refs = [ref({ id: '1', source: 'a', target: 'a' })];
    const stats = buildNoteStats('a', refs);
    expect(stats.backlinkCount).toBe(0);
    expect(stats.outgoingLinkCount).toBe(0);
  });

  it('ignores references unrelated to the note', () => {
    const refs = [
      ref({ id: '1', source: 'x', target: 'y' }),
      ref({ id: '2', source: 'y', target: 'z', type: 'scripture-reference' }),
    ];
    expect(buildNoteStats('a', refs)).toEqual({
      backlinkCount: 0,
      outgoingLinkCount: 0,
      verseCount: 0,
    });
  });
});
