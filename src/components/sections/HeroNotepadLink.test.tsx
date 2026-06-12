// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { heroNotepadLinkOpacity } from './HeroNotepadLink';

describe('heroNotepadLinkOpacity', () => {
  it('is 0 before the intro is revealed, regardless of progress', () => {
    expect(heroNotepadLinkOpacity(false, 0)).toBe(0);
    expect(heroNotepadLinkOpacity(false, 0.5)).toBe(0);
  });

  it('is fully visible in the calm opening frame (progress 0)', () => {
    expect(heroNotepadLinkOpacity(true, 0)).toBe(1);
  });

  it('stays fully visible until the fade window opens', () => {
    expect(heroNotepadLinkOpacity(true, 0.02)).toBe(1);
  });

  it('is fully faded out by the end of the early window', () => {
    expect(heroNotepadLinkOpacity(true, 0.12)).toBe(0);
  });

  it('clamps to 0 past the window (during collapse / manifesto)', () => {
    expect(heroNotepadLinkOpacity(true, 0.2)).toBe(0);
    expect(heroNotepadLinkOpacity(true, 1)).toBe(0);
  });

  it('interpolates linearly across the window midpoint', () => {
    expect(heroNotepadLinkOpacity(true, 0.07)).toBeCloseTo(0.5, 5);
  });
});
