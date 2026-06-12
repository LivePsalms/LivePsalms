// src/notepad/onboarding/onboarding-storage.test.ts
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_ANON_TOUR_DONE_KEY, ONBOARDING_ANON_CHECKLIST_KEY,
  readAnonTourDone, markAnonTourDone,
  readAnonProgress, writeAnonProgress, clearAnon,
} from './onboarding-storage';
import { defaultAnonProgress } from './onboarding-types';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('onboarding anon storage', () => {
  it('tour-done round-trips', () => {
    const s = fakeStorage();
    expect(readAnonTourDone(s)).toBe(false);
    markAnonTourDone(s);
    expect(s.data.get(ONBOARDING_ANON_TOUR_DONE_KEY)).toBe('1');
    expect(readAnonTourDone(s)).toBe(true);
  });

  it('checklist progress round-trips', () => {
    const s = fakeStorage();
    expect(readAnonProgress(s)).toBeNull();
    const p = { ...defaultAnonProgress(), items: { highlight: '2026-06-11T00:00:00Z' } };
    writeAnonProgress(s, p);
    expect(s.data.get(ONBOARDING_ANON_CHECKLIST_KEY)).toBeTypeOf('string');
    expect(readAnonProgress(s)).toEqual(p);
  });

  it('returns null on malformed JSON instead of throwing', () => {
    const s = fakeStorage();
    s.data.set(ONBOARDING_ANON_CHECKLIST_KEY, '{not json');
    expect(readAnonProgress(s)).toBeNull();
  });

  it('write failures are swallowed', () => {
    const s = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    expect(() => writeAnonProgress(s, defaultAnonProgress())).not.toThrow();
    expect(() => markAnonTourDone(s)).not.toThrow();
  });

  it('clearAnon removes both keys', () => {
    const s = fakeStorage();
    markAnonTourDone(s);
    writeAnonProgress(s, defaultAnonProgress());
    clearAnon(s);
    expect(s.data.has(ONBOARDING_ANON_TOUR_DONE_KEY)).toBe(false);
    expect(s.data.has(ONBOARDING_ANON_CHECKLIST_KEY)).toBe(false);
  });
});
