// Curated word lists in the app's contemplative voice. All lowercase [a-z]+ and
// none collide with RESERVED_USERNAMES, so generated names always pass
// validateUsername (3-30 chars, [a-z0-9_], not reserved).
const ADJECTIVES = [
  'quiet', 'still', 'gentle', 'humble', 'patient', 'faithful', 'tender',
  'hidden', 'gracious', 'steady', 'kindly', 'radiant', 'mindful',
  'hopeful', 'rooted', 'calm', 'bright', 'soft', 'true',
] as const;

const NOUNS = [
  'psalm', 'water', 'lamp', 'dawn', 'harbor', 'meadow', 'cedar', 'river',
  'shepherd', 'pilgrim', 'garden', 'vineyard', 'mountain', 'valley', 'fountain',
  'lantern', 'ember', 'willow', 'haven', 'sparrow',
] as const;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Returns a readable random username like "quiet_psalm_4821".
 * Guaranteed to satisfy validateUsername.
 */
export function generateUsername(): string {
  const digits = Math.floor(1000 + Math.random() * 9000); // 1000-9999, always 4 digits
  return `${pick(ADJECTIVES)}_${pick(NOUNS)}_${digits}`;
}
