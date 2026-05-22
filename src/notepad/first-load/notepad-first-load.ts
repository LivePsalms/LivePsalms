import type { User } from '@supabase/supabase-js';

export type FirstLoadAction =
  | { kind: 'redirect-welcome' }
  | { kind: 'greet'; firstName: string }
  | { kind: 'offer-migration' };

export interface FirstLoadInput {
  user: User | null;
  authLoading: boolean;
  profileLoading: boolean;
  hasBeenWelcomed: boolean;
  hasBeenGreetedToday: boolean;
  localNoteCount: number;
}

export function firstNameOf(user: User): string {
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (fullName) return fullName.split(/\s+/)[0];
  const email = user.email;
  if (email) return email.split('@')[0];
  return 'friend';
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const welcomedKey = (userId: string): string => `welcomed_${userId}`;

export const greetedKey = (userId: string, today: string): string =>
  `greeted_${userId}_${today}`;

export const hasBeenWelcomed = (userId: string, storage: StorageLike): boolean =>
  storage.getItem(welcomedKey(userId)) !== null;

export const markWelcomed = (userId: string, storage: StorageLike): void => {
  storage.setItem(welcomedKey(userId), 'true');
};

export const hasBeenGreetedToday = (
  userId: string,
  today: string,
  storage: StorageLike,
): boolean => storage.getItem(greetedKey(userId, today)) !== null;

export const markGreetedToday = (
  userId: string,
  today: string,
  storage: StorageLike,
): void => {
  storage.setItem(greetedKey(userId, today), 'true');
};

export const todayDateString = (now: Date): string => now.toDateString();

export function decideFirstLoadActions(input: FirstLoadInput): FirstLoadAction[] {
  const { user, authLoading, profileLoading, hasBeenWelcomed, hasBeenGreetedToday, localNoteCount } = input;
  if (authLoading || profileLoading || !user) return [];

  const actions: FirstLoadAction[] = [];
  if (!hasBeenWelcomed) {
    actions.push({ kind: 'redirect-welcome' });
  } else if (!hasBeenGreetedToday) {
    actions.push({ kind: 'greet', firstName: firstNameOf(user) });
  }
  if (localNoteCount > 0) {
    actions.push({ kind: 'offer-migration' });
  }
  return actions;
}
