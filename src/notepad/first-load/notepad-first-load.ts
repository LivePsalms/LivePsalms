import type { User } from '@supabase/supabase-js';

export type FirstLoadAction =
  | { kind: 'redirect-welcome' }
  | { kind: 'welcome'; firstName: string | null }
  | { kind: 'offer-migration' };

export interface FirstLoadInput {
  user: User | null;
  authLoading: boolean;
  profileLoading: boolean;
  hasBeenWelcomed: boolean;
  hasBeenWelcomedOnce: boolean;
  localNoteCount: number;
}

export function firstNameOf(user: User): string | null {
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (fullName) return fullName.split(/\s+/)[0];
  const email = user.email;
  if (email) return email.split('@')[0];
  return null;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const welcomedOnceKey = (userId: string): string =>
  `welcomed_once_${userId}`;

export const hasBeenWelcomedOnce = (
  userId: string,
  storage: StorageLike,
): boolean => storage.getItem(welcomedOnceKey(userId)) !== null;

export const markWelcomedOnce = (
  userId: string,
  storage: StorageLike,
): void => {
  storage.setItem(welcomedOnceKey(userId), 'true');
};

export function decideFirstLoadActions(input: FirstLoadInput): FirstLoadAction[] {
  const { user, authLoading, profileLoading, hasBeenWelcomed, hasBeenWelcomedOnce, localNoteCount } = input;
  if (authLoading || profileLoading || !user) return [];

  const actions: FirstLoadAction[] = [];
  if (!hasBeenWelcomed) {
    actions.push({ kind: 'redirect-welcome' });
  } else if (!hasBeenWelcomedOnce) {
    actions.push({ kind: 'welcome', firstName: firstNameOf(user) });
  }
  if (localNoteCount > 0) {
    actions.push({ kind: 'offer-migration' });
  }
  return actions;
}
