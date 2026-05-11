export const INTRO_FLAG_KEY = 'psalms-intro-played';

export interface GateStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface GateInput {
  storage: GateStorage;
  prefersReducedMotion: boolean;
}

export interface GateDecision {
  playIntro: boolean;
  persistFlag: boolean;
}

export function decideHeroIntro({ storage, prefersReducedMotion }: GateInput): GateDecision {
  const flagAlreadySet = storage.getItem(INTRO_FLAG_KEY) === '1';

  if (flagAlreadySet) {
    return { playIntro: false, persistFlag: false };
  }

  if (prefersReducedMotion) {
    return { playIntro: false, persistFlag: true };
  }

  return { playIntro: true, persistFlag: false };
}

export function persistIntroPlayed(storage: GateStorage): void {
  try {
    storage.setItem(INTRO_FLAG_KEY, '1');
  } catch {
    // sessionStorage may throw QuotaExceededError in Safari private mode
    // or be unavailable in locked-down environments. We treat persistence
    // as best-effort — failing silently means the intro may replay on
    // the next visit within the session, which is an acceptable
    // degradation compared to a render crash.
  }
}
