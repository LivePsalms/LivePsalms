// src/notepad/onboarding/onboarding-storage.ts
import type { AnonProgress } from './onboarding-types';

export const ONBOARDING_ANON_TOUR_DONE_KEY = 'onboarding_anon_tour_done';
export const ONBOARDING_ANON_CHECKLIST_KEY = 'onboarding_anon_checklist';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readAnonTourDone(storage: StorageLike): boolean {
  try {
    return storage.getItem(ONBOARDING_ANON_TOUR_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAnonTourDone(storage: StorageLike): void {
  try {
    storage.setItem(ONBOARDING_ANON_TOUR_DONE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function readAnonProgress(storage: StorageLike): AnonProgress | null {
  try {
    const raw = storage.getItem(ONBOARDING_ANON_CHECKLIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnonProgress;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return { items: parsed.items ?? {}, dismissed: Boolean(parsed.dismissed) };
  } catch {
    return null;
  }
}

export function writeAnonProgress(storage: StorageLike, progress: AnonProgress): void {
  try {
    storage.setItem(ONBOARDING_ANON_CHECKLIST_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function clearAnon(storage: StorageLike): void {
  try {
    storage.removeItem(ONBOARDING_ANON_TOUR_DONE_KEY);
    storage.removeItem(ONBOARDING_ANON_CHECKLIST_KEY);
  } catch {
    /* ignore */
  }
}
