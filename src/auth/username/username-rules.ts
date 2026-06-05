const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/** Usernames that collide with route segments or are otherwise off-limits. */
export const RESERVED_USERNAMES = new Set([
  'u',
  'notes',
  'note',
  'shared',
  'admin',
  'api',
  'settings',
  'account',
  'signin',
  'signup',
  'lamplight',
]);

export interface UsernameValidation {
  valid: boolean;
  reason?: string;
}

export type UsernameClaimResult =
  | { ok: true }
  | { ok: false; reason: 'taken' | 'invalid' };

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): UsernameValidation {
  const name = normalizeUsername(raw);
  if (name.length < 3) return { valid: false, reason: 'Must be at least 3 characters.' };
  if (name.length > 30) return { valid: false, reason: 'Must be 30 characters or fewer.' };
  if (!USERNAME_PATTERN.test(name)) {
    return { valid: false, reason: 'Use only lowercase letters, numbers, and underscores.' };
  }
  if (RESERVED_USERNAMES.has(name)) return { valid: false, reason: 'That username is reserved.' };
  return { valid: true };
}
