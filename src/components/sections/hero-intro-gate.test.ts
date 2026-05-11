import { describe, it, expect } from 'vitest';
import {
  INTRO_FLAG_KEY,
  decideHeroIntro,
  persistIntroPlayed,
} from './hero-intro-gate';

interface FakeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  data: Map<string, string>;
}

function makeFakeStorage(initial?: Record<string, string>): FakeStorage {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('decideHeroIntro', () => {
  it('plays the intro when no flag and reduced-motion is not preferred', () => {
    const storage = makeFakeStorage();
    const result = decideHeroIntro({
      storage,
      prefersReducedMotion: false,
    });
    expect(result).toEqual({ playIntro: true, persistFlag: false });
  });

  it('skips the intro when the session flag is already set', () => {
    const storage = makeFakeStorage({ [INTRO_FLAG_KEY]: '1' });
    const result = decideHeroIntro({
      storage,
      prefersReducedMotion: false,
    });
    expect(result).toEqual({ playIntro: false, persistFlag: false });
  });

  it('skips the intro and asks caller to persist the flag when reduced-motion is preferred', () => {
    const storage = makeFakeStorage();
    const result = decideHeroIntro({
      storage,
      prefersReducedMotion: true,
    });
    expect(result).toEqual({ playIntro: false, persistFlag: true });
  });

  it('skips the intro when both flag is set and reduced-motion is preferred', () => {
    const storage = makeFakeStorage({ [INTRO_FLAG_KEY]: '1' });
    const result = decideHeroIntro({
      storage,
      prefersReducedMotion: true,
    });
    expect(result).toEqual({ playIntro: false, persistFlag: false });
  });

  it('uses sessionStorage key "psalms-intro-played"', () => {
    expect(INTRO_FLAG_KEY).toBe('psalms-intro-played');
  });
});

describe('persistIntroPlayed', () => {
  it('writes the intro flag to storage', () => {
    const storage = makeFakeStorage();
    persistIntroPlayed(storage);
    expect(storage.getItem(INTRO_FLAG_KEY)).toBe('1');
  });

  it('silently swallows errors from storage.setItem (Safari private-mode safety)', () => {
    const throwingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    // Should not throw.
    expect(() => persistIntroPlayed(throwingStorage)).not.toThrow();
  });
});
